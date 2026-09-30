"use client";

import { useState } from "react";
import Link from "next/link";

const products = [
  {
    name: "Pádua Globe",
    category: "Camiseta",
    price: "R$ 149,90",
    image: "/images/globe.jpg",
  },
  {
    name: "Pádua 1980",
    category: "Camiseta",
    price: "R$ 159,90",
    image: "/images/1980.jpg",
  },
  {
    name: "Pádua Essential",
    category: "Camiseta",
    price: "R$ 129,90",
    image: "/images/essential.jpg",
  },
];
const categories = [
  {
    name: "CAMISETAS",
    search: ["camiseta", "camisetas"],
    href: "/loja/camisetas",
  },
  {
    name: "CALÇAS",
    search: ["calça", "calças", "calca", "calcas"],
    href: "/loja/calcas",
  },
  {
    name: "SHORTS",
    search: ["short", "shorts"],
    href: "/loja/shorts",
  },
  {
    name: "BONÉS",
    search: ["boné", "bonés", "bone", "bones"],
    href: "/loja/bones",
  },
  {
    name: "UPCYCLING",
    search: ["upcycling"],
    href: "/loja/upcycling",
  },
];

export default function Home() {



  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredProducts = products.filter((product) => {
    const term = search.toLowerCase();

    return (
      product.name.toLowerCase().includes(term) ||
      product.category.toLowerCase().includes(term)
    );
  });
  const normalizedSearch = search
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  const matchedCategory = categories.find((category) =>
    category.search.some((term) => {
      const normalizedTerm = term
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      return normalizedTerm === normalizedSearch;
    })
  );

  function openSearch() {
    setSearchOpen(true);
    setSearch("");
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearch("");
  }

  

  return (
    <main>

      {/*Código referente ao BUSCAR*/}
      {searchOpen && (
        <div className="searchOverlay">

          <div className="searchTop">
            <span className="searchLogo">PÁDUA</span>

            <button
              type="button"
              className="searchClose"
              onClick={closeSearch}
              aria-label="Fechar busca"
            >
              ×
            </button>
          </div>

          <div className="searchContainer">

            <span className="searchEyebrow">
              BUSCA
            </span>

            <h2>
              O QUE VOCÊ
              <br />
              PROCURA?
            </h2>

            <div className="searchInputArea">

              <input
                type="text"
                placeholder="Digite sua busca..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                autoFocus
              />

              <span>⌕</span>

            </div>

            {search === "" ? (

              <div className="searchSuggestions">
                <p>SUGESTÕES</p>

                <div className="searchCategoryList">
                  {categories.map((category, index) => (
                   <Link
                      href={category.href}
                      key={category.name}
                      onClick={closeSearch}
                    >
                      <span>{category.name}</span>

                      <small>
                        {String(index + 1).padStart(2, "0")}
                      </small>

                      <strong>↗</strong>
                    </Link>
                  ))}
                </div>
              </div>

            ) : (

              <div className="searchResults">

                <div className="searchResultsHeader">

                  <span>
                    RESULTADOS
                  </span>

                  <span>
                    {filteredProducts.length}{" "}
                    {filteredProducts.length === 1
                      ? "PRODUTO"
                      : "PRODUTOS"}
                  </span>

                </div>

                {filteredProducts.length > 0 ? (

                  <div className="searchProducts">

                    {filteredProducts.map((product) => (

                      <article
                        className="searchProduct"
                        key={product.name}
                      >

                        <div className="searchProductImage">

                          <img
                            src={product.image}
                            alt={product.name}
                          />

                        </div>

                        <div className="searchProductInfo">

                          <div>
                            <h3>{product.name}</h3>
                            <p>{product.category}</p>
                          </div>

                          <strong>
                            {product.price}
                          </strong>

                        </div>

                      </article>

                    ))}

                  </div>

                ) : (

                  <div className="noResults">

                    <p>
                      Nenhum produto encontrado.
                    </p>

                    <span>
                      Tente buscar outro termo.
                    </span>

                  </div>

                )}

              </div>

            )}

          </div>

        </div>
      )}





      
      {/* HEADER */}
      <header className="header">
        <a href="#" className="logo">
          PÁDUA.CULTURE
        </a>

        <nav className="nav">
          <a href="#shop">LOJA</a>
          <a href="#new-drop">LANÇAMENTOS</a>
          <a href="#upcycling">UPCYCLING</a>
          <a href="#about">SOBRE</a>
        </nav>


        {/*botões do lado direito superior*/}
        <div className="headerActions">
          <Link href="/login" className="accountLink">
            CONTA
          </Link>

           <button type="button" onClick={openSearch}>
              BUSCAR
           </button>

          <button>SACOLA (0)</button>
        </div>
      </header>

      {/* HERO */}
      <section className="hero">
        <div className="heroContent">
          <p>NOVA COLEÇÃO · 2026</p>

          <h1>PÁDUA</h1>

          <span>Novas peças. Mesma essência.</span>

          <a href="#new-drop" className="buttonLight">
            EXPLORAR COLEÇÃO
          </a>
        </div>
      </section>

      {/* NEW DROP */}
      <section className="section" id="new-drop">
        <div className="sectionHeader">
          <div>
            <span className="eyebrow">01 / NEW DROP</span>
            <h2>Novidades</h2>
          </div>

          <a href="#shop">VER TUDO →</a>
        </div>

        <div className="products">
          {products.map((product) => (
            <article className="productCard" key={product.name}>
              <div className="productImage">
                <img src={product.image} alt={product.name} />

                <button className="quickAdd">+</button>
              </div>

              <div className="productInfo">
                <div>
                  <h3>{product.name}</h3>
                  <p>{product.category}</p>
                </div>

                <strong>{product.price}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* UPCYCLING */}
      <section className="upcycling" id="upcycling">
        <div className="upcyclingNumber">02</div>

        <div className="upcyclingContent">
          <p>PÁDUA UPCYCLING</p>

          <h2>
            RECRIAR,
            <br />
            RESSIGNIFICAR.
            <br />
            <em>VESTIR DE NOVO.</em>
          </h2>

          <p className="upcyclingText">
            Peças existentes transformadas em algo novo. Cada criação carrega
            sua própria história e identidade.
          </p>

          <a href="#">EXPLORAR UPCYCLING →</a>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="categories" id="shop">
        <span className="eyebrow">03 / SHOP</span>

        <h2>Explore</h2>

        <div className="categoryList">

          <Link href="/loja/camisetas">
            <span>CAMISETAS</span>
            <small>01</small>
            <strong>↗</strong>
          </Link>

          <Link href="/loja/calcas">
            <span>CALÇAS</span>
            <small>02</small>
            <strong>↗</strong>
          </Link>

          <Link href="/loja/shorts">
            <span>SHORTS</span>
            <small>03</small>
            <strong>↗</strong>
          </Link>

          <Link href="/loja/bones">
            <span>BONÉS</span>
            <small>04</small>
            <strong>↗</strong>
          </Link>

          <Link href="/loja/upcycling">
            <span>UPCYCLING</span>
            <small>05</small>
            <strong>↗</strong>
          </Link>

        </div>
      </section>

      {/* ABOUT */}
      <section className="about" id="about">
        <p>EST. 2025 — BRASIL</p>

        <h2>
          NÃO É SÓ
          <br />
          O QUE VOCÊ VESTE.
          <br />
          <span>É O QUE VOCÊ CARREGA.</span>
        </h2>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footerLogo">PÁDUA</div>

        <div className="footerBottom">
          <span>© 2026 PÁDUA</span>

          <div>
            <a href="#">INSTAGRAM</a>
            <a href="#">CONTATO</a>
          </div>

          <span>BRASIL</span>
        </div>
      </footer>
    </main>
  );
}