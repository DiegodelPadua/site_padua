"use client";

import { useCart } from "../../context/CartContext";

type CartDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function CartDrawer({
  isOpen,
  onClose,
}: CartDrawerProps) {

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

            <button
              type="button"
              className="cartCheckout"
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