
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

/* =========================================================
   PÁDUA CULTURE — API PÚBLICA DE PRODUTOS

   ENDPOINTS:

   GET /api/produtos

   GET /api/produtos?categoria=camisetas

   OBJETIVOS:

   - Consultar produtos cadastrados no MySQL.
   - Exibir somente produtos publicados.
   - Respeitar categorias ativas.
   - Consultar fotografias dos produtos.
   - Consultar variantes e estoque.
   - Não expor dados administrativos.

   ========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* =========================================================
   GET — LISTAR PRODUTOS
   ========================================================= */

export async function GET(request: NextRequest) {
  try {
    // Obtém o filtro opcional de categoria.
    const categoria = request.nextUrl.searchParams
      .get("categoria")
      ?.trim()
      .toLowerCase();

    /* -----------------------------------------------------
       CONSULTA AO MYSQL
       ----------------------------------------------------- */

    const produtos = await prisma.produto.findMany({
      where: {
        // Somente produtos publicados.
        ativo: true,

        // A categoria também precisa estar ativa.
        categoria: {
          ativa: true,

          // Filtra por slug quando informado.
          ...(categoria
            ? { slug: categoria }
            : {}),
        },
      },

      select: {
        id: true,
        nome: true,
        slug: true,
        descricao: true,
        preco: true,
        precoPromocional: true,
        destaque: true,

        // Dados públicos da categoria.
        categoria: {
          select: {
            nome: true,
            slug: true,
          },
        },

        // Galeria de fotografias.
        imagens: {
          select: {
            id: true,
            url: true,
            textoAlt: true,
            principal: true,
            ordem: true,
          },

          orderBy: [
            { principal: "desc" },
            { ordem: "asc" },
            { id: "asc" },
          ],
        },

        // Variantes cadastradas no produto.
        variantes: {
          where: {
            ativa: true,
          },

          select: {
            id: true,
            tamanho: true,
            cor: true,
            sku: true,

            // Nome real do campo no Prisma.
            quantidade: true,
          },

          orderBy: [
            { tamanho: "asc" },
            { cor: "asc" },
          ],
        },
      },

      orderBy: [
        { destaque: "desc" },
        { criadoEm: "desc" },
      ],
    });

    /* -----------------------------------------------------
       PREPARAR DADOS PARA A VITRINE
       ----------------------------------------------------- */

    const resultado = produtos.map((produto) => {
      // Preço promocional tem prioridade quando existir.
      const precoAtual = Number(
        produto.precoPromocional ?? produto.preco
      );

      // Converte o Decimal do Prisma para number.
      const precoOriginal = Number(produto.preco);

      // Seleciona a fotografia principal.
      const imagemPrincipal =
        produto.imagens.find(
          (imagem) => imagem.principal
        ) ??
        produto.imagens[0] ??
        null;

      // Converte as variantes para um formato público.
      const variantes = produto.variantes.map(
        (variante) => ({
          id: variante.id,
          size: variante.tamanho,
          color: variante.cor,
          sku: variante.sku,
          stock: variante.quantidade,

          // Informa se a variante pode ser comprada.
          available: variante.quantidade > 0,
        })
      );

      // Calcula o estoque total do produto.
      const estoqueTotal = variantes.reduce(
        (total, variante) =>
          total + variante.stock,
        0
      );

      return {
        id: produto.id,
        name: produto.nome,
        slug: produto.slug,
        description: produto.descricao,

        category: produto.categoria.nome,
        categorySlug: produto.categoria.slug,

        price: precoAtual,
        originalPrice: precoOriginal,

        // URL da imagem principal.
        image: imagemPrincipal?.url ?? null,

        // Galeria completa.
        images: produto.imagens,

        // Variantes e disponibilidade.
        variants: variantes,
        stock: estoqueTotal,
        available: estoqueTotal > 0,

        featured: produto.destaque,
      };
    });

    /* -----------------------------------------------------
       RESPOSTA DA API
       ----------------------------------------------------- */

    return NextResponse.json(
      {
        produtos: resultado,
        total: resultado.length,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error(
      "[API PUBLICA PRODUTOS]",
      error
    );

    return NextResponse.json(
      {
        erro: "Não foi possível carregar os produtos.",
      },
      {
        status: 500,
      }
    );
  }
}
