
import { NextResponse } from "next/server";
import { verificarUsuarioAutenticado } from "../utils/userAuth";
import {
  consultarEnderecos,
  cadastrarEndereco,
  ErroEndereco,
} from "../services/enderecoService";

/* =========================================================
   CONTROLLER DE ENDEREÇOS - PÁDUA CULTURE
   Recebe requisições e retorna respostas HTTP.
   ========================================================= */

export async function listarEnderecosController() {
  try {
    const usuario = await verificarUsuarioAutenticado();

    if (!usuario) {
      return NextResponse.json(
        { erro: "Você precisa estar autenticado." },
        { status: 401 }
      );
    }

    const enderecos = await consultarEnderecos(usuario.id);

    return NextResponse.json({ enderecos });
  } catch (error) {
    console.error("[ENDERECOS] Erro ao listar:", error);

    return NextResponse.json(
      { erro: "Não foi possível consultar os endereços." },
      { status: 500 }
    );
  }
}

export async function cadastrarEnderecoController(
  request: Request
) {
  try {
    const usuario = await verificarUsuarioAutenticado();

    if (!usuario) {
      return NextResponse.json(
        { erro: "Você precisa estar autenticado." },
        { status: 401 }
      );
    }

  /* =========================================================
    VALIDAÇÃO DE ORIGEM - PÁDUA CULTURE
    =========================================================
    Permite requisições POST realizadas pelo próprio site.

    A comparação utiliza uma origem pública confiável,
    evitando depender do endereço interno do servidor
    utilizado pela hospedagem.
    ========================================================= */

  // Obtém a origem informada pelo navegador.
  const origem = request.headers.get("origin");

  // Lista explícita de origens autorizadas.
  // Não utilizar curingas nem aceitar qualquer domínio.
  const origensPermitidas = new Set([
    "https://paduaculture.com.br",
    "https://www.paduaculture.com.br",
  ]);

  // Rejeita requisições sem Origin ou de outros domínios.
  if (!origem || !origensPermitidas.has(origem)) {
    return NextResponse.json(
      { erro: "Origem da requisição não autorizada." },
      { status: 403 }
    );
  }

    let dados: unknown;

    try {
      dados = await request.json();
    } catch {
      return NextResponse.json(
        { erro: "JSON inválido." },
        { status: 400 }
      );
    }

    const endereco = await cadastrarEndereco(
      usuario.id,
      dados
    );

    return NextResponse.json(
      { mensagem: "Endereço cadastrado.", endereco },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ErroEndereco) {
      return NextResponse.json(
        { erro: error.message },
        { status: error.status }
      );
    }

    console.error("[ENDERECOS] Erro ao cadastrar:", error);

    return NextResponse.json(
      { erro: "Não foi possível cadastrar o endereço." },
      { status: 500 }
    );
  }
}
