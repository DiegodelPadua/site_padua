
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

/* =========================================================
   PÁDUA CULTURE — EXIBIÇÃO PÚBLICA DE IMAGENS
   =========================================================
   GET:
   - Busca a imagem na pasta persistente da Hostinger.
   - Permite somente arquivos JPG, PNG e WebP.
   - Impede acesso a outros diretórios do servidor.
   - Retorna a imagem para o navegador.
   ========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIPOS: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ arquivo: string }> }
) {
  try {
    // Obtém o nome do arquivo pela URL.
    const { arquivo } = await context.params;

    // Aceita somente nomes gerados pela API de upload.
    const nomeValido =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(
        arquivo
      );

    if (!nomeValido) {
      return NextResponse.json(
        { erro: "Nome de arquivo inválido." },
        { status: 400 }
      );
    }

    // Obtém a extensão e o tipo de conteúdo.
    const extensao = path.extname(arquivo).toLowerCase();
    const tipo = TIPOS[extensao];

    // Verifica a configuração do armazenamento.
    const diretorio = process.env.UPLOAD_DIR;

    if (!diretorio || !path.isAbsolute(diretorio)) {
      return NextResponse.json(
        { erro: "Armazenamento indisponível." },
        { status: 500 }
      );
    }

    // Monta o caminho dentro do diretório autorizado.
    const caminho = path.join(diretorio, arquivo);

    let imagem: Buffer;

    try {
      imagem = await readFile(caminho);
    } catch (error) {
      // Retorna 404 caso a imagem não exista.
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ) {
        return NextResponse.json(
          { erro: "Imagem não encontrada." },
          { status: 404 }
        );
      }

      throw error;
    }

    // Entrega o arquivo com cache no navegador.
    return new NextResponse(new Uint8Array(imagem), {
      status: 200,
      headers: {
        "Content-Type": tipo,
        "Content-Length": String(imagem.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[IMAGENS GET]", error);

    return NextResponse.json(
      { erro: "Não foi possível carregar a imagem." },
      { status: 500 }
    );
  }
}
