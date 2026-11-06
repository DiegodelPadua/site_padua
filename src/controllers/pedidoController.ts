
/* =========================================================
   PEDIDO CONTROLLER - PÁDUA CULTURE
   =========================================================
   Responsabilidades:
   - Validar a autenticação do cliente.
   - Verificar se a sessão continua ativa.
   - Validar a origem da requisição.
   - Preparar a integração com o PedidoService.

   Fluxo:
   Route -> Controller -> Service -> Repository -> Prisma
   ========================================================= */

// Serviço responsável pela criação do pedido.
import {
  criarNovoPedido,
  PedidoServiceError,
} from "../services/pedidoService";

// Erro de estoque insuficiente durante a reserva.
import { ReservaEstoqueError } from "../repositories/pedidoRepository";

import { NextRequest, NextResponse } from "next/server";

import { prisma } from "../../lib/prisma";
import { validarAuthToken } from "../utils/authToken";

/* =========================================================
   CONTROLLER - CRIAR PEDIDO
   ========================================================= */

export async function criarPedidoController(
  request: NextRequest
) {
  try {
    /* =====================================================
       1. IDENTIFICAR O COOKIE DE AUTENTICAÇÃO
       ===================================================== */

    const token = request.cookies.get("padua_session")?.value;

    if (!token) {
      return NextResponse.json(
        { erro: "Usuário não autenticado." },
        { status: 401 }
      );
    }

    /* =====================================================
       2. VALIDAR O JWT
       ===================================================== */

    let usuarioId: number;
    let versaoSessao: number;

    try {
      // Valida a assinatura e a validade do token.
      const payload = await validarAuthToken(token);

      // Recupera os dados da sessão autenticada.
      usuarioId = Number(payload.usuarioId);
      versaoSessao = Number(payload.versaoSessao);
    } catch {
      return NextResponse.json(
        { erro: "Sessão inválida ou expirada." },
        { status: 401 }
      );
    }

    /* =====================================================
       3. VERIFICAR SE A SESSÃO FOI REVOGADA
       ===================================================== */

    // Consulta a versão atual da sessão no banco.
    const usuario = await prisma.usuario.findUnique({
      where: {
        id: usuarioId,
      },
      select: {
        id: true,
        versaoSessao: true,
      },
    });

    // Impede o uso de sessões que foram revogadas.
    if (
      !usuario ||
      usuario.versaoSessao !== versaoSessao
    ) {
      return NextResponse.json(
        { erro: "Sessão revogada. Faça login novamente." },
        { status: 401 }
      );
    }

    /* =====================================================
       4. VALIDAR A ORIGEM DA REQUISIÇÃO
       =====================================================
       Proteção contra requisições externas que tentem
       utilizar o cookie de autenticação do cliente.

       CORREÇÃO PARA PRODUÇÃO NA HOSTINGER:

       Anteriormente, comparávamos a origem do navegador
       com request.url.

       Dependendo da configuração do proxy da Hostinger,
       request.url pode representar um endereço interno
       diferente do domínio público utilizado pelo cliente.

       Agora utilizamos uma lista explícita de origens
       públicas autorizadas.

       Não utilizamos curingas e não aceitamos
       automaticamente qualquer domínio.
       ===================================================== */

    // Recupera a origem informada pelo navegador.
    const origin = request.headers.get("origin");

    // Requisições sem Origin não são autorizadas.
    if (!origin) {
      return NextResponse.json(
        { erro: "Origem da requisição não informada." },
        { status: 403 }
      );
    }

    try {
      // Interpreta a origem recebida como uma URL.
      const origem = new URL(origin);

      // Domínios oficiais autorizados da Pádua Culture.
      // São comparados pelo protocolo, domínio e porta.
      const origensPermitidas = new Set([
        "https://paduaculture.com.br",
        "https://www.paduaculture.com.br",
      ]);

      // Impede que sites externos utilizem o cookie
      // de autenticação para registrar pedidos.
      if (!origensPermitidas.has(origem.origin)) {
        return NextResponse.json(
          { erro: "Origem da requisição não autorizada." },
          { status: 403 }
        );
      }
    } catch {
      // Rejeita cabeçalhos Origin malformados.
      return NextResponse.json(
        { erro: "Origem da requisição inválida." },
        { status: 403 }
      );
    }

    /* =====================================================
       5. VALIDAR O CORPO DA REQUISIÇÃO
       ===================================================== */

    let body: unknown;

    try {
      // Lê os dados enviados pelo checkout.
      body = await request.json();
    } catch {
      return NextResponse.json(
        { erro: "JSON inválido." },
        { status: 400 }
      );
    }

    // Exige um objeto JSON válido.
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { erro: "Dados do pedido inválidos." },
        { status: 400 }
      );
    }

    /* =====================================================
       6. PREPARAR A CRIAÇÃO DO PEDIDO
       =====================================================
       O PedidoService é responsável por:
       - Validar os dados recebidos.
       - Consultar os preços oficiais.
       - Validar o frete.
       - Criar o pedido.
       - Registrar a reserva de estoque no MySQL.

       O Controller não calcula valores financeiros.
       ===================================================== */

    // Envia os dados para o Service, utilizando
    // o identificador do usuário autenticado.
    const pedido = await criarNovoPedido(usuarioId, body);

    // Retorna o pedido criado para o checkout.
    return NextResponse.json(
      {
        mensagem: "Pedido registrado com sucesso.",
        pedido: {
          id: pedido.id,
          status: pedido.status,
          valorTotal: pedido.valorTotal.toString(),
          criadoEm: pedido.criadoEm,
        },
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );

  } catch (error) {
    /* =====================================================
       7. TRATAMENTO DE ERROS
       ===================================================== */

    // Erros esperados das regras de negócio.
    if (error instanceof PedidoServiceError) {
      return NextResponse.json(
        { erro: error.message },
        { status: error.status }
      );
    }

    // Falta de estoque identificada na transação.
    if (error instanceof ReservaEstoqueError) {
      return NextResponse.json(
        { erro: error.message },
        { status: 409 }
      );
    }

    // Registra erros inesperados no servidor.
    console.error(
      "[PEDIDO CONTROLLER] Erro ao processar pedido:",
      error
    );

    // Não expõe detalhes internos ao navegador.
    return NextResponse.json(
      { erro: "Não foi possível processar o pedido." },
      { status: 500 }
    );
  }
}
