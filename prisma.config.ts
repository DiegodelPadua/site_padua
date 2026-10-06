/* =========================================================
   CONFIGURAÇÃO DO PRISMA - PÁDUA
   =========================================================
   Define onde está o schema, onde ficam as migrations
   e qual conexão de banco será utilizada.
   ========================================================= */

import "dotenv/config";

import {
  defineConfig,
  env,
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
     ======================================================= */

  datasource: {
    url: env("DATABASE_URL"),
  },

});