"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Consulta = {
  pedidoId: number;
  pagamentoId: number;
  orderId: string;
  statusNoSite: string;
  statusPedidoNoSite: string;
  statusMercadoPago: string;
  detalheMercadoPago: string | null;
  valorTotal: string;
  valorTotalPago: string | null;
  possuiAjustesFinanceiros: boolean;

  transacoes: Array<{
    status: string | null;
    detalhe: string | null;
    valorPago: string | null;
  }>;

  consultadoEm: string;
};

function moeda(valor: string | null) {
  if (valor === null) {
    return "Não informado pelo provedor";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valor));
}

export default function ConsultaCobranca({
  pedidoId,
}: {
  pedidoId: number;
}) {
  const trava = useRef(false);
  const router = useRouter();

  const [ocupado, setOcupado] = useState(false);
  const [consulta, setConsulta] =
    useState<Consulta | null>(null);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  const [confirmarExpiracao, setConfirmarExpiracao] =
    useState(false);

  async function consultar() {
    if (trava.current) return;

    trava.current = true;
    setOcupado(true);
    setConfirmarExpiracao(false);
    setMensagem("");
    setErro("");
    setConsulta(null);

    try {
      const resposta = await fetch(
        "/api/admin/pedidos/consultar",
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

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          typeof dados.erro === "string"
            ? dados.erro
            : "Não foi possível consultar a cobrança."
        );
      }

      if (
        dados.pedidoId !== pedidoId ||
        typeof dados.statusMercadoPago !== "string" ||
        !Array.isArray(dados.transacoes)
      ) {
        throw new Error(
          "Resposta de consulta inválida."
        );
      }

      setConsulta(dados);
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Não foi possível consultar a cobrança."
      );
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }
  async function conciliarExpiracao() {
    if (trava.current || !consulta) return;

    trava.current = true;
    setOcupado(true);
    setErro("");
    setMensagem("");

    try {
      const resposta = await fetch(
        "/api/admin/pedidos/conciliar-expirada",
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

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          typeof dados.erro === "string"
            ? dados.erro
            : "Não foi possível concluir a conciliação."
        );
      }

      if (
        dados.pedidoId !== pedidoId ||
        dados.conciliado !== true ||
        typeof dados.mensagem !== "string"
      ) {
        throw new Error(
          "Não foi possível confirmar o resultado. Atualize o painel para conferir."
        );
      }

      setMensagem(dados.mensagem);
      setConfirmarExpiracao(false);
      setConsulta(null);
      router.refresh();
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Atualize o painel para conferir o resultado antes de tentar novamente."
      );

      setConfirmarExpiracao(false);
      setConsulta(null);
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  }

  const podeConciliar =
    consulta !== null &&
    consulta.statusPedidoNoSite === "AGUARDANDO_PAGAMENTO" &&
    ["PENDENTE", "PROCESSANDO"].includes(
      consulta.statusNoSite
    ) &&
    ["canceled", "cancelled"].includes(
      consulta.statusMercadoPago
    ) &&
    consulta.detalheMercadoPago === "expired" &&
    consulta.transacoes.length === 0 &&
    !consulta.possuiAjustesFinanceiros &&
    (
      consulta.valorTotalPago === null ||
      Number(consulta.valorTotalPago) === 0
    );

  return (
    <section
      aria-label={`Consulta da cobrança do pedido ${pedidoId}`}
      style={{ margin: "24px 0" }}
    >
      <button
        type="button"
        disabled={ocupado}
        onClick={() => void consultar()}
        style={{
          padding: "14px 20px",
          background: "#171717",
          color: "#fff",
          border: "1px solid #171717",
          cursor: ocupado ? "wait" : "pointer",
        }}
      >
        {ocupado
          ? "CONSULTANDO..."
          : "CONSULTAR COBRANÇA"}
      </button>

      {mensagem && (
        <p role="status" style={{ lineHeight: 1.7 }}>
          {mensagem}
        </p>
      )}

      {erro && (
        <p role="alert" style={{ lineHeight: 1.7 }}>
          {erro}
        </p>
      )}

      {consulta && (
        <div
          role="status"
          style={{
            marginTop: 16,
            padding: 20,
            border: "1px solid #ddd",
            lineHeight: 1.8,
            overflowWrap: "anywhere",
          }}
        >
          <p>
            <strong>Consulta ao Mercado Pago</strong>
          </p>

          <p>
            Order: {consulta.orderId}
            <br />
            Pedido no site: {consulta.statusPedidoNoSite}
            <br />
            Pagamento no site: {consulta.statusNoSite}
            <br />
            Status no Mercado Pago:{" "}
            <strong>{consulta.statusMercadoPago}</strong>
            <br />
            Detalhe:{" "}
            {consulta.detalheMercadoPago ?? "Não informado"}
            <br />
            Valor da cobrança: {moeda(consulta.valorTotal)}
            <br />
            Valor pago informado:{" "}
            {moeda(consulta.valorTotalPago)}
            <br />
            Devoluções ou contestações na consulta:{" "}
            {consulta.possuiAjustesFinanceiros
              ? "Sim"
              : "Nenhuma informada"}
            <br />
            Quantidade de transações:{" "}
            {consulta.transacoes.length}
          </p>

          {consulta.transacoes.map(
            (transacao, indice) => (
              <p key={indice}>
                Transação {indice + 1}:{" "}
                {transacao.status ?? "Status não informado"}
                {" / "}
                {transacao.detalhe ?? "Detalhe não informado"}.
                {" "}Valor pago: {moeda(transacao.valorPago)}.
              </p>
            )
          )}

          <p>
            Consultado em{" "}
            {new Intl.DateTimeFormat("pt-BR", {
              dateStyle: "short",
              timeStyle: "medium",
              timeZone: "America/Sao_Paulo",
            }).format(new Date(consulta.consultadoEm))}
            {" "}(Brasília).
          </p>

          <p>
            Esta consulta não cancela a cobrança,
            não confirma o pedido e não libera estoque.
          </p>
        </div>
      )}

{podeConciliar && (
        <div
          style={{
            marginTop: 20,
            lineHeight: 1.7,
          }}
        >
          {confirmarExpiracao ? (
            <div
              role="group"
              aria-label="Confirmar conciliação da cobrança expirada"
            >
              <p>
                Ao confirmar, o servidor consultará a Order
                novamente. Se a expiração for confirmada e a
                reserva estiver íntegra, o pagamento será
                marcado como expirado, o pedido será cancelado
                e o estoque será devolvido.
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
                  disabled={ocupado}
                  onClick={() =>
                    void conciliarExpiracao()
                  }
                  style={{
                    padding: "14px 20px",
                    background: "#171717",
                    color: "#fff",
                    border: "1px solid #171717",
                    cursor: ocupado ? "wait" : "pointer",
                  }}
                >
                  {ocupado
                    ? "CONCILIANDO..."
                    : "CONFIRMAR CONCILIAÇÃO"}
                </button>

                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() =>
                    setConfirmarExpiracao(false)
                  }
                  style={{
                    padding: "14px 20px",
                    background: "transparent",
                    color: "#171717",
                    border: "1px solid #171717",
                    cursor: "pointer",
                  }}
                >
                  VOLTAR
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={ocupado}
              onClick={() =>
                setConfirmarExpiracao(true)
              }
              style={{
                padding: "14px 20px",
                background: "#171717",
                color: "#fff",
                border: "1px solid #171717",
                cursor: "pointer",
              }}
            >
              CONCILIAR COBRANÇA EXPIRADA
            </button>
          )}
        </div>
      )}

    </section>
  );
}