
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { verificarAdministrador } from "../../../../src/utils/adminAuth";

/* =========================================================
   PÁDUA CULTURE — API ADMINISTRATIVA DE UPLOAD
   =========================================================

   ROTA:
   POST /api/admin/upload

   FUNCIONALIDADES:
   1. Verificar se o usuário é administrador.
   2. Validar a origem da requisição.
   3. Receber uma imagem via FormData.
   4. Aceitar somente JPG, PNG ou WebP.
   5. Limitar o arquivo a 5 MB.
   6. Verificar a assinatura do arquivo.
   7. Gerar um nome único para a imagem.
   8. Salvar no armazenamento da Hostinger.
   9. Retornar o nome da imagem para o frontend.

   ARMAZENAMENTO:
   Configurado pela variável de ambiente UPLOAD_DIR.

   IMPORTANTE:
   Esta API salva a imagem no servidor.
   O vínculo com o produto será implementado
   separadamente, na tabela ImagemProduto.

   ========================================================= */

// Garante que a API execute no ambiente Node.js.
export const runtime = "nodejs";

// Define o tamanho máximo permitido: 5 MB.
const TAMANHO_MAXIMO = 5 * 1024 * 1024;

// Relaciona os tipos MIME às extensões permitidas.
const FORMATOS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

// Domínios públicos autorizados a enviar imagens.
// Não utilizamos request.url para validar a origem,
// pois a Hostinger pode utilizar um proxy reverso.
const ORIGENS_PERMITIDAS = [
  "https://paduaculture.com.br",
  "https://www.paduaculture.com.br",
];

/* =========================================================
   POST — ENVIAR IMAGEM
   ========================================================= */

