import Link from "next/link";

export default function StoreFooter() {
  return (
    <footer className="storeFooter">

      <div className="storeFooterLogo">
        PÁDUA
      </div>

      <div className="storeFooterBottom">

        <span>
          © 2026 PÁDUA
        </span>

        <Link href="/">
          VOLTAR AO INÍCIO
        </Link>

        <span>
          BRASIL
        </span>

      </div>

    </footer>
  );
}