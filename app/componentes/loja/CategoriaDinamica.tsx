
import CategoryLayout, {
  type Product,
} from "./CategoryLayout";

import { prisma } from "../../../lib/prisma";

/* =========================================================
   PÁDUA CULTURE — CATEGORIA DINÂMICA

   Responsabilidades:
   - Consultar produtos publicados no MySQL.
   - Filtrar pela categoria.
   - Carregar a fotografia principal.
   - Carregar variantes e estoque.
   - Preservar o layout original da loja.

   Este componente roda no servidor.
   ========================================================= */

type CategoriaDinamicaProps = {
  number: string;
  title: string;
  categorySlug: string;
  nextCategory: string;
  nextHref: string;
};

/* =========================================================
   FORMATAR PREÇO EM REAIS
   ========================================================= */

function formatPrice(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/* =========================================================
   CONSULTAR E RENDERIZAR CATEGORIA
   ========================================================= */

export default async function CategoriaDinamica({
  number,
  title,
  categorySlug,
  nextCategory,
  nextHref,
}: CategoriaDinamicaProps) {
  const registros = await prisma.produto.findMany({
    where: {
      ativo: true,

      categoria: {
        slug: categorySlug,
        ativa: true,
      },
    },

    include: {
      categoria: {
        select: {
          nome: true,
        },
      },

      imagens: {
        orderBy: [
          { principal: "desc" },
          { ordem: "asc" },
          { id: "asc" },
        ],
      },

      variantes: {
        where: {
          ativa: true,
        },
      },
    },

    orderBy: [
      { destaque: "desc" },
      { criadoEm: "desc" },
    ],
  });

  /* =======================================================
     CONVERTER DADOS DO PRISMA
     ======================================================= */

  const products: Product[] = registros.map((produto) => {
    const variants = produto.variantes.map((variante) => ({
      id: variante.id,
      size: variante.tamanho,
      color: variante.cor,
      sku: variante.sku,
      stock: variante.quantidade,
      available: variante.quantidade > 0,
    }));

    return {
      id: produto.id,
      name: produto.nome,
      slug: produto.slug,
      category: produto.categoria.nome,

      price: formatPrice(
        Number(
          produto.precoPromocional ?? produto.preco
        )
      ),

      image: produto.imagens[0]?.url ?? "",

      variants,

      available: variants.some(
        (variant) => variant.available
      ),
    };
  });

  /* =======================================================
     UTILIZAR O LAYOUT ORIGINAL
     ======================================================= */

  return (
    <CategoryLayout
      number={number}
      title={title}
      products={products}
      nextCategory={nextCategory}
      nextHref={nextHref}
    />
  );
}
