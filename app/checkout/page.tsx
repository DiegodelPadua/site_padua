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

/* A tentativa guarda apenas IDs, quantidades e referências da compra.
   Não contém token, senha, endereço completo ou link de pagamento. */
type DadosPedidoCheckout = {
  enderecoId: number;
  freteId: number;
  itens: Array<{
    variantId: number;
    quantity: number;
  }>;
};

type TentativaCheckout = {
  versao: 1;
  usuarioId: number;
  assinatura: string;
  chave: string;
  dados: DadosPedidoCheckout;
  pedidoId: number | null;
  valorTotal: string | null;
  revisarDados: boolean;
};

function inteiroPositivo(valor: unknown): valor is number {
  return (
    typeof valor === "number" &&
    Number.isSafeInteger(valor) &&
    valor > 0
  );
}

function chaveArmazenamentoCheckout(usuarioId: number) {
  return `padua_checkout_tentativa_${usuarioId}`;
}

function assinaturaCheckout(
  usuarioId: number,
  dados: DadosPedidoCheckout
) {
  return JSON.stringify({
    usuarioId,
    enderecoId: dados.enderecoId,
    freteId: dados.freteId,
    itens: [...dados.itens].sort(
      (a, b) => a.variantId - b.variantId
    ),
  });
}

// Confere o conteúdo salvo antes de usá-lo para recuperar uma tentativa.
// O servidor continua responsável por autorização, preços e idempotência.
function lerTentativaCheckout(
  texto: string,
  usuarioId: number
): TentativaCheckout {
  const valor: unknown = JSON.parse(texto);

  if (
    !valor ||
    typeof valor !== "object" ||
    Array.isArray(valor)
  ) {
    throw new Error("Tentativa salva inválida.");
  }

  const tentativa = valor as Record<string, unknown>;
  const dados =
    tentativa.dados as DadosPedidoCheckout | undefined;

  const formatoUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (
    tentativa.versao !== 1 ||
    tentativa.usuarioId !== usuarioId ||
    typeof tentativa.revisarDados !== "boolean" ||
    typeof tentativa.chave !== "string" ||
    !formatoUUID.test(tentativa.chave) ||
    !dados ||
    typeof dados !== "object" ||
    Array.isArray(dados) ||
    !inteiroPositivo(dados.enderecoId) ||
    !inteiroPositivo(dados.freteId) ||
    !Array.isArray(dados.itens) ||
    dados.itens.length === 0 ||
    dados.itens.some(
      (item) =>
        !item ||
        !inteiroPositivo(item.variantId) ||
        !inteiroPositivo(item.quantity)
    ) ||
    tentativa.assinatura !==
      assinaturaCheckout(usuarioId, dados) ||
    (
      tentativa.pedidoId !== null &&
      !inteiroPositivo(tentativa.pedidoId)
    ) ||
    (
      tentativa.valorTotal !== null &&
      (
        typeof tentativa.valorTotal !== "string" ||
        !/^\d+(\.\d{1,2})?$/.test(tentativa.valorTotal) ||
        !Number.isFinite(Number(tentativa.valorTotal)) ||
        Number(tentativa.valorTotal) <= 0
      )
    ) ||
    (
      tentativa.pedidoId !== null &&
      tentativa.valorTotal === null
    )
  ) {
    throw new Error("Tentativa salva inválida.");
  }

  return tentativa as TentativaCheckout;
}

async function lerRespostaCheckout(
  resposta: Response
): Promise<Record<string, unknown>> {
  let dados: unknown;

  try {
    dados = await resposta.json();
  } catch {
    throw new Error(
      "Não foi possível ler a resposta. Continue a mesma tentativa para verificar o pedido."
    );
  }

  if (
    !dados ||
    typeof dados !== "object" ||
    Array.isArray(dados)
  ) {
    throw new Error(
      "Resposta inválida. Continue a mesma tentativa para verificar o pedido."
    );
  }

  return dados as Record<string, unknown>;
}

