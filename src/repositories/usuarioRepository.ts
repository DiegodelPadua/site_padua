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