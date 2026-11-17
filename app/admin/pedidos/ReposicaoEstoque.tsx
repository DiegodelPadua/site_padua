"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";

type Consulta = {
  pedidoId: number;
  podeRepor: boolean;

  origemPermitida:
    | "NAO_ENVIADO"
    | "DEVOLVIDO"
    | null;

  motivoBloqueio: string | null;

  itens: Array<{
    nome: string;
    cor: string;
    tamanho: string;
    quantidade: number;
  }>;

  reposicao: {
    registradoEm: string;
    administradorId: number | null;
    origem: string | null;
    observacao: string | null;
  } | null;
};

export default function ReposicaoEstoque({
  pedidoId,
}: {
  pedidoId: number;
}) {
  const router = useRouter();
  const trava = useRef(false);

  const [versao, setVersao] = useState(0);

  const [dados, setDados] =
    useState<Consulta | null>(null);

  const [carregando, setCarregando] =
    useState(true);

  const [enviando, setEnviando] =
    useState(false);

  const [observacao, setObservacao] =
    useState("");

  const [conferido, setConferido] =
    useState(false);

  const [confirmar, setConfirmar] =
    useState(false);

  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] =
    useState("");

  useEffect(() => {
    const abort = new AbortController();

    trava.current = true;

    setCarregando(true);
    setDados(null);
    setConfirmar(false);
    setConferido(false);

    async function carregar() {
      try {
        const resposta = await fetch(
          `/api/admin/pedidos/reposicao?pedidoId=${pedidoId}`,
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: abort.signal,
          }
        );

        const corpo =
          await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            corpo.erro ??
              "Não foi possível consultar a reposição."
          );
        }

        if (
          corpo.pedidoId !== pedidoId ||
          typeof corpo.podeRepor !==
            "boolean" ||
          !Array.isArray(corpo.itens)
        ) {
          throw new Error(
            "Consulta de reposição inválida."
          );
        }

        if (!abort.signal.aborted) {
          setDados(corpo);
        }
      } catch (e) {
        if (!abort.signal.aborted) {
          setErro(
            e instanceof Error
              ? e.message
              : "Falha na consulta."
          );
        }
      } finally {
        if (!abort.signal.aborted) {
          trava.current = false;
          setCarregando(false);
        }
      }
    }

    void carregar();

    return () => abort.abort();
  }, [pedidoId, versao]);

  async function registrar() {
    if (
      trava.current ||
      !confirmar ||
      !conferido ||
      !dados?.podeRepor ||
      !dados.origemPermitida
    ) {
      return;
    }

    trava.current = true;

    setEnviando(true);
    setErro("");
    setMensagem("");

    try {
      const resposta = await fetch(
        "/api/admin/pedidos/reposicao",
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
            origem:
              dados.origemPermitida,
            observacao,
            conferido,
          }),
        }
      );

      const corpo = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          corpo.erro ??
            "Não foi possível confirmar a reposição."
        );
      }

      if (
        corpo.pedidoId !== pedidoId ||
        typeof corpo.jaReposto !==
          "boolean"
      ) {
        throw new Error(
          "Resultado inválido. Atualize a consulta."
        );
      }

      setMensagem(
        corpo.jaReposto
          ? "A reposição já estava registrada. Nenhuma quantidade foi adicionada novamente."
          : "Reposição integral registrada com sucesso."
      );

      setVersao((v) => v + 1);
      router.refresh();
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Atualize a consulta para conferir o resultado."
      );

      setDados(null);
    } finally {
      setConfirmar(false);
      setEnviando(false);
      trava.current = false;
    }
  }

  const ocupado =
    carregando || enviando;

  const estilo = {
    padding: "14px 18px",
    background: "#171717",
    color: "#fff",
    border: "1px solid #171717",
    cursor: ocupado ? "wait" : "pointer",
    opacity: ocupado ? 0.6 : 1,
  } as const;

  const origem =
    dados?.origemPermitida === "NAO_ENVIADO"
      ? "Confirme que os produtos permaneceram na loja e estão aptos à venda."
      : "Há registro ou indício de envio. Reponha somente após receber e conferir todos os produtos.";

  return (
    <section
      aria-label="Conferência e reposição de estoque"
      style={{
        marginTop: 24,
        padding: 20,
        border: "1px solid #aaa",
        lineHeight: 1.7,
      }}
    >
      <h3 style={{ marginTop: 0 }}>
        Conferência e reposição de estoque
      </h3>

      {carregando && (
        <p role="status">
          Consultando reserva e reembolso...
        </p>
      )}

      {erro && (
        <p role="alert">{erro}</p>
      )}

      {mensagem && (
        <p role="status">{mensagem}</p>
      )}

      {dados?.reposicao ? (
        <div>
          <p>
            <strong>
              Estoque já reposto integralmente.
            </strong>
          </p>

          <p>
            Conferido pelo administrador #
            {dados.reposicao.administradorId}
            {" em "}
            {new Intl.DateTimeFormat(
              "pt-BR",
              {
                dateStyle: "short",
                timeStyle: "short",
                timeZone:
                  "America/Sao_Paulo",
              }
            ).format(
              new Date(
                dados.reposicao.registradoEm
              )
            )}
            .
          </p>

          <p>
            {dados.reposicao.origem ===
            "NAO_ENVIADO"
              ? "Produtos permaneceram na loja."
              : "Produtos retornaram à loja."}
          </p>

          <p
            style={{
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {dados.reposicao.observacao}
          </p>
        </div>
      ) : dados?.podeRepor ? (
        <div>
          <p>{origem}</p>

          <ul>
            {dados.itens.map((item, i) => (
              <li key={i}>
                {item.quantidade} ×{" "}
                {item.nome}
                {" — "}
                {item.cor} / {item.tamanho}
              </li>
            ))}
          </ul>

          <p>
            Esta ação repõe todos os itens.
            Confirme somente depois de verificar
            as quantidades e as condições de venda.
          </p>

          <label
            htmlFor={
              `observacao-reposicao-${pedidoId}`
            }
          >
            Registro da conferência física
          </label>

          <textarea
            id={
              `observacao-reposicao-${pedidoId}`
            }
            rows={4}
            maxLength={1000}
            value={observacao}
            disabled={ocupado || confirmar}
            onChange={(e) =>
              setObservacao(e.target.value)
            }
            style={{
              width: "100%",
              boxSizing: "border-box",
              display: "block",
              margin: "10px 0",
              padding: 12,
              font: "inherit",
            }}
          />

          <label
            style={{
              display: "block",
              margin: "16px 0",
            }}
          >
            <input
              type="checkbox"
              checked={conferido}
              disabled={ocupado || confirmar}
              onChange={(e) =>
                setConferido(e.target.checked)
              }
            />{" "}
            Conferi fisicamente todos os itens
            acima. Estão na loja, nas quantidades
            indicadas e aptos à venda.
          </label>

          {confirmar ? (
            <div>
              <p>
                <strong>
                  Confirmar a reposição integral
                  deste pedido?
                </strong>
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
                  style={estilo}
                  disabled={ocupado}
                  onClick={() =>
                    void registrar()
                  }
                >
                  CONFIRMAR REPOSIÇÃO INTEGRAL
                </button>

                <button
                  type="button"
                  style={{
                    ...estilo,
                    color: "#171717",
                    background: "transparent",
                  }}
                  disabled={ocupado}
                  onClick={() =>
                    setConfirmar(false)
                  }
                >
                  VOLTAR
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              style={estilo}
              disabled={ocupado}
              onClick={() => {
                if (
                  !conferido ||
                  observacao.trim().length < 10 ||
                  observacao.trim().length > 1000
                ) {
                  setErro(
                    "Confirme a conferência e escreva de 10 a 1.000 caracteres."
                  );
                  return;
                }

                setErro("");
                setConfirmar(true);
              }}
            >
              REPOR ESTOQUE
            </button>
          )}
        </div>
      ) : dados?.motivoBloqueio ? (
        <p>{dados.motivoBloqueio}</p>
      ) : null}

      <button
        type="button"
        disabled={ocupado}
        style={{
          ...estilo,
          marginTop: 16,
          color: "#171717",
          background: "transparent",
        }}
        onClick={() => {
          if (trava.current) return;

          trava.current = true;
          setErro("");
          setVersao((v) => v + 1);
        }}
      >
        ATUALIZAR CONFERÊNCIA
      </button>
    </section>
  );
}