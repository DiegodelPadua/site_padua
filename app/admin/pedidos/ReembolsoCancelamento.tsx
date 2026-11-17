"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";

type Registro = {
  status: string;
  valor: string;
  confirmadoEm: string | null;
};

type Resultado = {
  solicitacaoId: number;
  pedidoId: number;

  status:
    | "PRONTO"
    | "CONSULTA_NECESSARIA"
    | "CONFIRMADO";

  valor: string;
  mensagem: string;
};

export default function ReembolsoCancelamento({
  solicitacaoId,
  reembolso,
}: {
  solicitacaoId: number;
  reembolso?: Registro | null;
}) {
  const router = useRouter();
  const trava = useRef(false);

  const [ocupado, setOcupado] =
    useState(false);

  const [confirmar, setConfirmar] =
    useState(false);

  const [resultado, setResultado] =
    useState<Resultado | null>(null);

  const [erro, setErro] = useState("");

  const [incerto, setIncerto] =
    useState(false);

  useEffect(() => {
    setResultado(null);
    setConfirmar(false);
    setIncerto(false);
    setErro("");
  }, [
    solicitacaoId,
    reembolso?.status,
    reembolso?.confirmadoEm,
  ]);

  async function executar(
    acao: "consultar" | "executar"
  ) {
    if (trava.current) return;

    if (
      acao === "executar" &&
      (
        !confirmar ||
        resultado?.status !== "PRONTO" ||
        incerto
      )
    ) {
      return;
    }

    trava.current = true;
    setOcupado(true);
    setErro("");

    try {
      const resposta = await fetch(
        "/api/admin/cancelamentos/reembolsar",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            solicitacaoId,
            acao,
          }),
        }
      );

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          typeof dados.erro === "string"
            ? dados.erro
            : "Não foi possível consultar o resultado."
        );
      }

      if (
        dados.solicitacaoId !==
          solicitacaoId ||
        ![
          "PRONTO",
          "CONSULTA_NECESSARIA",
          "CONFIRMADO",
        ].includes(dados.status) ||
        typeof dados.valor !== "string" ||
        !/^\d{1,8}\.\d{2}$/.test(
          dados.valor
        ) ||
        typeof dados.mensagem !== "string"
      ) {
        throw new Error(
          "Resposta incompleta. Consulte novamente."
        );
      }

      setResultado(dados);
      setIncerto(false);
      setConfirmar(false);

      if (dados.status !== "PRONTO") {
        router.refresh();
      }
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Consulte novamente para conferir o resultado."
      );

      setIncerto(true);
      setConfirmar(false);
      setResultado(null);
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }

  const confirmado =
    reembolso?.status === "CONFIRMADO" ||
    resultado?.status === "CONFIRMADO";

  const botao = {
    padding: "14px 18px",
    border: "1px solid #171717",
    background: "#171717",
    color: "#fff",
    cursor: ocupado ? "wait" : "pointer",
    opacity: ocupado ? 0.6 : 1,
  } as const;

  return (
    <section
      aria-label="Reembolso integral"
      style={{
        marginTop: 24,
        padding: 20,
        background: "#f5f5f5",
        border: "1px solid #ccc",
      }}
    >
      <h4 style={{ marginTop: 0 }}>
        Reembolso integral — ambiente de teste
      </h4>

      <p>
        O reembolso devolve o valor do pagamento.
        A reposição do produto depende da
        conferência física.
      </p>

      {confirmado ? (
        <p role="status">
          <strong>
            Reembolso integral confirmado pelo
            Mercado Pago.
          </strong>
        </p>
      ) : (
        <>
          <p>
            {reembolso || incerto
              ? "Consulte o resultado da tentativa antes de continuar."
              : "Confira o pagamento antes de solicitar a devolução."}
          </p>

          <button
            type="button"
            disabled={ocupado}
            style={botao}
            onClick={() =>
              void executar("consultar")
            }
          >
            {ocupado
              ? "AGUARDE..."
              : "CONSULTAR REEMBOLSO"}
          </button>
        </>
      )}

      {resultado && (
        <p role="status">
          {resultado.mensagem}
        </p>
      )}

      {erro && (
        <p role="alert">{erro}</p>
      )}

      {!confirmado &&
        !incerto &&
        resultado?.status === "PRONTO" && (
          <div>
            <p>
              <strong>
                Valor integral:{" "}
                {new Intl.NumberFormat(
                  "pt-BR",
                  {
                    style: "currency",
                    currency: "BRL",
                  }
                ).format(
                  Number(resultado.valor)
                )}
              </strong>
            </p>

            {confirmar ? (
              <>
                <p>
                  Confirmar a devolução integral
                  deste pagamento de teste? Depois
                  da confirmação do Mercado Pago,
                  o pedido será cancelado. O
                  estoque precisará ser conferido
                  separadamente.
                </p>

                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <button
                    type="button"
                    disabled={ocupado}
                    style={botao}
                    onClick={() =>
                      void executar("executar")
                    }
                  >
                    {ocupado
                      ? "ENVIANDO..."
                      : "CONFIRMAR REEMBOLSO DE TESTE"}
                  </button>

                  <button
                    type="button"
                    disabled={ocupado}
                    style={{
                      ...botao,
                      color: "#171717",
                      background: "transparent",
                    }}
                    onClick={() =>
                      setConfirmar(false)
                    }
                  >
                    VOLTAR
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                disabled={ocupado}
                style={botao}
                onClick={() =>
                  setConfirmar(true)
                }
              >
                REEMBOLSAR VALOR INTEGRAL
              </button>
            )}
          </div>
        )}
    </section>
  );
}