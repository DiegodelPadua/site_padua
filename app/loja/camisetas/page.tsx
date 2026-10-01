import CategoryLayout, {
    Product,
  } from "../../componentes/loja/CategoryLayout";
  
  
  const camisetas: Product[] = [
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
  
  
  export default function Camisetas() {
    return (
      <CategoryLayout
        number="01"
        title="CAMISETAS"
        products={camisetas}
        nextCategory="CALÇAS"
        nextHref="/loja/calcas"
      />
    );
  }