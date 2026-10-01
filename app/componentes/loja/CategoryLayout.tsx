import Link from "next/link";
import "./store.css";
import StoreHeader from "./StoreHeader";
import StoreFooter from "./StoreFooter";


/* =========================================================
   TIPO DO PRODUTO
   ========================================================= */

export type Product = {
  name: string;
  category: string;
  price: string;
  image: string;
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

            <div className="storeProductImage">

              <img
                src={product.image}
                alt={product.name}
              />

              <button
                type="button"
                className="storeQuickAdd"
                aria-label={`Adicionar ${product.name} à sacola`}
              >
                +
              </button>

            </div>


            {/* INFORMAÇÕES */}

            <div className="storeProductInfo">

              <div>

                <h2>
                  {product.name}
                </h2>

                <p>
                  {product.category}
                </p>

              </div>

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

    </main>
  );
}