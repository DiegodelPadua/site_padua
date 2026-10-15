
/* =========================================================
   ROTA DO USUÁRIO AUTENTICADO - PÁDUA
   =========================================================
   Endpoints:

   GET /api/auth/me
   Consulta os dados do usuário autenticado.

   PUT /api/auth/me
   Atualiza os dados cadastrais do usuário autenticado.

   Ambos utilizam o cookie padua_session.
   ========================================================= */

import {
  usuarioAutenticadoController,
  atualizarUsuarioController,
} from "../../../../src/controllers/authController";


/* =========================================================
   GET /api/auth/me
   =========================================================
   Consulta os dados do usuário autenticado.
   ========================================================= */

export async function GET(
  request: Request
) {
  return usuarioAutenticadoController(
    request
  );
}


/* =========================================================
   PUT /api/auth/me
   =========================================================
   Atualiza os dados cadastrais do usuário autenticado.

   O Controller valida a sessão JWT antes de permitir
   qualquer alteração no banco de dados.
   ========================================================= */

export async function PUT(
  request: Request
) {
  return atualizarUsuarioController(
    request
  );
}
