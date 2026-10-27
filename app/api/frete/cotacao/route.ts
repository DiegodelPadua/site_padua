
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import {
  cotarFreteMelhorEnvio,
} from "../../../../src/services/melhorEnvioService";

/**
 * PÁDUA CULTURE — API DE COTAÇÃO DE FRETE
 *
 * POST /api/frete/cotacao
 *
 * Consulta os dados reais das variantes no MySQL.
 * Não confia em preços, pesos ou estoque do navegador.
 * Não cria pedidos nem compra etiquetas.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Embalagem provisória definida para a loja.
const EMBALAGEM = {
  width: 25,
  height: 5,
  length: 30,
  pesoGramas: 200,
};

type ItemEntrada = {
  variantId: number;
  quantity: number;
};

function inteiroPositivo(valor: unknown): valor is number {
  return (
    typeof valor === "number" &&
    Number.isSafeInteger(valor) &&
    valor > 0
  );
}

export async function POST(request: NextRequest) {
  try {
    const corpo: unknown = await request.json();

    // Valida o formato da requisição.
    if (
      !corpo ||
      typeof corpo !== "object" ||
      Array.isArray(corpo)
    ) {
      return NextResponse.json(
        { erro: "Dados da cotação inválidos." },
        { status: 400 }
      );
    }

    const entrada = corpo as Record<string, unknown>;

    const cepDestino =
      typeof entrada.cepDestino === "string"
        ? entrada.cepDestino.replace(/\D/g, "")
        : "";

    if (!/^\d{8}$/.test(cepDestino)) {
      return NextResponse.json(
        { erro: "Informe um CEP válido." },
        { status: 400 }
      );
    }

    if (
      !Array.isArray(entrada.itens) ||
      entrada.itens.length === 0 ||
      entrada.itens.length > 30
    ) {
      return NextResponse.json(
        { erro: "A sacola está vazia ou inválida." },
        { status: 400 }
      );
    }

    const itens: ItemEntrada[] = [];

    // Agrupa variantes repetidas e valida as quantidades.
    const quantidades = new Map<number, number>();

    for (const item of entrada.itens) {
      if (
        !item ||
        typeof item !== "object" ||
        Array.isArray(item)
      ) {
        return NextResponse.json(
          { erro: "Item inválido na sacola." },
          { status: 400 }
        );
      }

      const { variantId, quantity } = item as Record<
        string,
        unknown
      >;

      if (
        !inteiroPositivo(variantId) ||
        !inteiroPositivo(quantity) ||
        quantity > 100
      ) {
        return NextResponse.json(
          { erro: "Variante ou quantidade inválida." },
          { status: 400 }
        );
      }

      const total =
        (quantidades.get(variantId) ?? 0) + quantity;

      if (total > 100) {
        return NextResponse.json(
          { erro: "Quantidade inválida para cotação." },
          { status: 400 }
        );
      }

      quantidades.set(variantId, total);
    }

    for (const [variantId, quantity] of quantidades) {
      itens.push({ variantId, quantity });
    }

    // Busca as variantes reais no banco de dados.
    const variantes = await prisma.varianteProduto.findMany({
      where: {
        id: { in: itens.map((item) => item.variantId) },
        ativa: true,
        produto: {
          ativo: true,
          categoria: { ativa: true },
        },
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
          },
        },
      },
    });

    if (variantes.length !== itens.length) {
      return NextResponse.json(
        {
          erro: "Um ou mais produtos não estão disponíveis.",
        },
        { status: 400 }
      );
    }

    let pesoProdutosGramas = 0;
    let valorSegurado = 0;
    let totalUnidades = 0;

    for (const item of itens) {
      const variante = variantes.find(
        (registro) => registro.id === item.variantId
      );

      if (!variante) {
        return NextResponse.json(
          { erro: "Variante não encontrada." },
          { status: 400 }
        );
      }

      if (item.quantity > variante.quantidade) {
        return NextResponse.json(
          {
            erro: `Estoque insuficiente para ${variante.produto.nome}.`,
          },
          { status: 400 }
        );
      }

      const peso = variante.produto.pesoGramas;

      if (
        peso === null ||
        !Number.isSafeInteger(peso) ||
        peso <= 0
      ) {
        return NextResponse.json(
          {
            erro: `O produto ${variante.produto.nome} ainda não possui peso cadastrado.`,
          },
          { status: 422 }
        );
      }

      const preco = Number(
        variante.produto.precoPromocional ??
          variante.produto.preco
      );

      if (!Number.isFinite(preco) || preco <= 0) {
        return NextResponse.json(
          { erro: "Preço de produto inválido." },
          { status: 422 }
        );
      }

      pesoProdutosGramas += peso * item.quantity;
      valorSegurado += preco * item.quantity;
      totalUnidades += item.quantity;
    }

    /**
     * Restrição temporária de segurança:
     *
     * Ainda não cadastramos as dimensões individuais
     * dos produtos nem a capacidade real da caixa.
     *
     * Por enquanto, cotamos somente uma unidade.
     * Isso evita apresentar fretes de uma caixa que
     * pode não comportar o pedido.
     */
    if (totalUnidades !== 1) {
      return NextResponse.json(
        {
          erro:
            "A cotação automática para múltiplas unidades ainda está em configuração.",
        },
        { status: 422 }
      );
    }

    // Soma o peso da mercadoria e da embalagem.
    const pesoTotalKg =
      (pesoProdutosGramas + EMBALAGEM.pesoGramas) / 1000;

    const opcoes = await cotarFreteMelhorEnvio({
      cepDestino,
      valorSegurado: Math.round(valorSegurado * 100) / 100,
      volumes: [
        {
          width: EMBALAGEM.width,
          height: EMBALAGEM.height,
          length: EMBALAGEM.length,
          weight: pesoTotalKg,
        },
      ],
    });

    return NextResponse.json(
      {
        opcoes,
        embalagem: {
          comprimentoCm: EMBALAGEM.length,
          larguraCm: EMBALAGEM.width,
          alturaCm: EMBALAGEM.height,
          pesoTotalKg,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("[API FRETE]", error);

    return NextResponse.json(
      {
        erro: "Não foi possível calcular o frete agora.",
      },
      { status: 500 }
    );
  }
}
