/* =========================================================
   CONFIGURAÇÃO NEXT.JS - PÁDUA
   =========================================================
   Configuração utilizada para executar o projeto como uma
   aplicação Next.js completa na Hostinger.

   Agora teremos suporte a:

   - Frontend Next.js
   - API Routes
   - Autenticação
   - Cookies / Sessões
   - Prisma
   - MySQL
   ========================================================= */

import type { NextConfig } from "next";


const nextConfig: NextConfig = {

  /* =======================================================
     IMAGENS
     =======================================================
     Mantemos unoptimized por enquanto para preservar
     o comportamento atual das imagens do projeto.
     ======================================================= */

  images: {
    unoptimized: true,
  },

};


export default nextConfig;