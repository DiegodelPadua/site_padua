/* =========================================================
   AUTH CONTROLLER - PÁDUA
   =========================================================
   Responsável por receber os dados vindos da rota HTTP,
   chamar o Service e preparar a resposta da API.

   Fluxo:

   Route
      ↓
   Controller
      ↓
   Service
      ↓
   Repository
      ↓
   Prisma
      ↓
   MySQL
   ========================================================= */
import { prisma } from "../../lib/prisma";
import { NextResponse } from "next/server";

import {
  cadastrarUsuario,
  autenticarUsuario,
  obterUsuarioAutenticado,
  atualizarDadosCadastrais,
  alterarSenhaUsuario,
  AuthServiceError,
} from "../services/authService";

import {
  gerarAuthToken,
  validarAuthToken,
} from "../utils/authToken";


/* =========================================================
   VALIDAR VERSÃO DA SESSÃO - PÁDUA
   =========================================================
   Compara a versão presente no JWT com a versão
   registrada no banco de dados.

   Retorna false quando a sessão foi revogada.
   ========================================================= */

async function verificarVersaoSessao(
  usuarioId: number,
  versaoToken: number
): Promise<boolean> {

  const usuario = await prisma.usuario.findUnique({
    where: {
      id: usuarioId,
    },
    select: {
      versaoSessao: true,
    },
  });

  if (!usuario) {
    return false;
  }

  return usuario.versaoSessao === versaoToken;
}



/* =========================================================
   CONTROLLER - CADASTRAR USUÁRIO
   ========================================================= */

export async function cadastrarUsuarioController(
  request: Request
) {

  try {

    /* =====================================================
       RECEBER BODY DA REQUISIÇÃO
       ===================================================== */

    const body = await request.json();


    /* =====================================================
       CHAMAR SERVICE
       ===================================================== */

    const usuario =
      await cadastrarUsuario({
        nome: body.nome,
        sobrenome: body.sobrenome,
        email: body.email,
        telefone: body.telefone,
        senha: body.senha,
      });


    /* =====================================================
       RESPOSTA DE SUCESSO
       =====================================================
       HTTP 201 = recurso criado com sucesso.
       ===================================================== */

    return NextResponse.json(
      {
        mensagem: "Conta criada com sucesso.",
        usuario,
      },
      {
        status: 201,
      }
    );

  } catch (error) {

    /* =====================================================
       ERROS DE REGRA DE NEGÓCIO
       =====================================================
       Exemplos:
       400 → dados inválidos
       409 → e-mail já cadastrado
       ===================================================== */

    if (error instanceof AuthServiceError) {

      return NextResponse.json(
        {
          erro: error.message,
        },
        {
          status: error.status,
        }
      );

    }


    /* =====================================================
       ERRO INTERNO
       =====================================================
       Erros inesperados não devem revelar detalhes
       internos da aplicação para o cliente.
       ===================================================== */

    console.error(
      "[AUTH CONTROLLER] Erro ao cadastrar usuário:",
      error
    );

    return NextResponse.json(
      {
        erro: "Não foi possível criar a conta.",
      },
      {
        status: 500,
      }
    );

  }

}

/* =========================================================
   CONTROLLER - LOGIN
   =========================================================
   Recebe e-mail e senha, chama o Service e retorna
   somente informações seguras do usuário.
   ========================================================= */

/* =========================================================
   CONTROLLER - LOGIN
   =========================================================
   Responsável por:

   1. Receber e-mail e senha
   2. Chamar o Service
   3. Gerar o token JWT
   4. Criar o cookie HttpOnly
   5. Retornar os dados seguros do usuário
   ========================================================= */

