
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useCart } from "../../context/CartContext";
import CartDrawer from "./CartDrawer";

/* =========================================================
   TIPO DO USUÁRIO AUTENTICADO
   ========================================================= */

type UsuarioAutenticado = {
  id: number;
  nome: string;
  sobrenome: string;
  email: string;
  perfil: string;
};

export default function StoreHeader() {
  /* =========================================================
     SACOLA - FUNCIONALIDADE EXISTENTE
     ========================================================= */

  const { cartCount } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  /* =========================================================
     AUTENTICAÇÃO DO CLIENTE
     ========================================================= */

  const [usuario, setUsuario] =
    useState<UsuarioAutenticado | null>(null);

  const [verificandoSessao, setVerificandoSessao] =
    useState(true);

  useEffect(() => {
    // Evita atualizar o componente após desmontagem.
    const controller = new AbortController();

    async function verificarSessao() {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          setUsuario(null);
          return;
        }

        const data = await response.json();

        // A API retorna { autenticado: true, usuario }.
        if (data.autenticado && data.usuario) {
          setUsuario(data.usuario);
        } else {
          setUsuario(null);
        }
      } catch (error) {
        // Requisições canceladas não são erros de sessão.
        if (controller.signal.aborted) return;

        console.error(
          "Erro ao verificar sessão da Pádua:",
          error
        );

        setUsuario(null);
      } finally {
        if (!controller.signal.aborted) {
          setVerificandoSessao(false);
        }
      }
    }

    verificarSessao();

    return () => controller.abort();
  }, []);

  return (
    <>
      <header className="storeHeader">
        <Link href="/" className="storeLogo">
          PÁDUA.CULTURE
        </Link>

        <nav className="storeNav">
          <Link href="/">INÍCIO</Link>

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
          {/* CONTROLE DE CONTA DO CLIENTE */}

         {/* Cliente autenticado abre sua conta.
              Visitante é direcionado ao login. */}

          {!verificandoSessao &&
            (usuario ? (
              <Link href="/minha-conta">
                MINHA CONTA
              </Link>
            ) : (
              <Link href="/login">
                ENTRAR
              </Link>
            ))}

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
