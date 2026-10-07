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

import { NextResponse } from "next/server";

import {
  cadastrarUsuario,
  autenticarUsuario,
  obterUsuarioAutenticado,
  AuthServiceError,
} from "../services/authService";

import {
  gerarAuthToken,
  validarAuthToken,
} from "../utils/authToken";


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


    /* =====================================================
       GERAR TOKEN JWT
       =====================================================
       O token identifica o usuário autenticado.

       Não colocamos senha nem senhaHash dentro do token.
       ===================================================== */

    const token =
      await gerarAuthToken({
        usuarioId: usuario.id,
        email: usuario.email,
        perfil: usuario.perfil,
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