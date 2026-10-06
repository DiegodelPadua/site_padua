/* =========================================================
   PRISMA CLIENT - PÁDUA
   =========================================================
   Centraliza a conexão da aplicação com o banco MySQL.

   Prisma 7 utiliza um Driver Adapter para realizar
   a conexão da aplicação com o banco.
   ========================================================= */

import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";


/* =========================================================
   VARIÁVEIS DE CONEXÃO
   =========================================================
   A DATABASE_URL continua protegida no arquivo .env.

   Aqui extraímos os dados da URL para configurar
   o adapter do MySQL/MariaDB.
   ========================================================= */

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL não foi encontrada no arquivo .env."
  );
}

const url = new URL(databaseUrl);


/* =========================================================
   ADAPTER MYSQL / MARIADB
   ========================================================= */

const adapter = new PrismaMariaDb({
  host: url.hostname,

  port: Number(
    url.port || 3306
  ),

  user: decodeURIComponent(
    url.username
  ),

  password: decodeURIComponent(
    url.password
  ),

  database: url.pathname.replace("/", ""),

  connectionLimit: 5,
});


/* =========================================================
   GLOBAL PRISMA
   =========================================================
   Durante o desenvolvimento, o Next.js utiliza Hot Reload.

   Guardamos o Prisma globalmente para evitar a criação
   desnecessária de vários PrismaClient.
   ========================================================= */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};


/* =========================================================
   INSTÂNCIA DO PRISMA
   ========================================================= */

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });


/* =========================================================
   DESENVOLVIMENTO
   ========================================================= */

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}