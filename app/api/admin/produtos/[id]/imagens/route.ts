
import { NextRequest, NextResponse } from "next/server";
import { access } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../../../../../../lib/prisma";
import { verificarAdministrador } from "../../../../../../src/utils/adminAuth";

/* =========================================================
   PÁDUA CULTURE — IMAGENS DOS PRODUTOS
   =========================================================

   GET /api/admin/produtos/[id]/imagens
   - Consulta as imagens de um produto.

   POST /api/admin/produtos/[id]/imagens
   - Associa uma imagem enviada à Hostinger.
   - Valida a sessão administrativa.
   - Confirma que o produto existe.
   - Confirma que o arquivo existe no servidor.
   - Define a primeira imagem como principal.
   - Salva o relacionamento no MySQL.

   IMPORTANTE:
   Esta API não realiza o upload físico.
   O upload é feito por /api/admin/upload.

   ========================================================= */

export const runtime = "nodejs";

type Contexto = {
  params: Promise<{ id: string }>;
};

// Aceita somente nomes gerados pela API de upload.
const PADRAO_ARQUIVO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

// Domínios autorizados a realizar operações administrativas.
const ORIGENS_PERMITIDAS = [
  "https://paduaculture.com.br",
  "https://www.paduaculture.com.br",
];

/* =========================================================
   FUNÇÕES AUXILIARES
   ========================================================= */

// Converte o ID da URL para um inteiro válido.
async function obterProdutoId(contexto: Contexto) {
  const { id } = await contexto.params;
  const numero = Number(id);

  if (!Number.isSafeInteger(numero) || numero <= 0) {
    return null;
  }

  return numero;
}

// Valida a origem da requisição.
// Não depende do endereço interno do proxy da Hostinger.
function origemAutorizada(request: NextRequest) {
  const origem = request.headers.get("origin");

  return (
    origem !== null &&
    ORIGENS_PERMITIDAS.includes(origem)
  );
}

/* =========================================================
   GET — LISTAR IMAGENS DO PRODUTO
   ========================================================= */

export async function GET(
  _request: NextRequest,
  contexto: Contexto
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

    // Valida o identificador do produto.
    const produtoId = await obterProdutoId(contexto);

    if (!produtoId) {
      return NextResponse.json(
        { erro: "ID do produto inválido." },
        { status: 400 }
      );
    }

    // Confirma que o produto existe.
    const produto = await prisma.produto.findUnique({
      where: { id: produtoId },
      select: {
        id: true,
        nome: true,
        slug: true,
      },
    });

    if (!produto) {
      return NextResponse.json(
        { erro: "Produto não encontrado." },
        { status: 404 }
      );
    }

    // Consulta as imagens na ordem de apresentação.
    const imagens = await prisma.imagemProduto.findMany({
      where: { produtoId },
      orderBy: [
        { principal: "desc" },
        { ordem: "asc" },
        { id: "asc" },
      ],
    });

    return NextResponse.json(
      { produto, imagens },
      { status: 200 }
    );
  } catch (error) {
    console.error("[ADMIN IMAGENS GET]", error);

    return NextResponse.json(
      { erro: "Não foi possível consultar as imagens." },
      { status: 500 }
    );
  }
}

/* =========================================================
   POST — ASSOCIAR IMAGEM AO PRODUTO
   ========================================================= */

