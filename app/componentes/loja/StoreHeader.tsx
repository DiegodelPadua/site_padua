"use client";

import { useState } from "react";
import Link from "next/link";

import { useCart } from "../../context/CartContext";
import CartDrawer from "./CartDrawer";

export default function StoreHeader() {
  const { cartCount } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <>
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

          <button
            type="button"
            onClick={() => setCartOpen(true)}
          >
            SACOLA ({cartCount})
          </button>

        </div>

      </header>

      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
      />
    </>
  );
}