
import { NextRequest, NextResponse } from "next/server";
import {
  mkdir,
  rename,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { prisma } from "../../../../../../../lib/prisma";
import { verificarAdministrador } from "../../../../../../../src/utils/adminAuth";

/* =========================================================
   PÁDUA CULTURE — GERENCIAMENTO INDIVIDUAL DE IMAGENS

   PATCH:
   - Definir fotografia principal.
   - Alterar a ordem da galeria.

   DELETE:
   - Validar o registro e o arquivo.
   - Mover o arquivo para uma área temporária.
   - Excluir o registro no MySQL.
   - Reorganizar as fotografias restantes.
   - Remover definitivamente o arquivo.

   ========================================================= */

export const runtime = "nodejs";

type Contexto = {
  params: Promise<{
    id: string;
    imagemId: string;
  }>;
};

const ORIGENS_PERMITIDAS = [
  "https://paduaculture.com.br",
  "https://www.paduaculture.com.br",
];

const PADRAO_ARQUIVO =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

/* =========================================================
   FUNÇÕES AUXILIARES
   ========================================================= */

// Confirma que a operação veio do domínio administrativo.
function origemAutorizada(request: NextRequest) {
  const origem = request.headers.get("origin");

  return (
    origem !== null &&
    ORIGENS_PERMITIDAS.includes(origem)
  );
}

// Obtém os identificadores da URL.
async function obterIds(contexto: Contexto) {
  const { id, imagemId } = await contexto.params;

  const produtoId = Number(id);
  const imagemNumero = Number(imagemId);

  if (
    !Number.isSafeInteger(produtoId) ||
    produtoId <= 0 ||
    !Number.isSafeInteger(imagemNumero) ||
    imagemNumero <= 0
  ) {
    return null;
  }

  return {
    produtoId,
    imagemId: imagemNumero,
  };
}

// Confere autenticação e origem da requisição.
async function verificarAcesso(request: NextRequest) {
  const administrador = await verificarAdministrador();

  if (!administrador) {
    return NextResponse.json(
      { erro: "Acesso não autorizado." },
      { status: 403 }
    );
  }

  if (!origemAutorizada(request)) {
    return NextResponse.json(
      { erro: "Origem não autorizada." },
      { status: 403 }
    );
  }

  return null;
}

// Organiza as imagens restantes após uma exclusão.
async function reorganizarGaleria(
  tx: Parameters<
    Parameters<typeof prisma.$transaction>[0]
  >[0],
  produtoId: number,
  principalExcluida: boolean
) {
  const restantes = await tx.imagemProduto.findMany({
    where: { produtoId },
    orderBy: [
      { ordem: "asc" },
      { id: "asc" },
    ],
  });

  for (let indice = 0; indice < restantes.length; indice++) {
    const imagem = restantes[indice];

    await tx.imagemProduto.update({
      where: { id: imagem.id },
      data: {
        ordem: indice,
        principal: principalExcluida
          ? indice === 0
          : imagem.principal,
      },
    });
  }
}

/* =========================================================
   PATCH — DEFINIR PRINCIPAL OU ALTERAR ORDEM
   ========================================================= */

export async function PATCH(
  request: NextRequest,
  contexto: Contexto
) {
  try {
    const erroAcesso = await verificarAcesso(request);

    if (erroAcesso) {
      return erroAcesso;
    }

    const ids = await obterIds(contexto);

    if (!ids) {
      return NextResponse.json(
        { erro: "Identificadores inválidos." },
        { status: 400 }
      );
    }

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

    const imagem = await prisma.imagemProduto.findFirst({
      where: {
        id: ids.imagemId,
        produtoId: ids.produtoId,
      },
    });

    if (!imagem) {
      return NextResponse.json(
        { erro: "Imagem não encontrada neste produto." },
        { status: 404 }
      );
    }

    /* -----------------------------------------------------
       DEFINIR FOTO PRINCIPAL
       ----------------------------------------------------- */

    if (entrada.acao === "definirPrincipal") {
      await prisma.$transaction(async (tx) => {
        await tx.imagemProduto.updateMany({
          where: { produtoId: ids.produtoId },
          data: { principal: false },
        });

        await tx.imagemProduto.update({
          where: { id: ids.imagemId },
          data: { principal: true },
        });
      });

      return NextResponse.json({
        mensagem: "Fotografia principal atualizada.",
      });
    }

    /* -----------------------------------------------------
       ALTERAR ORDEM
       ----------------------------------------------------- */

    if (entrada.acao === "alterarOrdem") {
      if (
        entrada.direcao !== "subir" &&
        entrada.direcao !== "descer"
      ) {
        return NextResponse.json(
          { erro: "Direção inválida." },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        const imagens = await tx.imagemProduto.findMany({
          where: { produtoId: ids.produtoId },
          orderBy: [
            { ordem: "asc" },
            { id: "asc" },
          ],
        });

        const atual = imagens.findIndex(
          (item) => item.id === ids.imagemId
        );

        if (atual < 0) {
          throw new Error("Imagem não encontrada.");
        }

        const destino =
          entrada.direcao === "subir"
            ? atual - 1
            : atual + 1;

        if (
          destino < 0 ||
          destino >= imagens.length
        ) {
          throw new Error(
            "A fotografia já está no limite da galeria."
          );
        }

        // Troca as posições na lista em memória.
        const novaOrdem = [...imagens];

        [novaOrdem[atual], novaOrdem[destino]] = [
          novaOrdem[destino],
          novaOrdem[atual],
        ];

        // Persiste a ordem completa no MySQL.
        for (let indice = 0; indice < novaOrdem.length; indice++) {
          await tx.imagemProduto.update({
            where: { id: novaOrdem[indice].id },
            data: { ordem: indice },
          });
        }
      });

      return NextResponse.json({
        mensagem: "Ordem das fotografias atualizada.",
      });
    }

    return NextResponse.json(
      { erro: "Ação não reconhecida." },
      { status: 400 }
    );
  } catch (error) {
    console.error("[ADMIN IMAGEM PATCH]", error);

    return NextResponse.json(
      { erro: "Não foi possível atualizar a fotografia." },
      { status: 500 }
    );
  }
}

/* =========================================================
   DELETE — REMOVER IMAGEM
   ========================================================= */

export async function DELETE(
  request: NextRequest,
  contexto: Contexto
) {
  try {
    const erroAcesso = await verificarAcesso(request);

    if (erroAcesso) {
      return erroAcesso;
    }

    const ids = await obterIds(contexto);

    if (!ids) {
      return NextResponse.json(
        { erro: "Identificadores inválidos." },
        { status: 400 }
      );
    }

    // Confirma que a fotografia pertence ao produto.
    const imagem = await prisma.imagemProduto.findFirst({
      where: {
        id: ids.imagemId,
        produtoId: ids.produtoId,
      },
    });

    if (!imagem) {
      return NextResponse.json(
        { erro: "Imagem não encontrada." },
        { status: 404 }
      );
    }

    const diretorio = process.env.UPLOAD_DIR;

    if (!diretorio || !path.isAbsolute(diretorio)) {
      return NextResponse.json(
        { erro: "Armazenamento não configurado." },
        { status: 500 }
      );
    }

    // Extrai o nome do arquivo de uma URL interna validada.
    const prefixo = "/api/imagens/";

    if (!imagem.url.startsWith(prefixo)) {
      return NextResponse.json(
        { erro: "URL da imagem inválida." },
        { status: 400 }
      );
    }

    const arquivo = imagem.url.slice(prefixo.length);

    if (!PADRAO_ARQUIVO.test(arquivo)) {
      return NextResponse.json(
        { erro: "Nome de arquivo inválido." },
        { status: 400 }
      );
    }

    // Impede exclusão física de arquivos compartilhados.
    const referencias = await prisma.imagemProduto.count({
      where: {
        url: imagem.url,
        NOT: { id: imagem.id },
      },
    });

    if (referencias > 0) {
      return NextResponse.json(
        {
          erro:
            "O arquivo também está vinculado a outra imagem. " +
            "A exclusão física foi bloqueada.",
        },
        { status: 409 }
      );
    }

    const caminhoOriginal = path.join(diretorio, arquivo);

    // Mantém a área temporária no mesmo armazenamento.
    const diretorioTemporario = path.join(
      diretorio,
      ".exclusoes-pendentes"
    );

    const caminhoTemporario = path.join(
      diretorioTemporario,
      `${randomUUID()}-${arquivo}`
    );

    await mkdir(diretorioTemporario, {
      recursive: true,
    });

    /* -----------------------------------------------------
       ETAPA 1 — RESERVAR ARQUIVO PARA EXCLUSÃO
       ----------------------------------------------------- */

    try {
      await rename(
        caminhoOriginal,
        caminhoTemporario
      );
    } catch (error) {
      console.error(
        "[ADMIN IMAGEM RESERVA]",
        error
      );

      return NextResponse.json(
        {
          erro:
            "Não foi possível preparar o arquivo " +
            "para exclusão. Nenhum registro foi removido.",
        },
        { status: 500 }
      );
    }

    /* -----------------------------------------------------
       ETAPA 2 — EXCLUIR REGISTRO DO MYSQL
       ----------------------------------------------------- */

    try {
      await prisma.$transaction(async (tx) => {
        // Remove o registro da imagem selecionada.
        await tx.imagemProduto.delete({
          where: {
            id: imagem.id,
          },
        });

        // Reorganiza as imagens restantes.
        await reorganizarGaleria(
          tx,
          ids.produtoId,
          imagem.principal
        );
      });
    } catch (error) {
      console.error(
        "[ADMIN IMAGEM BANCO]",
        error
      );

      // Tenta restaurar o arquivo se o banco falhar.
      try {
        await rename(
          caminhoTemporario,
          caminhoOriginal
        );
      } catch (erroRestauracao) {
        console.error(
          "[ADMIN IMAGEM RESTAURACAO]",
          erroRestauracao
        );

        return NextResponse.json(
          {
            erro:
              "Falha no banco e na restauração do arquivo. " +
              "Verifique os logs antes de tentar novamente.",
          },
          { status: 500 }
        );
      }

      return NextResponse.json(
        {
          erro:
            "Não foi possível excluir a imagem. " +
            "O arquivo original foi preservado.",
        },
        { status: 500 }
      );
    }

    /* -----------------------------------------------------
       ETAPA 3 — REMOVER ARQUIVO DEFINITIVAMENTE
       ----------------------------------------------------- */

    try {
      await unlink(caminhoTemporario);
    } catch (error) {
      console.error(
        "[ADMIN IMAGEM EXCLUSAO FISICA]",
        error
      );

      return NextResponse.json({
        mensagem:
          "Imagem removida do MySQL. " +
          "O arquivo permanece na área de exclusões pendentes.",
        aviso: true,
      });
    }

    return NextResponse.json({
      mensagem:
        "Fotografia excluída do MySQL e da Hostinger com sucesso.",
    });
  } catch (error) {
    console.error("[ADMIN IMAGEM DELETE]", error);

    return NextResponse.json(
      { erro: "Não foi possível excluir a fotografia." },
      { status: 500 }
    );
  }
}