export async function POST(request: NextRequest) {
  try {
    /* -----------------------------------------------------
       1. AUTENTICAÇÃO DO ADMINISTRADOR
       ----------------------------------------------------- */

    // Verifica a sessão e o perfil do usuário.
    const administrador = await verificarAdministrador();

    if (!administrador) {
      return NextResponse.json(
        {
          sucesso: false,
          erro: "Acesso não autorizado.",
        },
        { status: 403 }
      );
    }

    /* -----------------------------------------------------
       2. VALIDAÇÃO DA ORIGEM
       ----------------------------------------------------- */

    // Obtém o domínio que iniciou a requisição.
    const origem = request.headers.get("origin");

    // Compara com os domínios públicos autorizados.
    // Isso evita depender do endereço interno da Hostinger.
    if (
      !origem ||
      !ORIGENS_PERMITIDAS.includes(origem)
    ) {
      console.warn(
        "[UPLOAD] Requisição bloqueada por origem inválida."
      );

      return NextResponse.json(
        {
          sucesso: false,
          erro: "Origem não autorizada.",
        },
        { status: 403 }
      );
    }

    /* -----------------------------------------------------
       3. CONFIGURAÇÃO DO ARMAZENAMENTO
       ----------------------------------------------------- */

    // Obtém o diretório configurado na Hostinger.
    const diretorio = process.env.UPLOAD_DIR;

    // Impede gravações caso o diretório não esteja
    // configurado ou não seja um caminho absoluto.
    if (
      !diretorio ||
      !path.isAbsolute(diretorio)
    ) {
      console.error(
        "[UPLOAD] Variável UPLOAD_DIR inválida."
      );

      return NextResponse.json(
        {
          sucesso: false,
          erro: "Diretório de upload não configurado.",
        },
        { status: 500 }
      );
    }

    /* -----------------------------------------------------
       4. RECEBIMENTO DO ARQUIVO
       ----------------------------------------------------- */

    // Lê o formulário enviado pelo navegador.
    let formulario: FormData;

    try {
      formulario = await request.formData();
    } catch {
      return NextResponse.json(
        {
          sucesso: false,
          erro: "Formulário de upload inválido.",
        },
        { status: 400 }
      );
    }

    // Recupera o campo chamado "imagem".
    const arquivo = formulario.get("imagem");

    // Confirma que o campo contém um arquivo.
    if (!(arquivo instanceof File)) {
      return NextResponse.json(
        {
          sucesso: false,
          erro: "Selecione uma imagem para enviar.",
        },
        { status: 400 }
      );
    }

    /* -----------------------------------------------------
       5. VALIDAÇÃO DO FORMATO
       ----------------------------------------------------- */

    // Identifica a extensão a partir do MIME.
    const extensao =
      FORMATOS[arquivo.type as keyof typeof FORMATOS];

    if (!extensao) {
      return NextResponse.json(
        {
          sucesso: false,
          erro: "Formato inválido. Utilize JPG, PNG ou WebP.",
        },
        { status: 400 }
      );
    }

    /* -----------------------------------------------------
       6. VALIDAÇÃO DO TAMANHO
       ----------------------------------------------------- */

    // Não permite arquivos vazios.
    if (arquivo.size === 0) {
      return NextResponse.json(
        {
          sucesso: false,
          erro: "A imagem está vazia.",
        },
        { status: 400 }
      );
    }

    // Limita o tamanho da imagem a 5 MB.
    if (arquivo.size > TAMANHO_MAXIMO) {
      return NextResponse.json(
        {
          sucesso: false,
          erro: "A imagem deve ter no máximo 5 MB.",
        },
        { status: 400 }
      );
    }

    /* -----------------------------------------------------
       7. CONVERSÃO PARA BUFFER
       ----------------------------------------------------- */

    // Converte o arquivo recebido para bytes.
    const conteudo = Buffer.from(
      await arquivo.arrayBuffer()
    );

    /* -----------------------------------------------------
       8. VERIFICAÇÃO DA ASSINATURA DO ARQUIVO
       ----------------------------------------------------- */

    // Identifica a assinatura inicial de arquivos JPEG.
    const assinaturaJpg =
      conteudo.length >= 3 &&
      conteudo[0] === 0xff &&
      conteudo[1] === 0xd8 &&
      conteudo[2] === 0xff;

    // Identifica a assinatura inicial de arquivos PNG.
    const assinaturaPng =
      conteudo.length >= 8 &&
      conteudo.subarray(0, 8).equals(
        Buffer.from([
          137, 80, 78, 71, 13, 10, 26, 10,
        ])
      );

    // Identifica a assinatura inicial de arquivos WebP.
    const assinaturaWebp =
      conteudo.length >= 12 &&
      conteudo.toString("ascii", 0, 4) === "RIFF" &&
      conteudo.toString("ascii", 8, 12) === "WEBP";

    // Confirma que a assinatura corresponde ao formato.
    const assinaturaValida =
      (extensao === "jpg" && assinaturaJpg) ||
      (extensao === "png" && assinaturaPng) ||
      (extensao === "webp" && assinaturaWebp);

    if (!assinaturaValida) {
      return NextResponse.json(
        {
          sucesso: false,
          erro: "O conteúdo não corresponde a uma imagem válida.",
        },
        { status: 400 }
      );
    }

    /* -----------------------------------------------------
       9. GERAÇÃO DO NOME DO ARQUIVO
       ----------------------------------------------------- */

    // Utiliza UUID para evitar nomes repetidos.
    // O nome original não é utilizado no armazenamento.
    const nomeArquivo = `${randomUUID()}.${extensao}`;

    // Monta o caminho completo da imagem.
    const caminhoArquivo = path.join(
      diretorio,
      nomeArquivo
    );

    /* -----------------------------------------------------
       10. GRAVAÇÃO NA HOSTINGER
       ----------------------------------------------------- */

    // Garante que o diretório exista.
    await mkdir(diretorio, {
      recursive: true,
    });

    // Salva o arquivo sem permitir sobrescrita.
    await writeFile(
      caminhoArquivo,
      conteudo,
      { flag: "wx" }
    );

    /* -----------------------------------------------------
       11. RESPOSTA DE SUCESSO
       ----------------------------------------------------- */

    // Gera a URL pública da imagem.
    const urlImagem =
      `/api/imagens/${encodeURIComponent(nomeArquivo)}`;

    console.log(
      "[UPLOAD] Imagem salva com sucesso:",
      nomeArquivo
    );

    return NextResponse.json(
      {
        sucesso: true,
        mensagem: "Imagem enviada com sucesso.",
        arquivo: nomeArquivo,
        url: urlImagem,
        tamanho: arquivo.size,
        tipo: arquivo.type,
      },
      { status: 201 }
    );
  } catch (error) {
    /* -----------------------------------------------------
       12. TRATAMENTO DE ERROS
       ----------------------------------------------------- */

    console.error(
      "[UPLOAD] Erro ao enviar imagem:",
      error
    );

    return NextResponse.json(
      {
        sucesso: false,
        erro: "Não foi possível enviar a imagem.",
      },
      { status: 500 }
    );
  }
}
