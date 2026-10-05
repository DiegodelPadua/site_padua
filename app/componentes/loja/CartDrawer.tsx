"use client";

import { useRouter } from "next/navigation";
import { useCart } from "../../context/CartContext";

type CartDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function CartDrawer({
  isOpen,
  onClose,
}: CartDrawerProps) {
  
    /* =========================================================
     NAVEGAÇÃO
     =========================================================
     Utilizado para levar o cliente da sacola para a página
     de finalização da compra.
     ========================================================= */

  const router = useRouter();

  const {
    items,
    increaseQuantity,
    decreaseQuantity,
    removeItem,
  } = useCart();

  /* =========================================================
     SUBTOTAL
     ========================================================= */

  const subtotal = items.reduce(
    (total, item) =>
      total + item.price * item.quantity,
    0
  );

  return (
    <>
      {/* FUNDO ESCURO */}

      <div
        className={`cartOverlay ${isOpen ? "open" : ""}`}
        onClick={onClose}
      />


      {/* PAINEL DA SACOLA */}

      <aside className={`cartDrawer ${isOpen ? "open" : ""}`}>

        {/* CABEÇALHO */}

        <div className="cartDrawerHeader">

          <h2>SUA SACOLA</h2>

          <button
            type="button"
            className="cartClose"
            onClick={onClose}
            aria-label="Fechar sacola"
          >
            ×
          </button>

        </div>


        {/* PRODUTOS */}

        <div className="cartDrawerContent">

          {items.length === 0 ? (

            <div className="cartEmpty">
              <p>SUA SACOLA ESTÁ VAZIA.</p>
            </div>

          ) : (

            <div className="cartItems">

              {items.map((item) => (

                <div
                  className="cartItem"
                  key={item.id}
                >

                  {/* FOTO */}

                  <div className="cartItemImage">
                    <img
                      src={item.image}
                      alt={item.name}
                    />
                  </div>


                  {/* INFORMAÇÕES */}

                  <div className="cartItemInfo">

                    <h3>{item.name}</h3>

                    <p>
                      {item.color} / {item.size}
                    </p>

                    <strong>
                      {item.price.toLocaleString(
                        "pt-BR",
                        {
                          style: "currency",
                          currency: "BRL",
                        }
                      )}
                    </strong>


                    {/* QUANTIDADE */}

                    <div className="cartItemActions">

                      <div className="cartQuantity">

                        <button
                          type="button"
                          onClick={() =>
                            decreaseQuantity(item.id)
                          }
                          aria-label="Diminuir quantidade"
                        >
                          −
                        </button>

                        <span>
                          {item.quantity}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            increaseQuantity(item.id)
                          }
                          aria-label="Aumentar quantidade"
                        >
                          +
                        </button>

                      </div>

                      <button
                        type="button"
                        className="cartRemove"
                        onClick={() =>
                          removeItem(item.id)
                        }
                      >
                        REMOVER
                      </button>

                    </div>

                  </div>

                </div>

              ))}

            </div>

          )}

        </div>


        {/* RODAPÉ */}

        {items.length > 0 && (

          <div className="cartDrawerFooter">

            <div className="cartSubtotal">

              <span>SUBTOTAL</span>

              <strong>
                {subtotal.toLocaleString(
                  "pt-BR",
                  {
                    style: "currency",
                    currency: "BRL",
                  }
                )}
              </strong>

            </div>

            <p className="cartShipping">
              FRETE CALCULADO NA FINALIZAÇÃO DA COMPRA.
            </p>

            {/* =========================================================
                FINALIZAR COMPRA
                =========================================================
                Fecha a sacola e direciona o cliente para o checkout.
                ========================================================= */}

                <button
                  type="button"
                  className="cartCheckout"
                  onClick={() => {
                    onClose();
                    router.push("/checkout");
                  }}
                >
                  <span>FINALIZAR COMPRA</span>
                  <span>→</span>
                </button>

          </div>

        )}

      </aside>
    </>
  );
}