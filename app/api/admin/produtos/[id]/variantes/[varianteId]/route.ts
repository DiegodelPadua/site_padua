
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../../lib/prisma";
import { verificarAdministrador } from "../../../../../../../src/utils/adminAuth";

/* =========================================================
   PÁDUA CULTURE — EDIÇÃO DE VARIANTES

   PATCH:
   - Edita tamanho, cor, SKU e status.
   - Atualiza o saldo de estoque.
   - Registra entradas e saídas no histórico.
   - Impede estoque negativo.
   - Protege a operação com autenticação ADMIN.
   ========================================================= */

type Contexto = {
  params: Promise<{
    id: string;
    varianteId: string;
  }>;
};

// Domínios autorizados a realizar alterações administrativas.
const origensPermitidas = new Set([
  "https://paduaculture.com.br",
  "https://www.paduaculture.com.br",
]);

export async function PATCH(
  request: NextRequest,
  contexto: Contexto
) {
  try {
    // 1. Autenticação administrativa.
    const administrador = await verificarAdministrador();

    if (!administrador) {
      return NextResponse.json(
        { erro: "Acesso não autorizado." },
        { status: 403 }
      );
    }

    // 2. Proteção contra requisições de outras origens.
    const origem = request.headers.get("origin");

    if (!origem || !origensPermitidas.has(origem)) {
      return NextResponse.json(
        { erro: "Origem não autorizada." },
        { status: 403 }
      );
    }

    // 3. Validação dos identificadores.
    const { id, varianteId } = await contexto.params;

    const produtoId = Number(id);
    const idVariante = Number(varianteId);

    if (
      !Number.isSafeInteger(produtoId) ||
      produtoId <= 0 ||
      !Number.isSafeInteger(idVariante) ||
      idVariante <= 0
    ) {
      return NextResponse.json(
        { erro: "Identificador inválido." },
        { status: 400 }
      );
    }

    // 4. Leitura segura do JSON.
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

    // 5. Validação dos campos.
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

    if (
      typeof entrada.quantidade !== "number" ||
      !Number.isSafeInteger(entrada.quantidade) ||
      entrada.quantidade < 0 ||
      entrada.quantidade > 2147483647
    ) {
      return NextResponse.json(
        { erro: "Quantidade de estoque inválida." },
        { status: 400 }
      );
    }

    if (
      typeof entrada.ativa !== "boolean"
    ) {
      return NextResponse.json(
        { erro: "Status da variante inválido." },
        { status: 400 }
      );
    }

    if (
      entrada.sku !== null &&
      entrada.sku !== undefined &&
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

    const novaQuantidade = entrada.quantidade;
    const ativa = entrada.ativa;

    // 6. Confere a existência da variante.
    const varianteAtual = await prisma.varianteProduto.findFirst({
      where: {
        id: idVariante,
        produtoId,
      },
    });

    if (!varianteAtual) {
      return NextResponse.json(
        { erro: "Variante não encontrada." },
        { status: 404 }
      );
    }

    // 7. Evita duplicar tamanho e cor no mesmo produto.
    const combinacaoExistente =
      await prisma.varianteProduto.findUnique({
        where: {
          produtoId_tamanho_cor: {
            produtoId,
            tamanho,
            cor,
          },
        },
      });

    if (
      combinacaoExistente &&
      combinacaoExistente.id !== idVariante
    ) {
      return NextResponse.json(
        {
          erro:
            "Essa combinação de tamanho e cor já está cadastrada.",
        },
        { status: 409 }
      );
    }

    // 8. Evita reutilizar um SKU de outra variante.
    if (sku) {
      const skuExistente =
        await prisma.varianteProduto.findUnique({
          where: { sku },
        });

      if (
        skuExistente &&
        skuExistente.id !== idVariante
      ) {
        return NextResponse.json(
          { erro: "Esse SKU já está cadastrado." },
          { status: 409 }
        );
      }
    }

    /* =====================================================
       9. ATUALIZAÇÃO TRANSACIONAL

       Atualiza a variante e registra a movimentação
       na mesma transação.

       O updateMany condicional impede sobrescrever
       silenciosamente uma alteração concorrente de estoque.
       ===================================================== */

    const resultado = await prisma.$transaction(
      async (tx) => {
        const saldoAnterior = varianteAtual.quantidade;
        const diferenca = novaQuantidade - saldoAnterior;

        // Atualização condicional pelo saldo consultado.
        const atualizacao = await tx.varianteProduto.updateMany({
          where: {
            id: idVariante,
            produtoId,
            quantidade: saldoAnterior,
          },
          data: {
            tamanho,
            cor,
            sku,
            quantidade: novaQuantidade,
            ativa,
          },
        });

        if (atualizacao.count !== 1) {
          return null;
        }

        // Só registra movimentação se o saldo mudar.
        if (diferenca !== 0) {
          await tx.movimentacaoEstoque.create({
            data: {
              varianteId: idVariante,
              tipo: diferenca > 0 ? "ENTRADA" : "SAIDA",
              quantidade: Math.abs(diferenca),
              saldoAnterior,
              saldoPosterior: novaQuantidade,
              motivo: "Ajuste manual pelo painel administrativo",
            },
          });
        }

        return tx.varianteProduto.findUnique({
          where: { id: idVariante },
        });
      }
    );

    if (!resultado) {
      return NextResponse.json(
        {
          erro:
            "O estoque foi alterado por outra operação. " +
            "Atualize a página antes de tentar novamente.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      mensagem: "Variante atualizada com sucesso!",
      variante: resultado,
    });
  } catch (error) {
    console.error("[ADMIN VARIANTES PATCH]", error);

    // Conflito com restrições únicas do MySQL.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          erro:
            "Já existe uma variante com essa combinação ou SKU.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { erro: "Não foi possível atualizar a variante." },
      { status: 500 }
    );
  }
}
