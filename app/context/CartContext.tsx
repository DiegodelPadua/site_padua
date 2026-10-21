
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

/* =========================================================
   PÁDUA CULTURE — SACOLA DE COMPRAS

   Compatibilidade:
   - Produtos antigos cadastrados manualmente
   - Produtos e variantes cadastrados no MySQL

   O estoque exibido na interface é uma referência.
   A disponibilidade real deverá ser validada no
   servidor antes de finalizar qualquer pedido.
   ========================================================= */

export type CartItem = {
  id: string;
  name: string;
  price: number;
  image: string;
  size: string;
  color: string;
  quantity: number;

  // Identificador real da variante no MySQL.
  variantId?: number;

  // Estoque informado pela API pública.
  stock?: number;
};

type CartContextType = {
  items: CartItem[];
  cartCount: number;

  addItem: (item: CartItem) => boolean;
  increaseQuantity: (id: string) => void;
  decreaseQuantity: (id: string) => void;
  removeItem: (id: string) => void;
};

const CartContext = createContext<
  CartContextType | undefined
>(undefined);

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
    try {
      const savedCart = localStorage.getItem("padua-cart");

      if (savedCart) {
        const parsedCart: unknown = JSON.parse(savedCart);

        if (Array.isArray(parsedCart)) {
          // Mantém somente registros com estrutura básica válida.
          const validItems = parsedCart.filter(
            (item): item is CartItem =>
              item !== null &&
              typeof item === "object" &&
              typeof item.id === "string" &&
              typeof item.name === "string" &&
              typeof item.price === "number" &&
              Number.isFinite(item.price) &&
              typeof item.image === "string" &&
              typeof item.size === "string" &&
              typeof item.color === "string" &&
              Number.isInteger(item.quantity) &&
              item.quantity > 0
          );

          setItems(validItems);
        }
      }
    } catch {
      localStorage.removeItem("padua-cart");
    } finally {
      setLoaded(true);
    }
  }, []);

  /* =======================================================
     SALVAR SACOLA
     ======================================================= */

  useEffect(() => {
    if (!loaded) return;

    localStorage.setItem(
      "padua-cart",
      JSON.stringify(items)
    );
  }, [items, loaded]);

  /* =======================================================
     ADICIONAR PRODUTO
     ======================================================= */

  function addItem(item: CartItem): boolean {
    // Bloqueia quantidade inicial inválida.
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      return false;
    }

    // Verifica o estoque informado para variantes reais.
    if (
      item.stock !== undefined &&
      item.quantity > item.stock
    ) {
      return false;
    }

    // A atualização usa o estado mais recente da sacola.
    setItems((currentItems) => {
      const existingItem = currentItems.find(
        (cartItem) => cartItem.id === item.id
      );

      if (existingItem) {
        const newQuantity =
          existingItem.quantity + item.quantity;

        const stock = item.stock ?? existingItem.stock;

        // Não ultrapassa o estoque conhecido.
        if (
          stock !== undefined &&
          newQuantity > stock
        ) {
          return currentItems;
        }

        return currentItems.map((cartItem) =>
          cartItem.id === item.id
            ? {
                ...cartItem,
                quantity: newQuantity,
                stock,
              }
            : cartItem
        );
      }

      return [...currentItems, item];
    });

    return true;
  }

  /* =======================================================
     AUMENTAR QUANTIDADE
     ======================================================= */

  function increaseQuantity(id: string) {
    setItems((currentItems) =>
      currentItems.map((item) => {
        if (item.id !== id) return item;

        // Respeita o estoque conhecido.
        if (
          item.stock !== undefined &&
          item.quantity >= item.stock
        ) {
          return item;
        }

        return {
          ...item,
          quantity: item.quantity + 1,
        };
      })
    );
  }

  /* =======================================================
     DIMINUIR QUANTIDADE
     ======================================================= */

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

  /* =======================================================
     REMOVER ITEM
     ======================================================= */

  function removeItem(id: string) {
    setItems((currentItems) =>
      currentItems.filter((item) => item.id !== id)
    );
  }

  /* =======================================================
     CONTADOR DA SACOLA
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
   HOOK PARA UTILIZAR A SACOLA
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
