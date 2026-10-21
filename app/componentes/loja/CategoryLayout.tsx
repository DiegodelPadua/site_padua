
"use client";

import { useState } from "react";
import Link from "next/link";
import "./store.css";

import StoreHeader from "./StoreHeader";
import StoreFooter from "./StoreFooter";
import { useCart } from "../../context/CartContext";

/* =========================================================
   PÁDUA CULTURE — CATÁLOGO DINÂMICO

   Preserva as classes CSS do layout original.

   Produtos e variantes agora são provenientes do MySQL.
   ========================================================= */

export type ProductVariant = {
  id: number;
  size: string;
  color: string;
  sku: string | null;
  stock: number;
  available: boolean;
};

export type Product = {
  id: number;
  name: string;
  slug: string;
  category: string;
  price: string;
  image: string;
  variants: ProductVariant[];
  available: boolean;
};

type CategoryLayoutProps = {
  number: string;
  title: string;
  products: Product[];
  nextLabel?: string;
  nextCategory: string;
  nextHref: string;
};

export default function CategoryLayout({
  number,
  title,
  products,
  nextLabel = "PRÓXIMA CATEGORIA",
  nextCategory,
  nextHref,
}: CategoryLayoutProps) {
  const { addItem, items } = useCart();

  // Produto que está com a compra rápida aberta.
  const [quickAddOpen, setQuickAddOpen] = useState<
    string | null
  >(null);

  // Cor selecionada na compra rápida.
  const [quickColor, setQuickColor] = useState("");

  // Mensagem de confirmação ou indisponibilidade.
  const [cartMessage, setCartMessage] = useState<
    string | null
  >(null);

  const [cartError, setCartError] = useState(false);

  /* =======================================================
     ABRIR / FECHAR COMPRA RÁPIDA
     ======================================================= */

  function toggleQuickAdd(product: Product) {
    if (quickAddOpen === product.slug) {
      setQuickAddOpen(null);
      return;
    }

    // Seleciona inicialmente a primeira cor cadastrada.
    const firstColor =
      product.variants.find((variant) => variant.available)
        ?.color ??
      product.variants[0]?.color ??
      "";

    setQuickColor(firstColor);
    setQuickAddOpen(product.slug);
  }

  /* =======================================================
     CONSULTAR CORES CADASTRADAS
     ======================================================= */

  function getColors(product: Product) {
    return [
      ...new Set(
        product.variants.map((variant) => variant.color)
      ),
    ];
  }

  /* =======================================================
     CONSULTAR TAMANHOS DA COR SELECIONADA
     ======================================================= */

  function getSizes(product: Product) {
    return product.variants.filter(
      (variant) => variant.color === quickColor
    );
  }

  /* =======================================================
     EXIBIR MENSAGEM
     ======================================================= */

  function showMessage(message: string, error = false) {
    setCartMessage(message);
    setCartError(error);
  }

  /* =======================================================
     ADICIONAR VARIANTE REAL À SACOLA

     A validação no navegador melhora a experiência,
     mas o checkout deverá conferir novamente o estoque
     e o preço diretamente no servidor.
     ======================================================= */

  function handleQuickAdd(
    product: Product,
    variant: ProductVariant
  ) {
    if (!variant.available || variant.stock <= 0) {
      showMessage("VARIANTE INDISPONÍVEL", true);
      return;
    }

    const cartId = `variante-${variant.id}`;

    // Considera a quantidade já existente na sacola.
    const existingQuantity =
      items.find((item) => item.id === cartId)
        ?.quantity ?? 0;

    if (existingQuantity >= variant.stock) {
      showMessage(
        "QUANTIDADE MÁXIMA DISPONÍVEL NA SACOLA",
        true
      );
      return;
    }

    // O preço já chega formatado para a vitrine.
    const price = Number(
      product.price
        .replace("R$", "")
        .replace(/\./g, "")
        .replace(",", ".")
        .trim()
    );

    if (!Number.isFinite(price) || price < 0) {
      showMessage("PREÇO INDISPONÍVEL", true);
      return;
    }

    addItem({
      id: cartId,
      variantId: variant.id,
      name: product.name,
      price,
      image: product.image,
      size: variant.size,
      color: variant.color,
      quantity: 1,
      stock: variant.stock,
    });

    showMessage(
      `${product.name} — ${variant.color} / ${variant.size}`
    );

    setQuickAddOpen(null);
  }

  return (
    <main className="storePage">
      {/* CABEÇALHO ORIGINAL */}
      <StoreHeader />

      {/* HERO ORIGINAL DA CATEGORIA */}
      <section className="categoryHero">
        <span>LOJA / {number}</span>
        <h1>{title}</h1>
        <p>{products.length} PRODUTOS</p>
      </section>

      {/* BARRA ORIGINAL */}
      <div className="categoryBar">
        <span>{title}</span>
        <span>PÁDUA — 2026</span>
      </div>

      {/* CATÁLOGO DINÂMICO */}
      <section className="storeProducts">
        {products.length === 0 && (
          <p>
            NENHUM PRODUTO DISPONÍVEL NESTA CATEGORIA.
          </p>
        )}

        {products.map((product) => (
          <article
            className="storeProduct"
            key={product.id}
          >
            {/* FOTOGRAFIA PRINCIPAL */}
            <div className="storeProductImage">
              <Link
                href={`/produto/${product.slug}`}
                className="storeProductImageLink"
              >
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      minHeight: 250,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    PÁDUA CULTURE
                  </div>
                )}
              </Link>

              {/* BOTÃO + ORIGINAL */}
              <button
                type="button"
                className="storeQuickAdd"
                aria-label={`Selecionar variante de ${product.name}`}
                aria-expanded={
                  quickAddOpen === product.slug
                }
                disabled={!product.available}
                onClick={() => toggleQuickAdd(product)}
              >
                {quickAddOpen === product.slug
                  ? "×"
                  : "+"}
              </button>
            </div>

            {/* SELEÇÃO DINÂMICA DE VARIANTES */}
            {quickAddOpen === product.slug && (
              <div className="storeQuickPanel">
                <span>SELECIONE A COR</span>

                <div className="storeQuickColors">
                  {getColors(product).map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={
                        quickColor === color
                          ? "active"
                          : ""
                      }
                      onClick={() =>
                        setQuickColor(color)
                      }
                    >
                      {color}
                    </button>
                  ))}
                </div>

                <span>SELECIONE O TAMANHO</span>

                <div className="storeQuickSizes">
                  {getSizes(product).map((variant) => (
                    <button
                      key={variant.id}
                      type="button"
                      disabled={
                        !variant.available ||
                        variant.stock <= 0
                      }
                      title={
                        variant.stock > 0
                          ? `${variant.stock} disponível(is)`
                          : "Sem estoque"
                      }
                      onClick={() =>
                        handleQuickAdd(product, variant)
                      }
                    >
                      {variant.size}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* INFORMAÇÕES ORIGINAIS DO CARD */}
            <div className="storeProductInfo">
              <div>
                <Link
                  href={`/produto/${product.slug}`}
                  className="storeProductNameLink"
                >
                  <h2>{product.name}</h2>
                </Link>

                <p>{product.category}</p>
              </div>

              <strong>{product.price}</strong>
            </div>
          </article>
        ))}
      </section>

      {/* NAVEGAÇÃO ORIGINAL */}
      <section className="nextCategory">
        <span>{nextLabel}</span>

        <Link href={nextHref}>
          {nextCategory}
          <strong>↗</strong>
        </Link>
      </section>

      {/* RODAPÉ ORIGINAL */}
      <StoreFooter />

      {/* NOTIFICAÇÃO DA SACOLA */}
      {cartMessage && (
        <div
          className="cartNotification"
          role="status"
          aria-live="polite"
        >
          <span className="cartNotificationIcon">
            {cartError ? "!" : "✓"}
          </span>

          <div>
            <strong>
              {cartError
                ? "NÃO FOI POSSÍVEL ADICIONAR"
                : "PRODUTO ADICIONADO À SACOLA"}
            </strong>

            <p>{cartMessage}</p>

            <button
              type="button"
              onClick={() => setCartMessage(null)}
              aria-label="Fechar notificação"
              style={{
                border: 0,
                background: "transparent",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              FECHAR
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
