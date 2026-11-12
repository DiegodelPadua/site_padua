"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Pedido = {
  id: number;
  status: string;
  criadoEm: string;
  valorTotal: string;
  ultimoPagamento: string | null;
  podeCancelar: boolean;

  itens: Array<{
    nomeProduto: string;
    tamanho: string;
    cor: string;
    quantidade: number;
  }>;

  entrega: {
    transportadora: string | null;
    codigoRastreamento: string | null;
  } | null;
};

const situacoes: Record<string, string> = {
  AGUARDANDO_PAGAMENTO:
    "Aguardando confirmação do pagamento",
  CONFIRMADO: "Pedido confirmado",
  EM_PREPARACAO: "Em preparação",
  ENVIADO: "Pedido enviado",
  ENTREGUE: "Pedido entregue",
  CANCELADO: "Pedido cancelado",
};

const pagamentos: Record<string, string> = {
  PENDENTE: "Pendente",
  PROCESSANDO: "Em processamento",
  APROVADO: "Aprovado",
  RECUSADO: "Recusado",
  CANCELADO: "Cancelado",
  EXPIRADO: "Expirado",
  ESTORNADO: "Estornado",
};

const moeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const data = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
});

export default function MeusPedidos() {
  const router = useRouter();

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [atualizacao, setAtualizacao] = useState(0);

    const [
    confirmandoCancelamentoId,
    setConfirmandoCancelamentoId,
  ] = useState<number | null>(null);

  const [cancelandoId, setCancelandoId] =
    useState<number | null>(null);

  const [mensagemCancelamento, setMensagemCancelamento] =
    useState("");

  const cancelamentoRef = useRef(false);



  useEffect(() => {
    const controller = new AbortController();
    setConfirmandoCancelamentoId(null);
    setMensagemCancelamento("");
    setCarregando(true);
    setErro("");

    async function carregar() {
      try {
        const resposta = await fetch(
          "/api/minha-conta/pedidos",
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (resposta.status === 401) {
          setPedidos([]);
          router.replace("/login");
          return;
        }

        if (!resposta.ok) {
          throw new Error(
            "Não foi possível carregar seus pedidos. Tente atualizar."
          );
        }

        const dados = await resposta.json();

        if (
          !dados ||
          !Array.isArray(dados.pedidos)
        ) {
          throw new Error(
            "Resposta de pedidos inválida."
          );
        }

        if (!controller.signal.aborted) {
          setPedidos(dados.pedidos);
        }
      } catch (falha) {
        if (!controller.signal.aborted) {
          setErro(
            falha instanceof Error
              ? falha.message
              : "Não foi possível consultar seus pedidos."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setCarregando(false);
        }
      }
    }

    void carregar();

    return () => {
      controller.abort();
    };
  }, [router, atualizacao]);

    async function cancelarPedido(pedidoId: number) {
    if (cancelamentoRef.current || carregando) return;

    cancelamentoRef.current = true;
    setCancelandoId(pedidoId);
    setMensagemCancelamento("");

    try {
      const resposta = await fetch(
        "/api/minha-conta/pedidos/cancelar",
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

      if (resposta.status === 401) {
        setPedidos([]);
        router.replace("/login");
        return;
      }

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          typeof dados.erro === "string"
            ? dados.erro
            : "Não foi possível cancelar. Atualize os pedidos antes de tentar novamente."
        );
      }

      if (
        dados.pedidoId !== pedidoId ||
        dados.status !== "CANCELADO"
      ) {
        throw new Error(
          "Não foi possível confirmar o cancelamento. Atualize os pedidos para conferir."
        );
      }

      // Retira da lista após o servidor confirmar o cancelamento.
      setPedidos((anteriores) =>
        anteriores.filter(
          (pedido) => pedido.id !== pedidoId
        )
      );

      setConfirmandoCancelamentoId(null);

      setMensagemCancelamento(
        `Pedido #${pedidoId} cancelado. O estoque reservado foi liberado.`
      );
    } catch (falha) {
      setMensagemCancelamento(
        falha instanceof Error
          ? falha.message
          : "Não foi possível confirmar o cancelamento. Atualize os pedidos para conferir."
      );
    } finally {
      cancelamentoRef.current = false;
      setCancelandoId(null);
    }
  }


  return (
    <section
      aria-labelledby="titulo-meus-pedidos"
      style={{ marginTop: 48 }}
    >
      <div className="accountSectionTitle">
        <span>MEUS PEDIDOS</span>

        <h2 id="titulo-meus-pedidos">
          Acompanhe suas compras.
        </h2>

        <p>
          Seus 20 pedidos mais recentes, com a situação
          registrada no nosso sistema.
        </p>
      </div>

      <button
        type="button"
        disabled={carregando || cancelandoId !== null}
        onClick={() =>
          !cancelamentoRef.current &&
          setAtualizacao((valor) => valor + 1)
        }
        style={{
          padding: "14px 20px",
          background: "#111",
          color: "#fff",
          border: "1px solid #111",
          cursor: carregando ? "wait" : "pointer",
          margin: "20px 0",
          fontSize: 12,
          letterSpacing: ".08em",
          opacity: carregando ? 0.6 : 1,
        }}
      >
        {carregando
          ? "CONSULTANDO..."
          : "ATUALIZAR PEDIDOS"}
      </button>

      {carregando && (
        <p role="status">
          Consultando a situação dos pedidos...
        </p>
      )}

      {erro && <p role="alert">{erro}</p>}

            {mensagemCancelamento && (
        <p
          role="status"
          style={{ margin: "16px 0", lineHeight: 1.6 }}
        >
          {mensagemCancelamento}
        </p>
      )}

      {!carregando &&
        !erro &&
        pedidos.length === 0 && (
          <p>
          Nenhum pedido para acompanhar no momento.{" "}
            <Link href="/">Conhecer a loja</Link>
          </p>
        )}

      {!carregando &&
        !erro &&
        pedidos.map((pedido) => (
          <article
            key={pedido.id}
            style={{
              border: "1px solid #c9c6bf",
              padding: "clamp(16px, 4vw, 28px)",
              marginBottom: 16,
            }}
          >
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 6px" }}>
                  Pedido #{pedido.id}
                </h3>

                <time dateTime={pedido.criadoEm}>
                  {data.format(
                    new Date(pedido.criadoEm)
                  )}
                </time>
              </div>

              <strong>
                {moeda.format(
                  Number(pedido.valorTotal)
                )}
              </strong>
            </header>

            <p
              style={{
                margin: "20px 0 8px",
                fontWeight: 600,
              }}
            >
              {pedido.status === "AGUARDANDO_PAGAMENTO" &&
              pedido.ultimoPagamento === "APROVADO"
                ? "Pagamento aprovado — pedido em revisão"
                : situacoes[pedido.status] ??
                  "Situação em análise"}
            </p>

            <p
              style={{
                fontSize: 13,
                lineHeight: 1.6,
              }}
            >
              Última tentativa de pagamento:{" "}
              {pedido.ultimoPagamento
                ? pagamentos[pedido.ultimoPagamento] ??
                  "Em análise"
                : "Ainda não iniciada"}
              .
            </p>

            {pedido.ultimoPagamento === "APROVADO" &&
              [
                "AGUARDANDO_PAGAMENTO",
                "CANCELADO",
              ].includes(pedido.status) && (
                <p
                  role="status"
                  style={{
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  Há um pagamento aprovado, mas o pedido
                  precisa de revisão antes do atendimento.
                </p>
              )}

            <details style={{ marginTop: 20 }}>
              <summary
                style={{
                  cursor: "pointer",
                  padding: "10px 0",
                  textDecoration: "underline",
                  textUnderlineOffset: 4,
                }}
              >
                Ver itens e entrega
              </summary>

              <ul
                style={{
                  paddingLeft: 20,
                  lineHeight: 1.7,
                }}
              >
                {pedido.itens.map((item, indice) => (
                  <li key={indice}>
                    {item.quantidade} ×{" "}
                    {item.nomeProduto} —{" "}
                    {item.cor} / {item.tamanho}
                  </li>
                ))}
              </ul>

              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.7,
                }}
              >
                Transportadora:{" "}
                {pedido.entrega?.transportadora ||
                  "Ainda não informada"}
                .
                <br />
                Código de rastreamento:{" "}
                {pedido.entrega?.codigoRastreamento ||
                  "Ainda não informado"}
                .
              </p>
            </details>

            {pedido.podeCancelar && (
              <div style={{ marginTop: 24 }}>
                {confirmandoCancelamentoId === pedido.id ? (
                  <div
                    role="group"
                    aria-label={`Confirmar cancelamento do pedido ${pedido.id}`}
                  >
                    <p
                      style={{
                        fontSize: 14,
                        lineHeight: 1.6,
                      }}
                    >
                      Deseja cancelar o pedido #{pedido.id}?
                      Ele sairá desta lista e o estoque
                      reservado será liberado.
                    </p>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 12,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          void cancelarPedido(pedido.id)
                        }
                        disabled={
                          carregando ||
                          cancelandoId !== null
                        }
                        style={{
                          padding: "14px 18px",
                          background: "#111",
                          color: "#fff",
                          border: "1px solid #111",
                          cursor:
                            cancelandoId !== null
                              ? "wait"
                              : "pointer",
                        }}
                      >
                        {cancelandoId === pedido.id
                          ? "CANCELANDO..."
                          : "CONFIRMAR CANCELAMENTO"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setConfirmandoCancelamentoId(null)
                        }
                        disabled={
                          carregando ||
                          cancelandoId !== null
                        }
                        style={{
                          padding: "14px 18px",
                          background: "transparent",
                          color: "#111",
                          border: "1px solid #111",
                          cursor: "pointer",
                        }}
                      >
                        MANTER PEDIDO
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMensagemCancelamento("");
                      setConfirmandoCancelamentoId(
                        pedido.id
                      );
                    }}
                    disabled={
                      carregando ||
                      cancelandoId !== null
                    }
                    style={{
                      padding: "14px 18px",
                      background: "transparent",
                      color: "#111",
                      border: "1px solid #111",
                      cursor: "pointer",
                    }}
                  >
                    CANCELAR PEDIDO
                  </button>
                )}
              </div>
            )}
          </article>
        ))}
    </section>
  );
}