export async function loginController(
  request: Request
) {

  try {

    /* =====================================================
       RECEBER BODY DA REQUISIÇÃO
       ===================================================== */

    const body = await request.json();


    /* =====================================================
       AUTENTICAR USUÁRIO
       ===================================================== */

    const usuario =
      await autenticarUsuario({
        email: body.email,
        senha: body.senha,
      });


/* =========================================================
   GERAR TOKEN JWT COM VERSÃO DA SESSÃO
   ========================================================= */

    const token = await gerarAuthToken({
      usuarioId: usuario.id,
      email: usuario.email,
      perfil: usuario.perfil,
      versaoSessao: usuario.versaoSessao,
    });


    /* =====================================================
       CRIAR RESPOSTA
       ===================================================== */

    const response =
      NextResponse.json(
        {
          mensagem:
            "Login realizado com sucesso.",

          usuario,
        },
        {
          status: 200,
        }
      );


    /* =====================================================
       CRIAR COOKIE DE AUTENTICAÇÃO
       =====================================================
       httpOnly:
       impede acesso ao token pelo JavaScript do navegador.

       secure:
       será true em produção (HTTPS).

       sameSite:
       ajuda a proteger contra ataques CSRF.

       maxAge:
       7 dias em segundos.
       ===================================================== */

    response.cookies.set(
      "padua_session",
      token,
      {
        httpOnly: true,

        secure:
          process.env.NODE_ENV ===
          "production",

        sameSite: "lax",

        path: "/",

        maxAge:
          60 * 60 * 24 * 7,
      }
    );


    /* =====================================================
       RETORNAR RESPOSTA + COOKIE
       ===================================================== */

    return response;

  } catch (error) {

    /* =====================================================
       ERROS DE NEGÓCIO
       ===================================================== */

    if (
      error instanceof
      AuthServiceError
    ) {

      return NextResponse.json(
        {
          erro: error.message,
        },
        {
          status: error.status,
        }
      );

    }


    /* =====================================================
       ERRO INTERNO
       ===================================================== */

    console.error(
      "[AUTH CONTROLLER] Erro ao realizar login:",
      error
    );


    return NextResponse.json(
      {
        erro:
          "Não foi possível realizar o login.",
      },
      {
        status: 500,
      }
    );

  }

}
/* =========================================================
   CONTROLLER - USUÁRIO AUTENTICADO
   =========================================================
   Endpoint utilizado para descobrir qual usuário
   está atualmente autenticado.

   Não recebe e-mail nem senha.

   A identificação acontece através do cookie
   padua_session.
   ========================================================= */

export async function usuarioAutenticadoController(
  request: Request
) {

  try {

    /* =====================================================
       LER COOKIE DA REQUISIÇÃO
       ===================================================== */

    const cookieHeader =
      request.headers.get("cookie");


    /* =====================================================
       VERIFICAR SE EXISTE COOKIE
       ===================================================== */

    if (!cookieHeader) {

      return NextResponse.json(
        {
          erro: "Usuário não autenticado.",
        },
        {
          status: 401,
        }
      );

    }


    /* =====================================================
       LOCALIZAR COOKIE padua_session
       ===================================================== */

    const cookies =
      cookieHeader.split(";");


    const sessionCookie =
      cookies.find((cookie) =>
        cookie
          .trim()
          .startsWith("padua_session=")
      );


    if (!sessionCookie) {

      return NextResponse.json(
        {
          erro: "Usuário não autenticado.",
        },
        {
          status: 401,
        }
      );

    }


    /* =====================================================
       EXTRAIR TOKEN
       ===================================================== */

    const token =
      sessionCookie
        .trim()
        .substring(
          "padua_session=".length
        );


    /* =====================================================
       VALIDAR JWT
       ===================================================== */

    const payload =
      await validarAuthToken(token);

      
    /* =========================================================
      VERIFICAR SE A SESSÃO CONTINUA VÁLIDA
      ========================================================= */

        const sessaoValida = await verificarVersaoSessao(
          payload.usuarioId as number,
          payload.versaoSessao as number
        );

        if (!sessaoValida) {
          return NextResponse.json(
            { erro: "Sessão revogada. Faça login novamente." },
            { status: 401 }
          );
        }



    /* =====================================================
       OBTER ID DO USUÁRIO
       ===================================================== */

    const usuarioId =
      Number(payload.usuarioId);


    if (
      !usuarioId ||
      Number.isNaN(usuarioId)
    ) {

      return NextResponse.json(
        {
          erro: "Sessão inválida.",
        },
        {
          status: 401,
        }
      );

    }


    /* =====================================================
       BUSCAR USUÁRIO NO BANCO
       ===================================================== */

    const usuario =
      await obterUsuarioAutenticado(
        usuarioId
      );


    /* =====================================================
       RESPOSTA
       ===================================================== */

    return NextResponse.json(
      {
        autenticado: true,
        usuario,
      },
      {
        status: 200,
      }
    );

  } catch (error) {

    /* =====================================================
       TOKEN INVÁLIDO OU EXPIRADO
       =====================================================
       Também evitamos expor detalhes internos do JWT
       para o cliente.
       ===================================================== */

    console.error(
      "[AUTH CONTROLLER] Sessão inválida:",
      error
    );


    return NextResponse.json(
      {
        erro:
          "Sessão inválida ou expirada.",
      },
      {
        status: 401,
      }
    );

  }

}


/* =========================================================
   CONTROLLER - ATUALIZAR DADOS CADASTRAIS
   =========================================================
   Responsável por:

   1. Identificar o usuário pela sessão JWT
   2. Receber os dados enviados pelo cliente
   3. Chamar o Service de atualização
   4. Retornar os dados atualizados

   O ID do usuário nunca é recebido do formulário.
   ========================================================= */

