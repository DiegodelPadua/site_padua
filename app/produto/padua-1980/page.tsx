"use client";

/* =========================================================
   IMPORTAÇÕES
   ========================================================= */

import { useState } from "react";
import Link from "next/link";

import StoreHeader from "../../componentes/loja/StoreHeader";
import StoreFooter from "../../componentes/loja/StoreFooter";
import { useCart } from "../../context/CartContext";
/* =========================================================
   COMPONENTE - GUIA DE MEDIDAS
   ========================================================= */

import SizeGuide from "../../componentes/loja/SizeGuide";

import "../../componentes/loja/store.css";
import "../produto.css";


/* =========================================================
   PÁGINA DO PRODUTO - PÁDUA 1980
   ========================================================= */

export default function Padua1980Page() {

  /* =========================================================
   GUIA DE MEDIDAS
   =========================================================
   false = fechado
   true  = aberto
   ========================================================= */

  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  /* =======================================================
     ESTADOS DO PRODUTO
     =======================================================
     selectedSize:
     Guarda o tamanho escolhido pelo cliente.

     selectedColor:
     Guarda a cor escolhida pelo cliente.
     ======================================================= */

  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("OFF-WHITE");


  /* =======================================================
     NOTIFICAÇÃO DA SACOLA
     =======================================================
     Guarda a mensagem apresentada depois que o produto
     é adicionado à sacola.

     Quando estiver como null, nenhuma mensagem aparece.
     ======================================================= */

  const [cartMessage, setCartMessage] = useState<string | null>(null);


  /* =======================================================
     CONTEXTO DA SACOLA
     =======================================================
     Recupera a função addItem criada no CartContext.
     ======================================================= */

  const { addItem } = useCart();


  /* =======================================================
     ADICIONAR PRODUTO À SACOLA
     =======================================================
     Esta função:

     1. Verifica se o cliente escolheu um tamanho.
     2. Adiciona o produto à sacola.
     3. Exibe uma confirmação.
     4. Remove a confirmação depois de 3 segundos.
     ======================================================= */

  function addToCart() {

    /* =====================================================
       VALIDAÇÃO DO TAMANHO
       =====================================================
       O produto não pode ser adicionado sem que o
       cliente escolha um tamanho.
       ===================================================== */

    if (!selectedSize) {
      alert("Selecione um tamanho.");
      return;
    }


    /* =====================================================
       ADICIONAR À SACOLA
       =====================================================
       Mantém a lógica original que já estava funcionando.

       O ID identifica:
       produto + cor + tamanho

       Exemplo:
       padua-1980-PRETO-G
       ===================================================== */

    addItem({
      id: `padua-1980-${selectedColor}-${selectedSize}`,
      name: "Pádua 1980",
      price: 159.90,
      image: "/images/1980.jpg",
      size: selectedSize,
      color: selectedColor,
      quantity: 1,
    });


    /* =====================================================
       NOTIFICAÇÃO DE CONFIRMAÇÃO
       =====================================================
       Exemplo:
       Pádua 1980 — PRETO / G
       ===================================================== */

    setCartMessage(
      `Pádua 1980 — ${selectedColor} / ${selectedSize}`
    );


    /* =====================================================
       REMOVER A NOTIFICAÇÃO
       =====================================================
       Depois de 3 segundos, a mensagem desaparece.
       ===================================================== */

    setTimeout(() => {
      setCartMessage(null);
    }, 3000);
  }


  /* =========================================================
     CONTEÚDO DA PÁGINA
     ========================================================= */

  return (
    <>

      {/* =====================================================
          HEADER
          ===================================================== */}

      <StoreHeader />


      <main className="productPage">

        {/* ===================================================
            CAMINHO / BREADCRUMB
            =================================================== */}

        <div className="productBreadcrumb">

          <Link href="/">
            INÍCIO
          </Link>

          <span>/</span>

          <Link href="/loja/camisetas">
            CAMISETAS
          </Link>

          <span>/</span>

          <strong>
            PÁDUA 1980
          </strong>

        </div>


        {/* ===================================================
            PRODUTO
            =================================================== */}

        <section className="productLayout">


          {/* =================================================
              GALERIA DE IMAGENS
              ================================================= */}

          <div className="productGallery">

            {/* Foto frontal */}

            <div className="productPhoto">

              <img
                src="/images/1980.jpg"
                alt="Camiseta Pádua 1980"
              />

            </div>


            {/* Foto das costas */}

            <div className="productPhoto">

              <img
                src="/images/1980-costas.jpg"
                alt="Costas da camiseta Pádua 1980"
              />

            </div>

          </div>


          {/* =================================================
              INFORMAÇÕES DO PRODUTO
              ================================================= */}

          <div className="productDetails">


            {/* ===============================================
                NOME / CATEGORIA / PREÇO
                =============================================== */}

            <div className="productHeading">

              <p className="productCategory">
                CAMISETAS / PÁDUA
              </p>

              <h1>
                PÁDUA 1980
              </h1>

              <p className="productPrice">
                R$ 159,90
              </p>

            </div>


            {/* ===============================================
                SELEÇÃO DE COR
                =============================================== */}

            <div className="productOption">

              <div className="optionHeader">

                <span>
                  COR
                </span>

                <strong>
                  {selectedColor}
                </strong>

              </div>


              <div className="colorOptions">

                {/* Cor OFF-WHITE */}

                <button
                  type="button"
                  className={
                    selectedColor === "OFF-WHITE"
                      ? "colorButton active"
                      : "colorButton"
                  }
                  onClick={() =>
                    setSelectedColor("OFF-WHITE")
                  }
                  aria-label="Selecionar cor Off-white"
                >

                  <span className="colorOffWhite" />

                </button>


                {/* Cor PRETO */}

                <button
                  type="button"
                  className={
                    selectedColor === "PRETO"
                      ? "colorButton active"
                      : "colorButton"
                  }
                  onClick={() =>
                    setSelectedColor("PRETO")
                  }
                  aria-label="Selecionar cor Preto"
                >

                  <span className="colorBlack" />

                </button>

              </div>

            </div>


            {/* ===============================================
                SELEÇÃO DE TAMANHO
                =============================================== */}

            <div className="productOption">

              <div className="optionHeader">

                <span>
                  TAMANHO
                </span>


                {/* Futuramente este botão poderá abrir
                    o Guia de Medidas */}

                {/* =====================================================
                    BOTÃO - GUIA DE MEDIDAS
                    ===================================================== */}

                <button
                  type="button"
                  className="sizeGuide"
                  onClick={() => setSizeGuideOpen(true)}
                >
                  GUIA DE MEDIDAS
                </button>

              </div>


              <div className="sizeOptions">

                {/* Cria automaticamente os quatro tamanhos */}

                {["P", "M", "G", "GG"].map(
                  (size) => (

                    <button
                      type="button"
                      key={size}
                      className={
                        selectedSize === size
                          ? "sizeButton active"
                          : "sizeButton"
                      }
                      onClick={() =>
                        setSelectedSize(size)
                      }
                    >
                      {size}
                    </button>

                  )
                )}

              </div>

            </div>


            {/* ===============================================
                BOTÃO ADICIONAR À SACOLA
                =============================================== */}

            <button
              type="button"
              className="addToCart"
              onClick={addToCart}
            >

              <span>
                ADICIONAR À SACOLA
              </span>

              <span>
                →
              </span>

            </button>


            {/* ===============================================
                DESCRIÇÃO DO PRODUTO
                =============================================== */}

            <div className="productDescription">


              {/* DESCRIÇÃO */}

              <div className="descriptionItem">

                <span>
                  DESCRIÇÃO
                </span>

                <p>
                  Camiseta Pádua 1980 em modelagem
                  oversized. Uma peça que revisita referências
                  de outra época através da identidade
                  contemporânea da Pádua.
                </p>

              </div>


              {/* COMPOSIÇÃO */}

              <div className="descriptionItem">

                <span>
                  COMPOSIÇÃO
                </span>

                <p>
                  Algodão de alta gramatura.
                </p>

              </div>


              {/* MODELAGEM */}

              <div className="descriptionItem">

                <span>
                  MODELAGEM
                </span>

                <p>
                  Oversized.
                </p>

              </div>


              {/* ENVIO */}

              <div className="descriptionItem">

                <span>
                  ENVIO
                </span>

                <p>
                  O prazo de entrega será calculado
                  durante a finalização da compra.
                </p>

              </div>

            </div>

          </div>

        </section>

      </main>


      {/* =====================================================
          NOTIFICAÇÃO - PRODUTO ADICIONADO À SACOLA
          =====================================================
          Só aparece depois que o produto for adicionado.

          Exemplo:

          ✓ PRODUTO ADICIONADO À SACOLA
            Pádua 1980 — PRETO / G

          Depois de 3 segundos ela desaparece.
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


          {/* Texto da confirmação */}

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

      {/* =====================================================
          GUIA DE MEDIDAS
          ===================================================== */}

      <SizeGuide
        isOpen={sizeGuideOpen}
        onClose={() => setSizeGuideOpen(false)}
      />


      {/* =====================================================
          FOOTER
          ===================================================== */}

      <StoreFooter />

    </>
  );
}