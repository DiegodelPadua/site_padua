
import CategoriaDinamica from "../../componentes/loja/CategoriaDinamica";

/* =========================================================
   PÁDUA CULTURE — CAMISETAS
   Produtos reais do MySQL.
   ========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Camisetas() {
  return (
    <CategoriaDinamica
      number="01"
      title="CAMISETAS"
      categorySlug="camisetas"
      nextCategory="CALÇAS"
      nextHref="/loja/calcas"
    />
  );
}
