import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

/* API pública: apenas leitura de disponibilidade de variante publicada. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, contexto: Contexto) {
  try {
    const { id } = await contexto.params;
    const varianteId = Number(id);
    if (!Number.isSafeInteger(varianteId) || varianteId <= 0) {
      return NextResponse.json({ erro: "Variante inválida." }, { status: 400 });
    }

    const variante = await prisma.varianteProduto.findFirst({
      where: {
        id: varianteId,
        ativa: true,
        produto: { ativo: true, categoria: { ativa: true } },
      },
      select: { id: true, quantidade: true, tamanho: true, cor: true },
    });

    if (!variante) {
      return NextResponse.json({ erro: "Variante indisponível." }, { status: 404 });
    }

    return NextResponse.json(
      { varianteId: variante.id, quantidade: variante.quantidade, disponivel: variante.quantidade > 0, tamanho: variante.tamanho, cor: variante.cor },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("[DISPONIBILIDADE GET]", error);
    return NextResponse.json({ erro: "Não foi possível consultar o estoque." }, { status: 500 });
  }
}
