
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { verificarAdministrador } from "../../../../../../src/utils/adminAuth";

/* =========================================================
   PÁDUA CULTURE — PUBLICAÇÃO DE PRODUTOS

   PATCH /api/admin/produtos/:id/publicacao

   Permite:
   - Publicar um produto preparado.
   - Retornar um produto para rascunho.

   Acesso exclusivo para administradores.
   ========================================================= */

export const runtime = "nodejs";

type Contexto = {
  params: Promise<{ id: string }>;
};

export async function PATCH(
  request: NextRequest,
  { params }: Contexto
) {
  try {
    // Confirma que o usuário é administrador.
    const administrador = await verificarAdministrador();

    if (!administrador) {
      return NextResponse.json(
        { erro: "Acesso não autorizado." },
        { status: 403 }
      );
    }

    // Confere a origem da requisição.
    const origem = request.headers.get("origin");
    const origemEsperada = new URL(request.url).origin;

    if (!origem || origem !== origemEsperada) {
      return NextResponse.json(
        { erro: "Origem não autorizada." },
        { status: 403 }
      );
    }

    // Valida o identificador do produto.
    const { id } = await params;
    const produtoId = Number(id);

    if (
      !Number.isSafeInteger(produtoId) ||
      produtoId <= 0
    ) {
      return NextResponse.json(
        { erro: "ID de produto inválido." },
        { status: 400 }
      );
    }

    // Lê e valida o estado solicitado.
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
      Array.isArray(dados) ||
      typeof (dados as Record<string, unknown>).ativo !==
        "boolean"
    ) {
      return NextResponse.json(
        { erro: "Informe o campo ativo como booleano." },
        { status: 400 }
      );
    }

    const publicar = (
      dados as { ativo: boolean }
    ).ativo;

    // Busca o produto e os dados necessários.
    const produto = await prisma.produto.findUnique({
      where: { id: produtoId },
      include: {
        categoria: true,
        imagens: true,
        variantes: true,
      },
    });

    if (!produto) {
      return NextResponse.json(
        { erro: "Produto não encontrado." },
        { status: 404 }
      );
    }

    /* =====================================================
       REGRAS PARA PUBLICAÇÃO

       Retornar para rascunho não exige estas condições.
       ===================================================== */

    if (publicar) {
      if (!produto.categoria.ativa) {
        return NextResponse.json(
          { erro: "A categoria do produto está inativa." },
          { status: 400 }
        );
      }

      if (Number(produto.preco) <= 0) {
        return NextResponse.json(
          { erro: "O produto precisa ter preço válido." },
          { status: 400 }
        );
      }

      if (produto.imagens.length === 0) {
        return NextResponse.json(
          { erro: "Cadastre uma fotografia antes de publicar." },
          { status: 400 }
        );
      }

      const possuiEstoque = produto.variantes.some(
        (variante) =>
          variante.ativa && variante.quantidade > 0
      );

      if (!possuiEstoque) {
        return NextResponse.json(
          {
            erro:
              "Cadastre uma variante ativa com estoque antes de publicar.",
          },
          { status: 400 }
        );
      }
    }

    // Atualiza somente o status de publicação.
    const atualizado = await prisma.produto.update({
      where: { id: produtoId },
      data: { ativo: publicar },
      select: {
        id: true,
        nome: true,
        ativo: true,
      },
    });

    return NextResponse.json(
      {
        mensagem: publicar
          ? "Produto publicado com sucesso."
          : "Produto retornou para rascunho.",
        produto: atualizado,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[ADMIN PUBLICACAO PATCH]", error);

    return NextResponse.json(
      { erro: "Não foi possível alterar a publicação." },
      { status: 500 }
    );
  }
}
