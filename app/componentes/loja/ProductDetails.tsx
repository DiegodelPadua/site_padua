
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

  // Controla a consulta do estoque no MySQL da Hostinger.
  // true = consultando; false = consulta encerrada.
  const [consultandoEstoque, setConsultandoEstoque] = useState(false);

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


  async function addToCart() {
    if (!selectedColor || !selectedSize) {
      setCartError(true);
      setCartMessage("Selecione uma cor e um tamanho.");
      return;
    }

    if (!varianteSelecionada || !varianteSelecionada.ativa) {
      setCartError(true);
      setCartMessage("Esta variante está indisponível.");
      return;
    }

    // Impede duas consultas simultâneas pelo mesmo botão.
    if (consultandoEstoque) return;

    try {
      setConsultandoEstoque(true);
      setCartMessage(null);

      // Consulta o estoque atual no MySQL da Hostinger.
      const resposta = await fetch(
        `/api/variantes/${varianteSelecionada.id}/disponibilidade`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      if (!resposta.ok) {
        throw new Error(
          "Não foi possível confirmar a disponibilidade."
        );
      }

      const dados: {
        varianteId: number;
        quantidade: number;
        disponivel: boolean;
        tamanho: string;
        cor: string;
      } = await resposta.json();

      // Confere se a resposta corresponde à seleção.
      if (
        dados.varianteId !== varianteSelecionada.id ||
        dados.tamanho !== selectedSize ||
        dados.cor !== selectedColor
      ) {
        throw new Error("A variante selecionada foi alterada.");
      }

      const cartId = `variante-${dados.varianteId}`;

      const quantidadeNaSacola =
        items.find((item) => item.id === cartId)?.quantity ?? 0;

      if (
        !dados.disponivel ||
        quantidadeNaSacola + 1 > dados.quantidade
      ) {
        setCartError(true);
        setCartMessage(
          "Não há estoque suficiente para adicionar esta peça."
        );
        return;
      }

      const adicionado = addItem({
        id: cartId,
        variantId: dados.varianteId,
        name: produto.nome,
        price: produto.preco,
        image: produto.imagens[0]?.url ?? "",
        size: selectedSize,
        color: selectedColor,
        quantity: 1,
        stock: dados.quantidade,
      });

      if (!adicionado) {
        setCartError(true);
        setCartMessage(
          "Não foi possível adicionar a quantidade solicitada."
        );
        return;
      }

      setCartError(false);
      setCartMessage(
        `${produto.nome} — ${selectedColor} / ${selectedSize}`
      );
    } catch (error) {
      setCartError(true);
      setCartMessage(
        error instanceof Error
          ? error.message
          : "Erro ao consultar o estoque."
      );
    } finally {
      setConsultandoEstoque(false);
    }
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
                disabled={!disponivel || consultandoEstoque}
              >
                <span>
                  {consultandoEstoque
                    ? "CONSULTANDO ESTOQUE..."
                    : disponivel
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
