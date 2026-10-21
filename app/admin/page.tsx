
import Link from "next/link";
import { redirect } from "next/navigation";

import { prisma } from "../../lib/prisma";
import { verificarAdministrador } from "../../src/utils/adminAuth";

/* =========================================================
   PÁDUA CULTURE — PAINEL ADMINISTRATIVO

   - Autenticação obrigatória de administrador.
   - Indicadores de produtos consultados no MySQL.
   - Navegação para módulos administrativos existentes.
   - Preserva a identidade visual original.

   Os módulos ainda não implementados permanecem
   identificados como "EM BREVE".
   ========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Estilo compartilhado dos botões de navegação.
const estiloNavegacao = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "12px 18px",
  background: "#171717",
  color: "#ffffff",
  fontSize: "11px",
  fontWeight: 700,
  textDecoration: "none",
  letterSpacing: "0.5px",
} as const;

// Configuração dos módulos do painel.
const modulos = [
  {
    titulo: "PRODUTOS",
    descricao:
      "Cadastre peças, gerencie imagens, variantes e publicação.",
    href: "/admin/produtos",
    disponivel: true,
  },
  {
    titulo: "CATEGORIAS",
    descricao:
      "Organize as categorias utilizadas na loja.",
    href: "/admin/categorias",
    disponivel: true,
  },
  {
    titulo: "PEDIDOS",
    descricao:
      "Acompanhe compras, pagamentos e entregas.",
    href: "",
    disponivel: false,
  },
  {
    titulo: "CLIENTES",
    descricao:
      "Consulte os clientes cadastrados na plataforma.",
    href: "",
    disponivel: false,
  },
  {
    titulo: "ESTOQUE",
    descricao:
      "Consulte o estoque das variantes dos produtos.",
    href: "",
    disponivel: false,
  },
  {
    titulo: "RELATÓRIOS",
    descricao:
      "Acompanhe faturamento e desempenho da loja.",
    href: "",
    disponivel: false,
  },
];

export default async function AdminPage() {
  /* =======================================================
     1. AUTORIZAÇÃO
     ======================================================= */

  const administrador = await verificarAdministrador();

  if (!administrador) {
    redirect("/login");
  }

  /* =======================================================
     2. INDICADORES REAIS DO MYSQL

     A consulta só acontece após verificar o administrador.
     ======================================================= */

  const [totalProdutos, produtosPublicados] =
    await Promise.all([
      prisma.produto.count(),
      prisma.produto.count({
        where: {
          ativo: true,
        },
      }),
    ]);

  /* =======================================================
     3. INDICADORES DO PAINEL

     Pedidos, clientes e faturamento continuam com valores
     provisórios até integrarmos seus respectivos módulos.
     ======================================================= */

  const indicadores = [
    {
      titulo: "PRODUTOS",
      valor: String(totalProdutos),
      descricao: `${produtosPublicados} publicado(s)`,
    },
    {
      titulo: "PEDIDOS",
      valor: "—",
      descricao: "Integração pendente",
    },
    {
      titulo: "CLIENTES",
      valor: "—",
      descricao: "Integração pendente",
    },
    {
      titulo: "FATURAMENTO",
      valor: "—",
      descricao: "Integração pendente",
    },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        color: "#171717",
        padding: "48px 24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        {/* ================================================
            CABEÇALHO
            ================================================ */}

        <header
          style={{
            borderBottom: "2px solid #171717",
            paddingBottom: "24px",
            marginBottom: "32px",
          }}
        >
          <p
            style={{
              fontSize: "12px",
              letterSpacing: "3px",
            }}
          >
            PÁDUA.CULTURE / ADMIN
          </p>

          <h1
            style={{
              fontSize: "clamp(28px, 5vw, 40px)",
              margin: "16px 0",
            }}
          >
            PAINEL ADMINISTRATIVO.
          </h1>

          <p>Bem-vindo, {administrador.nome}.</p>
        </header>

        {/* ================================================
            NAVEGAÇÃO RÁPIDA
            ================================================ */}

        <nav
          aria-label="Navegação administrativa"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "40px",
          }}
        >
          <Link
            href="/admin"
            style={estiloNavegacao}
          >
            PAINEL
          </Link>

          <Link
            href="/admin/produtos"
            style={estiloNavegacao}
          >
            PRODUTOS
          </Link>

          <Link
            href="/admin/categorias"
            style={estiloNavegacao}
          >
            CATEGORIAS
          </Link>

          <Link
            href="/"
            style={{
              ...estiloNavegacao,
              background: "#ffffff",
              color: "#171717",
              border: "1px solid #171717",
            }}
          >
            VER LOJA ↗
          </Link>
        </nav>

        {/* ================================================
            INDICADORES
            ================================================ */}

        <section
          aria-label="Indicadores da loja"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "20px",
          }}
        >
          {indicadores.map((indicador) => (
            <div
              key={indicador.titulo}
              style={{
                padding: "28px",
                background: "#ffffff",
                border: "1px solid #dddddd",
              }}
            >
              <p
                style={{
                  fontSize: "12px",
                  marginBottom: "8px",
                }}
              >
                {indicador.titulo}
              </p>

              <strong
                style={{
                  fontSize: "32px",
                  display: "block",
                }}
              >
                {indicador.valor}
              </strong>

              <p
                style={{
                  marginTop: "10px",
                  fontSize: "11px",
                  color: "#666666",
                }}
              >
                {indicador.descricao}
              </p>
            </div>
          ))}
        </section>

        {/* ================================================
            MÓDULOS ADMINISTRATIVOS
            ================================================ */}

        <section style={{ marginTop: "48px" }}>
          <h2
            style={{
              fontSize: "24px",
              marginBottom: "12px",
            }}
          >
            GERENCIAMENTO
          </h2>

          <p
            style={{
              marginBottom: "24px",
              color: "#555555",
              fontSize: "13px",
            }}
          >
            Acesse as ferramentas de administração
            da Pádua Culture.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(250px, 1fr))",
              gap: "20px",
            }}
          >
            {modulos.map((modulo) => (
              <article
                key={modulo.titulo}
                style={{
                  background: "#ffffff",
                  border: "1px solid #dddddd",
                  padding: "26px",
                  display: "flex",
                  flexDirection: "column",
                  minHeight: "190px",
                }}
              >
                <h3
                  style={{
                    fontSize: "17px",
                    marginBottom: "12px",
                  }}
                >
                  {modulo.titulo}
                </h3>

                <p
                  style={{
                    fontSize: "12px",
                    lineHeight: 1.6,
                    color: "#555555",
                    marginBottom: "24px",
                  }}
                >
                  {modulo.descricao}
                </p>

                <div style={{ marginTop: "auto" }}>
                  {modulo.disponivel ? (
                    <Link
                      href={modulo.href}
                      style={estiloNavegacao}
                    >
                      ACESSAR ↗
                    </Link>
                  ) : (
                    <span
                      style={{
                        display: "inline-block",
                        padding: "12px 18px",
                        background: "#eeeeee",
                        color: "#777777",
                        fontSize: "11px",
                        fontWeight: 700,
                        letterSpacing: "0.5px",
                      }}
                    >
                      EM BREVE
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ================================================
            RODAPÉ ADMINISTRATIVO
            ================================================ */}

        <footer
          style={{
            marginTop: "60px",
            paddingTop: "20px",
            borderTop: "1px solid #cccccc",
            fontSize: "10px",
            letterSpacing: "1px",
            color: "#666666",
          }}
        >
          PÁDUA CULTURE — ADMINISTRAÇÃO
        </footer>
      </div>
    </main>
  );
}
