
"use client";

import { useState } from "react";
import Link from "next/link";

import StoreHeader from "./StoreHeader";
import StoreFooter from "./StoreFooter";
import SizeGuide from "./SizeGuide";
import { useCart } from "../../context/CartContext";

import "./store.css";
import "../../produto/produto.css";

/* =========================================================
   PÁDUA CULTURE — DETALHES DO PRODUTO

   Componente reutilizável para todos os produtos.

   Os dados são fornecidos pela página dinâmica,
   que consulta o MySQL no servidor.
   ========================================================= */

type Variante = {
  id: number;
  tamanho: string;
  cor: string;
  quantidade: number;
  ativa: boolean;
};

type Imagem = {
  id: number;
  url: string;
  textoAlt: string | null;
};

export type ProdutoDetalhes = {
  id: number;
  nome: string;
  slug: string;
  descricao: string | null;
  categoria: string;
  categoriaSlug: string;
  preco: number;
  precoOriginal: number | null;
  imagens: Imagem[];
  variantes: Variante[];
};

type Props = {
  produto: ProdutoDetalhes;
};

function formatarPreco(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

/* =========================================================
   CORES PARA REPRESENTAÇÃO VISUAL

   Cores desconhecidas continuam disponíveis,
   utilizando uma representação neutra.
   ========================================================= */

function corVisual(cor: string) {
  const cores: Record<string, string> = {
    PRETO: "#111111",
    BRANCO: "#ffffff",
    "OFF-WHITE": "#ece7da",
    CINZA: "#888888",
    AZUL: "#2851a4",
    VERDE: "#49764a",
    VERMELHO: "#bb3030",
    BEGE: "#d5c2a0",
    MARROM: "#76523e",
    ROSA: "#d98ca7",
    AMARELO: "#e9ca38",
  };

  return cores[cor.trim().toUpperCase()] ?? "#cccccc";
}

export default function ProductDetails({ produto }: Props) {
  const { addItem, items } = useCart();

  const cores = [
    ...new Set(produto.variantes.map((v) => v.cor)),
  ];

  const [selectedColor, setSelectedColor] = useState(
    cores[0] ?? ""
  );

  const [selectedSize, setSelectedSize] = useState("");
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [cartMessage, setCartMessage] = useState<string | null>(
    null
  );
  const [cartError, setCartError] = useState(false);

  // Somente tamanhos cadastrados para a cor selecionada.
  const variantesDaCor = produto.variantes.filter(
    (v) => v.cor === selectedColor
  );

  const varianteSelecionada = variantesDaCor.find(
    (v) => v.tamanho === selectedSize
  );

  const disponivel = produto.variantes.some(
    (v) => v.ativa && v.quantidade > 0
  );

  function escolherCor(cor: string) {
    setSelectedColor(cor);

    // Evita manter um tamanho de outra cor.
    setSelectedSize("");
  }

  /* =======================================================
     ADICIONAR À SACOLA
     ======================================================= */

  function addToCart() {
    if (!selectedColor || !selectedSize) {
      setCartError(true);
      setCartMessage("Selecione uma cor e um tamanho.");
      return;
    }

    if (
      !varianteSelecionada ||
      !varianteSelecionada.ativa ||
      varianteSelecionada.quantidade <= 0
    ) {
      setCartError(true);
      setCartMessage("Esta variante está indisponível.");
      return;
    }

    const cartId = `variante-${varianteSelecionada.id}`;

    const quantidadeNaSacola =
      items.find((item) => item.id === cartId)?.quantity ?? 0;

    if (
      quantidadeNaSacola >= varianteSelecionada.quantidade
    ) {
      setCartError(true);
      setCartMessage(
        "Você já selecionou a quantidade disponível em estoque."
      );
      return;
    }

    addItem({
      id: cartId,
      variantId: varianteSelecionada.id,
      name: produto.nome,
      price: produto.preco,
      image: produto.imagens[0]?.url ?? "",
      size: selectedSize,
      color: selectedColor,
      quantity: 1,
      stock: varianteSelecionada.quantidade,
    });

    setCartError(false);
    setCartMessage(
      `${produto.nome} — ${selectedColor} / ${selectedSize}`
    );
  }

  return (
    <>
      {/* CABEÇALHO ORIGINAL */}
      <StoreHeader />

      <main className="productPage">
        {/* CAMINHO */}
        <div className="productBreadcrumb">
          <Link href="/">INÍCIO</Link>

          <span>/</span>

          <Link href={`/loja/${produto.categoriaSlug}`}>
            {produto.categoria.toUpperCase()}
          </Link>

          <span>/</span>

          <strong>{produto.nome.toUpperCase()}</strong>
        </div>

        <section className="productLayout">
          {/* GALERIA ORIGINAL */}
          <div className="productGallery">
            {produto.imagens.map((imagem) => (
              <div className="productPhoto" key={imagem.id}>
                <img
                  src={imagem.url}
                  alt={imagem.textoAlt || produto.nome}
                  loading="lazy"
                />
              </div>
            ))}
          </div>

          {/* DETALHES ORIGINAIS */}
          <div className="productDetails">
            <div className="productHeading">
              <p className="productCategory">
                {produto.categoria.toUpperCase()} / PÁDUA
              </p>

              <h1>{produto.nome.toUpperCase()}</h1>

              <p className="productPrice">
                {formatarPreco(produto.preco)}
              </p>

              {produto.precoOriginal !== null &&
                produto.precoOriginal > produto.preco && (
                  <p
                    style={{
                      textDecoration: "line-through",
                      color: "#777",
                      marginTop: 8,
                    }}
                  >
                    {formatarPreco(produto.precoOriginal)}
                  </p>
                )}
            </div>

            {/* CORES REAIS DO BANCO */}
            <div className="productOption">
              <div className="optionHeader">
                <span>COR</span>
                <strong>{selectedColor || "INDISPONÍVEL"}</strong>
              </div>

              <div className="colorOptions">
                {cores.map((cor) => (
                  <button
                    key={cor}
                    type="button"
                    className={
                      selectedColor === cor
                        ? "colorButton active"
                        : "colorButton"
                    }
                    onClick={() => escolherCor(cor)}
                    aria-label={`Selecionar cor ${cor}`}
                    title={cor}
                  >
                    <span
                      style={{
                        backgroundColor: corVisual(cor),
                      }}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* TAMANHOS REAIS DO BANCO */}
            <div className="productOption">
              <div className="optionHeader">
                <span>TAMANHO</span>

                <button
                  type="button"
                  className="sizeGuide"
                  onClick={() => setSizeGuideOpen(true)}
                >
                  GUIA DE MEDIDAS
                </button>
              </div>

              <div className="sizeOptions">
                {variantesDaCor.map((variante) => (
                  <button
                    key={variante.id}
                    type="button"
                    className={
                      selectedSize === variante.tamanho
                        ? "sizeButton active"
                        : "sizeButton"
                    }
                    disabled={
                      !variante.ativa ||
                      variante.quantidade <= 0
                    }
                    onClick={() =>
                      setSelectedSize(variante.tamanho)
                    }
                    title={
                      variante.quantidade > 0
                        ? `${variante.quantidade} disponível(is)`
                        : "Sem estoque"
                    }
                    style={{
                      opacity:
                        variante.quantidade > 0 ? 1 : 0.35,
                      cursor:
                        variante.quantidade > 0
                          ? "pointer"
                          : "not-allowed",
                    }}
                  >
                    {variante.tamanho}
                  </button>
                ))}
              </div>
            </div>

            {/* BOTÃO ORIGINAL */}
            <button
              type="button"
              className="addToCart"
              onClick={addToCart}
              disabled={!disponivel}
            >
              <span>
                {disponivel
                  ? "ADICIONAR À SACOLA"
                  : "PRODUTO ESGOTADO"}
              </span>

              <span>→</span>
            </button>

            {/* DESCRIÇÃO */}
            <div className="productDescription">
              <div className="descriptionItem">
                <span>DESCRIÇÃO</span>

                <p>
                  {produto.descricao ||
                    "Peça da coleção Pádua Culture."}
                </p>
              </div>

              <div className="descriptionItem">
                <span>ENVIO</span>

                <p>
                  O prazo de entrega será calculado durante
                  a finalização da compra.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* NOTIFICAÇÃO */}
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
              style={{
                marginTop: 8,
                background: "transparent",
                border: "none",
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              FECHAR
            </button>
          </div>
        </div>
      )}

      {/* GUIA DE MEDIDAS ORIGINAL */}
      <SizeGuide
        isOpen={sizeGuideOpen}
        onClose={() => setSizeGuideOpen(false)}
      />

      {/* RODAPÉ ORIGINAL */}
      <StoreFooter />
    </>
  );
}
