
import { redirect } from "next/navigation";
import { verificarAdministrador } from "../../src/utils/adminAuth";

/* =========================================================
   PÁDUA CULTURE — LAYOUT ADMINISTRATIVO
   =========================================================
   Protege todas as páginas dentro de /admin.

   Apenas usuários autenticados com perfil ADMIN
   e sessão válida podem acessar o painel.
   ========================================================= */

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Valida o cookie, a sessão e o perfil no banco.
  const administrador = await verificarAdministrador();

  // Impede o acesso de visitantes e clientes comuns.
  if (!administrador) {
    redirect("/login");
  }

  // Renderiza a página administrativa autorizada.
  return <>{children}</>;
}
