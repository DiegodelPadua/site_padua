import Link from "next/link";
import "./upcycling.css";

import StoreHeader from "../../componentes/loja/StoreHeader";


/* =========================================================
   PEÇAS UPCYCLING
   ========================================================= */

const pieces = [
  {
    number: "001",
    name: "Pádua Rework 01",
    description: "Peça reconstruída individualmente.",
    price: "R$ 289,90",
    image: "/images/upcycling-01.jpg",
  },
  {
    number: "002",
    name: "Pádua Rework 02",
    description: "Uma nova leitura para uma peça existente.",
    price: "R$ 319,90",
    image: "/images/upcycling-02.jpg",
  },
  {
    number: "003",
    name: "Pádua Rework 03",
    description: "Reconstruída. Ressignificada. Única.",
    price: "R$ 349,90",
    image: "/images/upcycling-03.jpg",
  },
];


/* =========================================================
   PÁGINA UPCYCLING
   ========================================================= */

export default function Upcycling() {
  return (
    <main className="upcyclingPage">

      {/* HEADER */}

      <StoreHeader />


      {/* =====================================================
          HERO
          ===================================================== */}

      <section className="upcyclingHero">

        <div className="upcyclingHeroTop">
          <span>PÁDUA / UPCYCLING</span>
          <span>COLLECTION 001</span>
        </div>


        <div className="upcyclingHeroTitle">

          <p>NOVAS</p>

          <h1>HISTÓRIAS</h1>

          <p className="upcyclingHeroSecond">
            PARA
          </p>

          <h2>VESTIR.</h2>

        </div>


        <div className="upcyclingHeroBottom">

          <p>
            PEÇAS EXISTENTES.
            <br />
            NOVAS HISTÓRIAS.
          </p>

          <p>
            PRODUÇÃO LIMITADA
            <br />
            PÁDUA — BRASIL
          </p>

        </div>

      </section>


      {/* =====================================================
          MANIFESTO
          ===================================================== */}

      <section className="upcyclingManifesto">

        <span>
          01 / MANIFESTO
        </span>


        <div className="upcyclingManifestoText">

          <p>
            Nem tudo precisa
            <br />
            começar do zero.
          </p>

          <p>
            O UPCYCLING PÁDUA transforma peças
            existentes em novas expressões de identidade.
          </p>

        </div>

      </section>


      {/* =====================================================
          COLEÇÃO
          ===================================================== */}

      <section className="upcyclingCollection">

        <div className="upcyclingSectionHeader">

          <span>
            02 / COLLECTION
          </span>

          <span>
            {pieces.length} PEÇAS
          </span>

        </div>


        {pieces.map((piece, index) => (
          <article
            className={
              index % 2 !== 0
                ? "upcyclingPiece upcyclingPieceReverse"
                : "upcyclingPiece"
            }
            key={piece.number}
          >

            {/* IMAGEM */}

            <div className="upcyclingPieceImage">

              <img
                src={piece.image}
                alt={piece.name}
              />

              <span className="upcyclingPieceNumber">
                {piece.number}
              </span>

            </div>


            {/* INFORMAÇÕES */}

            <div className="upcyclingPieceContent">

              <span className="upcyclingLimited">
                UNIQUE PIECE / {piece.number}
              </span>

              <h2>
                {piece.name}
              </h2>

              <p>
                {piece.description}
              </p>

              <strong>
                {piece.price}
              </strong>

              <button type="button">
                VER PEÇA
                <span>↗</span>
              </button>

            </div>

          </article>
        ))}

      </section>


      {/* =====================================================
          CONCEITO
          ===================================================== */}

      <section className="upcyclingConcept">

        <span>
          03 / CONCEPT
        </span>

        <h2>
          MENOS
          <br />
          MESMICE.
          <br />
          MAIS
          <br />
          IDENTIDADE.
        </h2>

        <p>
          Cada intervenção cria algo que não precisa
          existir duas vezes.
        </p>

      </section>


      {/* =====================================================
          FINAL
          ===================================================== */}

      <section className="upcyclingFinal">

        <p>
          PÁDUA UPCYCLING
        </p>

        <h2>
          FORA DO
          <br />
          ÓBVIO.
        </h2>

        <Link href="/loja/camisetas">

          EXPLORAR PÁDUA

          <span>
            ↗
          </span>

        </Link>

      </section>


      {/* =====================================================
          FOOTER
          ===================================================== */}

      <footer className="upcyclingFooter">

        <div>
          PÁDUA
        </div>

        <section>

          <span>
            UPCYCLING / 2026
          </span>

          <Link href="/">
            INÍCIO
          </Link>

          <span>
            BRASIL
          </span>

        </section>

      </footer>

    </main>
  );
}