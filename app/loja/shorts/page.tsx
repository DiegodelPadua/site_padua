import CategoryLayout, {
  Product,
} from "../../componentes/loja/CategoryLayout";

/* =========================================================
   PRODUTOS — SHORTS
   ========================================================= */

const shorts: Product[] = [
  {
    name: "Pádua Essential Shorts",
    category: "Shorts",
    price: "R$ 149,90",
    image: "/images/shorts-essential.jpg",

    // Identificador usado para acessar a página individual do produto
    slug: "padua-essential-shorts",
  },
  {
    name: "Pádua Street Shorts",
    category: "Shorts",
    price: "R$ 159,90",
    image: "/images/shorts-street.jpg",

    // Identificador usado para acessar a página individual do produto
    slug: "padua-street-shorts",
  },
  {
    name: "Pádua Black Shorts",
    category: "Shorts",
    price: "R$ 169,90",
    image: "/images/shorts-black.jpg",

    // Identificador usado para acessar a página individual do produto
    slug: "padua-black-shorts",
  },
];

/* =========================================================
   PÁGINA DA CATEGORIA SHORTS
   ========================================================= */

export default function Shorts() {
  return (
    <CategoryLayout
      number="03"
      title="SHORTS"
      products={shorts}
      nextCategory="BONÉS"
      nextHref="/loja/bones"
    />
  );
}