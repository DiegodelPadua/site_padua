/* =========================================================
   IMPORTAÇÕES
   =========================================================
   CategoryLayout:
   Componente responsável pelo layout das páginas da loja.

   Product:
   Tipo utilizado para definir os dados de cada produto.
   ========================================================= */

   import CategoryLayout, {
    Product,
  } from "../../componentes/loja/CategoryLayout";
  
  
  /* =========================================================
     PRODUTOS - CAMISETAS
     =========================================================
     Lista das camisetas exibidas nesta categoria.
  
     IMPORTANTE:
     Atualmente os produtos estão cadastrados manualmente.
  
     Futuramente estes dados serão carregados diretamente
     do banco de dados da Pádua.
     ========================================================= */
  
  const camisetas: Product[] = [
  
    /* =======================================================
       PÁDUA GLOBE
       ======================================================= */
  
    {
      name: "Pádua Globe",
  
      // Identificador utilizado nas rotas e na sacola
      slug: "padua-globe",
  
      category: "Camiseta",
  
      price: "R$ 149,90",
  
      // Caminho da imagem considerando o basePath 
      image: "/images/globe.jpg",
    },
  
  
    /* =======================================================
       PÁDUA 1980
       ======================================================= */
  
    {
      name: "Pádua 1980",
  
      // Identificador utilizado nas rotas e na sacola
      slug: "padua-1980",
  
      category: "Camiseta",
  
      price: "R$ 159,90",
  
      // Caminho da imagem considerando o basePath 
      image: "/images/1980.jpg",
    },
  
  
    /* =======================================================
       PÁDUA ESSENTIAL
       ======================================================= */
  
    {
      name: "Pádua Essential",
  
      // Identificador utilizado nas rotas e na sacola
      slug: "padua-essential",
  
      category: "Camiseta",
  
      price: "R$ 129,90",
  
      // Caminho da imagem considerando o basePath 
      image: "/images/essential.jpg",
    },
  
  ];
  
  
  /* =========================================================
     PÁGINA - CAMISETAS
     =========================================================
     Envia os produtos e informações da categoria para o
     componente CategoryLayout.
  
     O CategoryLayout será responsável por:
  
     - Exibir os produtos
     - Mostrar o botão "+"
     - Selecionar cor
     - Selecionar tamanho
     - Adicionar o produto à sacola
     ========================================================= */
  
  export default function Camisetas() {
  
    return (
  
      <CategoryLayout
  
        // Número utilizado no cabeçalho da categoria
        number="01"
  
        // Nome principal da página
        title="CAMISETAS"
  
        // Produtos que serão exibidos
        products={camisetas}
  
        // Próxima categoria apresentada no final da página
        nextCategory="CALÇAS"
  
        // Rota da próxima categoria
        nextHref="/loja/calcas"
  
      />
  
    );
  }