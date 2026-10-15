
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { verificarAdministrador } from "../../../../src/utils/adminAuth";

/* =========================================================
   API ADMINISTRATIVA DE CATEGORIAS - PÁDUA
   =========================================================
   GET  - Lista as categorias cadastradas.
   POST - Cadastra uma nova categoria.

   Ambas as operações exigem perfil ADMIN.
   ========================================================= */

// =========================================================
// LISTAR CATEGORIAS
// =========================================================

export async function GET() {
  try {
    const administrador = await verificarAdministrador();

    if (!administrador) {
      return NextResponse.json(
        { erro: "Acesso não autorizado." },
        { status: 403 }
      );
    }

    const categorias = await prisma.categoria.findMany({
      orderBy: {
        nome: "asc",
      },
    });

    return NextResponse.json(
      { categorias },
      { status: 200 }
    );
  } catch (error) {
    console.error("[ADMIN CATEGORIAS GET]", error);

    return NextResponse.json(
      { erro: "Não foi possível consultar as categorias." },
      { status: 500 }
    );
  }
}

// =========================================================
// CADASTRAR CATEGORIA
// =========================================================

export async function POST(request: NextRequest) {
  try {
    const administrador = await verificarAdministrador();

    if (!administrador) {
      return NextResponse.json(
        { erro: "Acesso não autorizado." },
        { status: 403 }
      );
    }

    // Bloqueia requisições de outras origens.
    const origem = request.headers.get("origin");
    const origemEsperada = new URL(request.url).origin;

    if (!origem || origem !== origemEsperada) {
      return NextResponse.json(
        { erro: "Origem da requisição não autorizada." },
        { status: 403 }
      );
    }

    // Verifica se o corpo contém JSON válido.
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

    if (typeof entrada.nome !== "string") {
      return NextResponse.json(
        { erro: "O nome da categoria é obrigatório." },
        { status: 400 }
      );
    }

    const nome = entrada.nome.trim();

    if (!nome || nome.length > 100) {
      return NextResponse.json(
        { erro: "Informe um nome com até 100 caracteres." },
        { status: 400 }
      );
    }

    // Gera um identificador amigável para a URL.
    const slug = nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    if (!slug || slug.length > 120) {
      return NextResponse.json(
        { erro: "Não foi possível gerar um slug válido." },
        { status: 400 }
      );
    }

    // Impede o cadastro duplicado.
    const existente = await prisma.categoria.findFirst({
      where: {
        OR: [{ nome }, { slug }],
      },
    });

    if (existente) {
      return NextResponse.json(
        { erro: "Esta categoria já está cadastrada." },
        { status: 409 }
      );
    }

    // Salva a categoria no MySQL.
    const categoria = await prisma.categoria.create({
      data: {
        nome,
        slug,
        ativa: true,
      },
    });

    return NextResponse.json(
      {
        mensagem: "Categoria cadastrada com sucesso.",
        categoria,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[ADMIN CATEGORIAS POST]", error);

    return NextResponse.json(
      { erro: "Não foi possível cadastrar a categoria." },
      { status: 500 }
    );
  }
}
