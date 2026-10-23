
import {
  listarEnderecosController,
  cadastrarEnderecoController,
} from "../../../src/controllers/enderecoController";

/* =========================================================
   ROTAS DE ENDEREÇOS - PÁDUA CULTURE

   GET  /api/enderecos - Listar endereços
   POST /api/enderecos - Cadastrar endereço
   ========================================================= */

export async function GET() {
  return listarEnderecosController();
}

export async function POST(request: Request) {
  return cadastrarEnderecoController(request);
}
