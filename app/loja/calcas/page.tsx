import CategoryLayout, {
    Product,
  } from "../../componentes/loja/CategoryLayout";
  
  
  const calcas: Product[] = [
    {
      name: "Pádua Wide Black",
      category: "Calça",
      price: "R$ 229,90",
      image: "/images/calca-wide-black.jpg",
    },
  
    {
      name: "Pádua Cargo",
      category: "Calça",
      price: "R$ 249,90",
      image: "/images/calca-cargo.jpg",
    },
  
    {
      name: "Pádua Essential Pants",
      category: "Calça",
      price: "R$ 219,90",
      image: "/images/calca-essential.jpg",
    },
  ];
  
  
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