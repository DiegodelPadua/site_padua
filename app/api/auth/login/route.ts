/* =========================================================
   ROTA DE LOGIN - PÁDUA
   =========================================================
   Endpoint:

   POST /api/auth/login

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

import {
  loginController,
} from "../../../../src/controllers/authController";


/* =========================================================
   POST /api/auth/login
   ========================================================= */

export async function POST(request: Request) {

  return loginController(request);

}