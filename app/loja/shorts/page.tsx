import CategoryLayout, {
    Product,
  } from "../../componentes/loja/CategoryLayout";
  
  
  const shorts: Product[] = [
    {
      name: "Pádua Essential Shorts",
      category: "Shorts",
      price: "R$ 149,90",
      image: "/images/shorts-essential.jpg",
    },
  
    {
      name: "Pádua Street Shorts",
      category: "Shorts",
      price: "R$ 159,90",
      image: "/images/shorts-street.jpg",
    },
  
    {
      name: "Pádua Black Shorts",
      category: "Shorts",
      price: "R$ 169,90",
      image: "/images/shorts-black.jpg",
    },
  ];
  
  
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