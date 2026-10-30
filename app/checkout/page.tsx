
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "../context/CartContext";
import "./checkout.css";

/* =========================================================
   PÁDUA CULTURE — CHECKOUT
   Mantém autenticação, endereços, ViaCEP e sacola.
   Acrescenta cotação e seleção de frete.
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

type DadosEntrega = {
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
};

type OpcaoFreteCheckout = {
  id: number;
  nome: string;
  transportadora: string;
  preco: number;
  prazoDias: number | null;
};

const entregaInicial: DadosEntrega = {
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
};

function formatarMoeda(valor: number) {
  return valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function somenteNumeros(valor: string) {
  return valor.replace(/\D/g, "");
}

export default function Checkout() {
  /* =======================================================
     SACOLA
     ======================================================= */

  const { items } = useCart();

  const subtotal = items.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  );

  const quantidadeItens = items.reduce(
    (total, item) => total + item.quantity,
    0
  );

  /* =======================================================
     AUTENTICAÇÃO
     ======================================================= */

  const [usuario, setUsuario] =
    useState<UsuarioCheckout | null>(null);

  const [carregandoUsuario, setCarregandoUsuario] =
    useState(true);

  const [erroUsuario, setErroUsuario] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function consultarCliente() {
      try {
        const resposta = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        if (resposta.status === 401) {
          setUsuario(null);
          return;
        }

        if (!resposta.ok) {
          throw new Error(
            "Não foi possível consultar sua conta."
          );
        }

        const dados = await resposta.json();

        if (!controller.signal.aborted) {
          setUsuario(
            dados.autenticado && dados.usuario
              ? dados.usuario
              : null
          );
        }
      } catch {
        if (!controller.signal.aborted) {
          setErroUsuario(
            "Não foi possível carregar seus dados."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setCarregandoUsuario(false);
        }
      }
    }

    void consultarCliente();

    return () => controller.abort();
  }, []);

  /* =======================================================
     ENDEREÇOS
     ======================================================= */

  const [enderecos, setEnderecos] =
    useState<EnderecoCheckout[]>([]);

  const [
    enderecoSelecionadoId,
    setEnderecoSelecionadoId,
  ] = useState<number | null>(null);

  const [
    carregandoEnderecos,
    setCarregandoEnderecos,
  ] = useState(true);

  const [salvandoEndereco, setSalvandoEndereco] =
    useState(false);

  const [mensagemEndereco, setMensagemEndereco] =
    useState("");

  const [dadosEntrega, setDadosEntrega] =
    useState<DadosEntrega>(entregaInicial);

  // Impede respostas antigas de sobrescreverem
  // informações digitadas manualmente.
  const versaoEdicaoEndereco = useRef(0);

  const consultaCepController =
    useRef<AbortController | null>(null);

  const [consultandoCep, setConsultandoCep] =
    useState(false);

  const [mensagemCep, setMensagemCep] = useState("");

  /* =======================================================
     FRETE
     ======================================================= */

  const [opcoesFrete, setOpcoesFrete] =
    useState<OpcaoFreteCheckout[]>([]);

  const [freteSelecionadoId, setFreteSelecionadoId] =
    useState<number | null>(null);

  const [cotandoFrete, setCotandoFrete] =
    useState(false);

  const [erroFrete, setErroFrete] = useState("");

  const [mensagemPagamento, setMensagemPagamento] =
    useState("");

  const cotacaoController =
    useRef<AbortController | null>(null);

  const cepCotacao = somenteNumeros(dadosEntrega.cep);

  // Detecta alterações na sacola, inclusive quantidade.
  const chaveSacola = JSON.stringify(
    items.map((item) => [
      item.id,
      item.variantId,
      item.quantity,
    ])
  );

  // Uma cotação anterior deixa de ser válida
  // quando o CEP ou os itens mudam.
  useEffect(() => {
    cotacaoController.current?.abort();
    cotacaoController.current = null;

    setOpcoesFrete([]);
    setFreteSelecionadoId(null);
    setErroFrete("");
    setMensagemPagamento("");
    setCotandoFrete(false);
  }, [cepCotacao, chaveSacola]);

  /* =======================================================
     FUNÇÕES DE ENDEREÇO
     ======================================================= */

  function registrarEdicaoEndereco() {
    versaoEdicaoEndereco.current += 1;

    consultaCepController.current?.abort();
    consultaCepController.current = null;

    setConsultandoCep(false);
    setMensagemCep("");

    // Um endereço editado não corresponde mais
    // necessariamente ao endereço salvo.
    setEnderecoSelecionadoId(null);
    setMensagemEndereco("");
  }

  function preencherEndereco(endereco: EnderecoCheckout) {
    consultaCepController.current?.abort();
    consultaCepController.current = null;

    versaoEdicaoEndereco.current += 1;

    setConsultandoCep(false);
    setMensagemCep("");

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

  function alterarCampo(
    campo: keyof DadosEntrega,
    valor: string
  ) {
    registrarEdicaoEndereco();

    setDadosEntrega((anterior) => ({
      ...anterior,
      [campo]: valor,
    }));
  }

  /* =======================================================
     CONSULTAR ENDEREÇOS CADASTRADOS
     ======================================================= */

  useEffect(() => {
    if (carregandoUsuario) return;

    if (!usuario) {
      setEnderecos([]);
      setCarregandoEnderecos(false);
      return;
    }

    const controller = new AbortController();

    const versaoInicial =
      versaoEdicaoEndereco.current;

    async function consultarEnderecos() {
      setCarregandoEnderecos(true);
      setMensagemEndereco("");

      try {
        const resposta = await fetch("/api/enderecos", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        if (!resposta.ok) {
          throw new Error(
            "Não foi possível consultar os endereços."
          );
        }

        const dados = await resposta.json();

        const lista: EnderecoCheckout[] =
          Array.isArray(dados.enderecos)
            ? dados.enderecos
            : [];

        if (controller.signal.aborted) return;

        setEnderecos(lista);

        const principal =
          lista.find((endereco) => endereco.principal) ??
          lista[0];

        if (
          principal &&
          versaoEdicaoEndereco.current === versaoInicial
        ) {
          preencherEndereco(principal);
        }
      } catch {
        if (!controller.signal.aborted) {
          setMensagemEndereco(
            "Não foi possível carregar seus endereços."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setCarregandoEnderecos(false);
        }
      }
    }

    void consultarEnderecos();

    return () => controller.abort();
  }, [usuario?.id, carregandoUsuario]);

  /* =======================================================
     CONSULTA AUTOMÁTICA DE CEP — VIACEP
     ======================================================= */

  async function consultarCEP(
    cep: string,
    versaoDaDigitacao: number
  ) {
    const numeros = somenteNumeros(cep);

    if (numeros.length !== 8) return;

    consultaCepController.current?.abort();

    const controller = new AbortController();
    consultaCepController.current = controller;

    setConsultandoCep(true);
    setMensagemCep("");

    try {
      const resposta = await fetch(
        `https://viacep.com.br/ws/${numeros}/json/`,
        { signal: controller.signal }
      );

      if (!resposta.ok) {
        throw new Error(
          "Serviço de CEP indisponível. Preencha manualmente."
        );
      }

      const dados: {
        erro?: boolean;
        logradouro?: string;
        bairro?: string;
        localidade?: string;
        uf?: string;
      } = await resposta.json();

      if (
        controller.signal.aborted ||
        versaoEdicaoEndereco.current !==
          versaoDaDigitacao
      ) {
        return;
      }

      if (dados.erro) {
        setMensagemCep(
          "CEP não encontrado. Confira o número informado."
        );
        return;
      }

      // Número e complemento são preservados.
      setDadosEntrega((anterior) => ({
        ...anterior,
        endereco: dados.logradouro ?? "",
        bairro: dados.bairro ?? "",
        cidade: dados.localidade ?? "",
        estado: dados.uf ?? "",
      }));

      if (!dados.logradouro || !dados.bairro) {
        setMensagemCep(
          "CEP localizado. Complete os campos não informados."
        );
      }
    } catch (erro) {
      if (
        !controller.signal.aborted &&
        versaoEdicaoEndereco.current ===
          versaoDaDigitacao
      ) {
        setMensagemCep(
          erro instanceof Error
            ? erro.message
            : "Não foi possível consultar o CEP."
        );
      }
    } finally {
      if (consultaCepController.current === controller) {
        consultaCepController.current = null;
        setConsultandoCep(false);
      }
    }
  }

  function alterarCEP(valor: string) {
    const numeros = somenteNumeros(valor).slice(0, 8);

    const cepFormatado =
      numeros.length > 5
        ? `${numeros.slice(0, 5)}-${numeros.slice(5)}`
        : numeros;

    registrarEdicaoEndereco();

    const versaoAtual =
      versaoEdicaoEndereco.current;

    // Limpa os dados de um CEP anterior.
    setDadosEntrega((anterior) => ({
      ...anterior,
      cep: cepFormatado,
      endereco: "",
      bairro: "",
      cidade: "",
      estado: "",
    }));

    if (numeros.length === 8) {
      void consultarCEP(numeros, versaoAtual);
    }
  }

  /* =======================================================
     SALVAR ENDEREÇO NO MYSQL
     ======================================================= */

  async function salvarEndereco() {
    if (salvandoEndereco) return;

    if (!usuario) {
      setMensagemEndereco(
        "Entre na sua conta para salvar o endereço."
      );
      return;
    }

    if (enderecoSelecionadoId !== null) {
      setMensagemEndereco(
        "Este endereço já está cadastrado."
      );
      return;
    }

    if (
      !/^\d{8}$/.test(cepCotacao) ||
      !dadosEntrega.endereco.trim() ||
      !dadosEntrega.numero.trim() ||
      !dadosEntrega.bairro.trim() ||
      !dadosEntrega.cidade.trim() ||
      !/^[A-Z]{2}$/.test(dadosEntrega.estado.trim())
    ) {
      setMensagemEndereco(
        "Preencha corretamente todos os campos obrigatórios."
      );
      return;
    }

    setSalvandoEndereco(true);
    setMensagemEndereco("");

    try {
      const resposta = await fetch("/api/enderecos", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          destinatario:
            `${usuario.nome} ${usuario.sobrenome}`.trim(),
          cep: dadosEntrega.cep,
          logradouro: dadosEntrega.endereco,
          numero: dadosEntrega.numero,
          complemento: dadosEntrega.complemento,
          bairro: dadosEntrega.bairro,
          cidade: dadosEntrega.cidade,
          estado: dadosEntrega.estado,
        }),
      });

      const resultado = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          resultado.erro ??
            "Não foi possível salvar o endereço."
        );
      }

      const enderecoSalvo =
        resultado.endereco as EnderecoCheckout;

      setEnderecos((anteriores) => [
        enderecoSalvo,
        ...anteriores,
      ]);

      preencherEndereco(enderecoSalvo);

      setMensagemEndereco(
        "Endereço salvo com sucesso."
      );
    } catch (erro) {
      setMensagemEndereco(
        erro instanceof Error
          ? erro.message
          : "Não foi possível salvar o endereço."
      );
    } finally {
      setSalvandoEndereco(false);
    }
  }

  /* =======================================================
     CALCULAR FRETE — API MELHOR ENVIO
     ======================================================= */

  async function calcularFrete() {
    setErroFrete("");
    setMensagemPagamento("");
    setFreteSelecionadoId(null);
    setOpcoesFrete([]);

    if (!usuario) {
      setErroFrete(
        "Entre na sua conta para calcular o frete."
      );
      return;
    }

    if (!/^\d{8}$/.test(cepCotacao)) {
      setErroFrete(
        "Informe um CEP de entrega válido."
      );
      return;
    }

    if (items.length === 0) {
      setErroFrete("Sua sacola está vazia.");
      return;
    }

    // O ID textual do carrinho não substitui
    // o ID numérico da variante no banco.
    const itemSemVariante = items.some(
      (item) =>
        !Number.isSafeInteger(item.variantId) ||
        (item.variantId ?? 0) <= 0
    );

    if (itemSemVariante) {
      setErroFrete(
        "Existem produtos antigos na sacola. Remova-os e adicione novamente pela loja."
      );
      return;
    }

    cotacaoController.current?.abort();

    const controller = new AbortController();
    cotacaoController.current = controller;

    setCotandoFrete(true);

    try {
      const resposta = await fetch(
        "/api/frete/cotacao",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            cepDestino: cepCotacao,
            itens: items.map((item) => ({
              variantId: item.variantId,
              quantity: item.quantity,
            })),
          }),
        }
      );

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.erro ??
            "Não foi possível calcular o frete."
        );
      }

      const opcoes: OpcaoFreteCheckout[] =
        Array.isArray(dados.opcoes)
          ? dados.opcoes.filter(
              (opcao: OpcaoFreteCheckout) =>
                Number.isSafeInteger(opcao.id) &&
                Number.isFinite(opcao.preco) &&
                opcao.preco >= 0
            )
          : [];

      if (controller.signal.aborted) return;

      setOpcoesFrete(opcoes);

      if (opcoes.length === 0) {
        setErroFrete(
          "Nenhuma modalidade de entrega disponível para este CEP."
        );
      }
    } catch (erro) {
      if (!controller.signal.aborted) {
        setErroFrete(
          erro instanceof Error
            ? erro.message
            : "Falha ao consultar o frete."
        );
      }
    } finally {
      if (cotacaoController.current === controller) {
        cotacaoController.current = null;
        setCotandoFrete(false);
      }
    }
  }

  const freteSelecionado = opcoesFrete.find(
    (opcao) => opcao.id === freteSelecionadoId
  );

  const total =
    subtotal + (freteSelecionado?.preco ?? 0);

  /* =======================================================
     CONTINUAR PARA PAGAMENTO
     Ainda não cria pedido nem cobrança.
     ======================================================= */

  function continuarParaPagamento() {
    setMensagemPagamento("");

    if (!usuario) {
      setMensagemPagamento(
        "Entre na sua conta para continuar."
      );
      return;
    }

    if (items.length === 0) {
      setMensagemPagamento(
        "Adicione produtos à sacola."
      );
      return;
    }

    if (
      !/^\d{8}$/.test(cepCotacao) ||
      !dadosEntrega.endereco.trim() ||
      !dadosEntrega.numero.trim() ||
      !dadosEntrega.bairro.trim() ||
      !dadosEntrega.cidade.trim() ||
      !/^[A-Z]{2}$/.test(dadosEntrega.estado.trim())
    ) {
      setMensagemPagamento(
        "Complete o endereço de entrega."
      );
      return;
    }

    if (enderecoSelecionadoId === null) {
      setMensagemPagamento(
        "Salve ou selecione um endereço de entrega."
      );
      return;
    }

    if (!freteSelecionado) {
      setMensagemPagamento(
        "Calcule o frete e selecione uma opção de entrega."
      );
      return;
    }

    // Esta etapa será conectada à API de pedidos
    // e ao provedor de pagamentos posteriormente.
    setMensagemPagamento(
      "Endereço e frete validados. A integração de pagamento ainda não está disponível. Nenhum pedido ou cobrança foi criado."
    );
  }

  /* =======================================================
     INTERFACE DO CHECKOUT
     ======================================================= */

  return (
    <main className="checkoutPage">
      <header className="checkoutHeader">
        <Link href="/" className="checkoutLogo">
          PÁDUA
        </Link>

        <Link href="/" className="checkoutBack">
          ← CONTINUAR COMPRANDO
        </Link>
      </header>

      <div className="checkoutLayout">
        {/* ================================================
            LADO ESQUERDO — CLIENTE E ENTREGA
            ================================================ */}

        <section className="checkoutForm">
          <span className="checkoutEyebrow">
            CHECKOUT
          </span>

          <h1>
            FINALIZAR
            <br />
            COMPRA
          </h1>

          {/* CONTATO */}

          <div className="checkoutSection">
            <div className="checkoutSectionHeader">
              <span>01</span>
              <h2>CONTATO</h2>
            </div>

            {carregandoUsuario && (
              <p role="status">
                CARREGANDO SEUS DADOS...
              </p>
            )}

            {erroUsuario && (
              <p role="alert">{erroUsuario}</p>
            )}

            {!carregandoUsuario &&
              !erroUsuario &&
              !usuario && (
                <p>
                  PARA FINALIZAR SUA COMPRA,{" "}
                  <Link href="/login">
                    ENTRE NA SUA CONTA
                  </Link>
                  .
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

          {/* ENTREGA */}

          <div className="checkoutSection">
            <div className="checkoutSectionHeader">
              <span>02</span>
              <h2>ENTREGA</h2>
            </div>

            {carregandoEnderecos && usuario && (
              <p role="status">
                CARREGANDO ENDEREÇOS...
              </p>
            )}


          {/* =====================================================
              ENDEREÇOS CADASTRADOS — PÁDUA CULTURE
              ===================================================== */}

          {!carregandoEnderecos && enderecos.length > 0 && (
            <div className="checkoutSavedAddresses">
              <div className="checkoutAddressHeading">
                <h3>SEUS ENDEREÇOS CADASTRADOS</h3>
                <span>SELECIONE ONDE DESEJA RECEBER</span>
              </div>

              <div className="checkoutAddressList">
                {enderecos.map((endereco) => {
                  const selecionado =
                    enderecoSelecionadoId === endereco.id;

                  return (
                    <button
                      key={endereco.id}
                      type="button"
                      className={`checkoutAddressCard ${
                        selecionado ? "isSelected" : ""
                      }`}
                      onClick={() => preencherEndereco(endereco)}
                      aria-pressed={selecionado}
                    >
                      {/* Indicador visual de seleção */}
                      <span
                        className="checkoutAddressRadio"
                        aria-hidden="true"
                      >
                        <span />
                      </span>

                      {/* Dados do endereço */}
                      <span className="checkoutAddressContent">
                        <span className="checkoutAddressTop">
                          <span className="checkoutAddressName">
                            {endereco.apelido || "ENDEREÇO DE ENTREGA"}
                          </span>

                          {endereco.principal && (
                            <span className="checkoutAddressBadge">
                              PRINCIPAL
                            </span>
                          )}
                        </span>

                        <strong className="checkoutAddressStreet">
                          {endereco.logradouro}, {endereco.numero}
                        </strong>

                        <span className="checkoutAddressDetails">
                          {endereco.bairro} · {endereco.cidade}/
                          {endereco.estado}
                        </span>

                        <span className="checkoutAddressCep">
                          CEP {endereco.cep}
                        </span>
                      </span>

                      <span className="checkoutAddressStatus">
                        {selecionado ? "SELECIONADO" : "SELECIONAR"}
                      </span>
                    </button>
                  );
                })}
             
                </div>
              </div>
            )}

            {/* =====================================================
                FORMULÁRIO DE ENDEREÇO
                Mantém os campos e funcionalidades existentes.
                ===================================================== */}

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

              {/* CEP */}

              <label className="checkoutField checkoutFieldFull">
                <span>CEP</span>
                <input
                  type="text"
                  name="cep"
                  placeholder="00000-000"
                  autoComplete="postal-code"
                  inputMode="numeric"
                  maxLength={9}
                  value={dadosEntrega.cep}
                  onChange={(event) =>
                    alterarCEP(event.target.value)
                  }
                />
              </label>

              {consultandoCep && (
                <p role="status">
                  CONSULTANDO CEP...
                </p>
              )}

              {mensagemCep && (
                <p role="status">
                  {mensagemCep}
                </p>
              )}

              {/* LOGRADOURO */}

              <label className="checkoutField checkoutFieldFull">
                <span>ENDEREÇO</span>
                <input
                  type="text"
                  name="endereco"
                  placeholder="Rua / Avenida"
                  autoComplete="address-line1"
                  maxLength={200}
                  value={dadosEntrega.endereco}
                  onChange={(event) =>
                    alterarCampo(
                      "endereco",
                      event.target.value
                    )
                  }
                />
              </label>

              {/* NÚMERO */}

              <label className="checkoutField">
                <span>NÚMERO</span>
                <input
                  type="text"
                  name="numero"
                  placeholder="Número"
                  maxLength={20}
                  value={dadosEntrega.numero}
                  onChange={(event) =>
                    alterarCampo(
                      "numero",
                      event.target.value
                    )
                  }
                />
              </label>

              {/* COMPLEMENTO */}

              <label className="checkoutField">
                <span>COMPLEMENTO</span>
                <input
                  type="text"
                  name="complemento"
                  placeholder="Apto, bloco..."
                  autoComplete="address-line2"
                  maxLength={150}
                  value={dadosEntrega.complemento}
                  onChange={(event) =>
                    alterarCampo(
                      "complemento",
                      event.target.value
                    )
                  }
                />
              </label>

              {/* BAIRRO */}

              <label className="checkoutField checkoutFieldFull">
                <span>BAIRRO</span>
                <input
                  type="text"
                  name="bairro"
                  placeholder="Bairro"
                  maxLength={100}
                  value={dadosEntrega.bairro}
                  onChange={(event) =>
                    alterarCampo(
                      "bairro",
                      event.target.value
                    )
                  }
                />
              </label>

              {/* CIDADE */}

              <label className="checkoutField">
                <span>CIDADE</span>
                <input
                  type="text"
                  name="cidade"
                  placeholder="Cidade"
                  autoComplete="address-level2"
                  maxLength={100}
                  value={dadosEntrega.cidade}
                  onChange={(event) =>
                    alterarCampo(
                      "cidade",
                      event.target.value
                    )
                  }
                />
              </label>

              {/* ESTADO */}

              <label className="checkoutField">
                <span>ESTADO</span>
                <input
                  type="text"
                  name="estado"
                  placeholder="SP"
                  autoComplete="address-level1"
                  maxLength={2}
                  value={dadosEntrega.estado}
                  onChange={(event) =>
                    alterarCampo(
                      "estado",
                      event.target.value.toUpperCase()
                    )
                  }
                />
              </label>
            </div>

            {mensagemEndereco && (
              <p role="status">
                {mensagemEndereco}
              </p>
            )}

            <button
              type="button"
              className="checkoutContinue"
              onClick={() => void salvarEndereco()}
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

        {/* ================================================
            LADO DIREITO — RESUMO DO PEDIDO
            ================================================ */}

        <aside className="checkoutSummary">
          <div className="checkoutSummaryHeader">
            <span>SEU PEDIDO</span>
            <span>{quantidadeItens} ITENS</span>
          </div>

          {items.length === 0 ? (
            <div className="checkoutEmpty">
              <p>SUA SACOLA ESTÁ VAZIA.</p>

              <Link href="/">
                VOLTAR PARA A LOJA →
              </Link>
            </div>
          ) : (
            <>
              {/* PRODUTOS */}

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
                      <span>{item.quantity}</span>
                    </div>

                    <div className="checkoutItemInfo">
                      <div>
                        <h3>{item.name}</h3>

                        <p>
                          {item.color} / {item.size}
                        </p>
                      </div>

                      <strong>
                        {formatarMoeda(
                          item.price * item.quantity
                        )}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>

              {/* =========================================
                  CÁLCULO DE FRETE
                  ========================================= */}

              <div
                style={{
                  padding: "18px 0",
                  borderTop: "1px solid #444",
                  borderBottom: "1px solid #444",
                }}
              >
                <p
                  style={{
                    fontSize: 12,
                    marginBottom: 12,
                  }}
                >
                  ENTREGA — CEP{" "}
                  {dadosEntrega.cep ||
                    "NÃO INFORMADO"}
                </p>

                <button
                  type="button"
                  className="checkoutContinue"
                  onClick={() =>
                    void calcularFrete()
                  }
                  disabled={
                    cotandoFrete ||
                    carregandoUsuario
                  }
                >
                  {cotandoFrete
                    ? "CALCULANDO FRETE..."
                    : "CALCULAR FRETE"}
                </button>

                {erroFrete && (
                  <p
                    role="alert"
                    style={{
                      color: "#fca5a5",
                      marginTop: 12,
                      fontSize: 13,
                    }}
                  >
                    {erroFrete}
                  </p>
                )}

                {/* OPÇÕES RETORNADAS PELA API */}

                {opcoesFrete.length > 0 && (
                  <fieldset
                    style={{
                      border: 0,
                      padding: 0,
                      margin: "16px 0 0",
                    }}
                  >
                    <legend
                      style={{
                        fontSize: 12,
                        marginBottom: 10,
                      }}
                    >
                      ESCOLHA A ENTREGA
                    </legend>

                    {opcoesFrete.map((opcao) => (
                      <label
                        key={opcao.id}
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                          padding: "10px 0",
                          cursor: "pointer",
                          fontSize: 13,
                        }}
                      >
                        <input
                          type="radio"
                          name="frete"
                          checked={
                            freteSelecionadoId ===
                            opcao.id
                          }
                          onChange={() => {
                            setFreteSelecionadoId(
                              opcao.id
                            );
                            setMensagemPagamento("");
                          }}
                        />

                        <span style={{ flex: 1 }}>
                          {opcao.transportadora}
                          {" — "}
                          {opcao.nome}

                          {opcao.prazoDias !== null
                            ? ` · ${opcao.prazoDias} dias`
                            : ""}
                        </span>

                        <strong>
                          {formatarMoeda(
                            opcao.preco
                          )}
                        </strong>
                      </label>
                    ))}
                  </fieldset>
                )}
              </div>

              {/* VALORES */}

              <div className="checkoutTotals">
                <div>
                  <span>SUBTOTAL</span>
                  <strong>
                    {formatarMoeda(subtotal)}
                  </strong>
                </div>

                <div>
                  <span>FRETE</span>

                  <strong>
                    {freteSelecionado
                      ? formatarMoeda(
                          freteSelecionado.preco
                        )
                      : "CALCULAR FRETE"}
                  </strong>
                </div>

                <div className="checkoutTotal">
                  <span>TOTAL</span>

                  <strong>
                    {formatarMoeda(total)}
                  </strong>
                </div>
              </div>

              {/* PRÓXIMA ETAPA */}

              <button
                type="button"
                className="checkoutContinue"
                onClick={
                  continuarParaPagamento
                }
              >
                <span>
                  CONTINUAR PARA PAGAMENTO
                </span>

                <span>→</span>
              </button>

              {mensagemPagamento && (
                <p
                  role="status"
                  style={{
                    marginTop: 14,
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  {mensagemPagamento}
                </p>
              )}
            </>
          )}
        </aside>
      </div>
    </main>
  );
}
