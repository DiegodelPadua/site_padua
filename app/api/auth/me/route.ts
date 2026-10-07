/* =========================================================
   ROTA DO USUÁRIO AUTENTICADO - PÁDUA
   =========================================================
   Endpoint:

   GET /api/auth/me

   Utiliza o cookie padua_session para identificar
   o usuário autenticado.
   ========================================================= */

import {
  usuarioAutenticadoController,
} from "../../../../src/controllers/authController";


/* =========================================================
   GET /api/auth/me
   ========================================================= */

export async function GET(
  request: Request
) {

  return usuarioAutenticadoController(
    request
  );

}