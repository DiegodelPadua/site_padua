import { cookies } from "next/headers";
import { prisma } from "../../lib/prisma";
import { validarAuthToken } from "./authToken";

/* =========================================================
   AUTENTICAÇÃO DO USUÁRIO - PÁDUA CULTURE
   =========================================================
   Valida a sessão de qualquer usuário autenticado.

   Utilizado por:
   - Checkout
   - Endereços
   - Pedidos
   - Funcionalidades da conta do cliente

   Não exige perfil ADMIN.
   ========================================================= */

export async function verificarUsuarioAutenticado() {

  /* =======================================================
     RECUPERAR COOKIE DE SESSÃO
     ======================================================= */

  const cookieStore = await cookies();

  const token = cookieStore.get("padua_session")?.value;

  if (!token) {
    return null;
  }

  try {

    /* =====================================================
       VALIDAR JWT
       ===================================================== */

    const payload = await validarAuthToken(token);

    // O ID precisa representar um usuário válido.
    const usuarioId = Number(payload.usuarioId);

    if (
      !Number.isSafeInteger(usuarioId) ||
      usuarioId <= 0
    ) {
      return null;
    }

    /* =====================================================
       CONSULTAR USUÁRIO NO MYSQL
       ===================================================== */

    const usuario = await prisma.usuario.findUnique({
      where: {
        id: usuarioId,
      },
      select: {
        id: true,
        nome: true,
        sobrenome: true,
        email: true,
        telefone: true,
        perfil: true,
        versaoSessao: true,
      },
    });

    if (!usuario) {
      return null;
    }

    /* =====================================================
       VERIFICAR VERSÃO DA SESSÃO
       ===================================================== */

    if (usuario.versaoSessao !== payload.versaoSessao) {
      return null;
    }

    /* =====================================================
       RETORNAR USUÁRIO AUTENTICADO
       ===================================================== */

    return usuario;

  } catch (error) {

    // Token inválido, expirado ou falha na consulta.
    console.error(
      "[USER AUTH] Falha ao validar sessão:",
      error
    );

    return null;
  }
}