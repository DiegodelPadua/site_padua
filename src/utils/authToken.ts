
/* =========================================================
   TOKEN DE AUTENTICAÇÃO - PÁDUA
   =========================================================
   Responsável pela criação e validação dos tokens JWT
   utilizados na sessão do usuário.

   IMPORTANTE:
   A chave secreta nunca deve ser colocada diretamente
   neste arquivo. Ela ficará no .env.
   ========================================================= */

import {
  SignJWT,
  jwtVerify,
} from "jose";


/* =========================================================
   TIPO DO PAYLOAD DO TOKEN
   ========================================================= */

export type AuthTokenPayload = {
  usuarioId: number;
  email: string;
  perfil: "CLIENTE" | "ADMIN";

  // Versão da sessão registrada no MySQL.
  versaoSessao: number;
};


/* =========================================================
   OBTER CHAVE SECRETA
   ========================================================= */

function obterChaveSecreta() {

  const segredo = process.env.JWT_SECRET;

  if (!segredo) {
    throw new Error(
      "JWT_SECRET não foi configurado."
    );
  }

  return new TextEncoder().encode(segredo);
}


/* =========================================================
   GERAR TOKEN
   ========================================================= */

export async function gerarAuthToken(
  payload: AuthTokenPayload
) {

  const chave = obterChaveSecreta();

  return new SignJWT({

    usuarioId: payload.usuarioId,
    email: payload.email,
    perfil: payload.perfil,

    // Inclui a versão atual da sessão no JWT.
    versaoSessao: payload.versaoSessao,

  })

    /* =====================================================
       ALGORITMO DE ASSINATURA
       ===================================================== */

    .setProtectedHeader({
      alg: "HS256",
    })

    /* =====================================================
       DATA DE CRIAÇÃO
       ===================================================== */

    .setIssuedAt()

    /* =====================================================
       TEMPO DE EXPIRAÇÃO
       =====================================================
       O token expira em 7 dias.

       A sessão também poderá ser invalidada antes
       desse prazo pela alteração da versão no MySQL.
       ===================================================== */

    .setExpirationTime("7d")

    /* =====================================================
       ASSINAR TOKEN
       ===================================================== */

    .sign(chave);
}


/* =========================================================
   VALIDAR TOKEN
   =========================================================
   Verifica a assinatura e a expiração do JWT.

   A comparação entre versaoSessao do token e do MySQL
   será realizada na camada de autenticação.

   Tokens antigos sem versaoSessao serão rejeitados
   quando essa comparação estiver implementada.
   ========================================================= */

export async function validarAuthToken(
  token: string
) {

  const chave = obterChaveSecreta();

  const { payload } = await jwtVerify(
    token,
    chave,
    {
      algorithms: ["HS256"],
    }
  );

  // Validação dos campos obrigatórios do JWT.
  if (
    typeof payload.usuarioId !== "number" ||
    !Number.isSafeInteger(payload.usuarioId) ||
    payload.usuarioId <= 0 ||
    typeof payload.email !== "string" ||
    !payload.email ||
    (
      payload.perfil !== "CLIENTE" &&
      payload.perfil !== "ADMIN"
    ) ||
    typeof payload.versaoSessao !== "number" ||
    !Number.isSafeInteger(payload.versaoSessao) ||
    payload.versaoSessao < 1
  ) {
    throw new Error(
      "Token de autenticação inválido."
    );
  }

  return payload;
}
