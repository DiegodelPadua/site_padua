
import { notFound } from "next/navigation";
import { prisma } from "../../../lib/prisma";

import ProductDetails, {
  type ProdutoDetalhes,
} from "../../componentes/loja/ProductDetails";

/* =========================================================
   PÁDUA CULTURE — PÁGINA DINÂMICA DE PRODUTO

   Exemplos:
   /produto/padua-brazil
   /produto/padua-globe

   Somente produtos publicados são exibidos.
   ========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ProdutoPage({
  params,
}: Props) {
  // Recupera o slug presente na URL.
  const { slug } = await params;

  // Busca o produto publicado no MySQL.
  const registro = await prisma.produto.findFirst({
    where: {
      slug,
      ativo: true,
      categoria: {
        ativa: true,
      },
    },

    include: {
      categoria: true,

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
        orderBy: {
          id: "asc",
        },
      },
    },
  });

  // Produto inexistente ou em rascunho.
  if (!registro) {
    notFound();
  }

  /* =======================================================
     CONVERTER DADOS DO PRISMA PARA O COMPONENTE CLIENTE
     ======================================================= */

  const precoNormal = Number(registro.preco);

  const precoPromocional =
    registro.precoPromocional !== null
      ? Number(registro.precoPromocional)
      : null;

  const possuiPromocao =
    precoPromocional !== null &&
    precoPromocional > 0 &&
    precoPromocional < precoNormal;

  const produto: ProdutoDetalhes = {
    id: registro.id,
    nome: registro.nome,
    slug: registro.slug,
    descricao: registro.descricao,
    categoria: registro.categoria.nome,
    categoriaSlug: registro.categoria.slug,

    preco: possuiPromocao
      ? precoPromocional!
      : precoNormal,

    precoOriginal: possuiPromocao
      ? precoNormal
      : null,

    imagens: registro.imagens.map((imagem) => ({
      id: imagem.id,
      url: imagem.url,
      textoAlt: imagem.textoAlt,
    })),

    variantes: registro.variantes.map((variante) => ({
      id: variante.id,
      tamanho: variante.tamanho,
      cor: variante.cor,
      quantidade: variante.quantidade,
      ativa: variante.ativa,
    })),
  };

  return <ProductDetails produto={produto} />;
}
