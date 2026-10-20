
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { verificarAdministrador } from "../../../../src/utils/adminAuth";

/* =========================================================
   PÁDUA CULTURE — UPLOAD DE IMAGENS
   =========================================================
   POST:
   - Verifica a sessão administrativa.
   - Valida a origem da requisição.
   - Aceita imagens JPG, PNG e WebP.
   - Limita o tamanho a 5 MB.
   - Salva na pasta configurada em UPLOAD_DIR.

   IMPORTANTE:
   Esta primeira etapa salva somente o arquivo.
   O relacionamento com o produto será feito depois.
   ========================================================= */

export const runtime = "nodejs";

const TAMANHO_MAXIMO = 5 * 1024 * 1024;

const FORMATOS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export async function POST(request: NextRequest) {
  try {
    // Confirma que o usuário é administrador.
    const administrador = await verificarAdministrador();

    if (!administrador) {
      return NextResponse.json(
        { erro: "Acesso não autorizado." },
        { status: 403 }
      );
    }

    // Impede requisições de outra origem.
    const origem = request.headers.get("origin");
    const origemEsperada = new URL(request.url).origin;

    if (!origem || origem !== origemEsperada) {
      return NextResponse.json(
        { erro: "Origem não autorizada." },
        { status: 403 }
      );
    }

    // Confirma que o armazenamento está configurado.
    const diretorio = process.env.UPLOAD_DIR;

    if (!diretorio || !path.isAbsolute(diretorio)) {
      return NextResponse.json(
        { erro: "Diretório de upload não configurado." },
        { status: 500 }
      );
    }

    // Lê o arquivo enviado como multipart/form-data.
    const formulario = await request.formData();
    const arquivo = formulario.get("imagem");

    if (!(arquivo instanceof File)) {
      return NextResponse.json(
        { erro: "Selecione uma imagem." },
        { status: 400 }
      );
    }

    // Valida o tipo declarado pelo navegador.
    const extensao = FORMATOS[
      arquivo.type as keyof typeof FORMATOS
    ];

    if (!extensao) {
      return NextResponse.json(
        { erro: "Formato inválido. Use JPG, PNG ou WebP." },
        { status: 400 }
      );
    }

    // Impede arquivos vazios ou maiores que 5 MB.
    if (
      arquivo.size === 0 ||
      arquivo.size > TAMANHO_MAXIMO
    ) {
      return NextResponse.json(
        { erro: "A imagem deve ter até 5 MB." },
        { status: 400 }
      );
    }

    // Converte o arquivo para Buffer.
    const conteudo = Buffer.from(await arquivo.arrayBuffer());

    // Verifica a assinatura real do arquivo.
    const jpg =
      conteudo.length >= 3 &&
      conteudo[0] === 0xff &&
      conteudo[1] === 0xd8 &&
      conteudo[2] === 0xff;

    const png =
      conteudo.length >= 8 &&
      conteudo.subarray(0, 8).equals(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
      );

    const webp =
      conteudo.length >= 12 &&
      conteudo.toString("ascii", 0, 4) === "RIFF" &&
      conteudo.toString("ascii", 8, 12) === "WEBP";

    const assinaturaValida =
      (extensao === "jpg" && jpg) ||
      (extensao === "png" && png) ||
      (extensao === "webp" && webp);

    if (!assinaturaValida) {
      return NextResponse.json(
        { erro: "O conteúdo não corresponde a uma imagem válida." },
        { status: 400 }
      );
    }

    // Gera um nome único, sem utilizar o nome original.
    const nomeArquivo = `${randomUUID()}.${extensao}`;

    // Garante que o diretório exista.
    await mkdir(diretorio, { recursive: true });

    // Salva a imagem na Hostinger sem sobrescrever arquivos.
    await writeFile(
      path.join(diretorio, nomeArquivo),
      conteudo,
      { flag: "wx" }
    );

    console.log("[UPLOAD] Imagem salva:", nomeArquivo);

    return NextResponse.json(
      {
        sucesso: true,
        mensagem: "Imagem enviada com sucesso.",
        arquivo: nomeArquivo,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[UPLOAD] Erro ao salvar imagem:", error);

    return NextResponse.json(
      { erro: "Não foi possível enviar a imagem." },
      { status: 500 }
    );
  }
}
