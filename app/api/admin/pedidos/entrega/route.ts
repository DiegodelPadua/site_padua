import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  verificarAdministrador,
} from "../../../../../src/utils/adminAuth";

import {
  consultarEntregaAdministrativa,
  atualizarEntregaComoAdministrador,
  EntregaError,
} from "../../../../../src/services/entregaService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function responder(
  dados: unknown,
  status = 200
) {
  return NextResponse.json(dados, {
    status,

    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    },
  });
}

function falha(erro: unknown) {
  if (erro instanceof EntregaError) {
    return responder(
      { erro: erro.message },
      erro.status
    );
  }

  console.error(
    "Falha na conferência de entrega."
  );

  return responder(
    {
      erro:
        "Não foi possível confirmar o resultado. Atualize a consulta antes de tentar novamente.",
    },
    500
  );
}

export async function GET(
  request: NextRequest
) {
  try {
    if (!await verificarAdministrador()) {
      throw new EntregaError(
        "Acesso administrativo necessário.",
        403
      );
    }

    const valores =
      request.nextUrl.searchParams.getAll(
        "pedidoId"
      );

    if (
      valores.length !== 1 ||
      !/^[1-9]\d{0,9}$/.test(valores[0])
    ) {
      throw new EntregaError(
        "Pedido inválido.",
        400
      );
    }

    return responder(
      await consultarEntregaAdministrativa(
        Number(valores[0])
      )
    );
  } catch (erro) {
    return falha(erro);
  }
}

export async function POST(
  request: NextRequest
) {
  try {
    if (
      ![
        "https://paduaculture.com.br",
        "https://www.paduaculture.com.br",
      ].includes(
        request.headers.get("origin") ?? ""
      )
    ) {
      throw new EntregaError(
        "Origem não autorizada.",
        403
      );
    }

    const admin =
      await verificarAdministrador();

    if (!admin) {
      throw new EntregaError(
        "Acesso administrativo necessário.",
        403
      );
    }

    const tipo = request.headers
      .get("content-type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();

    if (
      tipo !== "application/json" ||
      !request.body
    ) {
      throw new EntregaError(
        "Envie os dados em JSON.",
        415
      );
    }

    const leitor =
      request.body.getReader();

    const partes: Uint8Array[] = [];
    let tamanho = 0;

    try {
      while (true) {
        const {
          done,
          value,
        } = await leitor.read();

        if (done) break;

        tamanho += value.byteLength;

        if (tamanho > 4096) {
          await leitor.cancel().catch(
            () => undefined
          );

          throw new EntregaError(
            "Dados enviados muito grandes.",
            413
          );
        }

        partes.push(value);
      }
    } finally {
      leitor.releaseLock();
    }

    let corpo: unknown;

    try {
      corpo = JSON.parse(
        Buffer.concat(partes).toString(
          "utf8"
        )
      );
    } catch {
      throw new EntregaError(
        "JSON inválido.",
        400
      );
    }

    if (
      !corpo ||
      typeof corpo !== "object" ||
      Array.isArray(corpo)
    ) {
      throw new EntregaError(
        "Dados inválidos.",
        400
      );
    }

    const dados =
      corpo as Record<string, unknown>;

    return responder(
      await atualizarEntregaComoAdministrador(
        dados,
        admin.id
      )
    );
  } catch (erro) {
    return falha(erro);
  }
}