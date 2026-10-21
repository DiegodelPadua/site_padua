
import CategoriaDinamica from "../../componentes/loja/CategoriaDinamica";

/* =========================================================
   PÁDUA CULTURE — BONÉS
   Produtos carregados diretamente do MySQL.
   ========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Bones() {
  return (
    <CategoriaDinamica
      number="04"
      title="BONÉS"
      categorySlug="bone"
      nextCategory="UPCYCLING"
      nextHref="/loja/upcycling"
    />
  );
}
