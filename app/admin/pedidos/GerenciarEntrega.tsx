"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";

type Acao =
  | "preparar"
  | "enviar"
  | "entregar";

type Consulta = {
  pedidoId: number;
  situacaoPedido: string;
  situacaoEntrega: string | null;
  transportadora: string | null;
  codigoRastreamento: string | null;
  urlRastreamento: string | null;
  dataPostagem: string | null;
  dataEntrega: string | null;
  proximaAcao: Acao | null;
  motivoBloqueio: string | null;
};

const titulos = {
  preparar: "INICIAR PREPARAÇÃO",
  enviar: "REGISTRAR ENVIO",
  entregar: "REGISTRAR ENTREGA CONCLUÍDA",
};

const nomes: Record<string, string> = {
  CONFIRMADO: "Confirmado",
  EM_PREPARACAO: "Em preparação",
  ENVIADO: "Enviado",
  ENTREGUE: "Entregue",
  PENDENTE: "Aguardando preparação",
  PREPARANDO: "Preparando envio",
  POSTADO: "Enviado à transportadora",
  EM_TRANSITO: "Em trânsito",
  SAIU_PARA_ENTREGA: "Saiu para entrega",
};

const avisos = {
  preparar:
    "Confirma o início da preparação deste pedido?",
  enviar:
    "Confirme somente após entregar o pacote à transportadora. A postagem será registrada com a data e hora atuais.",
  entregar:
    "Confirme somente após conferir que o cliente recebeu o pedido. A conclusão será registrada com a data e hora atuais.",
};

const datas = new Intl.DateTimeFormat(
  "pt-BR",
  {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }
);

