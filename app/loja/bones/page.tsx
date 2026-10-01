import CategoryLayout, {
    Product,
  } from "../../componentes/loja/CategoryLayout";
  
  const bones: Product[] = [
    {
      name: "Pádua Classic Cap",
      category: "Boné",
      price: "R$ 119,90",
      image: "/images/bone-classic.jpg",
    },
  
    {
      name: "Pádua Culture Cap",
      category: "Boné",
      price: "R$ 129,90",
      image: "/images/bone-culture.jpg",
    },
  
    {
      name: "Pádua Essential Cap",
      category: "Boné",
      price: "R$ 109,90",
      image: "/images/bone-essential.jpg",
    },
  ];
  
  
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