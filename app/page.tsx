"use client";


/* =========================================================
   IMPORTAÇÕES
   =========================================================
   Link é utilizado para navegar entre as páginas do site
   sem precisar recarregar toda a aplicação.
   ========================================================= */

import Link from "next/link";


/* =========================================================
   PRODUTOS
   =========================================================
   Produtos exibidos atualmente na seção "NEW DROP".

   ATENÇÃO:
   Estes dados são temporários.

   Futuramente eles serão substituídos pelos produtos
   cadastrados no banco de dados.
   ========================================================= */

const products = [
  {
    name: "Pádua Globe",
    slug: "padua-globe",
    category: "Camiseta",
    price: "R$ 149,90",
    image: "/site_padua/images/globe.jpg",
  },
  {
    name: "Pádua 1980",
    slug: "padua-1980",
    category: "Camiseta",
    price: "R$ 159,90",
    image: "/site_padua/images/1980.jpg",
  },
  {
    name: "Pádua Essential",
    slug: "padua-essential",
    category: "Camiseta",
    price: "R$ 129,90",
    image: "/site_padua/images/essential.jpg",
  },
];

/* =========================================================
   FUNÇÃO PRINCIPAL - HOME
   =========================================================
   Esta função representa a página inicial do site Pádua.
   ========================================================= */

export default function Home() {

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

          <Link
            href="/login"
            className="accountLink"
          >
            CONTA
          </Link>


          {/* BUSCAR */}

          <Link href="/buscar">
            BUSCAR
          </Link>


          {/* SACOLA */}

          <button>
            SACOLA (0)
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

        <div className="products">

          {products.map((product) => (

            <article
              className="productCard"
              key={product.name}
            >


              {/* =============================================
                  IMAGEM DO PRODUTO
                  ============================================= */}

              <div className="productImage">

                <img
                  src={product.image}
                  alt={product.name}
                />


                {/* BOTÃO DE ADIÇÃO RÁPIDA */}

                <button className="quickAdd">
                  +
                </button>

              </div>



              {/* =============================================
                  INFORMAÇÕES DO PRODUTO
                  ============================================= */}

              <div className="productInfo">

                <div>

                  {/* NOME */}

                  <h3>
                    {product.name}
                  </h3>


                  {/* CATEGORIA */}

                  <p>
                    {product.category}
                  </p>

                </div>


                {/* PREÇO */}

                <strong>
                  {product.price}
                </strong>

              </div>

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


    </main>
  );
}