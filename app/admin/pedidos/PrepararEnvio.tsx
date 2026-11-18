"use client";

import {
  useRef,
  useState,
} from "react";

type Previa = {
  pedidoId: number;
  ambiente: string;
  consultadoEm: string;

  freteDoPedido: {
    nome: string | null;
    transportadora: string | null;
    valor: string;
  };

  destinatario: {
    nome: string;
    cep: string;
    logradouro: string;
    numero: string;
    complemento: string | null;
    bairro: string;
    cidade: string;
    estado: string;
  };

  itens: Array<{
    nome: string;
    cor: string;
    tamanho: string;
    quantidade: number;
  }>;

  volumes: Array<{
    width: number;
    height: number;
    length: number;
    weight: number;
  }>;

  valorProdutos: string;

  opcoes: Array<{
    id: number;
    nome: string;
    transportadora: string;
    preco: string;
  }>;

  avisoCotacao: string | null;
  pendencias: string[];
  observacao: string;
};

const moeda = (valor: string) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor));

export default function PrepararEnvio({
  pedidoId,
}: {
  pedidoId: number;
}) {
  const trava = useRef(false);

  const [ocupado, setOcupado] =
    useState(false);

  const [dados, setDados] =
    useState<Previa | null>(null);

  const [erro, setErro] = useState("");

  async function consultar() {
    if (trava.current) return;

    trava.current = true;
    setOcupado(true);
    setErro("");
    setDados(null);

    try {
      const resposta = await fetch(
        "/api/admin/pedidos/preparar-envio",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            pedidoId,
          }),
        }
      );

      const corpo =
        await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          corpo.erro ??
            "Não foi possível preparar a prévia."
        );
      }

      if (
        corpo.pedidoId !== pedidoId ||
        corpo.ambiente !== "sandbox" ||
        !Array.isArray(corpo.volumes) ||
        !Array.isArray(corpo.opcoes)
      ) {
        throw new Error(
          "Resposta de preparação inválida."
        );
      }

      setDados(corpo);
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Tente consultar novamente."
      );
    } finally {
      setOcupado(false);
      trava.current = false;
    }
  }

  return (
    <section
      aria-label="Preparação de etiqueta no Sandbox"
      style={{
        marginTop: 24,
        padding: 20,
        border: "1px solid #aaa",
        lineHeight: 1.7,
      }}
    >
      <h3 style={{ marginTop: 0 }}>
        Preparação de etiqueta — Sandbox
      </h3>

      <p>
        Confira o pedido e simule os serviços
        de frete no ambiente de teste.
        Esta etapa não cria nem compra etiquetas.
      </p>

      <button
        type="button"
        disabled={ocupado}
        onClick={() =>
          void consultar()
        }
        style={{
          padding: "14px 18px",
          background: "#171717",
          color: "#fff",
          border: "1px solid #171717",
          cursor:
            ocupado ? "wait" : "pointer",
          opacity: ocupado ? 0.6 : 1,
        }}
      >
        {ocupado
          ? "CONSULTANDO..."
          : "CONFERIR DADOS E SIMULAR FRETE"}
      </button>

      {erro && (
        <p role="alert">{erro}</p>
      )}

      {dados && (
        <div>
          <h4>Destinatário do pedido</h4>

          <p>
            {dados.destinatario.nome}
            <br />
            {dados.destinatario.logradouro},
            {" "}
            {dados.destinatario.numero}
            {dados.destinatario.complemento
              ? ` — ${dados.destinatario.complemento}`
              : ""}
            <br />
            {dados.destinatario.bairro}
            {" — "}
            {dados.destinatario.cidade}/
            {dados.destinatario.estado}
            <br />
            CEP: {dados.destinatario.cep}
          </p>

          <h4>Produtos</h4>

          <ul>
            {dados.itens.map((item, indice) => (
              <li key={indice}>
                {item.quantidade} ×{" "}
                {item.nome}
                {" — "}
                {item.cor} / {item.tamanho}
              </li>
            ))}
          </ul>

          <p>
            Valor dos produtos:{" "}
            {moeda(dados.valorProdutos)}.
          </p>

          <h4>
            Embalagem calculada para conferência
          </h4>

          <ul>
            {dados.volumes.map((volume, indice) => (
              <li key={indice}>
                Volume {indice + 1}:{" "}
                {volume.length} ×{" "}
                {volume.width} ×{" "}
                {volume.height} cm;{" "}
                {volume.weight.toLocaleString(
                  "pt-BR"
                )}{" "}
                kg.
              </li>
            ))}
          </ul>

          <p>{dados.observacao}</p>

          <h4>Frete registrado na compra</h4>

          <p>
            {dados.freteDoPedido.transportadora ??
              "Transportadora não informada"}
            {" — "}
            {dados.freteDoPedido.nome ??
              "Serviço não informado"}
            : {moeda(dados.freteDoPedido.valor)}.
          </p>

          <h4>Nova simulação no Sandbox</h4>

          {dados.avisoCotacao && (
            <p role="status">
              {dados.avisoCotacao}
            </p>
          )}

          <ul>
            {dados.opcoes.map((opcao) => (
              <li key={opcao.id}>
                {opcao.transportadora}
                {" — "}
                {opcao.nome}:{" "}
                {moeda(opcao.preco)}.
              </li>
            ))}
          </ul>

          <h4>
            Dados necessários para a próxima etapa
          </h4>

          <ul>
            {dados.pendencias.map(
              (pendencia, indice) => (
                <li key={indice}>
                  {pendencia}
                </li>
              )
            )}
          </ul>
        </div>
      )}
    </section>
  );
}