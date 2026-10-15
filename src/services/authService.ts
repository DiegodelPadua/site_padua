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
  atualizarUsuario,
  atualizarSenhaUsuario,
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


/* =========================================================
   RETORNAR DADOS SEGUROS DO USUÁRIO
   =========================================================
   A versão será utilizada para gerar o JWT.

   Nunca retornar senhaHash.
   ========================================================= */

  return {
    id: usuario.id,
    nome: usuario.nome,
    sobrenome: usuario.sobrenome,
    email: usuario.email,
    telefone: usuario.telefone,
    perfil: usuario.perfil,

    versaoSessao: usuario.versaoSessao,
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


/* =========================================================
   TIPO DOS DADOS DE ATUALIZAÇÃO CADASTRAL
   =========================================================
   Define os campos que o cliente poderá atualizar.
   ========================================================= */

type AtualizacaoCadastralData = {
  nome: string;
  sobrenome: string;
  email: string;
  telefone?: string | null;
};


/* =========================================================
   ATUALIZAR DADOS CADASTRAIS - PÁDUA
   =========================================================
   Responsável por:

   1. Validar os campos recebidos
   2. Normalizar os dados
   3. Verificar se o usuário existe
   4. Impedir e-mails duplicados
   5. Atualizar o cadastro pelo Repository
   6. Retornar os dados atualizados

   O ID deverá vir da sessão JWT validada pelo Controller.
   ========================================================= */

export async function atualizarDadosCadastrais(
  usuarioId: number,
  dados: AtualizacaoCadastralData
) {

  /* =======================================================
     VALIDAR TIPOS E CAMPOS OBRIGATÓRIOS
     ======================================================= */

  if (
    !dados ||
    typeof dados.nome !== "string" ||
    typeof dados.sobrenome !== "string" ||
    typeof dados.email !== "string" ||
    (
      dados.telefone !== undefined &&
      dados.telefone !== null &&
      typeof dados.telefone !== "string"
    )
  ) {
    throw new AuthServiceError(
      "Dados cadastrais inválidos.",
      400
    );
  }

  /* =======================================================
     NORMALIZAR DADOS
     ======================================================= */

  const nome = dados.nome.trim();
  const sobrenome = dados.sobrenome.trim();
  const email = dados.email.trim().toLowerCase();
  const telefone = dados.telefone?.trim() || null;

  if (!nome || !sobrenome || !email) {
    throw new AuthServiceError(
      "Nome, sobrenome e e-mail são obrigatórios.",
      400
    );
  }

  // Validação básica do formato de e-mail.
  const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!formatoEmail.test(email)) {
    throw new AuthServiceError(
      "Informe um e-mail válido.",
      400
    );
  }

  /* =======================================================
     VERIFICAR SE O USUÁRIO EXISTE
     ======================================================= */

  const usuarioAtual = await buscarUsuarioPorId(usuarioId);

  if (!usuarioAtual) {
    throw new AuthServiceError(
      "Usuário não encontrado.",
      404
    );
  }

  /* =======================================================
     VERIFICAR DUPLICIDADE DE E-MAIL
     =======================================================
     Se o e-mail pertence ao próprio usuário, permitimos.
     Se pertence a outro usuário, bloqueamos.
     ======================================================= */

  if (email !== usuarioAtual.email) {
    const usuarioComEmail = await buscarUsuarioPorEmail(email);

    if (usuarioComEmail && usuarioComEmail.id !== usuarioId) {
      throw new AuthServiceError(
        "Este e-mail já está sendo utilizado.",
        409
      );
    }
  }

  /* =======================================================
     ATUALIZAR CADASTRO
     ======================================================= */

  const usuarioAtualizado = await atualizarUsuario(
    usuarioId,
    {
      nome,
      sobrenome,
      email,
      telefone,
    }
  );

  return usuarioAtualizado;
}


