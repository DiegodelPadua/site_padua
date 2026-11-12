import { NextRequest, NextResponse } from "next/server";

import {
  verificarAdministrador,
} from "../utils/adminAuth";

import {
  revisarPagamentoComoAdministrador,
  PagamentoServiceError,
} from "../services/pagamentoService";

function responder(
  dados: Record<string, unknown>,
  status: number
) {
  return NextResponse.json(dados, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    },
  });
}

export async function revisarPagamentoAdminController(
  request: NextRequest
) {
  try {
    const origem = request.headers.get("origin");

    if (
      ![
        "https://paduaculture.com.br",
        "https://www.paduaculture.com.br",
      ].includes(origem ?? "")
    ) {
      return responder(
        { erro: "Origem não autorizada." },
        403
      );
    }

    const administrador = await verificarAdministrador();

    if (!administrador) {
      return responder(
        { erro: "Acesso administrativo necessário." },
        403
      );
    }

    const tipo = request.headers
      .get("content-type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();

    if (tipo !== "application/json" || !request.body) {
      return responder(
        { erro: "Envie os dados em JSON." },
        400
      );
    }

    const leitor = request.body.getReader();
    const partes: Uint8Array[] = [];
    let tamanho = 0;

    try {
      while (true) {
        const { done, value } = await leitor.read();

        if (done) break;

        tamanho += value.byteLength;

        if (tamanho > 1024) {
          await leitor.cancel().catch(() => undefined);

          return responder(
            { erro: "Dados enviados muito grandes." },
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
        Buffer.concat(partes).toString("utf8")
      );
    } catch {
      return responder(
        { erro: "JSON inválido." },
        400
      );
    }

    if (
      !corpo ||
      typeof corpo !== "object" ||
      Array.isArray(corpo)
    ) {
      return responder(
        { erro: "Dados inválidos." },
        400
      );
    }

    const dados = corpo as Record<string, unknown>;

    if (
      Object.keys(dados).length !== 2 ||
      typeof dados.pedidoId !== "number" ||
      !Number.isSafeInteger(dados.pedidoId) ||
      dados.pedidoId <= 0 ||
      (
        dados.acao !== "consultar" &&
        dados.acao !== "confirmar"
      )
    ) {
      return responder(
        { erro: "Informe pedidoId e ação válidos." },
        400
      );
    }

    const resultado =
      await revisarPagamentoComoAdministrador(
        dados.pedidoId,
        administrador.id,
        dados.acao === "confirmar"
      );

    return responder(resultado, 200);
  } catch (erro) {
    if (erro instanceof PagamentoServiceError) {
      return responder(
        { erro: erro.message },
        erro.status
      );
    }

    console.error(
      "Falha na revisão administrativa do pagamento."
    );

    return responder(
      {
        erro:
          "Não foi possível concluir a revisão. Atualize o painel para conferir o pedido.",
      },
      500
    );
  }
}