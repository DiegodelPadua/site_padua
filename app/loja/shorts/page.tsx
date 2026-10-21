
import CategoriaDinamica from "../../componentes/loja/CategoriaDinamica";

/* =========================================================
   PÁDUA CULTURE — SHORTS
   Produtos carregados diretamente do MySQL.
   ========================================================= */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function Shorts() {
  return (
    <CategoriaDinamica
      number="03"
      title="SHORTS"
      categorySlug="shorts"
      nextCategory="BONÉS"
      nextHref="/loja/bones"
    />
  );
}
