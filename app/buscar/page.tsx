"use client";

/* =========================================================
   IMPORTAÇÕES
   ========================================================= */

import { useState } from "react";
import Link from "next/link";
import "./buscar.css";


/* =========================================================
   PRODUTOS
   =========================================================
   Dados temporários dos produtos.

   FUTURAMENTE:
   Estes produtos poderão vir do banco de dados.
   ========================================================= */

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


/* =========================================================
   CATEGORIAS / SUGESTÕES DE BUSCA
   =========================================================
   Essas categorias aparecem quando o usuário ainda
   não digitou nada no campo de busca.
   ========================================================= */

const categories = [
  {
    name: "CAMISETAS",
    href: "/loja/camisetas",
  },
  {
    name: "CALÇAS",
    href: "/loja/calcas",
  },
  {
    name: "SHORTS",
    href: "/loja/shorts",
  },
  {
    name: "BONÉS",
    href: "/loja/bones",
  },
  {
    name: "UPCYCLING",
    href: "/loja/upcycling",
  },
];


/* =========================================================
   PÁGINA BUSCAR
   ========================================================= */

export default function Buscar() {


  /* =======================================================
     ESTADO DO CAMPO DE BUSCA
     =======================================================
     Guarda aquilo que o usuário está digitando.
     ======================================================= */

  const [search, setSearch] = useState("");


  /* =======================================================
     NORMALIZAÇÃO DA BUSCA
     =======================================================
     Converte o texto para minúsculo e remove acentos.

     Exemplo:
     "BONÉS" -> "bones"

     Isso ajuda a busca a funcionar mesmo que o usuário
     digite com ou sem acento.
     ======================================================= */

  const normalizedSearch = search
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();


  /* =======================================================
     FILTRO DOS PRODUTOS
     =======================================================
     Procura o texto digitado no:
     
     - nome do produto
     - categoria do produto
     
     Exemplo:
     "Pádua Globe"
     "Camiseta"
     ======================================================= */

  const filteredProducts = products.filter((product) => {

    /* Normaliza o nome do produto */

    const name = product.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");


    /* Normaliza a categoria do produto */

    const category = product.category
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");


    /* Verifica se a busca aparece no nome ou categoria */

    return (
      name.includes(normalizedSearch) ||
      category.includes(normalizedSearch)
    );
  });


  /* =========================================================
     INTERFACE DA PÁGINA
     ========================================================= */

  return (

    <main className="searchPage">


      {/* =====================================================
          TOPO DA PÁGINA
          =====================================================
          Contém:
          - Logo PÁDUA
          - Botão X para voltar à Home
          ===================================================== */}

      <div className="searchTop">

        <Link href="/" className="searchLogo">
          PÁDUA
        </Link>

        <Link href="/" className="searchClose">
          ×
        </Link>

      </div>


      {/* =====================================================
          CONTAINER PRINCIPAL DA BUSCA
          ===================================================== */}

      <div className="searchContainer">


        {/* ===================================================
            TÍTULO DA BUSCA
            =================================================== */}

        <span className="searchEyebrow">
          BUSCA
        </span>

        <h1>
          O QUE VOCÊ
          <br />
          PROCURA?
        </h1>


        {/* ===================================================
            CAMPO DE BUSCA
            ===================================================
            Tudo digitado aqui é armazenado na variável:
            
            search
            =================================================== */}

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


        {/* ===================================================
            SUGESTÕES OU RESULTADOS
            ===================================================
            
            Se o campo estiver vazio:
            -> mostra as categorias

            Se o usuário digitar:
            -> mostra os produtos encontrados
            =================================================== */}

        {search === "" ? (


          /* =================================================
             SUGESTÕES
             =================================================
             Aparecem quando nenhuma busca foi digitada.
             ================================================= */

          <div className="searchSuggestions">

            <p>SUGESTÕES</p>


            {/* LISTA DE CATEGORIAS */}

            <div className="searchCategoryList">

              {categories.map((category, index) => (

                <Link
                  href={category.href}
                  key={category.name}
                >

                  {/* Nome da categoria */}

                  <span>
                    {category.name}
                  </span>


                  {/* Número da categoria: 01, 02, 03... */}

                  <small>
                    {String(index + 1).padStart(2, "0")}
                  </small>


                  {/* Ícone da seta */}

                  <strong>
                    ↗
                  </strong>

                </Link>

              ))}

            </div>

          </div>


        ) : (


          /* =================================================
             RESULTADOS DA BUSCA
             =================================================
             Esta área aparece quando o usuário começa
             a digitar alguma coisa.
             ================================================= */

          <div className="searchResults">


            {/* ===============================================
                CABEÇALHO DOS RESULTADOS
                ===============================================
                Exemplo:

                RESULTADOS                2 PRODUTOS
                =============================================== */}

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


            {/* ===============================================
                VERIFICA SE ENCONTROU ALGUM PRODUTO
                =============================================== */}

            {filteredProducts.length > 0 ? (


              /* =============================================
                 LISTA DOS PRODUTOS ENCONTRADOS
                 ============================================= */

              <div className="searchProducts">

                {filteredProducts.map((product) => (

                  <article
                    className="searchProduct"
                    key={product.name}
                  >


                    {/* IMAGEM DO PRODUTO */}

                    <div className="searchProductImage">

                      <img
                        src={product.image}
                        alt={product.name}
                      />

                    </div>


                    {/* INFORMAÇÕES DO PRODUTO */}

                    <div className="searchProductInfo">

                      <div>

                        {/* Nome */}

                        <h3>
                          {product.name}
                        </h3>


                        {/* Categoria */}

                        <p>
                          {product.category}
                        </p>

                      </div>


                      {/* Preço */}

                      <strong>
                        {product.price}
                      </strong>

                    </div>

                  </article>

                ))}

              </div>


            ) : (


              /* =============================================
                 NENHUM PRODUTO ENCONTRADO
                 ============================================= */

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

    </main>
  );
}