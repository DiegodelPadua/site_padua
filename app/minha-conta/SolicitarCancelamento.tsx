"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

type Solicitacao = {
  id: number;
  status: string;
  motivo: string;
  respostaAdmin: string | null;
  criadoEm: string;
  analisadoEm: string | null;
    reembolso?: {
    status: string;
    valor: string;
    confirmadoEm: string | null;
  } | null;
};

const nomes: Record<string, string> = {
  SOLICITADA:
    "Solicitação recebida — aguardando análise",
  EM_ANALISE:
    "Solicitação em análise",
  RECUSADA:
    "Solicitação recusada",
  APROVADA_PARA_REEMBOLSO:
    "Solicitação aprovada — reembolso ainda pendente",
};

const data = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export default function SolicitarCancelamento({
  pedidoId,
}: {
  pedidoId: number;
}) {
  const router = useRouter();
  const trava = useRef(false);

  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [versao, setVersao] = useState(0);

  const [solicitacao, setSolicitacao] =
    useState<Solicitacao | null>(null);

  const [podeSolicitar, setPodeSolicitar] =
    useState(false);

  const [mostrarFormulario, setMostrarFormulario] =
    useState(false);

  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    trava.current = true;
    setCarregando(true);
    setErro("");
    setSolicitacao(null);
    setPodeSolicitar(false);
    setMostrarFormulario(false);

    async function carregar() {
      try {
        const resposta = await fetch(
          `/api/minha-conta/cancelamentos?pedidoId=${pedidoId}`,
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        if (resposta.status === 401) {
          router.replace("/login");
          return;
        }

        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            dados.erro ??
              "Não foi possível consultar a solicitação."
          );
        }

        if (
          dados.pedidoId !== pedidoId ||
          typeof dados.podeSolicitar !== "boolean"
        ) {
          throw new Error(
            "Resposta de solicitação inválida."
          );
        }

        if (!controller.signal.aborted) {
          setSolicitacao(dados.solicitacao);
          setPodeSolicitar(dados.podeSolicitar);
          setMostrarFormulario(false);
        }
      } catch (falha) {
        if (!controller.signal.aborted) {
          setErro(
            falha instanceof Error
              ? falha.message
              : "Não foi possível consultar a solicitação."
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setCarregando(false);
          trava.current = false;
        }
      }
    }

    void carregar();

    return () => controller.abort();
  }, [pedidoId, router, versao]);

  async function enviar(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      trava.current ||
      !podeSolicitar ||
      carregando
    ) {
      return;
    }

    trava.current = true;
    setEnviando(true);
    setErro("");

    try {
      const resposta = await fetch(
        "/api/minha-conta/cancelamentos",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pedidoId,
            motivo,
          }),
        }
      );

      if (resposta.status === 401) {
        router.replace("/login");
        return;
      }

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.erro ??
            "Não foi possível enviar a solicitação."
        );
      }

      if (
        dados.pedidoId !== pedidoId ||
        !dados.solicitacao ||
        typeof dados.solicitacao.status !== "string"
      ) {
        throw new Error(
          "Não foi possível confirmar o registro. Atualize a solicitação para conferir."
        );
      }

      setSolicitacao(dados.solicitacao);
      setPodeSolicitar(false);
      setMostrarFormulario(false);
      setMotivo("");
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível confirmar o envio. Use Atualizar solicitação para conferir."
      );
    } finally {
      setEnviando(false);
      trava.current = false;
    }
  }

  const ocupado = carregando || enviando;

  const botao = {
    padding: "14px 18px",
    background: "#111",
    color: "#fff",
    border: "1px solid #111",
    fontSize: 12,
    cursor: ocupado ? "wait" : "pointer",
    opacity: ocupado ? 0.6 : 1,
  } as const;

  return (
    <section
      aria-label={`Cancelamento da compra ${pedidoId}`}
      style={{
        marginTop: 24,
        borderTop: "1px solid #c9c6bf",
        paddingTop: 20,
        lineHeight: 1.7,
      }}
    >
      <h4 style={{ margin: "0 0 12px" }}>
        Cancelamento da compra
      </h4>

      {carregando && (
        <p role="status">
          Consultando solicitações...
        </p>
      )}

      {erro && <p role="alert">{erro}</p>}

      {!carregando && solicitacao && (
        <div>
          <p role="status">
            <strong>
              {solicitacao.reembolso?.status === "CONFIRMADO"
                ? "Reembolso integral confirmado pelo Mercado Pago"
                : nomes[solicitacao.status] ??
                  "Situação em análise"}
            </strong>
          </p>

          <p>
            Solicitação #{solicitacao.id}, enviada em{" "}
            {data.format(new Date(solicitacao.criadoEm))}.
          </p>

          <p
            style={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            Seu motivo: {solicitacao.motivo}
          </p>

          {solicitacao.respostaAdmin && (
            <p
              style={{
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              Resposta da loja:{" "}
              {solicitacao.respostaAdmin}
            </p>
          )}

          {solicitacao.analisadoEm && (
            <p>
              Analisada em{" "}
              {data.format(
                new Date(solicitacao.analisadoEm)
              )}
              .
            </p>
          )}
        </div>
      )}

      {!carregando &&
        podeSolicitar &&
        !mostrarFormulario && (
          <button
            type="button"
            disabled={ocupado}
            style={botao}
            onClick={() =>
              setMostrarFormulario(true)
            }
          >
            {solicitacao
              ? "ENVIAR NOVA SOLICITAÇÃO"
              : "SOLICITAR CANCELAMENTO"}
          </button>
        )}

      {!carregando &&
        !erro &&
        !podeSolicitar &&
        !solicitacao && (
          <p>
            Não é possível enviar uma solicitação
            neste momento.
          </p>
        )}

      {mostrarFormulario && podeSolicitar && (
        <form onSubmit={enviar}>
          <p>
            Sua solicitação será analisada pela loja.
            O envio não cancela o pedido nem confirma
            um reembolso.
          </p>

          <label
            htmlFor={`motivo-cancelamento-${pedidoId}`}
          >
            Conte o motivo do cancelamento
          </label>

          <textarea
            id={`motivo-cancelamento-${pedidoId}`}
            value={motivo}
            onChange={(event) =>
              setMotivo(event.target.value)
            }
            minLength={10}
            maxLength={1000}
            required
            rows={4}
            disabled={ocupado}
            style={{
              display: "block",
              width: "100%",
              boxSizing: "border-box",
              padding: 12,
              margin: "10px 0",
              font: "inherit",
              resize: "vertical",
            }}
          />

          <p style={{ fontSize: 12 }}>
            De 10 a 1.000 caracteres.
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <button
              type="submit"
              disabled={ocupado}
              style={botao}
            >
              {enviando
                ? "ENVIANDO..."
                : "ENVIAR SOLICITAÇÃO"}
            </button>

            <button
              type="button"
              disabled={ocupado}
              style={{
                ...botao,
                background: "transparent",
                color: "#111",
              }}
              onClick={() =>
                setMostrarFormulario(false)
              }
            >
              VOLTAR
            </button>
          </div>
        </form>
      )}

      <button
        type="button"
        disabled={ocupado}
        onClick={() => {
          if (trava.current) return;

          trava.current = true;
          setVersao((valor) => valor + 1);
        }}
        style={{
          marginTop: 16,
          display: "block",
          padding: "10px 0",
          background: "transparent",
          border: 0,
          color: "#111",
          textDecoration: "underline",
          cursor: "pointer",
        }}
      >
        Atualizar solicitação
      </button>
    </section>
  );
}