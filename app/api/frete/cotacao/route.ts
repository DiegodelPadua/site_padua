import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { cotarFreteMelhorEnvio } from "../../../../src/services/melhorEnvioService";

/**
 * PÁDUA CULTURE — POST /api/frete/cotacao
 * O banco de dados é a fonte de verdade para estoque, preço e peso.
 * Cada volume representa uma embalagem física; não compra etiquetas.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMBALAGEM = {
  width: 25,
  height: 5,
  length: 30,
  pesoGramas: 200,
} as const;

const MAX_EMBALAGENS = 20;

type ItemEntrada = { variantId: number; quantity: number };
type Unidade = { pesoGramas: number; valor: number; categoria: string };
type Caixa = { unidades: Unidade[]; capacidade: number; categoria: string };

function inteiroPositivo(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isSafeInteger(valor) && valor > 0;
}

function capacidadePorCategoria(slug: string): number | null {
  // Upcycling e categorias sem configuração exigem embalagem própria.
  const normalizado = slug.toLowerCase().trim();
  if (normalizado === "camisetas") return 2;
  if (["calcas", "bonés", "bones", "shorts"].includes(normalizado)) return 1;
  return null;
}

export async function POST(request: NextRequest) {
  try {
    let corpo: unknown;
    try {
      corpo = await request.json();
    } catch {
      return NextResponse.json({ erro: "JSON inválido." }, { status: 400 });
    }

    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
      return NextResponse.json({ erro: "Dados da cotação inválidos." }, { status: 400 });
    }

    const entrada = corpo as Record<string, unknown>;
    const cepDestino = typeof entrada.cepDestino === "string"
      ? entrada.cepDestino.replace(/\D/g, "")
      : "";

    if (!/^\d{8}$/.test(cepDestino)) {
      return NextResponse.json({ erro: "Informe um CEP válido." }, { status: 400 });
    }

    if (!Array.isArray(entrada.itens) || entrada.itens.length === 0 || entrada.itens.length > 30) {
      return NextResponse.json({ erro: "A sacola está vazia ou inválida." }, { status: 400 });
    }

    const quantidades = new Map<number, number>();
    for (const item of entrada.itens) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return NextResponse.json({ erro: "Item inválido na sacola." }, { status: 400 });
      }
      const { variantId, quantity } = item as Record<string, unknown>;
      if (!inteiroPositivo(variantId) || !inteiroPositivo(quantity) || quantity > 100) {
        return NextResponse.json({ erro: "Variante ou quantidade inválida." }, { status: 400 });
      }
      const total = (quantidades.get(variantId) ?? 0) + quantity;
      if (total > 100) {
        return NextResponse.json({ erro: "Quantidade inválida para cotação." }, { status: 400 });
      }
      quantidades.set(variantId, total);
    }

    const itens: ItemEntrada[] = Array.from(quantidades, ([variantId, quantity]) => ({ variantId, quantity }));
    const variantes = await prisma.varianteProduto.findMany({
      where: {
        id: { in: itens.map((item) => item.variantId) },
        ativa: true,
        produto: { ativo: true, categoria: { ativa: true } },
      },
      select: {
        id: true,
        quantidade: true,
        produto: {
          select: {
            nome: true,
            pesoGramas: true,
            preco: true,
            precoPromocional: true,
            categoria: { select: { slug: true } },
          },
        },
      },
    });

    if (variantes.length !== itens.length) {
      return NextResponse.json({ erro: "Um ou mais produtos não estão disponíveis." }, { status: 400 });
    }

    const porId = new Map(variantes.map((variante) => [variante.id, variante]));
    const unidades: Unidade[] = [];

    for (const item of itens) {
      const variante = porId.get(item.variantId);
      if (!variante) {
        return NextResponse.json({ erro: "Variante não encontrada." }, { status: 400 });
      }
      if (item.quantity > variante.quantidade) {
        return NextResponse.json({ erro: `Estoque insuficiente para ${variante.produto.nome}.` }, { status: 400 });
      }
      const peso = variante.produto.pesoGramas;
      if (peso === null || !Number.isSafeInteger(peso) || peso <= 0) {
        return NextResponse.json({ erro: `O produto ${variante.produto.nome} ainda não possui peso cadastrado.` }, { status: 422 });
      }
      const valor = Number(variante.produto.precoPromocional ?? variante.produto.preco);
      if (!Number.isFinite(valor) || valor <= 0) {
        return NextResponse.json({ erro: "Preço de produto inválido." }, { status: 422 });
      }
      const categoria = variante.produto.categoria.slug.toLowerCase().trim();
      if (capacidadePorCategoria(categoria) === null) {
        return NextResponse.json({ erro: `A embalagem do produto ${variante.produto.nome} ainda precisa ser configurada.` }, { status: 422 });
      }
      for (let i = 0; i < item.quantity; i++) unidades.push({ pesoGramas: peso, valor, categoria });
    }

    // Não misturamos categorias na mesma embalagem. Para camisetas,
    // agrupamos pares; para as demais categorias, uma unidade por caixa.
    const caixas: Caixa[] = [];
    for (const unidade of unidades) {
      const capacidade = capacidadePorCategoria(unidade.categoria)!;
      let caixa = caixas.find(
        (atual) => atual.categoria === unidade.categoria && atual.unidades.length < atual.capacidade
      );
      if (!caixa) {
        caixa = { unidades: [], capacidade, categoria: unidade.categoria };
        caixas.push(caixa);
      }
      caixa.unidades.push(unidade);
      if (caixas.length > MAX_EMBALAGENS) {
        return NextResponse.json({ erro: "O pedido excede o limite de embalagens para cotação automática." }, { status: 422 });
      }
    }

    // O Melhor Envio recebe um volume por caixa. O serviço pode não oferecer
    // modalidades para remessas multivolume; nesse caso, não inventamos frete.
    const volumes = caixas.map((caixa) => ({
      width: EMBALAGEM.width,
      height: EMBALAGEM.height,
      length: EMBALAGEM.length,
      weight: (caixa.unidades.reduce((soma, unidade) => soma + unidade.pesoGramas, 0) + EMBALAGEM.pesoGramas) / 1000,
    }));

    const valorSegurado = Math.round(
      unidades.reduce((soma, unidade) => soma + unidade.valor, 0) * 100
    ) / 100;

    const opcoes = await cotarFreteMelhorEnvio({ cepDestino, valorSegurado, volumes });

    // Apenas informações públicas para o checkout. A separação detalhada das
    // caixas será integrada à área administrativa quando os pedidos forem criados.
    return NextResponse.json(
      { opcoes, embalagem: {
        comprimentoCm: EMBALAGEM.length,
        larguraCm: EMBALAGEM.width,
        alturaCm: EMBALAGEM.height,
        pesoTotalKg: volumes.reduce((soma, volume) => soma + volume.weight, 0),
      } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[API FRETE]", error);
    return NextResponse.json({ erro: "Não foi possível calcular o frete agora." }, { status: 500 });
  }
}
