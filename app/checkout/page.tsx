"use client";

/* =========================================================
   IMPORTAÇÕES
   ========================================================= */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "../context/CartContext";
import "./checkout.css";


/* =========================================================
   DADOS DO CLIENTE AUTENTICADO
   ========================================================= */

type UsuarioCheckout = {
  id: number;
  nome: string;
  sobrenome: string;
  email: string;
  telefone?: string | null;
};



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

  /* =========================================================
   IDENTIFICAÇÃO DO CLIENTE
   ========================================================= */

  const [usuario, setUsuario] = useState<UsuarioCheckout | null>(null);
  const [carregandoUsuario, setCarregandoUsuario] = useState(true);
  const [erroUsuario, setErroUsuario] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function consultarCliente() {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 401) {
          setUsuario(null);
          return;
        }

        if (!response.ok) {
          throw new Error("Não foi possível consultar sua conta.");
        }

        const dados = await response.json();

        if (!controller.signal.aborted) {
          setUsuario(
            dados.autenticado && dados.usuario
              ? dados.usuario
              : null
          );
        }
      } catch {
        if (!controller.signal.aborted) {
          setErroUsuario("Não foi possível carregar seus dados.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setCarregandoUsuario(false);
        }
      }
    }

    consultarCliente();

    return () => controller.abort();
  }, []);

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
            {/* =====================================================
                ESTADO DA IDENTIFICAÇÃO DO CLIENTE
                ===================================================== */}

            {carregandoUsuario && (
              <p role="status">CARREGANDO SEUS DADOS...</p>
            )}

            {erroUsuario && (
              <p role="alert">{erroUsuario}</p>
            )}

            {!carregandoUsuario && !erroUsuario && !usuario && (
              <p>
                PARA FINALIZAR SUA COMPRA,{" "}
                <Link href="/login">
                  ENTRE NA SUA CONTA
                </Link>.
              </p>
            )}

            <div className="checkoutFields">

              <label className="checkoutField checkoutFieldFull">
                <span>E-MAIL</span>

                <input
                  type="email"
                  name="email"
                  placeholder="seu@email.com"
                  value={usuario?.email ?? ""}
                  readOnly
                  autoComplete="email"
                />
              </label>

              <label className="checkoutField checkoutFieldFull">
                <span>TELEFONE</span>

                <input
                  type="tel"
                  name="telefone"
                  placeholder="(11) 99999-9999"
                  value={usuario?.telefone ?? ""}
                  readOnly
                  autoComplete="tel"
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
                  value={usuario?.nome ?? ""}
                  readOnly
                  autoComplete="given-name"
                />
              </label>


              <label className="checkoutField">
                <span>SOBRENOME</span>

                <input
                  type="text"
                  name="sobrenome"
                  placeholder="Sobrenome"
                  value={usuario?.sobrenome ?? ""}
                  readOnly
                  autoComplete="family-name"
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