export default function GerenciarEntrega({
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

  const [confirmar, setConfirmar] =
    useState(false);

  const [transportadora, setTransportadora] =
    useState("");

  const [codigo, setCodigo] = useState("");
  const [link, setLink] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    const abort = new AbortController();

    trava.current = true;
    setCarregando(true);
    setDados(null);
    setConfirmar(false);

    async function carregar() {
      try {
        const resposta = await fetch(
          `/api/admin/pedidos/entrega?pedidoId=${pedidoId}`,
          {
            credentials: "same-origin",
            cache: "no-store",
            signal: abort.signal,
          }
        );

        const corpo = await resposta.json();

        if (!resposta.ok) {
          throw new Error(
            corpo.erro ??
              "Não foi possível consultar a entrega."
          );
        }

        if (
          corpo.pedidoId !== pedidoId ||
          typeof corpo.situacaoPedido !==
            "string" ||
          !(
            corpo.proximaAcao === null ||
            [
              "preparar",
              "enviar",
              "entregar",
            ].includes(corpo.proximaAcao)
          )
        ) {
          throw new Error(
            "Consulta de entrega inválida."
          );
        }

        if (!abort.signal.aborted) {
          setDados(corpo);
          setTransportadora(
            corpo.transportadora ?? ""
          );
          setCodigo(
            corpo.codigoRastreamento ?? ""
          );
          setLink(
            corpo.urlRastreamento ?? ""
          );
        }
      } catch (e) {
        if (!abort.signal.aborted) {
          setErro(
            e instanceof Error
              ? e.message
              : "Falha ao consultar entrega."
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
      !dados?.proximaAcao
    ) {
      return;
    }

    trava.current = true;
    setEnviando(true);
    setErro("");
    setMensagem("");

    try {
      const acao = dados.proximaAcao;

      const resposta = await fetch(
        "/api/admin/pedidos/entrega",
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
            acao,
            situacaoEsperada:
              dados.situacaoPedido,

            ...(acao === "enviar"
              ? {
                  transportadora,
                  codigoRastreamento: codigo,
                  urlRastreamento: link,
                }
              : {}),
          }),
        }
      );

      const corpo = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          corpo.erro ??
            "Não foi possível confirmar a alteração."
        );
      }

      if (
        corpo.pedidoId !== pedidoId ||
        typeof corpo.jaAplicado !== "boolean"
      ) {
        throw new Error(
          "Resultado inválido. Atualize a entrega."
        );
      }

      setMensagem(
        corpo.jaAplicado
          ? "Esta etapa já estava registrada. Nenhuma alteração foi repetida."
          : "Etapa registrada com sucesso."
      );

      setVersao((v) => v + 1);
      router.refresh();
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : "Atualize a entrega para conferir o resultado."
      );

      setDados(null);
    } finally {
      setEnviando(false);
      setConfirmar(false);
      trava.current = false;
    }
  }

  const ocupado =
    carregando || enviando;

  const botao = {
    padding: "14px 18px",
    background: "#171717",
    color: "#fff",
    border: "1px solid #171717",
    cursor: ocupado ? "wait" : "pointer",
    opacity: ocupado ? 0.6 : 1,
  } as const;

  const campo = {
    display: "block",
    boxSizing: "border-box",
    width: "100%",
    maxWidth: 520,
    padding: 12,
    margin: "6px 0 16px",
    font: "inherit",
  } as const;

  return (
    <section
      aria-label={
        `Gerenciar entrega do pedido ${pedidoId}`
      }
      style={{
        marginTop: 24,
        padding: 20,
        border: "1px solid #aaa",
        lineHeight: 1.7,
      }}
    >
      <h3 style={{ marginTop: 0 }}>
        Preparação e entrega
      </h3>

      {carregando && (
        <p role="status">
          Consultando entrega...
        </p>
      )}

      {erro && (
        <p role="alert">{erro}</p>
      )}

      {mensagem && (
        <p role="status">{mensagem}</p>
      )}

      {dados && (
        <div>
          <p>
            Pedido:{" "}
            {nomes[dados.situacaoPedido] ??
              "Em análise"}
            .
            <br />
            Entrega:{" "}
            {nomes[
              dados.situacaoEntrega ?? ""
            ] ?? "Em análise"}
            .
          </p>

          {dados.dataPostagem && (
            <p>
              Postagem registrada em{" "}
              {datas.format(
                new Date(dados.dataPostagem)
              )}
              .
            </p>
          )}

          {dados.dataEntrega && (
            <p>
              Entrega registrada em{" "}
              {datas.format(
                new Date(dados.dataEntrega)
              )}
              .
            </p>
          )}

          {dados.codigoRastreamento && (
            <p>
              Transportadora:{" "}
              {dados.transportadora}.
              <br />
              Rastreamento:{" "}
              {dados.codigoRastreamento}.
            </p>
          )}

          {dados.motivoBloqueio && (
            <p>{dados.motivoBloqueio}</p>
          )}

          {dados.proximaAcao === "enviar" && (
            <fieldset
              disabled={ocupado || confirmar}
              style={{
                border: 0,
                padding: 0,
                margin: "16px 0",
              }}
            >
              <legend>
                Dados do envio manual
              </legend>

              <label
                htmlFor={
                  `transportadora-${pedidoId}`
                }
              >
                Transportadora
              </label>

              <input
                id={
                  `transportadora-${pedidoId}`
                }
                value={transportadora}
                maxLength={100}
                onChange={(e) =>
                  setTransportadora(
                    e.target.value
                  )
                }
                style={campo}
              />

              <label
                htmlFor={`rastreio-${pedidoId}`}
              >
                Código de rastreamento
              </label>

              <input
                id={`rastreio-${pedidoId}`}
                value={codigo}
                maxLength={150}
                onChange={(e) =>
                  setCodigo(e.target.value)
                }
                style={campo}
              />

              <label
                htmlFor={
                  `link-rastreio-${pedidoId}`
                }
              >
                Link oficial de rastreamento
                (opcional, HTTPS)
              </label>

              <input
                id={
                  `link-rastreio-${pedidoId}`
                }
                type="url"
                value={link}
                maxLength={1000}
                onChange={(e) =>
                  setLink(e.target.value)
                }
                style={campo}
              />
            </fieldset>
          )}

          {dados.proximaAcao ? (
            confirmar ? (
              <div>
                <p>
                  {avisos[dados.proximaAcao]}
                </p>

                {dados.proximaAcao ===
                  "enviar" && (
                  <p>
                    Transportadora:{" "}
                    {transportadora}.
                    Código: {codigo}.
                  </p>
                )}

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <button
                    type="button"
                    style={botao}
                    disabled={ocupado}
                    onClick={() =>
                      void registrar()
                    }
                  >
                    {enviando
                      ? "REGISTRANDO..."
                      : "CONFIRMAR ETAPA"}
                  </button>

                  <button
                    type="button"
                    style={{
                      ...botao,
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
                style={botao}
                disabled={ocupado}
                onClick={() => {
                  if (
                    dados.proximaAcao ===
                      "enviar" &&
                    (
                      transportadora.trim()
                        .length < 2 ||
                      codigo.trim().length < 3
                    )
                  ) {
                    setErro(
                      "Preencha a transportadora e o código de rastreamento."
                    );
                    return;
                  }

                  setErro("");
                  setConfirmar(true);
                }}
              >
                {titulos[dados.proximaAcao]}
              </button>
            )
          ) : (
            !dados.motivoBloqueio && (
              <p>Pedido já entregue.</p>
            )
          )}
        </div>
      )}

      <button
        type="button"
        disabled={ocupado}
        style={{
          ...botao,
          color: "#171717",
          background: "transparent",
          marginTop: 16,
        }}
        onClick={() => {
          if (trava.current) return;

          trava.current = true;
          setErro("");
          setVersao((v) => v + 1);
        }}
      >
        ATUALIZAR ENTREGA
      </button>
    </section>
  );
}