
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { verificarAdministrador } from "../../../../../src/utils/adminAuth";

/* =========================================================
   PÁDUA CULTURE — EDIÇÃO DE PRODUTOS

   PATCH /api/admin/produtos/:id

   Permite atualizar:
   - Nome
   - Descrição
   - Preço
   - Categoria
   - Peso em gramas

   Não modifica variantes, imagens ou publicação.
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
    /* =====================================================
       1. VERIFICAR AUTENTICAÇÃO ADMINISTRATIVA
       ===================================================== */

    const administrador = await verificarAdministrador();

    if (!administrador) {
      return NextResponse.json(
        { erro: "Acesso não autorizado." },
        { status: 403 }
      );
    }

    /* =====================================================
       2. VALIDAR ORIGEM DA REQUISIÇÃO
       ===================================================== */

    const origem = request.headers.get("origin");

    const origensPermitidas = new Set([
      "https://paduaculture.com.br",
      "https://www.paduaculture.com.br",
    ]);

    if (!origem || !origensPermitidas.has(origem)) {
      return NextResponse.json(
        { erro: "Origem não autorizada." },
        { status: 403 }
      );
    }

    /* =====================================================
       3. VALIDAR ID DO PRODUTO
       ===================================================== */

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

    /* =====================================================
       4. LER JSON DA REQUISIÇÃO
       ===================================================== */

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
        { erro: "Dados do produto inválidos." },
        { status: 400 }
      );
    }

    const entrada = dados as Record<string, unknown>;

    /* =====================================================
       5. VALIDAR NOME
       ===================================================== */

    if (
      typeof entrada.nome !== "string" ||
      !entrada.nome.trim() ||
      entrada.nome.trim().length > 150
    ) {
      return NextResponse.json(
        { erro: "Informe um nome válido de até 150 caracteres." },
        { status: 400 }
      );
    }

    const nome = entrada.nome.trim();

    /* =====================================================
       6. VALIDAR DESCRIÇÃO
       ===================================================== */

    if (
      entrada.descricao !== null &&
      entrada.descricao !== undefined &&
      typeof entrada.descricao !== "string"
    ) {
      return NextResponse.json(
        { erro: "Descrição inválida." },
        { status: 400 }
      );
    }

    const descricao =
      typeof entrada.descricao === "string"
        ? entrada.descricao.trim() || null
        : null;

    if (descricao && descricao.length > 10000) {
      return NextResponse.json(
        { erro: "A descrição deve ter até 10000 caracteres." },
        { status: 400 }
      );
    }

    /* =====================================================
       7. VALIDAR PREÇO
       ===================================================== */

    if (
      typeof entrada.preco !== "string" ||
      !/^\d{1,8}\.\d{2}$/.test(entrada.preco)
    ) {
      return NextResponse.json(
        { erro: "Informe o preço no formato 149.90." },
        { status: 400 }
      );
    }

    const precoCentavos = Number(
      entrada.preco.replace(".", "")
    );

    if (
      !Number.isSafeInteger(precoCentavos) ||
      precoCentavos <= 0
    ) {
      return NextResponse.json(
        { erro: "O preço deve ser maior que zero." },
        { status: 400 }
      );
    }

    /* =====================================================
       8. VALIDAR PESO
       ===================================================== */

    if (
      typeof entrada.pesoGramas !== "number" ||
      !Number.isSafeInteger(entrada.pesoGramas) ||
      entrada.pesoGramas < 1 ||
      entrada.pesoGramas > 100000
    ) {
      return NextResponse.json(
        { erro: "Informe um peso entre 1 e 100000 gramas." },
        { status: 400 }
      );
    }

    /* =====================================================
       9. VALIDAR CATEGORIA
       ===================================================== */

    if (
      typeof entrada.categoriaId !== "number" ||
      !Number.isSafeInteger(entrada.categoriaId) ||
      entrada.categoriaId <= 0
    ) {
      return NextResponse.json(
        { erro: "Selecione uma categoria válida." },
        { status: 400 }
      );
    }

    /* =====================================================
       10. CONSULTAR PRODUTO EXISTENTE
       ===================================================== */

    const produtoExistente = await prisma.produto.findUnique({
      where: { id: produtoId },
      select: { id: true },
    });

    if (!produtoExistente) {
      return NextResponse.json(
        { erro: "Produto não encontrado." },
        { status: 404 }
      );
    }

    /* =====================================================
       11. CONSULTAR CATEGORIA
       ===================================================== */

    const categoria = await prisma.categoria.findUnique({
      where: { id: entrada.categoriaId as number },
    });

    if (!categoria || !categoria.ativa) {
      return NextResponse.json(
        { erro: "A categoria selecionada não está ativa." },
        { status: 400 }
      );
    }

    /* =====================================================
       12. ATUALIZAR PRODUTO NO MYSQL
       ===================================================== */

    // Preserva o slug atual para não quebrar links existentes.
    // Também preserva imagens, variantes, estoque e publicação.

    const produtoAtualizado = await prisma.produto.update({
      where: { id: produtoId },
      data: {
        nome,
        descricao,
        preco: entrada.preco as string,
        pesoGramas: entrada.pesoGramas as number,
        categoriaId: entrada.categoriaId as number,
      },
      include: {
        categoria: true,
      },
    });

    /* =====================================================
       13. RETORNAR RESULTADO
       ===================================================== */

    return NextResponse.json(
      {
        mensagem: "Produto atualizado com sucesso!",
        produto: {
          ...produtoAtualizado,
          preco: produtoAtualizado.preco.toString(),
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[ADMIN PRODUTOS PATCH]", error);

    return NextResponse.json(
      { erro: "Não foi possível atualizar o produto." },
      { status: 500 }
    );
  }
}