export async function atualizarUsuarioController(
  request: Request
) {
  try {
    /* =====================================================
       IDENTIFICAR COOKIE DE AUTENTICAÇÃO
       ===================================================== */

    const cookieHeader = request.headers.get("cookie");

    const sessionCookie = cookieHeader
      ?.split(";")
      .find((cookie) =>
        cookie.trim().startsWith("padua_session=")
      );

    if (!sessionCookie) {
      return NextResponse.json(
        { erro: "Usuário não autenticado." },
        { status: 401 }
      );
    }

    /* =====================================================
       VALIDAR TOKEN JWT
       ===================================================== */

    const token = sessionCookie
      .trim()
      .substring("padua_session=".length);

    let usuarioId: number;

    try {
      const payload = await validarAuthToken(token);

      
/* =========================================================
   VERIFICAR SE A SESSÃO CONTINUA VÁLIDA
   ========================================================= */

    const sessaoValida = await verificarVersaoSessao(
      payload.usuarioId as number,
      payload.versaoSessao as number
    );

    if (!sessaoValida) {
      return NextResponse.json(
        { erro: "Sessão revogada. Faça login novamente." },
        { status: 401 }
      );
    }


      usuarioId = Number(payload.usuarioId);

      if (!Number.isSafeInteger(usuarioId) || usuarioId <= 0) {
        return NextResponse.json(
          { erro: "Sessão inválida." },
          { status: 401 }
        );
      }
    } catch {
      return NextResponse.json(
        { erro: "Sessão inválida ou expirada." },
        { status: 401 }
      );
    }

    /* =====================================================
       VALIDAR ORIGEM DA REQUISIÇÃO
       =====================================================
       Ajuda a impedir alterações enviadas por sites
       externos utilizando o cookie do cliente.
       ===================================================== */

    const origin = request.headers.get("origin");

    if (!origin) {
      return NextResponse.json(
        { erro: "Origem da requisição não informada." },
        { status: 403 }
      );
    }

    try {
      const origem = new URL(origin);
      const destino = new URL(request.url);

      if (origem.origin !== destino.origin) {
        return NextResponse.json(
          { erro: "Origem da requisição não autorizada." },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { erro: "Origem da requisição inválida." },
        { status: 403 }
      );
    }

    /* =====================================================
       RECEBER E VALIDAR JSON
       ===================================================== */

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { erro: "JSON inválido." },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { erro: "Dados cadastrais inválidos." },
        { status: 400 }
      );
    }

    const dados = body as Record<string, unknown>;

    /* =====================================================
       VALIDAR CAMPOS RECEBIDOS
       =====================================================
       Não permitimos alterações de senha, perfil ou ID
       através desta operação.
       ===================================================== */

    const camposPermitidos = [
      "nome",
      "sobrenome",
      "email",
      "telefone",
    ];

    const possuiCampoInvalido = Object.keys(dados).some(
      (campo) => !camposPermitidos.includes(campo)
    );

    if (possuiCampoInvalido) {
      return NextResponse.json(
        { erro: "A requisição contém campos não permitidos." },
        { status: 400 }
      );
    }

    if (
      typeof dados.nome !== "string" ||
      typeof dados.sobrenome !== "string" ||
      typeof dados.email !== "string" ||
      (
        dados.telefone !== undefined &&
        dados.telefone !== null &&
        typeof dados.telefone !== "string"
      )
    ) {
      return NextResponse.json(
        { erro: "Dados cadastrais inválidos." },
        { status: 400 }
      );
    }

    /* =====================================================
       ATUALIZAR DADOS PELO SERVICE
       ===================================================== */

    const usuario = await atualizarDadosCadastrais(
      usuarioId,
      {
        nome: dados.nome,
        sobrenome: dados.sobrenome,
        email: dados.email,
        telefone: dados.telefone ?? null,
      }
    );

    return NextResponse.json(
      {
        mensagem: "Dados atualizados com sucesso.",
        usuario,
      },
      { status: 200 }
    );

  } catch (error) {
    /* =====================================================
       ERROS DE NEGÓCIO
       ===================================================== */

    if (error instanceof AuthServiceError) {
      return NextResponse.json(
        { erro: error.message },
        { status: error.status }
      );
    }

    /* =====================================================
       E-MAIL DUPLICADO NO BANCO
       =====================================================
       Trata também conflitos que aconteçam entre
       a verificação do Service e a gravação no MySQL.
       ===================================================== */

    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { erro: "Este e-mail já está sendo utilizado." },
        { status: 409 }
      );
    }

    console.error(
      "[AUTH CONTROLLER] Erro ao atualizar cadastro:",
      error
    );

    return NextResponse.json(
      { erro: "Não foi possível atualizar os dados." },
      { status: 500 }
    );
  }
}


/* =========================================================
   CONTROLLER - ALTERAR SENHA DO USUÁRIO - PÁDUA
   =========================================================
   Responsabilidades:

   1. Validar a sessão JWT.
   2. Verificar a origem da requisição.
   3. Validar os campos recebidos.
   4. Chamar o Service de alteração de senha.
   5. Retornar uma resposta segura.

   O ID do usuário vem exclusivamente da sessão.
   ========================================================= */