/* =========================================================
   TIPO DOS DADOS DE ALTERAÇÃO DE SENHA
   ========================================================= */

type AlteracaoSenhaData = {
  senhaAtual: string;
  novaSenha: string;
  confirmarNovaSenha: string;
};

/* =========================================================
   ALTERAR SENHA DO USUÁRIO - PÁDUA
   =========================================================
   Responsabilidades:

   1. Validar os campos recebidos.
   2. Identificar o usuário autenticado.
   3. Verificar a senha atual.
   4. Validar a nova senha.
   5. Impedir reutilização da senha atual.
   6. Gerar um novo hash com bcrypt.
   7. Atualizar o banco pelo Repository.

   O ID do usuário deverá vir do JWT validado
   pelo Controller, nunca do formulário.
   ========================================================= */

export async function alterarSenhaUsuario(
  usuarioId: number,
  dados: AlteracaoSenhaData
) {

  /* =======================================================
     VALIDAR OS DADOS RECEBIDOS
     ======================================================= */

  if (
    !dados ||
    typeof dados.senhaAtual !== "string" ||
    typeof dados.novaSenha !== "string" ||
    typeof dados.confirmarNovaSenha !== "string"
  ) {
    throw new AuthServiceError(
      "Dados de alteração de senha inválidos.",
      400
    );
  }

  const {
    senhaAtual,
    novaSenha,
    confirmarNovaSenha,
  } = dados;

  if (
    !senhaAtual ||
    !novaSenha ||
    !confirmarNovaSenha
  ) {
    throw new AuthServiceError(
      "Preencha todos os campos de senha.",
      400
    );
  }

  /* =======================================================
     VALIDAR A NOVA SENHA
     ======================================================= */

  if (novaSenha.length < 8) {
    throw new AuthServiceError(
      "A nova senha deve possuir pelo menos 8 caracteres.",
      400
    );
  }

  if (novaSenha !== confirmarNovaSenha) {
    throw new AuthServiceError(
      "A confirmação da nova senha não corresponde.",
      400
    );
  }

  /* =======================================================
     CONSULTAR O USUÁRIO AUTENTICADO
     ======================================================= */

  const usuarioAtual = await buscarUsuarioPorId(
    usuarioId
  );

  if (!usuarioAtual) {
    throw new AuthServiceError(
      "Usuário não encontrado.",
      404
    );
  }

  // Consulta interna para obter o hash da senha.
  const usuarioComSenha = await buscarUsuarioPorEmail(
    usuarioAtual.email
  );

  if (!usuarioComSenha) {
    throw new AuthServiceError(
      "Usuário não encontrado.",
      404
    );
  }

  /* =======================================================
     VERIFICAR A SENHA ATUAL
     ======================================================= */

  const senhaAtualCorreta = await bcrypt.compare(
    senhaAtual,
    usuarioComSenha.senhaHash
  );

  if (!senhaAtualCorreta) {
    throw new AuthServiceError(
      "A senha atual está incorreta.",
      401
    );
  }

  /* =======================================================
     IMPEDIR REUTILIZAÇÃO DA SENHA
     ======================================================= */

  const senhaJaUtilizada = await bcrypt.compare(
    novaSenha,
    usuarioComSenha.senhaHash
  );

  if (senhaJaUtilizada) {
    throw new AuthServiceError(
      "A nova senha deve ser diferente da senha atual.",
      400
    );
  }

  /* =======================================================
     GERAR NOVO HASH
     ======================================================= */

  const novaSenhaHash = await bcrypt.hash(
    novaSenha,
    12
  );

  /* =======================================================
     ATUALIZAR SENHA NO BANCO DE DADOS
     ======================================================= */

  await atualizarSenhaUsuario(
    usuarioId,
    novaSenhaHash
  );

  // Nunca retornar senhas ou hashes ao frontend.
  return {
    mensagem: "Senha alterada com sucesso.",
  };
}

