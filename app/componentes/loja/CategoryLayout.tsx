


"use client";

import { useState } from "react";
import Link from "next/link";
import "./store.css";
import StoreHeader from "./StoreHeader";
import StoreFooter from "./StoreFooter";
import { useCart } from "../../context/CartContext";


/* =========================================================
   TIPO DO PRODUTO
   ========================================================= */

export type Product = {
  name: string;
  category: string;
  price: string;
  image: string;
  slug: string;
};




/* =========================================================
   PROPRIEDADES DO LAYOUT
   ========================================================= */

type CategoryLayoutProps = {
  number: string;
  title: string;

  products: Product[];

  nextLabel?: string;
  nextCategory: string;
  nextHref: string;
};


/* =========================================================
   LAYOUT DA CATEGORIA
   ========================================================= */

export default function CategoryLayout({
  number,
  title,
  products,
  nextLabel = "PRÓXIMA CATEGORIA",
  nextCategory,
  nextHref,
}: CategoryLayoutProps) {

  const { addItem } = useCart();

  const [quickAddOpen, setQuickAddOpen] = useState<string | null>(null);
  const [quickColor, setQuickColor] = useState("OFF-WHITE");
  /* =========================================================
   NOTIFICAÇÃO - PRODUTO ADICIONADO
   =========================================================
   Armazena a mensagem que será exibida quando o cliente
   adicionar um produto à sacola através do botão "+".

   Quando o valor for null, nenhuma mensagem será exibida.
   ========================================================= */

  const [cartMessage, setCartMessage] = useState<string | null>(null);

/* =========================================================
   ADICIONAR PRODUTO RAPIDAMENTE À SACOLA
   =========================================================
   Recebe o produto e o tamanho selecionado.

   A cor utilizada será a que estiver selecionada no
   Quick Add no momento da compra.
   ========================================================= */

   function handleQuickAdd(product: Product, size: string) {

    /* Converte o preço de:
       "R$ 149,90"
       para:
       149.90
    */
  
    const price = Number(
      product.price
        .replace("R$", "")
        .replace(".", "")
        .replace(",", ".")
        .trim()
    );
  
  
    /* =======================================================
       ADICIONA O PRODUTO À SACOLA
       ======================================================= */
  
    addItem({
      id: `${product.slug}-${quickColor}-${size}`,
      name: product.name,
      price: price,
      image: product.image,
      size: size,
      color: quickColor,
      quantity: 1,
    });
  
  
    /* =======================================================
       EXIBE A CONFIRMAÇÃO PARA O CLIENTE
       =======================================================
       Exemplo:
       Pádua Globe — PRETO / G
       ======================================================= */
  
    setCartMessage(
      `${product.name} — ${quickColor} / ${size}`
    );
  
  
    /* Fecha o painel de seleção */
  
    setQuickAddOpen(null);
  
  
    /* =======================================================
       REMOVE A MENSAGEM AUTOMATICAMENTE
       =======================================================
       A notificação ficará visível durante 3 segundos.
       ======================================================= */
  
    setTimeout(() => {
      setCartMessage(null);
    }, 3000);
  }

  return (

    <main className="storePage">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <StoreHeader />


      {/* =====================================================
          HERO DA CATEGORIA
          ===================================================== */}

      <section className="categoryHero">

        <span>
          LOJA / {number}
        </span>

        <h1>
          {title}
        </h1>

        <p>
          {products.length} PRODUTOS
        </p>

      </section>


      {/* =====================================================
          BARRA DA CATEGORIA
          ===================================================== */}

      <div className="categoryBar">

        <span>
          {title}
        </span>

        <span>
          PÁDUA — 2026
        </span>

      </div>


      {/* =====================================================
          PRODUTOS
          ===================================================== */}

      <section className="storeProducts">

        {products.map((product) => (

          <article
            className="storeProduct"
            key={product.name}
          >

            {/* IMAGEM */}

            {/* =====================================================
                IMAGEM DO PRODUTO
                =====================================================
                Ao clicar na imagem, o cliente é direcionado
                para a página individual do produto.
                ===================================================== */}

            <div className="storeProductImage">


            <Link
              href={`/produto/${product.slug}`}
              className="storeProductImageLink"
            >
              <img
                src={product.image}
                alt={product.name}
              />
            </Link>



             {/* =====================================================
                  BOTÃO DE ADIÇÃO RÁPIDA
                  ===================================================== */}

              <button
                type="button"
                className="storeQuickAdd"
                aria-label={`Adicionar ${product.name} à sacola`}
                onClick={() => {
                  setQuickAddOpen(
                    quickAddOpen === product.slug
                      ? null
                      : product.slug
                  );

                  setQuickColor("OFF-WHITE");
                }}
              >
                {quickAddOpen === product.slug ? "×" : "+"}
              </button>

            </div>


            

            {quickAddOpen === product.slug && (
              <div className="storeQuickPanel">

                <span>SELECIONE A COR</span>

                <div className="storeQuickColors">
                  {["OFF-WHITE", "PRETO"].map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={quickColor === color ? "active" : ""}
                      onClick={() => setQuickColor(color)}
                    >
                      {color}
                    </button>
                  ))}
                </div>

                <span>SELECIONE O TAMANHO</span>

                <div className="storeQuickSizes">
                  {["P", "M", "G", "GG"].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => handleQuickAdd(product, size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>

              </div>
            )}

            {/* =====================================================
                INFORMAÇÕES DO PRODUTO
                =====================================================
                O nome do produto também funciona como link para
                sua página individual.

                A categoria e o preço continuam apenas como
                informações visuais.
                ===================================================== */}

            <div className="storeProductInfo">

            <div>

              {/* =================================================
                  NOME DO PRODUTO
                  =================================================
                  Utilizamos o slug para gerar automaticamente
                  a rota individual de cada produto.
                  ================================================= */}

              <Link
                href={`/produto/${product.slug}`}
                className="storeProductNameLink"
              >
                <h2>
                  {product.name}
                </h2>
              </Link>


              {/* Categoria do produto */}

              <p>
                {product.category}
              </p>

            </div>


            {/* Preço do produto */}

            <strong>
              {product.price}
            </strong>

            </div>

          </article>

        ))}

      </section>


      {/* =====================================================
          PRÓXIMA CATEGORIA
          ===================================================== */}

      <section className="nextCategory">

        <span>
          {nextLabel}
        </span>

        <Link href={nextHref}>

          {nextCategory}

          <strong>
            ↗
          </strong>

        </Link>

      </section>


      {/* =====================================================
          FOOTER
          ===================================================== */}

      <StoreFooter />

      {/* =====================================================
          NOTIFICAÇÃO - PRODUTO ADICIONADO À SACOLA
          =====================================================
          Só aparece quando cartMessage possuir uma mensagem.
          ===================================================== */}

      {cartMessage && (

      <div
        className="cartNotification"
        role="status"
        aria-live="polite"
      >

        {/* Ícone de confirmação */}

        <span className="cartNotificationIcon">
          ✓
        </span>


        {/* Informações da compra */}

        <div>

          <strong>
            PRODUTO ADICIONADO À SACOLA
          </strong>

          <p>
            {cartMessage}
          </p>

        </div>

      </div>

      )}

    </main>
  );
}