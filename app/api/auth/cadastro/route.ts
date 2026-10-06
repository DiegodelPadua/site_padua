/* =========================================================
   API DE CADASTRO - PÁDUA
   =========================================================
   Responsável por:
   - receber os dados do formulário;
   - validar os dados;
   - verificar se o e-mail já existe;
   - gerar o hash da senha;
   - cadastrar o usuário no MySQL.
   ========================================================= */

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { prisma } from "../../../../lib/prisma";


/* =========================================================
   POST /api/auth/cadastro
   ========================================================= */

export async function POST(request: Request) {

  try {

    /* =====================================================
       RECEBER DADOS
       ===================================================== */

    const body = await request.json();

    const {
      nome,
      sobrenome,
      email,
      telefone,
      senha,
    } = body;


    /* =====================================================
       VALIDAR CAMPOS OBRIGATÓRIOS
       ===================================================== */

    if (
      !nome ||
      !sobrenome ||
      !email ||
      !senha
    ) {

      return NextResponse.json(
        {
          erro: "Preencha todos os campos obrigatórios.",
        },
        {
          status: 400,
        }
      );

    }


    /* =====================================================
       VALIDAR TAMANHO DA SENHA
       ===================================================== */

    if (senha.length < 8) {

      return NextResponse.json(
        {
          erro: "A senha deve possuir pelo menos 8 caracteres.",
        },
        {
          status: 400,
        }
      );

    }


    /* =====================================================
       NORMALIZAR E-MAIL
       ===================================================== */

    const emailNormalizado =
      email.toLowerCase().trim();


    /* =====================================================
       VERIFICAR E-MAIL EXISTENTE
       ===================================================== */

    const usuarioExistente =
      await prisma.usuario.findUnique({
        where: {
          email: emailNormalizado,
        },
      });


    if (usuarioExistente) {

      return NextResponse.json(
        {
          erro: "Já existe uma conta com este e-mail.",
        },
        {
          status: 409,
        }
      );

    }


    /* =====================================================
       PROTEGER A SENHA
       =====================================================
       Nunca armazenamos a senha original no banco.
       ===================================================== */

    const senhaHash =
      await bcrypt.hash(senha, 12);


    /* =====================================================
       CRIAR USUÁRIO
       ===================================================== */

    const usuario =
      await prisma.usuario.create({

        data: {
          nome: nome.trim(),
          sobrenome: sobrenome.trim(),
          email: emailNormalizado,
          telefone:
            telefone?.trim() || null,
          senhaHash,
        },

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


    /* =====================================================
       RESPOSTA
       ===================================================== */

    return NextResponse.json(
      {
        mensagem: "Conta criada com sucesso.",
        usuario,
      },
      {
        status: 201,
      }
    );

  } catch (error) {

    /* =====================================================
       ERRO INTERNO
       ===================================================== */

    console.error(
      "Erro ao cadastrar usuário:",
      error
    );

    return NextResponse.json(
      {
        erro: "Não foi possível criar a conta.",
      },
      {
        status: 500,
      }
    );

  }

}