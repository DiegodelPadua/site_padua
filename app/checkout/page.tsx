"use client";

/* =========================================================
   IMPORTAÇÕES
   ========================================================= */

import Link from "next/link";
import { useCart } from "../context/CartContext";
import "./checkout.css";


/* =========================================================
   CHECKOUT - PÁDUA
   =========================================================
   Primeira etapa da finalização da compra.

   Nesta página:
   - coletamos os dados de contato;
   - coletamos os dados de entrega;
   - mostramos os produtos da sacola;
   - calculamos o subtotal.

   FUTURAMENTE:
   - cálculo de frete;
   - validação de CEP;
   - criação do pedido no banco;
   - pagamento.
   ========================================================= */

export default function Checkout() {

  /* =======================================================
     DADOS DA SACOLA
     ======================================================= */

  const { items } = useCart();


  /* =======================================================
     SUBTOTAL
     ======================================================= */

  const subtotal = items.reduce(
    (total, item) =>
      total + item.price * item.quantity,
    0
  );


  return (
    <main className="checkoutPage">

      {/* ===================================================
          CABEÇALHO
          =================================================== */}

      <header className="checkoutHeader">

        <Link
          href="/"
          className="checkoutLogo"
        >
          PÁDUA
        </Link>

        <Link
          href="/"
          className="checkoutBack"
        >
          ← CONTINUAR COMPRANDO
        </Link>

      </header>


      {/* ===================================================
          CONTEÚDO
          =================================================== */}

      <div className="checkoutLayout">


        {/* =================================================
            LADO ESQUERDO - DADOS DO CLIENTE
            ================================================= */}

        <section className="checkoutForm">

          <span className="checkoutEyebrow">
            CHECKOUT
          </span>

          <h1>
            FINALIZAR
            <br />
            COMPRA
          </h1>


          {/* ===============================================
              CONTATO
              =============================================== */}

          <div className="checkoutSection">

            <div className="checkoutSectionHeader">
              <span>01</span>
              <h2>CONTATO</h2>
            </div>

            <div className="checkoutFields">

              <label className="checkoutField checkoutFieldFull">
                <span>E-MAIL</span>

                <input
                  type="email"
                  name="email"
                  placeholder="seu@email.com"
                />
              </label>

              <label className="checkoutField checkoutFieldFull">
                <span>TELEFONE</span>

                <input
                  type="tel"
                  name="telefone"
                  placeholder="(11) 99999-9999"
                />
              </label>

            </div>

          </div>


          {/* ===============================================
              ENTREGA
              =============================================== */}

          <div className="checkoutSection">

            <div className="checkoutSectionHeader">
              <span>02</span>
              <h2>ENTREGA</h2>
            </div>

            <div className="checkoutFields">

              <label className="checkoutField">
                <span>NOME</span>

                <input
                  type="text"
                  name="nome"
                  placeholder="Nome"
                />
              </label>


              <label className="checkoutField">
                <span>SOBRENOME</span>

                <input
                  type="text"
                  name="sobrenome"
                  placeholder="Sobrenome"
                />
              </label>


              <label className="checkoutField checkoutFieldFull">
                <span>CEP</span>

                <input
                  type="text"
                  name="cep"
                  placeholder="00000-000"
                />
              </label>


              <label className="checkoutField checkoutFieldFull">
                <span>ENDEREÇO</span>

                <input
                  type="text"
                  name="endereco"
                  placeholder="Rua / Avenida"
                />
              </label>


              <label className="checkoutField">
                <span>NÚMERO</span>

                <input
                  type="text"
                  name="numero"
                  placeholder="Número"
                />
              </label>


              <label className="checkoutField">
                <span>COMPLEMENTO</span>

                <input
                  type="text"
                  name="complemento"
                  placeholder="Apto, bloco..."
                />
              </label>


              <label className="checkoutField checkoutFieldFull">
                <span>BAIRRO</span>

                <input
                  type="text"
                  name="bairro"
                  placeholder="Bairro"
                />
              </label>


              <label className="checkoutField">
                <span>CIDADE</span>

                <input
                  type="text"
                  name="cidade"
                  placeholder="Cidade"
                />
              </label>


              <label className="checkoutField">
                <span>ESTADO</span>

                <input
                  type="text"
                  name="estado"
                  placeholder="SP"
                />
              </label>

            </div>

          </div>

        </section>


        {/* =================================================
            LADO DIREITO - RESUMO
            ================================================= */}

        <aside className="checkoutSummary">

          <div className="checkoutSummaryHeader">

            <span>SEU PEDIDO</span>

            <span>
              {items.reduce(
                (total, item) =>
                  total + item.quantity,
                0
              )}{" "}
              ITENS
            </span>

          </div>


          {/* ===============================================
              SACOLA VAZIA
              =============================================== */}

          {items.length === 0 ? (

            <div className="checkoutEmpty">

              <p>
                SUA SACOLA ESTÁ VAZIA.
              </p>

              <Link href="/">
                VOLTAR PARA A LOJA →
              </Link>

            </div>

          ) : (

            <>
              {/* ===========================================
                  PRODUTOS
                  =========================================== */}

              <div className="checkoutItems">

                {items.map((item) => (

                  <div
                    className="checkoutItem"
                    key={item.id}
                  >

                    <div className="checkoutItemImage">

                      <img
                        src={item.image}
                        alt={item.name}
                      />

                      <span>
                        {item.quantity}
                      </span>

                    </div>


                    <div className="checkoutItemInfo">

                      <div>

                        <h3>
                          {item.name}
                        </h3>

                        <p>
                          {item.color} / {item.size}
                        </p>

                      </div>


                      <strong>
                        {(
                          item.price *
                          item.quantity
                        ).toLocaleString(
                          "pt-BR",
                          {
                            style: "currency",
                            currency: "BRL",
                          }
                        )}
                      </strong>

                    </div>

                  </div>

                ))}

              </div>


              {/* ===========================================
                  VALORES
                  =========================================== */}

              <div className="checkoutTotals">

                <div>
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


                <div>
                  <span>FRETE</span>

                  <strong>
                    CALCULADO DEPOIS
                  </strong>
                </div>


                <div className="checkoutTotal">

                  <span>TOTAL</span>

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

              </div>


              {/* ===========================================
                  PRÓXIMA ETAPA
                  =========================================== */}

              <button
                type="button"
                className="checkoutContinue"
              >
                <span>
                  CONTINUAR PARA PAGAMENTO
                </span>

                <span>→</span>
              </button>

            </>

          )}

        </aside>

      </div>

    </main>
  );
}