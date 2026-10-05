import CategoryLayout, {
  Product,
} from "../../componentes/loja/CategoryLayout";

/* =========================================================
   PRODUTOS — CALÇAS
   ========================================================= */

const calcas: Product[] = [
  {
    name: "Pádua Wide Black",
    category: "Calça",
    price: "R$ 229,90",
    image: "/images/calca-wide-black.jpg",

    // Identificador usado para acessar a página individual do produto
    slug: "padua-wide-black",
  },
  {
    name: "Pádua Cargo",
    category: "Calça",
    price: "R$ 249,90",
    image: "/images/calca-cargo.jpg",

    // Identificador usado para acessar a página individual do produto
    slug: "padua-cargo",
  },
  {
    name: "Pádua Essential Pants",
    category: "Calça",
    price: "R$ 219,90",
    image: "/images/calca-essential.jpg",

    // Identificador usado para acessar a página individual do produto
    slug: "padua-essential-pants",
  },
];

/* =========================================================
   PÁGINA DA CATEGORIA CALÇAS
   ========================================================= */

export default function Calcas() {
  return (
    <CategoryLayout
      number="02"
      title="CALÇAS"
      products={calcas}
      nextCategory="SHORTS"
      nextHref="/loja/shorts"
    />
  );
}