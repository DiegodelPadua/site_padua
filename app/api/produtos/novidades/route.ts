import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

/* API pública: somente produtos publicados, de categorias ativas.
   Não revela dados de administração ou de usuários. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const registros = await prisma.produto.findMany({
      where: { ativo: true, categoria: { ativa: true } },
      include: {
        categoria: { select: { nome: true } },
        imagens: {
          orderBy: [{ principal: "desc" }, { ordem: "asc" }, { id: "asc" }],
          take: 1,
          select: { url: true },
        },
      },
      orderBy: [{ destaque: "desc" }, { criadoEm: "desc" }],
      take: 6,
    });

    const formatarPreco = (valor: number) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(valor);

    return NextResponse.json({
      produtos: registros.map((produto) => {
        const normal = Number(produto.preco);
        const promocional = produto.precoPromocional === null
          ? null
          : Number(produto.precoPromocional);
        const preco = promocional !== null && promocional > 0 && promocional < normal
          ? promocional : normal;

        return {
          id: produto.id,
          name: produto.nome,
          slug: produto.slug,
          category: produto.categoria.nome,
          price: formatarPreco(preco),
          image: produto.imagens[0]?.url ?? "",
        };
      }),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[NOVIDADES GET]", error);
    return NextResponse.json(
      { erro: "Não foi possível carregar novidades." },
      { status: 500 }
    );
  }
}
