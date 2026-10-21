
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { verificarAdministrador } from "../../../../../../src/utils/adminAuth";

// Identifica o produto pela URL.
type Contexto = {
  params: Promise<{ id: string }>;
};

// Converte o identificador para um inteiro válido.
async function obterProdutoId(contexto: Contexto) {
  const { id } = await contexto.params;
  const numero = Number(id);

  if (!Number.isSafeInteger(numero) || numero <= 0) {
    return null;
  }

  return numero;
}

// GET: consulta as variantes de um produto.
export async function GET(
  _request: NextRequest,
  contexto: Contexto
) {
  try {
    const administrador = await verificarAdministrador();

    if (!administrador) {
      return NextResponse.json(
        { erro: "Acesso não autorizado." },
        { status: 403 }
      );
    }

    const produtoId = await obterProdutoId(contexto);

    if (!produtoId) {
      return NextResponse.json(
        { erro: "ID do produto inválido." },
        { status: 400 }
      );
    }

    const produto = await prisma.produto.findUnique({
      where: { id: produtoId },
      select: { id: true, nome: true },
    });

    if (!produto) {
      return NextResponse.json(
        { erro: "Produto não encontrado." },
        { status: 404 }
      );
    }

    const variantes = await prisma.varianteProduto.findMany({
      where: { produtoId },
      orderBy: [{ tamanho: "asc" }, { cor: "asc" }],
    });

    return NextResponse.json({ produto, variantes });
  } catch (error) {
    console.error("[ADMIN VARIANTES GET]", error);

    return NextResponse.json(
      { erro: "Não foi possível consultar as variantes." },
      { status: 500 }
    );
  }
}

// POST: cadastra uma nova combinação de tamanho e cor.
export async function POST(
  request: NextRequest,
  contexto: Contexto
) {
  try {
    const administrador = await verificarAdministrador();

    if (!administrador) {
      return NextResponse.json(
        { erro: "Acesso não autorizado." },
        { status: 403 }
      );
    }

    // Permite somente os domínios públicos da Pádua Culture.
    // Evita falhas quando a Hostinger encaminha requisições
    // por meio de um proxy reverso.

    const origensPermitidas = new Set([
      "https://paduaculture.com.br",
      "https://www.paduaculture.com.br",
    ]);

    const origem = request.headers.get("origin");

    if (!origem || !origensPermitidas.has(origem)) {
      return NextResponse.json(
        { erro: "Origem não autorizada." },
        { status: 403 }
      );
    }

    const produtoId = await obterProdutoId(contexto);

    if (!produtoId) {
      return NextResponse.json(
        { erro: "ID do produto inválido." },
        { status: 400 }
      );
    }

    // Confirma a existência do produto.
    const produto = await prisma.produto.findUnique({
      where: { id: produtoId },
      select: { id: true },
    });

    if (!produto) {
      return NextResponse.json(
        { erro: "Produto não encontrado." },
        { status: 404 }
      );
    }

    let dados: unknown;

    try {
      dados = await request.json();
    } catch {
      return NextResponse.json(
        { erro: "JSON inválido." },
        { status: 400 }
      );
    }

    if (
      !dados ||
      typeof dados !== "object" ||
      Array.isArray(dados)
    ) {
      return NextResponse.json(
        { erro: "Dados inválidos." },
        { status: 400 }
      );
    }

    const entrada = dados as Record<string, unknown>;

    // Valida tamanho e cor.
    if (
      typeof entrada.tamanho !== "string" ||
      !entrada.tamanho.trim() ||
      entrada.tamanho.trim().length > 30
    ) {
      return NextResponse.json(
        { erro: "Tamanho inválido." },
        { status: 400 }
      );
    }

    if (
      typeof entrada.cor !== "string" ||
      !entrada.cor.trim() ||
      entrada.cor.trim().length > 60
    ) {
      return NextResponse.json(
        { erro: "Cor inválida." },
        { status: 400 }
      );
    }

    // O estoque não pode ser negativo.
    if (
      typeof entrada.quantidade !== "number" ||
      !Number.isSafeInteger(entrada.quantidade) ||
      entrada.quantidade < 0
    ) {
      return NextResponse.json(
        { erro: "Informe uma quantidade válida." },
        { status: 400 }
      );
    }

    // O SKU é opcional, mas deve respeitar o tamanho do banco.
    if (
      entrada.sku !== undefined &&
      entrada.sku !== null &&
      typeof entrada.sku !== "string"
    ) {
      return NextResponse.json(
        { erro: "SKU inválido." },
        { status: 400 }
      );
    }

    const tamanho = entrada.tamanho.trim();
    const cor = entrada.cor.trim();
    const sku =
      typeof entrada.sku === "string"
        ? entrada.sku.trim() || null
        : null;

    if (sku && sku.length > 100) {
      return NextResponse.json(
        { erro: "SKU deve ter até 100 caracteres." },
        { status: 400 }
      );
    }

    // Verifica duplicidade de tamanho e cor.
    const existente = await prisma.varianteProduto.findUnique({
      where: {
        produtoId_tamanho_cor: {
          produtoId,
          tamanho,
          cor,
        },
      },
    });

    if (existente) {
      return NextResponse.json(
        { erro: "Essa combinação de tamanho e cor já existe." },
        { status: 409 }
      );
    }

    // Confere se o SKU já está cadastrado em outro produto.
    if (sku) {
      const skuExistente = await prisma.varianteProduto.findUnique({
        where: { sku },
      });

      if (skuExistente) {
        return NextResponse.json(
          { erro: "Esse SKU já está cadastrado." },
          { status: 409 }
        );
      }
    }

    // Cria a variante e registra o estoque inicial
    // na mesma transação, preservando o histórico.
    const variante = await prisma.$transaction(async (tx) => {
      const novaVariante = await tx.varianteProduto.create({
        data: {
          produtoId,
          tamanho,
          cor,
          sku,
          quantidade: entrada.quantidade as number,
          ativa: true,
        },
      });

      if (novaVariante.quantidade > 0) {
        await tx.movimentacaoEstoque.create({
          data: {
            varianteId: novaVariante.id,
            tipo: "ENTRADA",
            quantidade: novaVariante.quantidade,
            saldoAnterior: 0,
            saldoPosterior: novaVariante.quantidade,
            motivo: "Estoque inicial da variante",
          },
        });
      }

      return novaVariante;
    });

    return NextResponse.json(
      {
        mensagem: "Variante cadastrada com sucesso.",
        variante,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[ADMIN VARIANTES POST]", error);

    return NextResponse.json(
      { erro: "Não foi possível cadastrar a variante." },
      { status: 500 }
    );
  }
}
