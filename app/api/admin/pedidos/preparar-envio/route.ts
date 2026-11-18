import {
    NextRequest,
    NextResponse,
  } from "next/server";
  
  import {
    verificarAdministrador,
  } from "../../../../../src/utils/adminAuth";
  
  import {
    prepararEnvioSandbox,
    PreparacaoEnvioError,
  } from "../../../../../src/services/preparacaoEnvioService";
  
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
        return responder(
          { erro: "Origem não autorizada." },
          403
        );
      }
  
      if (!await verificarAdministrador()) {
        return responder(
          {
            erro:
              "Acesso administrativo necessário.",
          },
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
        return responder(
          { erro: "Envie os dados em JSON." },
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
  
          if (tamanho > 1024) {
            await leitor.cancel().catch(
              () => undefined
            );
  
            return responder(
              {
                erro:
                  "Dados enviados muito grandes.",
              },
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
  
      const dados =
        corpo as Record<string, unknown>;
  
      if (
        Object.keys(dados).length !== 1 ||
        typeof dados.pedidoId !== "number"
      ) {
        return responder(
          {
            erro:
              "Envie somente o pedidoId.",
          },
          400
        );
      }
  
      const resultado =
        await prepararEnvioSandbox(
          dados.pedidoId
        );
  
      return responder(resultado);
    } catch (erro) {
      if (
        erro instanceof PreparacaoEnvioError
      ) {
        return responder(
          { erro: erro.message },
          erro.status
        );
      }
  
      console.error(
        "Falha ao preparar prévia de envio no Sandbox."
      );
  
      return responder(
        {
          erro:
            "Não foi possível preparar a prévia do envio. Tente consultar novamente.",
        },
        503
      );
    }
  }