"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SolicitacaoAdmin = {
  id: number;
  pedidoId: number;
  status: string;
  motivo: string;
  respostaAdmin: string | null;
  administradorNome: string | null;
  criadoEm: string;
  atualizadoEm: string;
  analisadoEm: string | null;
  situacaoPedido: string;
  situacaoEntrega: string | null;
  codigoRastreamento: string | null;
    reembolso?: {
    status: string;
    valor: string;
    confirmadoEm: string | null;
  } | null;
};

import ReembolsoCancelamento from "./ReembolsoCancelamento";

const nomes: Record<string, string> = {
  SOLICITADA: "Aguardando análise",
  EM_ANALISE: "Em análise",
  RECUSADA: "Solicitação recusada",
  APROVADA_PARA_REEMBOLSO:
    "Aprovada para reembolso — dinheiro ainda não devolvido por este fluxo",
};

const data = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

export default function AnaliseCancelamento({
  solicitacao,
}: {
  solicitacao: SolicitacaoAdmin;
}) {
  const router = useRouter();
  const trava = useRef(false);

  const [ocupado, setOcupado] = useState(false);

  const [
    aguardandoAtualizacao,
    setAguardandoAtualizacao,
  ] = useState(false);

  const [resposta, setResposta] = useState(
    solicitacao.respostaAdmin ?? ""
  );

  const [decisao, setDecisao] =
    useState<"aprovar" | "recusar" | null>(null);

  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    setAguardandoAtualizacao(false);
    setResposta(solicitacao.respostaAdmin ?? "");
    setDecisao(null);
  }, [
    solicitacao.id,
    solicitacao.status,
    solicitacao.atualizadoEm,
    solicitacao.respostaAdmin,
  ]);

  async function executar(
    acao: "iniciar" | "aprovar" | "recusar"
  ) {
    if (
      trava.current ||
      aguardandoAtualizacao
    ) {
      return;
    }

    trava.current = true;
    setOcupado(true);
    setErro("");
    setMensagem("");

    try {
      const retorno = await fetch(
        "/api/admin/cancelamentos/analisar",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            solicitacaoId: solicitacao.id,
            acao,
            statusEsperado: solicitacao.status,
            resposta:
              acao === "iniciar" ? "" : resposta,
          }),
        }
      );

      const dados = await retorno.json();

      if (!retorno.ok) {
        throw new Error(
          typeof dados.erro === "string"
            ? dados.erro
            : "Não foi possível registrar a análise."
        );
      }

      if (
        dados.solicitacaoId !== solicitacao.id ||
        dados.pedidoId !== solicitacao.pedidoId ||
        typeof dados.status !== "string"
      ) {
        throw new Error(
          "Não foi possível confirmar o resultado. Atualize o painel."
        );
      }

      setAguardandoAtualizacao(true);
      setDecisao(null);

      setMensagem(
        "Análise registrada. Atualizando o painel. Pagamento e estoque permanecem inalterados."
      );

      router.refresh();
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível confirmar o resultado. Atualize o painel."
      );

      setDecisao(null);
      router.refresh();
    } finally {
      setOcupado(false);
      trava.current = false;
    }
  }

  function escolher(
    acao: "aprovar" | "recusar"
  ) {
    if (
      resposta.trim().length < 10 ||
      resposta.trim().length > 1000
    ) {
      setErro(
        "Escreva uma resposta ao cliente com 10 a 1.000 caracteres."
      );
      return;
    }

    setErro("");
    setDecisao(acao);
  }

  const bloqueado =
    ocupado || aguardandoAtualizacao;

  const botao = {
    padding: "14px 18px",
    background: "#171717",
    color: "#fff",
    border: "1px solid #171717",
    cursor: bloqueado ? "wait" : "pointer",
    opacity: bloqueado ? 0.6 : 1,
  } as const;

  return (
    <section
      aria-label={`Análise do cancelamento ${solicitacao.id}`}
      style={{
        margin: "24px 0",
        padding: 20,
        border: "1px solid #aaa",
        lineHeight: 1.7,
      }}
    >
      <h3 style={{ marginTop: 0 }}>
        Solicitação de cancelamento #{solicitacao.id}
      </h3>

      <p>
        <strong>
            {solicitacao.reembolso?.status === "CONFIRMADO"
            ? "Reembolso integral confirmado"
            : nomes[solicitacao.status] ??
                "Situação em análise"}
        </strong>
      </p>

      <p>
        Recebida em{" "}
        {data.format(
          new Date(solicitacao.criadoEm)
        )}
        .
      </p>

      <p
        style={{
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }}
      >
        Motivo do cliente: {solicitacao.motivo}
      </p>

      <p>
        Pedido: {solicitacao.situacaoPedido}.
        <br />
        Entrega:{" "}
        {solicitacao.situacaoEntrega ??
          "Não informada"}
        .
        <br />
        Rastreamento:{" "}
        {solicitacao.codigoRastreamento ??
          "Não informado"}
        .
      </p>

      <p>
        Administrador responsável:{" "}
        {solicitacao.administradorNome ??
          "Ainda não definido"}
        .
      </p>

      {solicitacao.respostaAdmin && (
        <p
          style={{
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          Resposta ao cliente:{" "}
          {solicitacao.respostaAdmin}
        </p>
      )}

      {solicitacao.analisadoEm && (
        <p>
          Decisão registrada em{" "}
          {data.format(
            new Date(solicitacao.analisadoEm)
          )}
          .
        </p>
      )}

      {erro && <p role="alert">{erro}</p>}

      {mensagem && (
        <p role="status">{mensagem}</p>
      )}

      {solicitacao.status === "SOLICITADA" && (
        <button
          type="button"
          disabled={bloqueado}
          style={botao}
          onClick={() => void executar("iniciar")}
        >
          {ocupado
            ? "REGISTRANDO..."
            : "INICIAR ANÁLISE"}
        </button>
      )}

      {solicitacao.status === "EM_ANALISE" && (
        <div>
          <label
            htmlFor={`resposta-cancelamento-${solicitacao.id}`}
          >
            Resposta que será exibida ao cliente
          </label>

          <textarea
            id={`resposta-cancelamento-${solicitacao.id}`}
            rows={4}
            maxLength={1000}
            value={resposta}
            onChange={(event) =>
              setResposta(event.target.value)
            }
            disabled={
              bloqueado || decisao !== null
            }
            style={{
              width: "100%",
              boxSizing: "border-box",
              display: "block",
              padding: 12,
              font: "inherit",
              margin: "10px 0",
            }}
          />

          <p style={{ fontSize: 12 }}>
            De 10 a 1.000 caracteres. Esta etapa
            não movimenta dinheiro nem estoque.
          </p>

          {decisao ? (
            <div
              role="group"
              aria-label="Confirmar decisão de cancelamento"
            >
              <p>
                {decisao === "aprovar"
                  ? "Confirmar aprovação para reembolso? O reembolso ainda precisará ser realizado e confirmado no Mercado Pago."
                  : "Confirmar recusa? O cliente verá sua resposta, e o pedido e o pagamento serão mantidos."}
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
                  disabled={bloqueado}
                  style={botao}
                  onClick={() =>
                    void executar(decisao)
                  }
                >
                  {ocupado
                    ? "REGISTRANDO..."
                    : "CONFIRMAR DECISÃO"}
                </button>

                <button
                  type="button"
                  disabled={bloqueado}
                  style={{
                    ...botao,
                    background: "transparent",
                    color: "#171717",
                  }}
                  onClick={() => setDecisao(null)}
                >
                  VOLTAR
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <button
                type="button"
                disabled={bloqueado}
                style={botao}
                onClick={() => escolher("aprovar")}
              >
                APROVAR PARA REEMBOLSO
              </button>

              <button
                type="button"
                disabled={bloqueado}
                style={{
                  ...botao,
                  background: "transparent",
                  color: "#171717",
                }}
                onClick={() => escolher("recusar")}
              >
                RECUSAR SOLICITAÇÃO
              </button>
            </div>
          )}
        </div>
      )}
            {solicitacao.status ===
        "APROVADA_PARA_REEMBOLSO" && (
        <ReembolsoCancelamento
          solicitacaoId={solicitacao.id}
          reembolso={solicitacao.reembolso}
        />
      )}
    </section>
  );
}