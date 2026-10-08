
/* =========================================================
   CONFIGURAÇÃO NEXT.JS - PÁDUA
   =========================================================
   Configuração para execução completa do Next.js
   na Hostinger, incluindo frontend e API Routes.

   Não utilizamos output: "export", pois precisamos
   executar o backend no servidor.
   ========================================================= */

/** @type {import('next').NextConfig} */
const nextConfig = {

  /* =======================================================
     IMAGENS
     ======================================================= */

  images: {
    unoptimized: true,
  },

};

export default nextConfig;
