"use client";

/* =========================================================
   IMPORTAÇÕES
   ========================================================= */

import Link from "next/link";
// Hooks utilizados para estados, efeitos e controle de edição.
import { useEffect, useRef, useState } from "react";
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

type EnderecoCheckout = {
  id: number;
  apelido: string | null;
  destinatario: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  principal: boolean;
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


   // Endereços cadastrados no MySQL.
  const [enderecos, setEnderecos] = useState<EnderecoCheckout[]>([]);
  const [enderecoSelecionadoId, setEnderecoSelecionadoId] = useState<number | null>(null);
  const [carregandoEnderecos, setCarregandoEnderecos] = useState(true);
  const [salvandoEndereco, setSalvandoEndereco] = useState(false);
  const [mensagemEndereco, setMensagemEndereco] = useState("");

  // Dados editáveis do formulário de entrega.
  const [dadosEntrega, setDadosEntrega] = useState({
    cep: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
  });

  /* =========================================================
   CONTROLE DE EDIÇÃO DO ENDEREÇO
   =========================================================
   Identifica alterações realizadas pelo cliente enquanto
   a consulta de endereços está em andamento.
   ========================================================= */

  const versaoEdicaoEndereco = useRef(0);

  // Deve ser chamada sempre que o cliente modificar
  // manualmente algum campo do endereço.
  function registrarEdicaoEndereco() {
    versaoEdicaoEndereco.current += 1;
    // Registra a edição para evitar preenchimento automático atrasado.
    registrarEdicaoEndereco();
  }

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

  /* =========================================================
   CONSULTAR ENDEREÇOS DO CLIENTE - PÁDUA CULTURE
   =========================================================

   OBJETIVO:
   Consultar os endereços cadastrados no MySQL da Hostinger
   por meio da API GET /api/enderecos.

   FUNCIONAMENTO:
   1. Aguarda a identificação do cliente.
   2. Verifica se existe um usuário autenticado.
   3. Consulta os endereços desse usuário.
   4. Armazena os endereços no estado do React.
   5. Seleciona o endereço principal automaticamente.
   6. Preenche os campos do formulário de entrega.

   ========================================================= */

  useEffect(() => {

  /* -------------------------------------------------------
     ETAPA 1 - AGUARDAR A IDENTIFICAÇÃO DO CLIENTE
     -------------------------------------------------------

     Não podemos consultar os endereços enquanto a API
     de autenticação ainda está carregando.
  */

  if (carregandoUsuario) {
    return;
  }

  /* -------------------------------------------------------
     ETAPA 2 - VERIFICAR SE O CLIENTE ESTÁ AUTENTICADO
     -------------------------------------------------------

     Caso não exista um usuário autenticado, limpamos os
     endereços e encerramos o carregamento.
  */

  if (!usuario) {
    setEnderecos([]);
    // Registra a edição para evitar preenchimento automático atrasado.
    registrarEdicaoEndereco();
    setCarregandoEnderecos(false);
    return;
  }

  /* -------------------------------------------------------
     ETAPA 3 - PREPARAR O CONTROLE DA REQUISIÇÃO
     -------------------------------------------------------

     AbortController permite cancelar a requisição caso
     o componente seja desmontado ou a consulta mude.
  */

  const controller = new AbortController();

  // Guarda a versão do formulário no início da consulta.
  const versaoInicial = versaoEdicaoEndereco.current;

  /* -------------------------------------------------------
     ETAPA 4 - CONSULTAR A API DE ENDEREÇOS
     ------------------------------------------------------- */

  async function consultarEnderecos() {

    // Informa que a consulta começou.
    setCarregandoEnderecos(true);

    // Limpa mensagens anteriores.
    setMensagemEndereco("");

    try {

      /* ---------------------------------------------------
         REALIZAR A REQUISIÇÃO GET
         ---------------------------------------------------

         credentials: "same-origin"
         Envia o cookie de autenticação do próprio site.

         cache: "no-store"
         Evita utilizar uma resposta armazenada em cache.

         signal
         Permite cancelar a requisição quando necessário.
      */

      const resposta = await fetch("/api/enderecos", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });

      /* ---------------------------------------------------
         VERIFICAR SE A API RESPONDEU CORRETAMENTE
         --------------------------------------------------- */

      if (!resposta.ok) {
        throw new Error(
          "Não foi possível consultar os endereços."
        );
      }

      /* ---------------------------------------------------
         CONVERTER A RESPOSTA PARA JSON
         --------------------------------------------------- */

      const dados = await resposta.json();

      // Garante que a lista recebida seja um array.
      const lista: EnderecoCheckout[] =
        Array.isArray(dados.enderecos)
          ? dados.enderecos
          : [];

      // Evita atualizar estados após o cancelamento.
      if (controller.signal.aborted) {
        return;
      }

      /* ---------------------------------------------------
         ARMAZENAR OS ENDEREÇOS NO REACT
         --------------------------------------------------- */

      setEnderecos(lista);

      /* ---------------------------------------------------
         IDENTIFICAR O ENDEREÇO PRINCIPAL
         ---------------------------------------------------

         Se não existir um endereço marcado como principal,
         utilizamos o primeiro endereço da lista.
      */

      const principal =
        lista.find((endereco) => endereco.principal) ??
        lista[0];

      /* ---------------------------------------------------
         PREENCHER O FORMULÁRIO AUTOMATICAMENTE
         --------------------------------------------------- */

      /* =====================================================
        PREENCHIMENTO AUTOMÁTICO SEGURO
        =====================================================
        Só preenche se o cliente não tiver modificado
        manualmente o formulário durante a consulta.
        ===================================================== */

      if (
        principal &&
        versaoEdicaoEndereco.current === versaoInicial
      ) {
        preencherEndereco(principal);
      }

    } catch (error) {

      /* ---------------------------------------------------
         TRATAMENTO DE ERROS
         ---------------------------------------------------

         Não exibimos erro quando a requisição foi
         cancelada intencionalmente.
      */

      if (!controller.signal.aborted) {
        console.error(
          "[CHECKOUT] Erro ao consultar endereços:",
          error
        );

        setMensagemEndereco(
          "Não foi possível carregar seus endereços."
        );
      }

    } finally {

      /* ---------------------------------------------------
         FINALIZAR O CARREGAMENTO
         --------------------------------------------------- */

      if (!controller.signal.aborted) {
        setCarregandoEnderecos(false);
      }
    }
  }

  /* -------------------------------------------------------
     ETAPA 5 - EXECUTAR A CONSULTA
     ------------------------------------------------------- */

  consultarEnderecos();

  /* -------------------------------------------------------
     ETAPA 6 - CANCELAR REQUISIÇÕES PENDENTES
     ------------------------------------------------------- */

  return () => {
    controller.abort();
  };

  /* -------------------------------------------------------
     DEPENDÊNCIAS
     -------------------------------------------------------

     O efeito será executado quando:
     - A identificação do cliente terminar.
     - O ID do usuário autenticado mudar.
  */

}, [usuario?.id, carregandoUsuario]);

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

            
            {/* =====================================================
                ENDEREÇOS CADASTRADOS DO CLIENTE
                ===================================================== */}

            {carregandoEnderecos && usuario && (
              <p role="status">CARREGANDO ENDEREÇOS...</p>
            )}

            {!carregandoEnderecos && enderecos.length > 0 && (
              <div className="checkoutSavedAddresses">
                <p>SEUS ENDEREÇOS CADASTRADOS</p>

                {enderecos.map((endereco) => (
                  <button
                    key={endereco.id}
                    type="button"

                    // Seleciona e preenche o formulário.
                    onClick={() => preencherEndereco(endereco)}

                    // Informa qual endereço está selecionado.
                    aria-pressed={enderecoSelecionadoId === endereco.id}
                  >
                    {endereco.apelido || "ENDEREÇO DE ENTREGA"}

                    {endereco.principal ? " — PRINCIPAL" : ""}

                    {" · "}
                    {endereco.logradouro}, {endereco.numero}
                    {" — "}
                    {endereco.cidade}/{endereco.estado}
                  </button>
                ))}
              </div>
            )}


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


              {/* =====================================================
                  CAMPO CEP - ENDEREÇO DE ENTREGA
                  ===================================================== */}

              <label className="checkoutField checkoutFieldFull">
                <span>CEP</span>

                <input
                  type="text"
                  name="cep"
                  placeholder="00000-000"
                  autoComplete="postal-code"
                  inputMode="numeric"
                  maxLength={9}

                  // Exibe o CEP armazenado no estado do React.
                  value={dadosEntrega.cep}

                  // Atualiza o CEP quando o cliente digitar.
                  onChange={(event) => {

                    // Invalida a seleção do endereço salvo,
                    // pois o cliente está modificando o formulário.
                    // Registra a edição para evitar preenchimento automático atrasado.
                    registrarEdicaoEndereco();

                    // Atualiza apenas o CEP e mantém os demais dados.
                    setDadosEntrega((anterior) => ({
                      ...anterior,
                      cep: event.target.value,
                    }));
                  }}
                />
              </label>



              {/* =====================================================
                  ENDEREÇO - RUA OU AVENIDA
                  ===================================================== */}

              <label className="checkoutField checkoutFieldFull">
                <span>ENDEREÇO</span>

                <input
                  type="text"
                  name="endereco"
                  placeholder="Rua / Avenida"
                  autoComplete="address-line1"
                  maxLength={200}
                  value={dadosEntrega.endereco}
                  onChange={(event) => {
                    // O cliente alterou um endereço anteriormente salvo.
                    // Registra a edição para evitar preenchimento automático atrasado.
                    registrarEdicaoEndereco();

                    // Atualiza o logradouro sem apagar os outros campos.
                    setDadosEntrega((anterior) => ({
                      ...anterior,
                      endereco: event.target.value,
                    }));
                  }}
                />
              </label>


              {/* =====================================================
                  NÚMERO DO IMÓVEL
                  ===================================================== */}

              <label className="checkoutField">
                <span>NÚMERO</span>

                <input
                  type="text"
                  name="numero"
                  placeholder="Número"
                  maxLength={20}
                  value={dadosEntrega.numero}
                  onChange={(event) => {
                    // Marca o formulário como modificado.
                    // Registra a edição para evitar preenchimento automático atrasado.
                    registrarEdicaoEndereco();

                    // Atualiza somente o número do imóvel.
                    setDadosEntrega((anterior) => ({
                      ...anterior,
                      numero: event.target.value,
                    }));
                  }}
                />
              </label>


              {/* =====================================================
                  COMPLEMENTO - CAMPO OPCIONAL
                  ===================================================== */}

              <label className="checkoutField">
                <span>COMPLEMENTO</span>

                <input
                  type="text"
                  name="complemento"
                  placeholder="Apto, bloco..."
                  autoComplete="address-line2"
                  maxLength={150}
                  value={dadosEntrega.complemento}
                  onChange={(event) => {
                    // Invalida a seleção anterior.
                    // Registra a edição para evitar preenchimento automático atrasado.
                    registrarEdicaoEndereco();

                    // Atualiza somente o complemento.
                    setDadosEntrega((anterior) => ({
                      ...anterior,
                      complemento: event.target.value,
                    }));
                  }}
                />
              </label>


              {/* =====================================================
                  BAIRRO
                  ===================================================== */}

              <label className="checkoutField checkoutFieldFull">
                <span>BAIRRO</span>

                <input
                  type="text"
                  name="bairro"
                  placeholder="Bairro"
                  maxLength={100}
                  value={dadosEntrega.bairro}
                  onChange={(event) => {
                    // Identifica alteração manual do endereço.
                    // Registra a edição para evitar preenchimento automático atrasado.
                    registrarEdicaoEndereco();
                    // Atualiza somente o bairro.
                    setDadosEntrega((anterior) => ({
                      ...anterior,
                      bairro: event.target.value,
                    }));
                  }}
                />
              </label>


              {/* =====================================================
                  CIDADE
                  ===================================================== */}

              <label className="checkoutField">
                <span>CIDADE</span>

                <input
                  type="text"
                  name="cidade"
                  placeholder="Cidade"
                  autoComplete="address-level2"
                  maxLength={100}
                  value={dadosEntrega.cidade}
                  onChange={(event) => {
                    // Marca o endereço como modificado.
                    // Registra a edição para evitar preenchimento automático atrasado.
                    registrarEdicaoEndereco();

                    // Atualiza somente a cidade.
                    setDadosEntrega((anterior) => ({
                      ...anterior,
                      cidade: event.target.value,
                    }));
                  }}
                />
              </label>


              {/* =====================================================
                  ESTADO - SIGLA DA UNIDADE FEDERATIVA
                  ===================================================== */}

              <label className="checkoutField">
                <span>ESTADO</span>

                <input
                  type="text"
                  name="estado"
                  placeholder="SP"
                  autoComplete="address-level1"
                  maxLength={2}
                  value={dadosEntrega.estado}
                  onChange={(event) => {
                    // Marca o endereço como modificado.
                    // Registra a edição para evitar preenchimento automático atrasado.
                    registrarEdicaoEndereco();

                    // Converte a sigla para letras maiúsculas.
                    setDadosEntrega((anterior) => ({
                      ...anterior,
                      estado: event.target.value.toUpperCase(),
                    }));
                  }}
                />
              </label>


            </div>

            
          {/* =====================================================
              MENSAGENS E CADASTRO DE ENDEREÇO
              ===================================================== */}

          {mensagemEndereco && (
            <p role="status">{mensagemEndereco}</p>
          )}

          <button
            type="button"
            className="checkoutContinue"

            // Executa o cadastro na API de endereços.
            onClick={salvarEndereco}

            // Impede cliques repetidos ou sem autenticação.
            disabled={
              salvandoEndereco ||
              carregandoUsuario ||
              carregandoEnderecos ||
              !usuario
            }
          >
            {salvandoEndereco
              ? "SALVANDO ENDEREÇO..."
              : "SALVAR ENDEREÇO"}
          </button>


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

  // Preenche o formulário com os dados de um endereço cadastrado.
  function preencherEndereco(endereco: EnderecoCheckout) {
    setEnderecoSelecionadoId(endereco.id);

    setDadosEntrega({
      cep: endereco.cep,
      endereco: endereco.logradouro,
      numero: endereco.numero,
      complemento: endereco.complemento ?? "",
      bairro: endereco.bairro,
      cidade: endereco.cidade,
      estado: endereco.estado,
    });
  }

  
  /* =========================================================
    SALVAR ENDEREÇO DE ENTREGA - PÁDUA CULTURE
    =========================================================
    Envia os dados do formulário para POST /api/enderecos.

    O usuário é identificado pelo cookie de sessão
    no backend, e não por um ID enviado pelo navegador.
    ========================================================= */

  async function salvarEndereco() {
    // Impede o envio repetido enquanto a gravação acontece.
    if (salvandoEndereco) return;

    // Exige uma conta autenticada.
    if (!usuario) {
      setMensagemEndereco("Entre na sua conta para salvar o endereço.");
      return;
    }

    // Impede salvar novamente um endereço sem alterações.
    if (enderecoSelecionadoId !== null) {
      setMensagemEndereco("Este endereço já está cadastrado.");
      return;
    }

    // Valida os campos obrigatórios antes de enviar.
    if (
      !dadosEntrega.cep.trim() ||
      !dadosEntrega.endereco.trim() ||
      !dadosEntrega.numero.trim() ||
      !dadosEntrega.bairro.trim() ||
      !dadosEntrega.cidade.trim() ||
      !dadosEntrega.estado.trim()
    ) {
      setMensagemEndereco("Preencha todos os campos obrigatórios.");
      return;
    }

    setSalvandoEndereco(true);
    setMensagemEndereco("");

    try {
      /* -----------------------------------------------------
        PREPARAR OS DADOS PARA A API
        ----------------------------------------------------- */

      const dados = {
        // Nome do destinatário do pedido.
        destinatario: `${usuario.nome} ${usuario.sobrenome}`.trim(),

        // Dados de entrega preenchidos pelo cliente.
        cep: dadosEntrega.cep,
        logradouro: dadosEntrega.endereco,
        numero: dadosEntrega.numero,
        complemento: dadosEntrega.complemento,
        bairro: dadosEntrega.bairro,
        cidade: dadosEntrega.cidade,
        estado: dadosEntrega.estado,
      };

      /* -----------------------------------------------------
        ENVIAR O ENDEREÇO PARA O BACKEND
        ----------------------------------------------------- */

      const resposta = await fetch("/api/enderecos", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dados),
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          resultado.erro ?? "Não foi possível salvar o endereço."
        );
      }

      /* -----------------------------------------------------
        ATUALIZAR OS ENDEREÇOS DO CHECKOUT
        ----------------------------------------------------- */

      const enderecoSalvo = resultado.endereco as EnderecoCheckout;

      // Inclui o endereço retornado pelo MySQL na lista.
      setEnderecos((anteriores) => [
        enderecoSalvo,
        ...anteriores,
      ]);

      // Seleciona o endereço recém-cadastrado.
      preencherEndereco(enderecoSalvo);

      setMensagemEndereco("Endereço salvo com sucesso.");
    } catch (error) {
      setMensagemEndereco(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o endereço."
      );
    } finally {
      // Libera o botão após a conclusão da operação.
      setSalvandoEndereco(false);
    }
  }

}