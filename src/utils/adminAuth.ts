
import { cookies } from "next/headers";
import { prisma } from "../../lib/prisma";
import { validarAuthToken } from "./authToken";

/* =========================================================
   AUTORIZAÇÃO ADMINISTRATIVA - PÁDUA
   =========================================================
   Confirma a sessão e consulta o perfil atualizado
   diretamente no banco de dados.
   ========================================================= */

export async function verificarAdministrador() {
  // Recupera o cookie de autenticação.
  const cookieStore = await cookies();
  const token = cookieStore.get("padua_session")?.value;

  if (!token) {
    return null;
  }

  try {
    // Valida a assinatura, a expiração e o payload do JWT.
    const payload = await validarAuthToken(token);

    // Busca os dados atuais do usuário no MySQL.
    const usuario = await prisma.usuario.findUnique({
      where: {
        id: payload.usuarioId as number,
      },
      select: {
        id: true,
        nome: true,
        email: true,
        perfil: true,
        versaoSessao: true,
      },
    });

    if (!usuario) {
      return null;
    }

    // Rejeita sessões revogadas ou antigas.
    if (usuario.versaoSessao !== payload.versaoSessao) {
      return null;
    }

    // Somente o perfil ADMIN tem autorização.
    if (usuario.perfil !== "ADMIN") {
      return null;
    }

    return usuario;
  } catch (error) {
    // Token inválido, expirado ou erro na consulta.
    console.error(
      "[ADMIN AUTH] Falha ao validar administrador:",
      error
    );

    return null;
  }
}