export async function alterarSenhaController(
  request: Request
) {
  try {

    /* =====================================================
       IDENTIFICAR COOKIE DE AUTENTICAÇÃO
       ===================================================== */

    const cookieHeader = request.headers.get("cookie");

    const sessionCookie = cookieHeader
      ?.split(";")
      .find((cookie) =>
        cookie.trim().startsWith("padua_session=")
      );

    if (!sessionCookie) {
      return NextResponse.json(
        { erro: "Usuário não autenticado." },
        { status: 401 }
      );
    }

    /* =====================================================
       VALIDAR TOKEN JWT
       ===================================================== */

    const token = sessionCookie
      .trim()
      .substring("padua_session=".length);

    let usuarioId: number;

    try {
      const payload = await validarAuthToken(token);

            
      /* =========================================================
        VERIFICAR SE A SESSÃO CONTINUA VÁLIDA
        ========================================================= */

        const sessaoValida = await verificarVersaoSessao(
          payload.usuarioId as number,
          payload.versaoSessao as number
        );

        if (!sessaoValida) {
          return NextResponse.json(
            { erro: "Sessão revogada. Faça login novamente." },
            { status: 401 }
          );
        }


      usuarioId = Number(payload.usuarioId);

      if (
        !Number.isSafeInteger(usuarioId) ||
        usuarioId <= 0
      ) {
        return NextResponse.json(
          { erro: "Sessão inválida." },
          { status: 401 }
        );
      }
    } catch {
      return NextResponse.json(
        { erro: "Sessão inválida ou expirada." },
        { status: 401 }
      );
    }

    /* =====================================================
       VALIDAR ORIGEM DA REQUISIÇÃO
       =====================================================
       Proteção adicional contra requisições externas
       que tentem utilizar o cookie do cliente.
       ===================================================== */

    const origin = request.headers.get("origin");

    if (!origin) {
      return NextResponse.json(
        { erro: "Origem da requisição não informada." },
        { status: 403 }
      );
    }

    try {
      const origem = new URL(origin);
      const destino = new URL(request.url);

      if (origem.origin !== destino.origin) {
        return NextResponse.json(
          { erro: "Origem da requisição não autorizada." },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { erro: "Origem da requisição inválida." },
        { status: 403 }
      );
    }

    /* =====================================================
       RECEBER E VALIDAR JSON
       ===================================================== */

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { erro: "JSON inválido." },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return NextResponse.json(
        { erro: "Dados de senha inválidos." },
        { status: 400 }
      );
    }

    const dados = body as Record<string, unknown>;

    /* =====================================================
       VALIDAR CAMPOS PERMITIDOS
       =====================================================
       Não aceitamos ID, perfil, email ou senhaHash
       enviados pelo navegador.
       ===================================================== */

    const camposPermitidos = [
      "senhaAtual",
      "novaSenha",
      "confirmarNovaSenha",
    ];

    const possuiCampoInvalido = Object.keys(dados).some(
      (campo) => !camposPermitidos.includes(campo)
    );

    if (possuiCampoInvalido) {
      return NextResponse.json(
        { erro: "A requisição contém campos não permitidos." },
        { status: 400 }
      );
    }

    if (
      typeof dados.senhaAtual !== "string" ||
      typeof dados.novaSenha !== "string" ||
      typeof dados.confirmarNovaSenha !== "string"
    ) {
      return NextResponse.json(
        { erro: "Dados de senha inválidos." },
        { status: 400 }
      );
    }

    /* =====================================================
       CHAMAR SERVICE DE ALTERAÇÃO DE SENHA
       ===================================================== */

    const resultado = await alterarSenhaUsuario(
      usuarioId,
      {
        senhaAtual: dados.senhaAtual,
        novaSenha: dados.novaSenha,
        confirmarNovaSenha: dados.confirmarNovaSenha,
      }
    );

/* =========================================================
   ENCERRAR SESSÃO APÓS ALTERAÇÃO DE SENHA
   ========================================================= */

    const response = NextResponse.json(
      resultado,
      { status: 200 }
    );

    // Remove o cookie de autenticação do navegador.
    response.cookies.delete("padua_session");

    return response;

  } catch (error) {

    /* =====================================================
       ERROS DE NEGÓCIO
       ===================================================== */

    if (error instanceof AuthServiceError) {
      return NextResponse.json(
        { erro: error.message },
        { status: error.status }
      );
    }

    /* =====================================================
       ERRO INTERNO
       ===================================================== */

    console.error(
      "[AUTH CONTROLLER] Erro ao alterar senha:",
      error
    );

    return NextResponse.json(
      { erro: "Não foi possível alterar a senha." },
      { status: 500 }
    );
  }
}

