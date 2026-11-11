/* =========================================================
   PAGAMENTO CONTROLLER - PÁDUA CULTURE
   =========================================================
   Valida origem, sessão e pedido antes de iniciar o pagamento.
   O navegador envia somente o ID de um pedido existente.
   ========================================================= */

   import { NextRequest, NextResponse } from "next/server";
   import { prisma } from "../../lib/prisma";
   import { validarAuthToken } from "../utils/authToken";
   
   import {
     iniciarPagamentoMercadoPago,
     PagamentoServiceError,
   } from "../services/pagamentoService";
   
   const origensPermitidas = new Set([
     "https://paduaculture.com.br",
     "https://www.paduaculture.com.br",
   ]);
   
   // Evita armazenar em cache respostas que contêm dados ou links de pagamento.
   function responder(
     dados: Record<string, unknown>,
     status: number
   ) {
     return NextResponse.json(dados, {
       status,
       headers: {
         "Cache-Control": "private, no-store",
       },
     });
   }
   
   // Limita o corpo durante a leitura, inclusive sem Content-Length.
   async function lerPedidoId(
     request: NextRequest
   ): Promise<number> {
     const tipo = request.headers
       .get("content-type")
       ?.split(";")[0]
       .trim()
       .toLowerCase();
   
     if (tipo !== "application/json") {
       throw new PagamentoServiceError(
         "Envie os dados em JSON.",
         415,
         "TIPO_INVALIDO"
       );
     }
   
     if (!request.body) {
       throw new PagamentoServiceError(
         "Informe o pedido.",
         400,
         "DADOS_INVALIDOS"
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
   
           throw new PagamentoServiceError(
             "Os dados enviados excedem o tamanho permitido.",
             413,
             "CORPO_MUITO_GRANDE"
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
       throw new PagamentoServiceError(
         "JSON inválido.",
         400,
         "JSON_INVALIDO"
       );
     }
   
     if (
       !corpo ||
       typeof corpo !== "object" ||
       Array.isArray(corpo)
     ) {
       throw new PagamentoServiceError(
         "Dados do pagamento inválidos.",
         400,
         "DADOS_INVALIDOS"
       );
     }
   
     const dados = corpo as Record<string, unknown>;
   
     // Não aceita usuário, valores, método, URL ou chave enviados pelo navegador.
     if (
       Object.keys(dados).length !== 1 ||
       typeof dados.pedidoId !== "number" ||
       !Number.isSafeInteger(dados.pedidoId) ||
       dados.pedidoId <= 0
     ) {
       throw new PagamentoServiceError(
         "Envie somente um pedidoId numérico válido.",
         400,
         "DADOS_INVALIDOS"
       );
     }
   
     return dados.pedidoId;
   }
   
   export async function iniciarPagamentoController(
     request: NextRequest
   ) {
     try {
       const token = request.cookies.get("padua_session")?.value;
   
       if (!token) {
         return responder(
           { erro: "Usuário não autenticado." },
           401
         );
       }
   
       // Usa os domínios públicos explícitos, sem confiar na URL interna do proxy.
       const origem = request.headers.get("origin");
   
       if (!origem || !origensPermitidas.has(origem)) {
         return responder(
           { erro: "Origem da requisição não autorizada." },
           403
         );
       }
   
       let usuarioId: number;
       let versaoSessao: number;
   
       try {
         const payload = await validarAuthToken(token);
   
         if (
           typeof payload.usuarioId !== "number" ||
           !Number.isSafeInteger(payload.usuarioId) ||
           payload.usuarioId <= 0 ||
           typeof payload.versaoSessao !== "number" ||
           !Number.isSafeInteger(payload.versaoSessao) ||
           payload.versaoSessao < 1
         ) {
           return responder(
             { erro: "Sessão inválida ou expirada." },
             401
           );
         }
   
         usuarioId = payload.usuarioId;
         versaoSessao = payload.versaoSessao;
       } catch {
         return responder(
           { erro: "Sessão inválida ou expirada." },
           401
         );
       }
   
       const usuario = await prisma.usuario.findUnique({
         where: {
           id: usuarioId,
         },
         select: {
           id: true,
           versaoSessao: true,
         },
       });
   
       if (!usuario || usuario.versaoSessao !== versaoSessao) {
         return responder(
           { erro: "Sessão revogada. Faça login novamente." },
           401
         );
       }
   
       const pedidoId = await lerPedidoId(request);
   
       // O filtro evita iniciar pagamentos de pedidos pertencentes a outra conta.
       // O serviço também confere esse vínculo ao buscar os dados oficiais.
       const pedido = await prisma.pedido.findFirst({
         where: {
           id: pedidoId,
           usuarioId,
         },
         select: {
           id: true,
         },
       });
   
       if (!pedido) {
         return responder(
           { erro: "Pedido não encontrado para este cliente." },
           404
         );
       }
   
       const resultado = await iniciarPagamentoMercadoPago(
         pedido.id,
         usuario.id
       );
   
       return responder(resultado, 200);
     } catch (error) {
       if (error instanceof PagamentoServiceError) {
         return responder(
           {
             erro: error.message,
             codigo: error.codigo,
           },
           error.status
         );
       }
   
       // Não registra tokens, dados financeiros, URLs ou respostas do provedor.
       console.error(
         "[PAGAMENTO CONTROLLER] Falha ao iniciar pagamento."
       );
   
       return responder(
         { erro: "Não foi possível iniciar o pagamento." },
         500
       );
     }
   }