// Repete no navegador a verificação do destino, antes de sair da loja.
function validarDestinoPagamento(
  checkoutUrl: unknown
): string {
  if (typeof checkoutUrl !== "string") {
    throw new Error(
      "O pagamento não retornou um link válido."
    );
  }

  let url: URL;

  try {
    url = new URL(checkoutUrl);
  } catch {
    throw new Error(
      "O pagamento retornou um destino inválido."
    );
  }

  const ids = url.searchParams.getAll("order_id");

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    !(
      url.hostname === "mercadopago.com.br" ||
      url.hostname.endsWith(".mercadopago.com.br")
    ) ||
    ids.length !== 1 ||
    !/^ORD[A-Za-z0-9_-]{1,100}$/.test(ids[0])
  ) {
    throw new Error(
      "O pagamento retornou um destino inválido."
    );
  }

  return url.toString();
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

  // Indica quando o pedido ou o pagamento está sendo processado.
  const [criandoPedido, setCriandoPedido] =
    useState(false);

  // A ref bloqueia dois cliques antes de o React atualizar a interface.
  const envioPagamentoRef = useRef(false);

  const tentativaPedidoRef =
    useRef<TentativaCheckout | null>(null);

  const [tentativaSalva, setTentativaSalva] =
    useState<TentativaCheckout | null>(null);

  const [tentativaCarregada, setTentativaCarregada] =
    useState(false);

  const [erroRecuperacao, setErroRecuperacao] =
    useState("");

  const [pedidoParaReinicioId, setPedidoParaReinicioId] =
    useState<number | null>(null);


  const [etapaPagamento, setEtapaPagamento] =
    useState("");

  // Recupera a tentativa da mesma aba sem enviar pedidos automaticamente.
  
  useEffect(() => {
    setPedidoParaReinicioId(null);
    tentativaPedidoRef.current = null;
    setTentativaSalva(null);
    setTentativaCarregada(false);
    setErroRecuperacao("");

    if (!usuario) return;

    try {
      const texto = sessionStorage.getItem(
        chaveArmazenamentoCheckout(usuario.id)
      );

      if (texto !== null) {
        const tentativa = lerTentativaCheckout(
          texto,
          usuario.id
        );

        tentativaPedidoRef.current = tentativa;
        setTentativaSalva(tentativa);
      }
    } catch {
      // Não apaga uma referência que pode corresponder a um pedido existente.
      setErroRecuperacao(
        "Não foi possível recuperar sua tentativa de compra. Consulte seus pedidos na Minha Conta antes de continuar."
      );
    } finally {
      setTentativaCarregada(true);
    }
  }, [usuario?.id]);

  function salvarTentativaCheckout(
    tentativa: TentativaCheckout
  ) {
    // Mantém também o ID em memória se houver falha ao atualizar o armazenamento.
    tentativaPedidoRef.current = tentativa;
    setTentativaSalva(tentativa);

    try {
      sessionStorage.setItem(
        chaveArmazenamentoCheckout(tentativa.usuarioId),
        JSON.stringify(tentativa)
      );
    } catch {
      throw new Error(
        "Não foi possível guardar a referência da compra nesta aba. Verifique o armazenamento do navegador antes de continuar."
      );
    }
  }

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

  function preencherEndereco(
    endereco: EnderecoCheckout
  ) {
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


  async function iniciarNovaCompra() {
    if (
      envioPagamentoRef.current ||
      criandoPedido ||
      !usuario
    ) {
      return;
    }

    const tentativa = tentativaPedidoRef.current;

    if (
      !tentativa ||
      tentativa.usuarioId !== usuario.id ||
      !inteiroPositivo(tentativa.pedidoId) ||
      pedidoParaReinicioId !== tentativa.pedidoId
    ) {
      return;
    }

    envioPagamentoRef.current = true;
    setCriandoPedido(true);
    setEtapaPagamento("CONFERINDO PEDIDO ANTERIOR...");

    try {
      const resposta = await fetch(
        "/api/pedidos/reiniciar",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pedidoId: tentativa.pedidoId,
          }),
        }
      );

      const dados = await lerRespostaCheckout(resposta);

      if (!resposta.ok) {
        throw new Error(
          typeof dados.erro === "string"
            ? dados.erro
            : "Não foi possível encerrar o pedido anterior."
        );
      }

      if (
        dados.pedidoId !== tentativa.pedidoId ||
        dados.podeIniciarNovaCompra !== true
      ) {
        throw new Error(
          "Não foi possível confirmar o encerramento do pedido."
        );
      }

      if (tentativaPedidoRef.current !== tentativa) {
        throw new Error(
          "Sua sessão mudou. Atualize a página para continuar."
        );
      }

      // Só remove a referência após a confirmação do servidor.
      // Se o armazenamento falhar, mantém a tentativa em memória.
      sessionStorage.removeItem(
        chaveArmazenamentoCheckout(tentativa.usuarioId)
      );

      tentativaPedidoRef.current = null;
      setTentativaSalva(null);
      setPedidoParaReinicioId(null);

      cotacaoController.current?.abort();
      cotacaoController.current = null;

      setCotandoFrete(false);
      setOpcoesFrete([]);
      setFreteSelecionadoId(null);
      setErroFrete("");

      setMensagemPagamento(
        "Pedido anterior encerrado. Revise sua sacola, calcule o frete novamente e continue a nova compra."
      );
    } catch (erro) {
      setMensagemPagamento(
        erro instanceof Error
          ? erro.message
          : "Não foi possível preparar a nova compra."
      );
    } finally {
      envioPagamentoRef.current = false;
      setCriandoPedido(false);
      setEtapaPagamento("");
    }
  }





  /* =======================================================
     REGISTRAR OU RECUPERAR PEDIDO E INICIAR PAGAMENTO
     Reutiliza a mesma chave e o mesmo pedido nas repetições.
     O servidor define os valores e a situação financeira.
     ======================================================= */

  async function continuarParaPagamento() {
    if (envioPagamentoRef.current || criandoPedido) return;

    setMensagemPagamento("");

    if (!usuario) {
      setMensagemPagamento(
        "Entre na sua conta para continuar."
      );
      return;
    }

    if (!tentativaCarregada || erroRecuperacao) {
      setMensagemPagamento(
        erroRecuperacao ||
          "Aguarde a recuperação da tentativa de compra."
      );
      return;
    }

    envioPagamentoRef.current = true;
    setCriandoPedido(true);

    try {
      let tentativa = tentativaPedidoRef.current;

      if (
        tentativa &&
        tentativa.usuarioId !== usuario.id
      ) {
        throw new Error(
          "Aguarde a atualização da sua sessão antes de continuar."
        );
      }

      // Uma tentativa salva é retomada com os dados originais, mesmo se
      // endereço, cotação ou sacola ainda estiverem carregando após atualizar.
      if (!tentativa || tentativa.revisarDados) {
        if (items.length === 0) {
          throw new Error(
            "Adicione produtos à sacola."
          );
        }

        if (
          !/^\d{8}$/.test(cepCotacao) ||
          !dadosEntrega.endereco.trim() ||
          !dadosEntrega.numero.trim() ||
          !dadosEntrega.bairro.trim() ||
          !dadosEntrega.cidade.trim() ||
          !/^[A-Z]{2}$/.test(
            dadosEntrega.estado.trim()
          )
        ) {
          throw new Error(
            "Complete o endereço de entrega."
          );
        }

        if (enderecoSelecionadoId === null) {
          throw new Error(
            "Salve ou selecione um endereço de entrega."
          );
        }

        if (!freteSelecionado) {
          throw new Error(
            "Calcule o frete e selecione uma opção de entrega."
          );
        }

        const itensPedido:
          DadosPedidoCheckout["itens"] = [];

        for (const item of items) {
          if (
            !inteiroPositivo(item.variantId) ||
            !inteiroPositivo(item.quantity)
          ) {
            throw new Error(
              "Existem produtos inválidos na sacola. Confira os itens antes de continuar."
            );
          }

          itensPedido.push({
            variantId: item.variantId,
            quantity: item.quantity,
          });
        }

        const dados: DadosPedidoCheckout = {
          enderecoId: enderecoSelecionadoId,
          freteId: freteSelecionado.id,
          itens: itensPedido,
        };

        tentativa = {
          versao: 1,
          usuarioId: usuario.id,
          assinatura: assinaturaCheckout(
            usuario.id,
            dados
          ),

          // Uma revisão mantém a chave: se já existir pedido, o servidor
          // recusará dados incompatíveis em vez de criar outro.
          chave:
            tentativa?.chave ??
            crypto.randomUUID(),

          dados,
          pedidoId: null,
          valorTotal: null,
          revisarDados: false,
        };
      }

      // Persiste a chave antes de qualquer POST, inclusive após erro de rede.
      salvarTentativaCheckout(tentativa);

      if (tentativa.pedidoId === null) {
        setEtapaPagamento(
          "REGISTRANDO PEDIDO..."
        );

        const resposta = await fetch(
          "/api/pedidos",
          {
            method: "POST",
            credentials: "same-origin",
            cache: "no-store",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...tentativa.dados,
              chaveIdempotencia: tentativa.chave,
            }),
          }
        );

        const resultado =
          await lerRespostaCheckout(resposta);

        if (!resposta.ok) {
          // Permite corrigir dados recusados, preservando a mesma chave.
          // Falhas de rede ou erro interno continuam usando o corpo original.
          if (
            [400, 409, 422].includes(
              resposta.status
            )
          ) {
            tentativa = {
              ...tentativa,
              revisarDados: true,
            };

            salvarTentativaCheckout(tentativa);
          }

          throw new Error(
            typeof resultado.erro === "string"
              ? resultado.erro
              : "Não foi possível registrar o pedido."
          );
        }

        const pedido = resultado.pedido as
          | Record<string, unknown>
          | undefined;

        if (
          !pedido ||
          !inteiroPositivo(pedido.id) ||
          typeof pedido.valorTotal !== "string" ||
          !/^\d+(\.\d{1,2})?$/.test(
            pedido.valorTotal
          ) ||
          !Number.isFinite(
            Number(pedido.valorTotal)
          ) ||
          Number(pedido.valorTotal) <= 0
        ) {
          throw new Error(
            "A resposta do pedido está incompleta. Continue a mesma tentativa para verificá-lo."
          );
        }

        tentativa = {
          ...tentativa,
          pedidoId: pedido.id,
          valorTotal: pedido.valorTotal,
        };

        salvarTentativaCheckout(tentativa);
      }

      const pedidoId = tentativa.pedidoId;

      if (!inteiroPositivo(pedidoId)) {
        throw new Error(
          "Pedido inválido para pagamento."
        );
      }

      setEtapaPagamento(
        "PREPARANDO PAGAMENTO..."
      );

      const respostaPagamento = await fetch(
        "/api/pagamentos/iniciar",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ pedidoId }),
        }
      );

      const pagamento =
        await lerRespostaCheckout(
          respostaPagamento
        );

      if (!respostaPagamento.ok) {
        if (
          respostaPagamento.status === 409 &&
          [
            "RESERVA_EXPIRADA",
            "PEDIDO_INDISPONIVEL",
          ].includes(String(pagamento.codigo))
        ) {
          setPedidoParaReinicioId(pedidoId);
        }

        throw new Error(
          typeof pagamento.erro === "string"
            ? pagamento.erro
            : "Não foi possível iniciar o pagamento."
        );
      }

      if (
        pagamento.pedidoId !== pedidoId ||
        !inteiroPositivo(pagamento.pagamentoId)
      ) {
        throw new Error(
          "A resposta do pagamento não corresponde ao pedido."
        );
      }

      const destino = validarDestinoPagamento(
        pagamento.checkoutUrl
      );

      setEtapaPagamento(
        "REDIRECIONANDO..."
      );

      setMensagemPagamento(
        `Pedido #${pedidoId}: abrindo o checkout do Mercado Pago.`
      );

      // A referência permanece salva: voltar ou atualizar não cria outro pedido.
      // A confirmação financeira será feita pelo servidor, nunca por esta tela.
      window.location.assign(destino);
    } catch (erro) {
      const referencia =
        tentativaPedidoRef.current?.pedidoId;

      const mensagem =
        erro instanceof Error
          ? erro.message
          : "Não foi possível continuar o pagamento.";

      setMensagemPagamento(
        referencia
          ? `Pedido #${referencia}: ${mensagem}`
          : mensagem
      );
    } finally {
      // Se a navegação falhar ou o cliente voltar, poderá retomar o mesmo pedido.
      envioPagamentoRef.current = false;
      setCriandoPedido(false);
      setEtapaPagamento("");
    }
  }

  /* =======================================================
     INTERFACE DO CHECKOUT
     ======================================================= */

  return (
    <main className="checkoutPage">
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
              <p role="alert">
                {erroUsuario}
              </p>
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

            {!carregandoEnderecos &&
              enderecos.length > 0 && (
                <div className="checkoutSavedAddresses">
                  <div className="checkoutAddressHeading">
                    <h3>
                      SEUS ENDEREÇOS CADASTRADOS
                    </h3>
                    <span>
                      SELECIONE ONDE DESEJA RECEBER
                    </span>
                  </div>

                  <div className="checkoutAddressList">
                    {enderecos.map((endereco) => {
                      const selecionado =
                        enderecoSelecionadoId ===
                        endereco.id;

                      return (
                        <button
                          key={endereco.id}
                          type="button"
                          className={`checkoutAddressCard ${
                            selecionado
                              ? "isSelected"
                              : ""
                          }`}
                          onClick={() =>
                            preencherEndereco(
                              endereco
                            )
                          }
                          aria-pressed={
                            selecionado
                          }
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
                                {endereco.apelido ||
                                  "ENDEREÇO DE ENTREGA"}
                              </span>

                              {endereco.principal && (
                                <span className="checkoutAddressBadge">
                                  PRINCIPAL
                                </span>
                              )}
                            </span>

                            <strong className="checkoutAddressStreet">
                              {endereco.logradouro},{" "}
                              {endereco.numero}
                            </strong>

                            <span className="checkoutAddressDetails">
                              {endereco.bairro} ·{" "}
                              {endereco.cidade}/
                              {endereco.estado}
                            </span>

                            <span className="checkoutAddressCep">
                              CEP {endereco.cep}
                            </span>
                          </span>

                          <span className="checkoutAddressStatus">
                            {selecionado
                              ? "SELECIONADO"
                              : "SELECIONAR"}
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
                    alterarCEP(
                      event.target.value
                    )
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
              onClick={() =>
                void salvarEndereco()
              }
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

            <span>
              {tentativaSalva &&
              !tentativaSalva.revisarDados
                ? tentativaSalva.dados.itens.reduce(
                    (soma, item) =>
                      soma + item.quantity,
                    0
                  )
                : quantidadeItens}{" "}
              ITENS
            </span>
          </div>

          {erroRecuperacao && (
            <p
              role="alert"
              style={{
                marginBottom: 16,
                lineHeight: 1.5,
              }}
            >
              {erroRecuperacao}{" "}
              <Link href="/minha-conta">
                ABRIR MINHA CONTA
              </Link>
            </p>
          )}

          {tentativaSalva && (
            <div
              style={{
                padding: "16px 0",
                lineHeight: 1.5,
              }}
            >
              <p>
                {tentativaSalva.revisarDados
                  ? "Revise os dados abaixo e tente continuar novamente."
                  : tentativaSalva.pedidoId
                    ? `Pedido #${tentativaSalva.pedidoId} registrado. O pagamento usará os itens e a entrega desse pedido.`
                    : "Você já iniciou uma tentativa de compra. Ao continuar, verificaremos o mesmo pedido com os dados originais."}
              </p>
            </div>
          )}

          {items.length === 0 &&
          !tentativaSalva ? (
            <div className="checkoutEmpty">
              <p>SUA SACOLA ESTÁ VAZIA.</p>

              <Link href="/">
                VOLTAR PARA A LOJA →
              </Link>
            </div>
          ) : (
            <>
              {!tentativaSalva ||
              tentativaSalva.revisarDados ? (
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

                          <span>
                            {item.quantity}
                          </span>
                        </div>

                        <div className="checkoutItemInfo">
                          <div>
                            <h3>{item.name}</h3>

                            <p>
                              {item.color} /{" "}
                              {item.size}
                            </p>
                          </div>

                          <strong>
                            {formatarMoeda(
                              item.price *
                                item.quantity
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
                      borderTop:
                        "1px solid #444",
                      borderBottom:
                        "1px solid #444",
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
                          margin:
                            "16px 0 0",
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

                        {opcoesFrete.map(
                          (opcao) => (
                            <label
                              key={opcao.id}
                              style={{
                                display:
                                  "flex",
                                gap: 10,
                                alignItems:
                                  "center",
                                padding:
                                  "10px 0",
                                cursor:
                                  "pointer",
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
                                  setMensagemPagamento(
                                    ""
                                  );
                                }}
                              />

                              <span
                                style={{
                                  flex: 1,
                                }}
                              >
                                {
                                  opcao.transportadora
                                }
                                {" — "}
                                {opcao.nome}

                                {opcao.prazoDias !==
                                null
                                  ? ` · ${opcao.prazoDias} dias`
                                  : ""}
                              </span>

                              <strong>
                                {formatarMoeda(
                                  opcao.preco
                                )}
                              </strong>
                            </label>
                          )
                        )}
                      </fieldset>
                    )}
                  </div>

                  {/* VALORES */}

                  <div className="checkoutTotals">
                    <div>
                      <span>SUBTOTAL</span>
                      <strong>
                        {formatarMoeda(
                          subtotal
                        )}
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
                        {formatarMoeda(
                          total
                        )}
                      </strong>
                    </div>
                  </div>
                </>
              ) : (
                <div className="checkoutTotals">
                  <div>
                    <span>
                      ITENS DA COMPRA
                    </span>

                    <strong>
                      {tentativaSalva.dados.itens.reduce(
                        (soma, item) =>
                          soma +
                          item.quantity,
                        0
                      )}
                    </strong>
                  </div>

                  <div className="checkoutTotal">
                    <span>
                      TOTAL DO PEDIDO
                    </span>

                    <strong>
                      {tentativaSalva.valorTotal
                        ? formatarMoeda(
                            Number(
                              tentativaSalva.valorTotal
                            )
                          )
                        : "A CONFIRMAR"}
                    </strong>
                  </div>
                </div>
              )}

              {/* PRÓXIMA ETAPA */}

              {/* Registra ou recupera o mesmo pedido e solicita seu pagamento. */}
              <button
                type="button"
                className="checkoutContinue"

                // Usa a tentativa original também após falha ou atualização.
                onClick={() =>
                  void continuarParaPagamento()
                }

                // A ref da função também bloqueia cliques no mesmo instante.
                disabled={
                  criandoPedido ||
                  carregandoUsuario ||
                  !usuario ||
                  !tentativaCarregada ||
                  Boolean(erroRecuperacao)
                }
                aria-busy={criandoPedido}
              >
                <span>
                  {criandoPedido
                    ? etapaPagamento ||
                      "PROCESSANDO..."
                    : tentativaSalva?.revisarDados
                      ? "REVISAR E CONTINUAR"
                      : tentativaSalva
                        ? "CONTINUAR PEDIDO"
                        : "CONTINUAR PARA PAGAMENTO"}
                </span>

                <span>→</span>
              </button>

                            {pedidoParaReinicioId !== null &&
                pedidoParaReinicioId === tentativaSalva?.pedidoId && (
                  <button
                    type="button"
                    className="checkoutContinue"
                    style={{ marginTop: 12 }}
                    onClick={() => void iniciarNovaCompra()}
                    disabled={
                      criandoPedido ||
                      carregandoUsuario ||
                      !usuario ||
                      !tentativaCarregada ||
                      Boolean(erroRecuperacao)
                    }
                  >
                    <span>INICIAR NOVA COMPRA</span>
                    <span>→</span>
                  </button>
                )}

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