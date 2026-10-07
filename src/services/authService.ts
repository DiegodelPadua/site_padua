/* =========================================================
   AUTH SERVICE - PÁDUA
   =========================================================
   Responsável pelas regras de negócio relacionadas
   à autenticação e ao cadastro de usuários.

   Fluxo:

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

import bcrypt from "bcryptjs";

import {
  buscarUsuarioPorEmail,
  buscarUsuarioPorId,
  criarUsuario,
} from "../repositories/usuarioRepository";


/* =========================================================
   TIPO DOS DADOS DE CADASTRO
   ========================================================= */

type CadastroData = {
  nome: string;
  sobrenome: string;
  email: string;
  telefone?: string;
  senha: string;
};


/* =========================================================
   ERRO DE NEGÓCIO
   =========================================================
   Permite que o Controller saiba qual status HTTP deve
   retornar sem colocar regras HTTP dentro do Service.
   ========================================================= */

export class AuthServiceError extends Error {

  status: number;

  constructor(
    mensagem: string,
    status: number
  ) {

    super(mensagem);

    this.name = "AuthServiceError";
    this.status = status;

  }

}


/* =========================================================
   CADASTRAR USUÁRIO
   ========================================================= */

export async function cadastrarUsuario(
  dados: CadastroData
) {

  /* =======================================================
     VALIDAR CAMPOS OBRIGATÓRIOS
     ======================================================= */

  if (
    !dados.nome ||
    !dados.sobrenome ||
    !dados.email ||
    !dados.senha
  ) {

    throw new AuthServiceError(
      "Preencha todos os campos obrigatórios.",
      400
    );

  }


  /* =======================================================
     NORMALIZAR DADOS
     ======================================================= */

  const nome = dados.nome.trim();

  const sobrenome = dados.sobrenome.trim();

  const email =
    dados.email.toLowerCase().trim();

  const telefone =
    dados.telefone?.trim() || null;


  /* =======================================================
     VALIDAR SENHA
     ======================================================= */

  if (dados.senha.length < 8) {

    throw new AuthServiceError(
      "A senha deve possuir pelo menos 8 caracteres.",
      400
    );

  }


  /* =======================================================
     VERIFICAR SE O E-MAIL JÁ EXISTE
     ======================================================= */

  const usuarioExistente =
    await buscarUsuarioPorEmail(email);


  if (usuarioExistente) {

    throw new AuthServiceError(
      "Já existe uma conta com este e-mail.",
      409
    );

  }


  /* =======================================================
     GERAR HASH DA SENHA
     =======================================================
     A senha original nunca será enviada ao Repository
     e nunca será armazenada no banco.
     ======================================================= */

  const senhaHash =
    await bcrypt.hash(
      dados.senha,
      12
    );


  /* =======================================================
     CRIAR USUÁRIO
     ======================================================= */

  const usuario =
    await criarUsuario({
      nome,
      sobrenome,
      email,
      telefone,
      senhaHash,
    });


  /* =======================================================
     RETORNAR USUÁRIO
     ======================================================= */

  return usuario;

}
/* =========================================================
   TIPO DOS DADOS DE LOGIN
   ========================================================= */

type LoginData = {
  email: string;
  senha: string;
};


/* =========================================================
   AUTENTICAR USUÁRIO
   =========================================================
   Responsável por:

   1. Validar os dados recebidos
   2. Normalizar o e-mail
   3. Buscar o usuário
   4. Comparar a senha com o hash
   5. Retornar os dados seguros do usuário
   ========================================================= */

export async function autenticarUsuario(
  dados: LoginData
) {

  /* =======================================================
     VALIDAR CAMPOS OBRIGATÓRIOS
     ======================================================= */

  if (!dados.email || !dados.senha) {

    throw new AuthServiceError(
      "E-mail e senha são obrigatórios.",
      400
    );

  }


  /* =======================================================
     NORMALIZAR E-MAIL
     ======================================================= */

  const email =
    dados.email.toLowerCase().trim();


  /* =======================================================
     BUSCAR USUÁRIO
     ======================================================= */

  const usuario =
    await buscarUsuarioPorEmail(email);


  /* =======================================================
     USUÁRIO NÃO ENCONTRADO
     =======================================================
     Usamos uma mensagem genérica para não informar
     se determinado e-mail existe no sistema.
     ======================================================= */

  if (!usuario) {

    throw new AuthServiceError(
      "E-mail ou senha inválidos.",
      401
    );

  }


  /* =======================================================
     COMPARAR SENHA
     =======================================================
     bcrypt compara a senha digitada com o hash armazenado
     no banco de dados.
     ======================================================= */

  const senhaCorreta =
    await bcrypt.compare(
      dados.senha,
      usuario.senhaHash
    );


  if (!senhaCorreta) {

    throw new AuthServiceError(
      "E-mail ou senha inválidos.",
      401
    );

  }


  /* =======================================================
     RETORNAR DADOS SEGUROS DO USUÁRIO
     =======================================================
     Nunca retornamos senhaHash para o frontend.
     ======================================================= */

  return {
    id: usuario.id,
    nome: usuario.nome,
    sobrenome: usuario.sobrenome,
    email: usuario.email,
    telefone: usuario.telefone,
    perfil: usuario.perfil,
  };

}
/* =========================================================
   OBTER USUÁRIO AUTENTICADO
   =========================================================
   Recebe o ID recuperado do token JWT e consulta
   os dados atuais do usuário no banco.

   Isso é melhor do que confiar somente nos dados
   armazenados dentro do token.
   ========================================================= */

export async function obterUsuarioAutenticado(
  usuarioId: number
) {

  /* =======================================================
     BUSCAR USUÁRIO
     ======================================================= */

  const usuario =
    await buscarUsuarioPorId(
      usuarioId
    );


  /* =======================================================
     USUÁRIO NÃO ENCONTRADO
     ======================================================= */

  if (!usuario) {

    throw new AuthServiceError(
      "Usuário não encontrado.",
      404
    );

  }


  return usuario;

}