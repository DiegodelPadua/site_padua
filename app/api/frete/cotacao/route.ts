
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "../../../../lib/prisma";

import {
  cotarFreteMelhorEnvio,
} from "../../../../src/services/melhorEnvioService";

import {
  capacidadePorCategoria,
  montarVolumesFrete,
  EmbalagemFreteError,
  type UnidadeEmbalagem,
} from "../../../../src/services/embalagemFreteService";

/* =========================================================
   PÁDUA CULTURE - API DE COTAÇÃO DE FRETE
   =========================================================
   POST /api/frete/cotacao

   O banco é a fonte oficial de preços, pesos e estoque.

   As embalagens são calculadas por um serviço
   compartilhado com o módulo de pedidos.

   Esta rota não compra etiquetas.
   ========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   TIPOS E FUNÇÕES AUXILIARES
   ========================================================= */

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

/* =========================================================
   POST - CALCULAR FRETE
   ========================================================= */

export async function POST(request: NextRequest) {
  try {
    /* =====================================================
       1. RECEBER JSON
       ===================================================== */

    let corpo: unknown;

    try {
      corpo = await request.json();
    } catch {
      return NextResponse.json(
        { erro: "JSON inválido." },
        { status: 400 }
      );
    }

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

    /* =====================================================
       2. VALIDAR CEP
       ===================================================== */

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

    /* =====================================================
       3. VALIDAR ITENS DA SACOLA
       ===================================================== */

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

      const { variantId, quantity } =
        item as Record<string, unknown>;

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

    const itens: ItemEntrada[] = Array.from(
      quantidades,
      ([variantId, quantity]) => ({
        variantId,
        quantity,
      })
    );

    /* =====================================================
       4. CONSULTAR VARIANTES NO BANCO
       ===================================================== */

    const variantes = await prisma.varianteProduto.findMany({
      where: {
        id: {
          in: itens.map((item) => item.variantId),
        },
        ativa: true,
        produto: {
          ativo: true,
          categoria: {
            ativa: true,
          },
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
            categoria: {
              select: {
                slug: true,
              },
            },
          },
        },
      },
    });

    if (variantes.length !== itens.length) {
      return NextResponse.json(
        { erro: "Um ou mais produtos não estão disponíveis." },
        { status: 400 }
      );
    }

    const porId = new Map(
      variantes.map((variante) => [
        variante.id,
        variante,
      ])
    );

    /* =====================================================
       5. VALIDAR ESTOQUE, PESO E PREÇO
       ===================================================== */

    const unidades: UnidadeEmbalagem[] = [];

    for (const item of itens) {
      const variante = porId.get(item.variantId);

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

      const valor = Number(
        variante.produto.precoPromocional ??
        variante.produto.preco
      );

      if (!Number.isFinite(valor) || valor <= 0) {
        return NextResponse.json(
          { erro: "Preço de produto inválido." },
          { status: 422 }
        );
      }

      const categoria =
        variante.produto.categoria.slug
          .toLowerCase()
          .trim();

      if (capacidadePorCategoria(categoria) === null) {
        return NextResponse.json(
          {
            erro: `A embalagem do produto ${variante.produto.nome} ainda precisa ser configurada.`,
          },
          { status: 422 }
        );
      }

      // Cada peça é representada por uma unidade física.
      for (let i = 0; i < item.quantity; i++) {
        unidades.push({
          pesoGramas: peso,
          valor,
          categoria,
        });
      }
    }

    /* =====================================================
       6. MONTAR EMBALAGENS
       =====================================================
       Reutiliza o serviço compartilhado.
       ===================================================== */

    let resultadoEmbalagem;

    try {
      resultadoEmbalagem = montarVolumesFrete(unidades);
    } catch (error) {
      if (error instanceof EmbalagemFreteError) {
        return NextResponse.json(
          { erro: error.message },
          { status: 422 }
        );
      }

      throw error;
    }

    /* =====================================================
       7. CONSULTAR MELHOR ENVIO
       ===================================================== */

    const opcoes = await cotarFreteMelhorEnvio({
      cepDestino,
      volumes: resultadoEmbalagem.volumes,
      valorSegurado: resultadoEmbalagem.valorSegurado,
    });

    /* =====================================================
       8. RETORNAR COTAÇÃO
       =====================================================
       Preserva o contrato atual da API:
       { opcoes, embalagem }
       ===================================================== */

    return NextResponse.json(
      {
        opcoes,
        embalagem: resultadoEmbalagem.embalagem,
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
      { erro: "Não foi possível calcular o frete agora." },
      { status: 500 }
    );
  }
}
