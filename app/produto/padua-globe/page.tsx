"use client";

import { useState } from "react";
import Link from "next/link";

import StoreHeader from "../../componentes/loja/StoreHeader";
import StoreFooter from "../../componentes/loja/StoreFooter";

import "./produto.css";

export default function PaduaGlobePage() {
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("OFF-WHITE");

  function addToCart() {
    if (!selectedSize) {
      alert("Selecione um tamanho.");
      return;
    }

    alert(
      `Pádua Globe - ${selectedColor} - ${selectedSize} adicionado à sacola.`
    );
  }

  return (
    <>
      <StoreHeader />

      <main className="productPage">

        {/* CAMINHO */}

        <div className="productBreadcrumb">
          <Link href="/">INÍCIO</Link>

          <span>/</span>

          <Link href="/loja/camisetas">
            CAMISETAS
          </Link>

          <span>/</span>

          <strong>PÁDUA GLOBE</strong>
        </div>


        {/* PRODUTO */}

        <section className="productLayout">

          {/* IMAGENS */}

          <div className="productGallery">

            <div className="productPhoto">
              <img
                src="/site_padua/images/globe.jpg"
                alt="Camiseta Pádua Globe"
              />
            </div>

            <div className="productPhoto">
              <img
                src="/site_padua/images/globe-costas.jpg"
                alt="Costas da camiseta Pádua Globe"
              />
            </div>

          </div>


          {/* INFORMAÇÕES */}

          <div className="productDetails">

            <div className="productHeading">

              <p className="productCategory">
                CAMISETAS / PÁDUA
              </p>

              <h1>PÁDUA GLOBE</h1>

              <p className="productPrice">
                R$ 149,90
              </p>

            </div>


            {/* COR */}

            <div className="productOption">

              <div className="optionHeader">
                <span>COR</span>

                <strong>
                  {selectedColor}
                </strong>
              </div>

              <div className="colorOptions">

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


            {/* TAMANHO */}

            <div className="productOption">

              <div className="optionHeader">
                <span>TAMANHO</span>

                <button
                  type="button"
                  className="sizeGuide"
                >
                  GUIA DE MEDIDAS
                </button>
              </div>

              <div className="sizeOptions">

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


            {/* BOTÃO SACOLA */}

            <button
              type="button"
              className="addToCart"
              onClick={addToCart}
            >
              <span>ADICIONAR À SACOLA</span>

              <span>→</span>
            </button>


            {/* DESCRIÇÃO */}

            <div className="productDescription">

              <div className="descriptionItem">
                <span>DESCRIÇÃO</span>

                <p>
                  Camiseta Pádua Globe em modelagem
                  oversized. Uma peça desenvolvida para
                  representar movimento, identidade e
                  cultura.
                </p>
              </div>

              <div className="descriptionItem">
                <span>COMPOSIÇÃO</span>

                <p>
                  Algodão de alta gramatura.
                </p>
              </div>

              <div className="descriptionItem">
                <span>MODELAGEM</span>

                <p>
                  Oversized.
                </p>
              </div>

              <div className="descriptionItem">
                <span>ENVIO</span>

                <p>
                  O prazo de entrega será calculado
                  durante a finalização da compra.
                </p>
              </div>

            </div>

          </div>

        </section>

      </main>

      <StoreFooter />
    </>
  );
}