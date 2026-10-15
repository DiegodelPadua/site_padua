/* =========================================================
   USUÁRIO REPOSITORY - PÁDUA
   =========================================================
   Responsável exclusivamente pelo acesso aos dados
   relacionados aos usuários.

   Fluxo:

   Service
      ↓
   Repository
      ↓
   Prisma
      ↓
   MySQL

   Regras de negócio NÃO devem ficar neste arquivo.
   ========================================================= */

import { prisma } from "../../lib/prisma";


/* =========================================================
   TIPO PARA CRIAÇÃO DE USUÁRIO
   ========================================================= */

type CriarUsuarioData = {
  nome: string;
  sobrenome: string;
  email: string;
  telefone?: string | null;
  senhaHash: string;
};


/* =========================================================
   BUSCAR USUÁRIO PELO E-MAIL
   ========================================================= */

export async function buscarUsuarioPorEmail(email: string) {

  return prisma.usuario.findUnique({

    where: {
      email,
    },

  });

}


/* =========================================================
   CRIAR USUÁRIO
   ========================================================= */

export async function criarUsuario(
  dados: CriarUsuarioData
) {

  return prisma.usuario.create({

    data: {
      nome: dados.nome,
      sobrenome: dados.sobrenome,
      email: dados.email,
      telefone: dados.telefone,
      senhaHash: dados.senhaHash,
    },


    /* =====================================================
       DADOS QUE PODEM RETORNAR PARA A APLICAÇÃO

       senhaHash propositalmente NÃO é retornada.
       ===================================================== */

    select: {
      id: true,
      nome: true,
      sobrenome: true,
      email: true,
      telefone: true,
      perfil: true,
      criadoEm: true,
    },

  });

}
/* =========================================================
   BUSCAR USUÁRIO PELO ID
   =========================================================
   Utilizado quando já conhecemos o ID do usuário,
   como acontece após a validação da sessão.
   ========================================================= */

export async function buscarUsuarioPorId(
  id: number
) {

  return prisma.usuario.findUnique({

    where: {
      id,
    },


    /* =====================================================
       DADOS SEGUROS DO USUÁRIO
       =====================================================
       senhaHash não será retornada.
       ===================================================== */

    select: {
      id: true,
      nome: true,
      sobrenome: true,
      email: true,
      telefone: true,
      perfil: true,
      criadoEm: true,
      atualizadoEm: true,
    },

  });

}

/* =========================================================
   TIPO PARA ATUALIZAÇÃO CADASTRAL
   =========================================================
   Define os campos que podem ser alterados pelo cliente.

   Campos como ID, perfil e senhaHash não podem ser
   modificados por esta operação.
   ========================================================= */

export type AtualizarUsuarioData = {
  nome: string;
  sobrenome: string;
  email: string;
  telefone: string | null;
};


/* =========================================================
   ATUALIZAR DADOS DO USUÁRIO
   =========================================================
   Atualiza os dados cadastrais pelo ID identificado
   através da sessão autenticada.

   O Repository apenas executa a operação no banco.
   As validações serão feitas na camada Service.
   ========================================================= */

export async function atualizarUsuario(
  id: number,
  dados: AtualizarUsuarioData
) {
  return prisma.usuario.update({
    where: {
      id,
    },

    data: {
      nome: dados.nome,
      sobrenome: dados.sobrenome,
      email: dados.email,
      telefone: dados.telefone,
    },

    // Retorna somente os dados permitidos.
    select: {
      id: true,
      nome: true,
      sobrenome: true,
      email: true,
      telefone: true,
      perfil: true,
      criadoEm: true,
      atualizadoEm: true,
    },
  });
}

/* =========================================================
   ATUALIZAR SENHA DO USUÁRIO - PÁDUA
   =========================================================
   Responsável exclusivamente por atualizar o hash
   da senha no banco de dados MySQL.

   O ID será obtido da sessão autenticada.

   IMPORTANTE:
   - A senha recebida já deve estar criptografada
     por hash na camada Service.
   - A senha atual deve ser validada no Service.
   - O Repository não recebe senhas em texto puro.
   - senhaHash não é retornada na resposta.
   ========================================================= */

export async function atualizarSenhaUsuario(
  id: number,
  novaSenhaHash: string
) {

  return prisma.usuario.update({

    // Identifica o usuário autenticado.
    where: {
      id,
    },
/* =========================================================
   ATUALIZAR SENHA E INVALIDAR SESSÕES ANTIGAS
   =========================================================
   As duas alterações acontecem na mesma operação
   do MySQL, evitando inconsistências.
   ========================================================= */

    data: {
      senhaHash: novaSenhaHash,

      versaoSessao: {
        increment: 1,
      },
    },

    // Retorna apenas informações seguras.
    select: {
      id: true,
      nome: true,
      email: true,
      atualizadoEm: true,
    },

  });

}
