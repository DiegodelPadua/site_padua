"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";


/* =========================================================
   TIPO DE UM ITEM DA SACOLA
   ========================================================= */

export type CartItem = {
  id: string;
  name: string;
  price: number;
  image: string;
  size: string;
  color: string;
  quantity: number;
};


/* =========================================================
   TIPO DO CONTEXTO
   ========================================================= */

   type CartContextType = {
    items: CartItem[];
    cartCount: number;
  
    addItem: (item: CartItem) => void;
    increaseQuantity: (id: string) => void;
    decreaseQuantity: (id: string) => void;
    removeItem: (id: string) => void;
  };


/* =========================================================
   CRIAÇÃO DO CONTEXTO
   ========================================================= */

const CartContext = createContext<CartContextType | undefined>(
  undefined
);


/* =========================================================
   PROVIDER DA SACOLA
   ========================================================= */

export function CartProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);


  /* =======================================================
     CARREGAR SACOLA SALVA
     ======================================================= */

  useEffect(() => {
    const savedCart = localStorage.getItem("padua-cart");

    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);

        setItems(parsedCart);
      } catch {
        localStorage.removeItem("padua-cart");
      }
    }

    setLoaded(true);
  }, []);


  /* =======================================================
     SALVAR SACOLA
     ======================================================= */

  useEffect(() => {
    if (!loaded) {
      return;
    }

    localStorage.setItem(
      "padua-cart",
      JSON.stringify(items)
    );
  }, [items, loaded]);


  /* =======================================================
     ADICIONAR ITEM
     ======================================================= */

    function addItem(item: CartItem) {
    setItems((currentItems) => {
        // Procura o mesmo produto, com a mesma cor e tamanho
        const existingItem = currentItems.find(
        (cartItem) => cartItem.id === item.id
        );

        // Se já estiver na sacola, aumenta a quantidade
        if (existingItem) {
        return currentItems.map((cartItem) =>
            cartItem.id === item.id
            ? {
                ...cartItem,
                quantity: cartItem.quantity + 1,
                }
            : cartItem
        );
        }

        // Se ainda não estiver, adiciona como novo item
        return [...currentItems, item];
    });
    }

    /* =========================================================
   AUMENTAR QUANTIDADE
   ========================================================= */

function increaseQuantity(id: string) {
    setItems((currentItems) =>
      currentItems.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: item.quantity + 1,
            }
          : item
      )
    );
  }
  
  
  /* =========================================================
     DIMINUIR QUANTIDADE
     ========================================================= */
  
  function decreaseQuantity(id: string) {
    setItems((currentItems) =>
      currentItems
        .map((item) =>
          item.id === id
            ? {
                ...item,
                quantity: item.quantity - 1,
              }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }
  
  
  /* =========================================================
     REMOVER PRODUTO
     ========================================================= */
  
  function removeItem(id: string) {
    setItems((currentItems) =>
      currentItems.filter(
        (item) => item.id !== id
      )
    );
  }


  /* =======================================================
     QUANTIDADE TOTAL
     ======================================================= */

  const cartCount = items.reduce(
    (total, item) => total + item.quantity,
    0
  );


  return (
    <CartContext.Provider
    value={{
      items,
      cartCount,
      addItem,
      increaseQuantity,
      decreaseQuantity,
      removeItem,
    }}
  >
      {children}
    </CartContext.Provider>
  );
}


/* =========================================================
   HOOK DA SACOLA
   ========================================================= */

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error(
      "useCart deve ser utilizado dentro de CartProvider."
    );
  }

  return context;
}