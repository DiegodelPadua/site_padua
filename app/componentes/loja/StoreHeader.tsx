import Link from "next/link";

export default function StoreHeader() {
  return (
    <header className="storeHeader">

      <Link href="/" className="storeLogo">
        PÁDUA.CULTURE
      </Link>

      <nav className="storeNav">

        <Link href="/">
          INÍCIO
        </Link>

        <Link href="/loja/camisetas">
          CAMISETAS
        </Link>

        <Link href="/loja/calcas">
          CALÇAS
        </Link>

        <Link href="/loja/shorts">
          SHORTS
        </Link>

        <Link href="/loja/bones">
          BONÉS
        </Link>

        <Link href="/loja/upcycling">
          UPCYCLING
        </Link>

      </nav>

      <div className="storeActions">

        <Link href="/buscar">
          BUSCAR
        </Link>

        <button type="button">
          SACOLA (0)
        </button>

      </div>

    </header>
  );
}