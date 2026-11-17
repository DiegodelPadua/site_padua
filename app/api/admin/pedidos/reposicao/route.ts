import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  verificarAdministrador,
} from "../../../../../src/utils/adminAuth";

import {
  consultarReposicao,
  confirmarReposicao,
  ReposicaoError,
} from "../../../../../src/services/reposicaoEstoqueService";

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
  if (erro instanceof ReposicaoError) {
    return responder(
      { erro: erro.message },
      erro.status
    );
  }

  console.error(
    "Falha na conferência de reposição de estoque."
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
      throw new ReposicaoError(
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
      throw new ReposicaoError(
        "Pedido inválido.",
        400
      );
    }

    return responder(
      await consultarReposicao(
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
      throw new ReposicaoError(
        "Origem não autorizada.",
        403
      );
    }

    const admin =
      await verificarAdministrador();

    if (!admin) {
      throw new ReposicaoError(
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
      throw new ReposicaoError(
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

          throw new ReposicaoError(
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
      throw new ReposicaoError(
        "JSON inválido.",
        400
      );
    }

    if (
      !corpo ||
      typeof corpo !== "object" ||
      Array.isArray(corpo)
    ) {
      throw new ReposicaoError(
        "Dados inválidos.",
        400
      );
    }

    const d =
      corpo as Record<string, unknown>;

    if (
      Object.keys(d).length !== 4 ||
      !Object.keys(d).every(
        (k) =>
          [
            "pedidoId",
            "origem",
            "observacao",
            "conferido",
          ].includes(k)
      ) ||
      typeof d.pedidoId !== "number"
    ) {
      throw new ReposicaoError(
        "Dados da conferência inválidos.",
        400
      );
    }

    return responder(
      await confirmarReposicao(
        d.pedidoId,
        admin.id,
        d.origem,
        d.observacao,
        d.conferido
      )
    );
  } catch (erro) {
    return falha(erro);
  }
}