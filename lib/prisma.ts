/* =========================================================
   PRISMA CLIENT - PÁDUA
   =========================================================
   Centraliza a conexão da aplicação com o banco MySQL.

   LOCAL:
   utiliza DATABASE_URL definida no arquivo .env.

   BUILD:
   quando DATABASE_URL não estiver disponível, utiliza
   valores temporários apenas para permitir a compilação.

   IMPORTANTE:
   nenhuma senha real fica salva neste arquivo.
   ========================================================= */

import { PrismaClient } from "@prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";


/* =========================================================
   URL DO BANCO
   ========================================================= */

const databaseUrl =
  process.env.DATABASE_URL ??
  "mysql://root:placeholder@localhost:3306/db_padua";

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
   Evita criar várias instâncias do Prisma durante
   o Hot Reload do Next.js em desenvolvimento.
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