
import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { verificarAdministrador } from "@/src/utils/adminAuth";

export const runtime = "nodejs";

// Testa se a aplicação Next.js consegue gravar arquivos
// na pasta configurada na Hostinger.
export async function POST(request: NextRequest) {
  // Impede chamadas de outras origens.
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) {
    return NextResponse.json(
      { erro: "Origem da requisição inválida." },
      { status: 403 }
    );
  }

  try {
    if (new URL(origin).host !== host) {
      return NextResponse.json(
        { erro: "Origem não autorizada." },
        { status: 403 }
      );
    }
  } catch {
    return NextResponse.json(
      { erro: "Origem inválida." },
      { status: 403 }
    );
  }

  // Verifica se o usuário autenticado é administrador.
  const administrador = await verificarAdministrador();

  if (!administrador) {
    return NextResponse.json(
      { erro: "Acesso restrito ao administrador." },
      { status: 401 }
    );
  }

  // Recupera o diretório configurado na Hostinger.
  const uploadDir = process.env.UPLOAD_DIR;

  if (!uploadDir) {
    return NextResponse.json(
      { erro: "UPLOAD_DIR não configurada." },
      { status: 500 }
    );
  }

  // Cria um nome único para o arquivo temporário.
  const caminho = join(uploadDir, `teste-${randomUUID()}.txt`);

  try {
    // Testa a gravação sem sobrescrever arquivos existentes.
    await writeFile(caminho, "Teste de gravação Pádua", {
      flag: "wx",
    });

    // Remove o arquivo criado durante o teste.
    await unlink(caminho);

    return NextResponse.json({
      sucesso: true,
      mensagem: "Next.js conseguiu gravar na Hostinger!",
    });
  } catch (error) {
    console.error("[UPLOAD TESTE] Erro:", error);

    return NextResponse.json(
      {
        sucesso: false,
        mensagem: "Falha ao gravar na pasta de uploads.",
      },
      { status: 500 }
    );
  }
}
