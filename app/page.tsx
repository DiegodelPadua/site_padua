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

export default function Home() {
  return (
    <main>
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

        <div className="headerActions">
          <Link href="/login" className="accountLink">
            CONTA
          </Link>

          <button>BUSCAR</button>

          <button>SACOLA (0)</button>
        </div>
      </header>

      {/* HERO */}
      <section className="hero">DD
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
          <a href="#">
            <span>CAMISETAS</span>
            <small>01</small>
            <strong>↗</strong>
          </a>

          <a href="#">
            <span>CALÇAS</span>
            <small>02</small>
            <strong>↗</strong>
          </a>

          <a href="#">
            <span>SHORTS</span>
            <small>03</small>
            <strong>↗</strong>
          </a>

          <a href="#">
            <span>BONÉS</span>
            <small>04</small>
            <strong>↗</strong>
          </a>

          <a href="#">
            <span>UPCYCLING</span>
            <small>05</small>
            <strong>↗</strong>
          </a>
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