"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/* PÁDUA CULTURE — SACOLA. Estoque no cliente é indicativo; checkout valida no servidor. */
export type CartItem = {
  id: string;
  name: string;
  price: number;
  image: string;
  size: string;
  color: string;
  quantity: number;
  variantId?: number;
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

const CartContext = createContext<CartContextType | undefined>(undefined);

function estoqueValido(stock: unknown): stock is number {
  return typeof stock === "number" && Number.isSafeInteger(stock) && stock >= 0;
}

function itemValido(item: unknown): item is CartItem {
  if (!item || typeof item !== "object" || Array.isArray(item)) return false;
  const i = item as Record<string, unknown>;
  return typeof i.id === "string" && i.id.length > 0 &&
    typeof i.name === "string" &&
    typeof i.price === "number" && Number.isFinite(i.price) && i.price >= 0 &&
    typeof i.image === "string" &&
    typeof i.size === "string" &&
    typeof i.color === "string" &&
    typeof i.quantity === "number" && Number.isSafeInteger(i.quantity) && i.quantity > 0 &&
    (i.variantId === undefined || (typeof i.variantId === "number" && Number.isSafeInteger(i.variantId) && i.variantId > 0)) &&
    (i.stock === undefined || estoqueValido(i.stock));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Ref sincronizada permite resposta booleana imediata sem side effects no updater React.
  const itemsRef = useRef<CartItem[]>([]);

  function atualizarItens(proximos: CartItem[]) {
    itemsRef.current = proximos;
    setItems(proximos);
  }

  useEffect(() => {
    try {
      const salvo = localStorage.getItem("padua-cart");
      if (salvo) {
        const parsed: unknown = JSON.parse(salvo);
        if (Array.isArray(parsed)) {
          // O estoque persistido pode estar desatualizado; não confiar nele.
          const validos = parsed.filter(itemValido).map((item) => ({
            ...item,
            stock: undefined,
          }));
          atualizarItens(validos);
        }
      }
    } catch {
      localStorage.removeItem("padua-cart");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem("padua-cart", JSON.stringify(items));
  }, [items, loaded]);

  function addItem(item: CartItem): boolean {
    if (!itemValido(item)) return false;
    const atuais = itemsRef.current;
    const existente = atuais.find((i) => i.id === item.id);
    const novaQuantidade = (existente?.quantity ?? 0) + item.quantity;
    // Para variantes reais, o estoque deve vir da consulta recente da API.
    if (item.variantId !== undefined && !estoqueValido(item.stock)) return false;
    const limite = estoqueValido(item.stock) ? item.stock : existente?.stock;
    if (estoqueValido(limite) && novaQuantidade > limite) return false;
    if (!Number.isSafeInteger(novaQuantidade)) return false;

    const proximos = existente
      ? atuais.map((i) => i.id === item.id
          ? { ...i, quantity: novaQuantidade, stock: limite }
          : i)
      : [...atuais, item];
    atualizarItens(proximos);
    return true;
  }

  function increaseQuantity(id: string) {
    const atuais = itemsRef.current;
    atualizarItens(atuais.map((item) => {
      if (item.id !== id) return item;
      // Variante real sem estoque atualizado não pode aumentar até revalidação.
      if (item.variantId !== undefined && !estoqueValido(item.stock)) return item;
      if (estoqueValido(item.stock) && item.quantity >= item.stock) return item;
      return { ...item, quantity: item.quantity + 1 };
    }));
  }

  function decreaseQuantity(id: string) {
    atualizarItens(itemsRef.current.map((item) =>
      item.id === id ? { ...item, quantity: item.quantity - 1 } : item
    ).filter((item) => item.quantity > 0));
  }

  function removeItem(id: string) {
    atualizarItens(itemsRef.current.filter((item) => item.id !== id));
  }

  const cartCount = items.reduce((total, item) => total + item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, cartCount, addItem, increaseQuantity, decreaseQuantity, removeItem }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart deve ser utilizado dentro de CartProvider.");
  return context;
}
