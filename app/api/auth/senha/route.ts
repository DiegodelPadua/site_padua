
/* =========================================================
   ROTA DE ALTERAÇÃO DE SENHA - PÁDUA CULTURE
   =========================================================

   Endpoint:
   PUT /api/auth/senha

   Responsável por encaminhar a requisição ao Controller.

   A validação da sessão JWT, da senha atual e da
   nova senha acontece nas camadas correspondentes.
   ========================================================= */

import {
  alterarSenhaController,
} from "../../../../src/controllers/authController";

/* =========================================================
   PUT /api/auth/senha
   ========================================================= */

export async function PUT(request: Request) {
  return alterarSenhaController(request);
}
