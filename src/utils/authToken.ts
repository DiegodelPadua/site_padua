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
};


/* =========================================================
   OBTER CHAVE SECRETA
   ========================================================= */

function obterChaveSecreta() {

  const segredo =
    process.env.JWT_SECRET;

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

  const chave =
    obterChaveSecreta();


  return new SignJWT({
    usuarioId: payload.usuarioId,
    email: payload.email,
    perfil: payload.perfil,
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
       O usuário permanecerá autenticado por 7 dias,
       salvo se fizermos logout antes.
       ===================================================== */

    .setExpirationTime("7d")


    /* =====================================================
       ASSINAR TOKEN
       ===================================================== */

    .sign(chave);

}


/* =========================================================
   VALIDAR TOKEN
   ========================================================= */

export async function validarAuthToken(
  token: string
) {

  const chave =
    obterChaveSecreta();


  const { payload } =
    await jwtVerify(
      token,
      chave
    );


  return payload;

}