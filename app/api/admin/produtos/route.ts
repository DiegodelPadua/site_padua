
// Importa os recursos de requisição e resposta do Next.js.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { verificarAdministrador } from "../../../../src/utils/adminAuth";

/* =========================================================
   PÁDUA CULTURE — API ADMINISTRATIVA DE PRODUTOS
   =========================================================
   GET - Lista os produtos cadastrados no MySQL.

   Somente administradores autenticados podem consultar
   esta rota.
   ========================================================= */

export async function GET() {
  try {
    // Verifica a sessão e o perfil do usuário.
    const administrador = await verificarAdministrador();

    if (!administrador) {
      return NextResponse.json(
        { erro: "Acesso não autorizado." },
        { status: 403 }
      );
    }

    // Consulta os produtos com suas categorias,
    // variantes e imagens cadastradas.
    const produtos = await prisma.produto.findMany({
      include: {
        categoria: true,
        variantes: true,
        imagens: true,
      },
      orderBy: {
        criadoEm: "desc",
      },
    });

    // Retorna os valores monetários como strings,
    // evitando perda de precisão no JSON.
    const produtosFormatados = produtos.map((produto) => ({
      ...produto,
      preco: produto.preco.toString(),
      precoPromocional:
        produto.precoPromocional?.toString() ?? null,
    }));

    return NextResponse.json(
      { produtos: produtosFormatados },
      { status: 200 }
    );
  } catch (error) {
    console.error("[ADMIN PRODUTOS GET]", error);

    return NextResponse.json(
      { erro: "Não foi possível consultar os produtos." },
      { status: 500 }
    );
  }
}


/* =========================================================
   CADASTRAR PRODUTO — PÁDUA CULTURE
   =========================================================
   POST - Cadastra um produto no MySQL.

   Somente administradores autenticados podem cadastrar.
   Produtos novos começam inativos até serem preparados
   para publicação na loja.
   ========================================================= */

export async function POST(request: NextRequest) {
  try {
    // Confirma que o usuário possui perfil ADMIN.
    const administrador = await verificarAdministrador();

    if (!administrador) {
      return NextResponse.json(
        { erro: "Acesso não autorizado." },
        { status: 403 }
      );
    }

    // Impede requisições de origens diferentes.
    const origem = request.headers.get("origin");
    const origemEsperada = new URL(request.url).origin;

    if (!origem || origem !== origemEsperada) {
      return NextResponse.json(
        { erro: "Origem não autorizada." },
        { status: 403 }
      );
    }

    // Lê o JSON enviado pelo painel administrativo.
    let dados: unknown;

    try {
      dados = await request.json();
    } catch {
      return NextResponse.json(
        { erro: "JSON inválido." },
        { status: 400 }
      );
    }

    // Garante que o conteúdo seja um objeto.
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
      return NextResponse.json(
        { erro: "Dados inválidos." },
        { status: 400 }
      );
    }

    const entrada = dados as Record<string, unknown>;

    // Valida o nome do produto.
    if (
      typeof entrada.nome !== "string" ||
      !entrada.nome.trim() ||
      entrada.nome.trim().length > 150
    ) {
      return NextResponse.json(
        { erro: "Informe um nome válido com até 150 caracteres." },
        { status: 400 }
      );
    }

    const nome = entrada.nome.trim();

    // Valida a categoria.
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

    // Trabalha com preço em centavos para evitar
    // problemas de arredondamento de ponto flutuante.
    if (
      typeof entrada.preco !== "string" ||
      !/^\d{1,8}\.\d{2}$/.test(entrada.preco)
    ) {
      return NextResponse.json(
        { erro: "Informe o preço no formato 149.90." },
        { status: 400 }
      );
    }

    const precoCentavos = Number(entrada.preco.replace(".", ""));

    if (!Number.isSafeInteger(precoCentavos) || precoCentavos <= 0) {
      return NextResponse.json(
        { erro: "O preço deve ser maior que zero." },
        { status: 400 }
      );
    }

    // Valida a descrição opcional.
    if (
      entrada.descricao !== undefined &&
      entrada.descricao !== null &&
      (typeof entrada.descricao !== "string" ||
        entrada.descricao.length > 10000)
    ) {
      return NextResponse.json(
        { erro: "Descrição inválida." },
        { status: 400 }
      );
    }

    // Gera o identificador utilizado nas URLs.
    const slug = nome
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    if (!slug || slug.length > 180) {
      return NextResponse.json(
        { erro: "Não foi possível gerar um slug válido." },
        { status: 400 }
      );
    }

    // Confirma que a categoria existe e está ativa.
    const categoria = await prisma.categoria.findFirst({
      where: {
        id: entrada.categoriaId,
        ativa: true,
      },
    });

    if (!categoria) {
      return NextResponse.json(
        { erro: "Categoria não encontrada ou inativa." },
        { status: 400 }
      );
    }

    // Impede produtos com o mesmo slug.
    const existente = await prisma.produto.findUnique({
      where: { slug },
    });

    if (existente) {
      return NextResponse.json(
        { erro: "Já existe um produto com esse nome." },
        { status: 409 }
      );
    }

    // Cadastra o produto inicialmente como inativo.
    const produto = await prisma.produto.create({
      data: {
        nome,
        slug,
        descricao:
          typeof entrada.descricao === "string"
            ? entrada.descricao.trim() || null
            : null,
        preco: entrada.preco,
        categoriaId: entrada.categoriaId,
        ativo: false,
        destaque: false,
      },
    });

    // Converte o Decimal para string na resposta.
    return NextResponse.json(
      {
        mensagem: "Produto cadastrado com sucesso.",
        produto: {
          ...produto,
          preco: produto.preco.toString(),
          precoPromocional:
            produto.precoPromocional?.toString() ?? null,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[ADMIN PRODUTOS POST]", error);

    return NextResponse.json(
      { erro: "Não foi possível cadastrar o produto." },
      { status: 500 }
    );
  }
}
