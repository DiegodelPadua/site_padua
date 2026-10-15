
import { redirect } from "next/navigation";
import { verificarAdministrador } from "../../src/utils/adminAuth";

/* =========================================================
   PAINEL ADMINISTRATIVO - PÁDUA CULTURE
   =========================================================
   Página acessível somente aos administradores.
   A autorização é verificada no servidor.
   ========================================================= */

export default async function AdminPage() {
  // Confirma a autenticação e o perfil ADMIN.
  const administrador = await verificarAdministrador();

  // Impede que usuários não autorizados acessem o painel.
  if (!administrador) {
    redirect("/login");
  }

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
        {/* CABEÇALHO DO PAINEL */}
        <header
          style={{
            borderBottom: "2px solid #171717",
            paddingBottom: "24px",
            marginBottom: "40px",
          }}
        >
          <p style={{ fontSize: "12px", letterSpacing: "3px" }}>
            PÁDUA.CULTURE / ADMIN
          </p>

          <h1 style={{ fontSize: "40px", margin: "16px 0" }}>
            PAINEL ADMINISTRATIVO.
          </h1>

          <p>Bem-vindo, {administrador.nome}.</p>
        </header>

        {/* INDICADORES — VALORES INICIAIS */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "20px",
          }}
        >
          {[
            { titulo: "PRODUTOS", valor: "0" },
            { titulo: "PEDIDOS", valor: "0" },
            { titulo: "CLIENTES", valor: "0" },
            { titulo: "FATURAMENTO", valor: "R$ 0,00" },
          ].map((indicador) => (
            <div
              key={indicador.titulo}
              style={{
                padding: "28px",
                background: "#fff",
                border: "1px solid #ddd",
              }}
            >
              <p style={{ fontSize: "12px" }}>
                {indicador.titulo}
              </p>

              <strong style={{ fontSize: "32px" }}>
                {indicador.valor}
              </strong>
            </div>
          ))}
        </section>

        {/* MÓDULOS ADMINISTRATIVOS */}
        <section style={{ marginTop: "48px" }}>
          <h2>GERENCIAMENTO</h2>

          <p style={{ marginTop: "16px" }}>
            Em breve, você poderá gerenciar produtos,
            imagens, estoque, pedidos e clientes
            diretamente por este painel.
          </p>
        </section>
      </div>
    </main>
  );
}
