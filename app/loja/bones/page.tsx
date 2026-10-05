import CategoryLayout, {
  Product,
} from "../../componentes/loja/CategoryLayout";

/* =========================================================
   PRODUTOS — BONÉS
   ========================================================= */

const bones: Product[] = [
  {
    name: "Pádua Classic Cap",
    category: "Boné",
    price: "R$ 119,90",
    image: "/images/bone-classic.jpg",

    // Identificador usado para acessar a página individual do produto
    slug: "padua-classic-cap",
  },
  {
    name: "Pádua Culture Cap",
    category: "Boné",
    price: "R$ 129,90",
    image: "/images/bone-culture.jpg",

    // Identificador usado para acessar a página individual do produto
    slug: "padua-culture-cap",
  },
  {
    name: "Pádua Essential Cap",
    category: "Boné",
    price: "R$ 109,90",
    image: "/images/bone-essential.jpg",

    // Identificador usado para acessar a página individual do produto
    slug: "padua-essential-cap",
  },
];

/* =========================================================
   PÁGINA DA CATEGORIA BONÉS
   ========================================================= */

export default function Bones() {
  return (
    <CategoryLayout
      number="04"
      title="BONÉS"
      products={bones}
      nextCategory="UPCYCLING"
      nextHref="/loja/upcycling"
    />
  );
}