"use client";


/* =========================================================
   IMPORTAÇÕES
   =========================================================
   Link é utilizado para navegar entre as páginas do site
   sem precisar recarregar toda a aplicação.
   ========================================================= */
import { useEffect, useState } from "react";
import { useCart } from "./context/CartContext";
import CartDrawer from "./componentes/loja/CartDrawer";   
import Link from "next/link";
/* =========================================================
   ESTILOS DOS COMPONENTES DA LOJA
   =========================================================
   Necessário para que componentes compartilhados, como
   a Sacola, recebam seus estilos também na página inicial.
   ========================================================= */

import "./componentes/loja/store.css";



/* Produtos reais retornados pela API pública da loja. */
type ProdutoHome = {
  id: number;
  name: string;
  slug: string;
  category: string;
  price: string;
  image: string;
};

/* =========================================================
   FUNÇÃO PRINCIPAL - HOME
   =========================================================
   Esta função representa a página inicial do site Pádua.
   ========================================================= */

export default function Home() {

  const { cartCount } = useCart();
  const [cartOpen, setCartOpen] = useState(false);
  
/* =========================================================
   AUTENTICAÇÃO DO CLIENTE - HOME PÁDUA
   =========================================================
   Consulta a sessão existente através da API /api/auth/me.
   Não armazena senhas ou tokens no navegador.
   ========================================================= */

const [usuarioAutenticado, setUsuarioAutenticado] =
  useState(false);

const [verificandoSessao, setVerificandoSessao] =
  useState(true);

useEffect(() => {
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
        setUsuarioAutenticado(false);
        return;
      }

      const data = await response.json();

      setUsuarioAutenticado(
        data.autenticado === true && Boolean(data.usuario)
      );
    } catch (error) {
      if (controller.signal.aborted) return;

      console.error("Erro ao verificar sessão:", error);
      setUsuarioAutenticado(false);
    } finally {
      if (!controller.signal.aborted) {
        setVerificandoSessao(false);
      }
    }
  }

  verificarSessao();

  return () => controller.abort();
}, []);

  // Produtos publicados no MySQL da Hostinger, sem lista fixa.
  const [products, setProducts] = useState<ProdutoHome[]>([]);
  const [carregandoProdutos, setCarregandoProdutos] = useState(true);
  const [erroProdutos, setErroProdutos] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function carregarProdutos() {
      try {
        const resposta = await fetch("/api/produtos/novidades", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!resposta.ok) throw new Error("Falha ao carregar novidades.");
        const dados: { produtos?: ProdutoHome[] } = await resposta.json();
        if (!controller.signal.aborted) {
          setProducts(Array.isArray(dados.produtos) ? dados.produtos : []);
          setErroProdutos("");
        }
      } catch (erro) {
        if (!controller.signal.aborted) {
          setErroProdutos("Não foi possível carregar as novidades agora.");
          console.error("[HOME NOVIDADES]", erro);
        }
      } finally {
        if (!controller.signal.aborted) setCarregandoProdutos(false);
      }
    }

    void carregarProdutos();
    return () => controller.abort();
  }, []);

  return (

    <main>


      {/* =====================================================
          HEADER / CABEÇALHO
          =====================================================
          Parte superior do site.

          Contém:
          - Logo
          - Menu principal
          - Conta
          - Buscar
          - Sacola
          ===================================================== */}

      <header className="header">


        {/* LOGO */}

        <a href="#" className="logo">
          PÁDUA.CULTURE
        </a>


        {/* MENU PRINCIPAL */}

        <nav className="nav">

          <a href="#shop">
            LOJA
          </a>

          <a href="#new-drop">
            LANÇAMENTOS
          </a>

          <a href="#upcycling">
            UPCYCLING
          </a>

          <a href="#about">
            SOBRE
          </a>

        </nav>


        {/* ===================================================
            AÇÕES DO LADO DIREITO DO HEADER
            =================================================== */}

        <div className="headerActions">


          {/* CONTA / LOGIN */}

          {/* Direciona o cliente para a área da conta
              ou para o login, conforme a sessão. */}

          <Link
            href={usuarioAutenticado ? "/minha-conta" : "/login"}
            className="accountLink"
          >
            {verificandoSessao
              ? "CONTA"
              : usuarioAutenticado
                ? "MINHA CONTA"
                : "CONTA"}
          </Link>


          {/* BUSCAR */}

          <Link href="/buscar">
            BUSCAR
          </Link>


          {/* SACOLA */}

        <button
          type="button"
          onClick={() => setCartOpen(true)}
        >
          SACOLA ({cartCount})
        </button>


        </div>

      </header>



      {/* =====================================================
          HERO
          =====================================================
          Primeira área visual do site.

          Contém:
          - Nome da coleção
          - Nome Pádua
          - Frase principal
          - Botão para explorar a coleção
          ===================================================== */}

      <section className="hero">

        <div className="heroContent">


          {/* NOME DA COLEÇÃO */}

          <p>
            NOVA COLEÇÃO · 2026
          </p>


          {/* NOME PRINCIPAL */}

          <h1>
            PÁDUA
          </h1>


          {/* FRASE DA COLEÇÃO */}

          <span>
            Novas peças. Mesma essência.
          </span>


          {/* BOTÃO EXPLORAR */}

          <a
            href="#new-drop"
            className="buttonLight"
          >
            EXPLORAR COLEÇÃO
          </a>


        </div>

      </section>



      {/* =====================================================
          NEW DROP / NOVIDADES
          =====================================================
          Exibe os produtos que fazem parte dos lançamentos.
          ===================================================== */}

      <section
        className="section"
        id="new-drop"
      >


        {/* CABEÇALHO DA SEÇÃO */}

        <div className="sectionHeader">

          <div>

            <span className="eyebrow">
              01 / NEW DROP
            </span>

            <h2>
              Novidades
            </h2>

          </div>


          {/* LINK PARA VER TODOS OS PRODUTOS */}

          <a href="#shop">
            VER TUDO →
          </a>

        </div>



        {/* ===================================================
            LISTA DE PRODUTOS
            ===================================================
            O .map() percorre o array "products" e cria
            automaticamente um card para cada produto.
            =================================================== */}

        {carregandoProdutos && <p>Carregando novidades...</p>}
        {erroProdutos && <p role="alert">{erroProdutos}</p>}
        {!carregandoProdutos && !erroProdutos && products.length === 0 && (
          <p>Em breve, novas peças da Pádua Culture.</p>
        )}
        <div className="products">

          {products.map((product) => (

            <article
              className="productCard"
              key={product.slug}
            >

              {/* LINK PARA A PÁGINA DO PRODUTO */}

              <Link
                href={`/produto/${product.slug}`}
                className="productCardLink"
              >




                {/* IMAGEM DO PRODUTO */}

                <div className="productImage">

                  <img
                    src={product.image}
                    alt={product.name}
                  />

                  {/* A escolha de variante e a validação do estoque
                      são feitas na página real do produto. */}
                  <span className="quickAdd" aria-hidden="true">+</span>
                </div>


                {/* INFORMAÇÕES DO PRODUTO */}

                <div className="productInfo">

                  <div>

                    <h3>
                      {product.name}
                    </h3>

                    <p>
                      {product.category}
                    </p>

                  </div>


                  <strong>
                    {product.price}
                  </strong>

                </div>

              </Link>

              </article>

          ))}



        </div>

      </section>



      {/* =====================================================
          UPCYCLING
          =====================================================
          Área destinada à apresentação do conceito de
          Upcycling da Pádua.
          ===================================================== */}

      <section
        className="upcycling"
        id="upcycling"
      >


        {/* NÚMERO DA SEÇÃO */}

        <div className="upcyclingNumber">
          02
        </div>



        {/* CONTEÚDO DA SEÇÃO */}

        <div className="upcyclingContent">


          {/* TÍTULO PEQUENO */}

          <p>
            PÁDUA UPCYCLING
          </p>


          {/* TÍTULO PRINCIPAL */}

          <h2>

            A MESMICE
            <br />

            NÃO VESTE
            <br />

            <em>
              A GENTE.
            </em>

          </h2>


          {/* TEXTO EXPLICATIVO */}

          <p className="upcyclingText">

            Peças existentes transformadas em algo novo.
            Cada criação carrega sua própria história e identidade.

          </p>


          {/* LINK UPCYCLING */}

         <Link href="/loja/upcycling">
          EXPLORAR UPCYCLING →
         </Link>


        </div>

      </section>



      {/* =====================================================
          SHOP / CATEGORIAS
          =====================================================
          Área "Explore" da loja.

          Aqui o usuário escolhe qual categoria deseja acessar.
          ===================================================== */}

      <section
        className="categories"
        id="shop"
      >


        {/* IDENTIFICAÇÃO DA SEÇÃO */}

        <span className="eyebrow">
          03 / SHOP
        </span>


        {/* TÍTULO */}

        <h2>
          Explore
        </h2>



        {/* ===================================================
            LISTA DE CATEGORIAS
            =================================================== */}

        <div className="categoryList">


          {/* CAMISETAS */}

          <Link href="/loja/camisetas">

            <span>
              CAMISETAS
            </span>

            <small>
              01
            </small>

            <strong>
              ↗
            </strong>

          </Link>



          {/* CALÇAS */}

          <Link href="/loja/calcas">

            <span>
              CALÇAS
            </span>

            <small>
              02
            </small>

            <strong>
              ↗
            </strong>

          </Link>



          {/* SHORTS */}

          <Link href="/loja/shorts">

            <span>
              SHORTS
            </span>

            <small>
              03
            </small>

            <strong>
              ↗
            </strong>

          </Link>



          {/* BONÉS */}

          <Link href="/loja/bones">

            <span>
              BONÉS
            </span>

            <small>
              04
            </small>

            <strong>
              ↗
            </strong>

          </Link>



          {/* UPCYCLING */}

          <Link href="/loja/upcycling">

            <span>
              UPCYCLING
            </span>

            <small>
              05
            </small>

            <strong>
              ↗
            </strong>

          </Link>


        </div>

      </section>



      {/* =====================================================
          SOBRE / ABOUT
          =====================================================
          Área institucional da marca.
          ===================================================== */}

      <section
        className="about"
        id="about"
      >


        {/* INFORMAÇÃO DA MARCA */}

        <p>
          EST. 2025 — BRASIL
        </p>


        {/* FRASE PRINCIPAL */}

        <h2>

          NÃO É SÓ
          <br />

          O QUE VOCÊ VESTE.
          <br />

          <span>
            É O QUE VOCÊ CARREGA.
          </span>

        </h2>


      </section>



      {/* =====================================================
          FOOTER / RODAPÉ
          =====================================================
          Última área da página.

          Contém:
          - Logo
          - Copyright
          - Instagram
          - Contato
          - País
          ===================================================== */}

      <footer className="footer">


        {/* LOGO DO RODAPÉ */}

        <div className="footerLogo">
          PÁDUA
        </div>



        {/* PARTE INFERIOR DO RODAPÉ */}

        <div className="footerBottom">


          {/* COPYRIGHT */}

          <span>
            © 2026 PÁDUA
          </span>


          {/* LINKS */}

          <div>

            <a
              href="https://www.instagram.com/padua.culture/"
              target="_blank"
              rel="noopener noreferrer"
            >
              INSTAGRAM
            </a>

            <a href="#">
              CONTATO
            </a>

          </div>


          {/* LOCALIZAÇÃO */}

          <span>
            BRASIL
          </span>


        </div>

      </footer>
   <CartDrawer
      isOpen={cartOpen}
      onClose={() => setCartOpen(false)}
      />

    </main>
  );
}