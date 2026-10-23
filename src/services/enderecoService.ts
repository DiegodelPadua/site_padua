
/* =========================================================
   IMPORTAÇÕES DO REPOSITORY DE ENDEREÇOS
   ========================================================= */

import {
  criarEnderecoComTransacao,
  listarEnderecosPorUsuario,
  type DadosEndereco,
} from "../repositories/enderecoRepository";

/* =========================================================
   SERVICE DE ENDEREÇOS - PÁDUA CULTURE
   Validação dos dados e regras de negócio.
   ========================================================= */

export class ErroEndereco extends Error {
  constructor(
    mensagem: string,
    public readonly status = 400
  ) {
    super(mensagem);
    this.name = "ErroEndereco";
  }
}

export async function consultarEnderecos(usuarioId: number) {
  return listarEnderecosPorUsuario(usuarioId);
}

export async function cadastrarEndereco(
  usuarioId: number,
  entrada: unknown
) {
  // Não confiar diretamente nos dados enviados pelo navegador.
  if (
    !entrada ||
    typeof entrada !== "object" ||
    Array.isArray(entrada)
  ) {
    throw new ErroEndereco("Dados do endereço inválidos.");
  }

  const dados = entrada as Record<string, unknown>;

  // Campos obrigatórios devem ser textos válidos.
  function textoObrigatorio(
    campo: string,
    limite: number
  ): string {
    const valor = dados[campo];

    if (typeof valor !== "string") {
      throw new ErroEndereco(`Campo ${campo} inválido.`);
    }

    const texto = valor.trim();

    if (!texto || texto.length > limite) {
      throw new ErroEndereco(`Campo ${campo} inválido.`);
    }

    return texto;
  }

  // Campos opcionais também possuem limites no banco.
  function textoOpcional(
    campo: string,
    limite: number
  ): string | null {
    const valor = dados[campo];

    if (valor === undefined || valor === null || valor === "") {
      return null;
    }

    if (typeof valor !== "string" || valor.trim().length > limite) {
      throw new ErroEndereco(`Campo ${campo} inválido.`);
    }

    return valor.trim() || null;
  }

  // CEP é armazenado no MySQL com exatamente oito dígitos.
  const cep = textoObrigatorio("cep", 9).replace(/\D/g, "");

  if (!/^\d{8}$/.test(cep)) {
    throw new ErroEndereco("Informe um CEP válido com oito dígitos.");
  }

  // Estado deve ser uma sigla brasileira de duas letras.
  const estado = textoObrigatorio("estado", 2).toUpperCase();

  const estadosValidos = new Set([
    "AC", "AL", "AP", "AM", "BA", "CE", "DF",
    "ES", "GO", "MA", "MT", "MS", "MG",
    "PA", "PB", "PR", "PE", "PI", "RJ",
    "RN", "RS", "RO", "RR", "SC", "SP",
    "SE", "TO",
  ]);

  if (!estadosValidos.has(estado)) {
    throw new ErroEndereco("Estado inválido.");
  }

  const endereco: DadosEndereco = {
    apelido: textoOpcional("apelido", 50),
    destinatario: textoObrigatorio("destinatario", 150),
    cep,
    logradouro: textoObrigatorio("logradouro", 200),
    numero: textoObrigatorio("numero", 20),
    complemento: textoOpcional("complemento", 150),
    bairro: textoObrigatorio("bairro", 100),
    cidade: textoObrigatorio("cidade", 100),
    estado,
    principal: false,
  };

/* =========================================================
   CADASTRO SEGURO DO ENDEREÇO
   =========================================================

   O Repository controla a transação no MySQL.

   A definição do endereço principal acontece dentro
   da mesma transação utilizada para o cadastro.

   Isso evita dois endereços principais em requisições
   simultâneas que utilizem esse procedimento.
   ========================================================= */

return criarEnderecoComTransacao(usuarioId, endereco);
}
