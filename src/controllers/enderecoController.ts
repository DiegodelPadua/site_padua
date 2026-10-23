
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

    // Proteção básica contra requisições de outra origem.
    const origem = request.headers.get("origin");

    if (!origem || origem !== new URL(request.url).origin) {
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
