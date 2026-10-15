
import { NextResponse } from "next/server";

/* =========================================================
   LOGOUT - PÁDUA CULTURE
   =========================================================
   Encerra a sessão do cliente removendo o cookie JWT.
   ========================================================= */

export async function POST() {
  const response = NextResponse.json(
    {
      mensagem: "Sessão encerrada com sucesso.",
    },
    {
      status: 200,
    }
  );

  // Remove o cookie de autenticação no navegador.
  response.cookies.set("padua_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
