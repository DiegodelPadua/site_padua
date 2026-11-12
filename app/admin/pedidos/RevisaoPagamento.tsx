"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Revisao = {
  pedidoId: number;
  confirmado: boolean;
  podeConfirmar: boolean;
  pagamentoConferido: boolean;
  valorTotal: string;
  motivo: string;
};

export default function RevisaoPagamento({
  pedidoId,
}: {
  pedidoId: number;
}) {
  const router = useRouter();
  const trava = useRef(false);

  const [ocupado, setOcupado] = useState(false);
  const [revisao, setRevisao] =
    useState<Revisao | null>(null);
  const [erro, setErro] = useState("");

  async function executar(
    acao: "consultar" | "confirmar"
  ) {
    if (trava.current) return;

    if (
      acao === "confirmar" &&
      !revisao?.podeConfirmar
    ) {
      return;
    }

    trava.current = true;
    setOcupado(true);
    setErro("");
    setRevisao(null);

    try {
      const resposta = await fetch(
        "/api/admin/pedidos/revisar",
        {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pedidoId,
            acao,
          }),
        }
      );

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          typeof dados.erro === "string"
            ? dados.erro
            : "Não foi possível conferir o pedido."
        );
      }

      if (
        dados.pedidoId !== pedidoId ||
        dados.pagamentoConferido !== true ||
        typeof dados.motivo !== "string" ||
        typeof dados.podeConfirmar !== "boolean" ||
        typeof dados.confirmado !== "boolean" ||
        typeof dados.valorTotal !== "string"
      ) {
        throw new Error(
          "Resposta de revisão inválida. Atualize o painel antes de continuar."
        );
      }

      setRevisao(dados);

      if (dados.confirmado) {
        router.refresh();
      }
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível concluir a revisão. Atualize o painel para conferir."
      );
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }

  const estiloBotao = {
    padding: "14px 20px",
    border: "1px solid #171717",
    background: "#171717",
    color: "#fff",
    cursor: ocupado ? "wait" : "pointer",
  } as const;

  return (
    <section
      aria-label={`Revisão do pagamento do pedido ${pedidoId}`}
      style={{
        margin: "24px 0",
        borderTop: "1px solid #ddd",
        paddingTop: 20,
      }}
    >
      <button
        type="button"
        disabled={ocupado}
        onClick={() => void executar("consultar")}
        style={estiloBotao}
      >
        {ocupado
          ? "CONFERINDO..."
          : "REVISAR PAGAMENTO"}
      </button>

      {erro && (
        <p role="alert" style={{ lineHeight: 1.7 }}>
          {erro}
        </p>
      )}

      {revisao && (
        <div style={{ lineHeight: 1.7 }}>
          <p role="status">{revisao.motivo}</p>

          <p>
            Valor conferido:{" "}
            {new Intl.NumberFormat("pt-BR", {
              style: "currency",
              currency: "BRL",
            }).format(Number(revisao.valorTotal))}
            .
          </p>

          {revisao.podeConfirmar && (
            <>
              <p>
                Ao confirmar, você autoriza o atendimento
                deste pedido. O pagamento e o estoque
                serão conferidos novamente.
              </p>

              <button
                type="button"
                disabled={ocupado}
                onClick={() => void executar("confirmar")}
                style={estiloBotao}
              >
                CONFIRMAR PEDIDO APÓS REVISÃO
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}