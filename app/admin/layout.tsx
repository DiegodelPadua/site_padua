
import Link from "next/link";
import { redirect } from "next/navigation";
import { verificarAdministrador } from "../../src/utils/adminAuth";

/* =========================================================
   PÁDUA CULTURE — LAYOUT ADMINISTRATIVO

   Responsabilidades:
   1. Proteger todas as rotas /admin.
   2. Exibir a navegação administrativa compartilhada.
   3. Manter a identidade visual do painel.

   A autenticação existente foi preservada.
   ========================================================= */

const estiloLink = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "42px",
  padding: "10px 16px",
  background: "#171717",
  color: "#ffffff",
  fontSize: "11px",
  fontWeight: 700,
  textDecoration: "none",
  letterSpacing: "0.5px",
} as const;

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Mantém a verificação original da sessão e do perfil.
  const administrador = await verificarAdministrador();

  if (!administrador) {
    redirect("/login");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        color: "#171717",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* NAVEGAÇÃO COMPARTILHADA */}
      <header
        style={{
          borderBottom: "1px solid #d5d5d5",
          background: "#f5f5f5",
          padding: "22px 24px",
        }}
      >
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
          }}
        >
          <p
            style={{
              fontSize: "11px",
              letterSpacing: "3px",
              marginBottom: "18px",
              fontWeight: 700,
            }}
          >
            PÁDUA CULTURE / ADMIN
          </p>

          <nav
            aria-label="Navegação administrativa"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "10px",
            }}
          >
            <Link href="/admin" style={estiloLink}>
              PAINEL
            </Link>

            <Link
              href="/admin/produtos"
              style={estiloLink}
            >
              PRODUTOS
            </Link>

            <Link
              href="/admin/categorias"
              style={estiloLink}
            >
              CATEGORIAS
            </Link>

            <Link
              href="/"
              style={{
                ...estiloLink,
                background: "#ffffff",
                color: "#171717",
                border: "1px solid #171717",
              }}
            >
              VER LOJA ↗
            </Link>
          </nav>
        </div>
      </header>

      {/* CONTEÚDO ORIGINAL DE CADA PÁGINA */}
      {children}
    </div>
  );
}
