
import CategoriaDinamica from "../../componentes/loja/CategoriaDinamica";

/* =========================================================
   PÁDUA CULTURE — CALÇAS
   Produtos carregados diretamente do MySQL.
   ========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Calcas() {
  return (
    <CategoriaDinamica
      number="02"
      title="CALÇAS"
      categorySlug="calca"
      nextCategory="SHORTS"
      nextHref="/loja/shorts"
    />
  );
}
