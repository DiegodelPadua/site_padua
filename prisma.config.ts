/* =========================================================
   CONFIGURAÇÃO DO PRISMA - PÁDUA
   =========================================================
   Define onde está o schema, onde ficam as migrations
   e qual conexão de banco será utilizada.

   LOCAL:
   utiliza DATABASE_URL definida no arquivo .env.

   GITHUB:
   como o .env não é enviado ao repositório, utiliza uma
   URL temporária somente durante geração/build.
   ========================================================= */

import "dotenv/config";

import {
  defineConfig,
} from "prisma/config";


export default defineConfig({

  /* =======================================================
     SCHEMA
     ======================================================= */

  schema: "prisma/schema.prisma",


  /* =======================================================
     MIGRATIONS
     ======================================================= */

  migrations: {
    path: "prisma/migrations",
  },


  /* =======================================================
     BANCO DE DADOS
     =======================================================
     No computador:
     process.env.DATABASE_URL encontra a URL do .env.

     No GitHub Actions:
     como o .env não existe, utiliza a URL placeholder.

     IMPORTANTE:
     essa URL placeholder NÃO contém senha real e não será
     utilizada para conectar ao banco durante o site.
     ======================================================= */

  datasource: {
    url:
      process.env.DATABASE_URL ??
      "mysql://root:placeholder@localhost:3306/db_padua",
  },

});