export async function POST(
  request: NextRequest,
  contexto: Contexto
) {
  try {
    // Confirma a autenticação administrativa.
    const administrador = await verificarAdministrador();

    if (!administrador) {
      return NextResponse.json(
        { erro: "Acesso não autorizado." },
        { status: 403 }
      );
    }

    // Protege a operação contra outras origens.
    if (!origemAutorizada(request)) {
      return NextResponse.json(
        { erro: "Origem não autorizada." },
        { status: 403 }
      );
    }

    // Valida o ID recebido pela URL.
    const produtoId = await obterProdutoId(contexto);

    if (!produtoId) {
      return NextResponse.json(
        { erro: "ID do produto inválido." },
        { status: 400 }
      );
    }

    // Confirma a existência do produto.
    const produto = await prisma.produto.findUnique({
      where: { id: produtoId },
      select: { id: true, nome: true },
    });

    if (!produto) {
      return NextResponse.json(
        { erro: "Produto não encontrado." },
        { status: 404 }
      );
    }

    /* -----------------------------------------------------
       LEITURA DO JSON
       ----------------------------------------------------- */

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

    /* -----------------------------------------------------
       VALIDAÇÃO DO ARQUIVO
       ----------------------------------------------------- */

    // Recebe somente o nome retornado pela API de upload.
    if (
      typeof entrada.arquivo !== "string" ||
      !PADRAO_ARQUIVO.test(entrada.arquivo)
    ) {
      return NextResponse.json(
        { erro: "Nome de arquivo inválido." },
        { status: 400 }
      );
    }

    const nomeArquivo = entrada.arquivo;

    // Valida a descrição alternativa, quando informada.
    if (
      entrada.textoAlt !== undefined &&
      entrada.textoAlt !== null &&
      (
        typeof entrada.textoAlt !== "string" ||
        entrada.textoAlt.length > 255
      )
    ) {
      return NextResponse.json(
        { erro: "Texto alternativo inválido." },
        { status: 400 }
      );
    }

    const textoAlt =
      typeof entrada.textoAlt === "string"
        ? entrada.textoAlt.trim() || null
        : null;

    /* -----------------------------------------------------
       VERIFICAÇÃO DO ARQUIVO NA HOSTINGER
       ----------------------------------------------------- */

    // Recupera o diretório persistente configurado.
    const diretorio = process.env.UPLOAD_DIR;

    if (!diretorio || !path.isAbsolute(diretorio)) {
      return NextResponse.json(
        { erro: "Armazenamento não configurado." },
        { status: 500 }
      );
    }

    // Monta o caminho do arquivo validado.
    const caminho = path.join(diretorio, nomeArquivo);

    try {
      // Confirma que a imagem realmente existe.
      await access(caminho);
    } catch {
      return NextResponse.json(
        { erro: "Imagem não encontrada na Hostinger." },
        { status: 404 }
      );
    }

    // Gera a URL que será utilizada pela loja.
    const url = `/api/imagens/${nomeArquivo}`;

    /* -----------------------------------------------------
       GRAVAÇÃO NO MYSQL
       ----------------------------------------------------- */

    // Evita cadastrar o mesmo arquivo duas vezes.
    const imagemExistente =
      await prisma.imagemProduto.findFirst({
        where: { url },
        select: { id: true },
      });

    if (imagemExistente) {
      return NextResponse.json(
        { erro: "Essa imagem já está cadastrada." },
        { status: 409 }
      );
    }

    // Registra a imagem em uma transação.
    const imagem = await prisma.$transaction(async (tx) => {
      // Obtém as imagens existentes do produto.
      const imagensExistentes =
        await tx.imagemProduto.findMany({
          where: { produtoId },
          select: {
            ordem: true,
            principal: true,
          },
        });

      // A primeira imagem será automaticamente principal.
      const primeiraImagem = imagensExistentes.length === 0;

      // Calcula a próxima posição da galeria.
      const maiorOrdem = imagensExistentes.reduce(
        (maior, item) => Math.max(maior, item.ordem),
        -1
      );

      // Cadastra a imagem no MySQL.
      return tx.imagemProduto.create({
        data: {
          produtoId,
          url,
          textoAlt,
          ordem: maiorOrdem + 1,
          principal: primeiraImagem,
        },
      });
    });

    return NextResponse.json(
      {
        mensagem: "Imagem associada ao produto com sucesso.",
        imagem,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[ADMIN IMAGENS POST]", error);

    return NextResponse.json(
      { erro: "Não foi possível associar a imagem." },
      { status: 500 }
    );
  }
}
