import Link from "next/link";
import { redirect } from "next/navigation";

import {
  verificarAdministrador,
} from "../../../src/utils/adminAuth";

import {
  consultarPedidosAdministrativos,
} from "../../../src/repositories/pedidoRepository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const situacoes: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  CONFIRMADO: "Confirmado",
  EM_PREPARACAO: "Em preparação",
  ENVIADO: "Enviado",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
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
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const estiloLink = {
  display: "inline-block",
  padding: "12px 18px",
  border: "1px solid #171717",
  textDecoration: "none",
  fontSize: 12,
  fontWeight: 700,
} as const;

export default async function PedidosAdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    situacao?: string | string[];
    antesDe?: string | string[];
  }>;
}) {
  // Verifica a autorização antes de consultar os pedidos.
  const administrador = await verificarAdministrador();

  if (!administrador) {
    redirect("/login");
  }

  const parametros = await searchParams;

  const filtro =
    parametros.situacao === "cancelados"
      ? "cancelados"
      : parametros.situacao === "todos"
        ? "todos"
        : "ativos";

  let antesDe: number | undefined;

  if (parametros.antesDe !== undefined) {
    if (
      typeof parametros.antesDe !== "string" ||
      !/^[1-9]\d{0,9}$/.test(parametros.antesDe)
    ) {
      redirect(`/admin/pedidos?situacao=${filtro}`);
    }

    antesDe = Number(parametros.antesDe);

    if (antesDe > 2147483647) {
      redirect(`/admin/pedidos?situacao=${filtro}`);
    }
  }

  const registros = await consultarPedidosAdministrativos(
    filtro,
    antesDe
  );

  const pedidos = registros.slice(0, 20);
  const possuiMais = registros.length > 20;
  const ultimo = pedidos[pedidos.length - 1];

  return (
    <main
      style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "48px 24px",
      }}
    >
      <p style={{ fontSize: 11, letterSpacing: 2 }}>
        PÁDUA CULTURE / ADMIN
      </p>

      <h1
        style={{
          fontSize: "clamp(28px, 5vw, 40px)",
          margin: "16px 0",
        }}
      >
        PEDIDOS.
      </h1>

      <p style={{ lineHeight: 1.7 }}>
        Consulte compras e registros de cancelamento.
        Datas e horários de Brasília.
      </p>

      <nav
        aria-label="Filtrar pedidos"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          margin: "28px 0",
        }}
      >
        {(
          [
            ["ativos", "PEDIDOS"],
            ["cancelados", "CANCELADOS"],
            ["todos", "TODOS"],
          ] as const
        ).map(([valor, titulo]) => (
          <Link
            key={valor}
            href={`/admin/pedidos?situacao=${valor}`}
            aria-current={
              filtro === valor ? "page" : undefined
            }
            style={{
              ...estiloLink,
              background:
                filtro === valor ? "#171717" : "#fff",
              color:
                filtro === valor ? "#fff" : "#171717",
            }}
          >
            {titulo}
          </Link>
        ))}
      </nav>

      {pedidos.length === 0 && (
        <p>Nenhum pedido encontrado neste filtro.</p>
      )}

      {pedidos.map((pedido) => {
        const pagamento = pedido.pagamentos[0]?.status;

        const emRevisao =
          pagamento === "APROVADO" &&
          [
            "AGUARDANDO_PAGAMENTO",
            "CANCELADO",
          ].includes(pedido.status);

        return (
          <article
            key={pedido.id}
            style={{
              padding: "clamp(16px, 4vw, 28px)",
              background: "#fff",
              border: "1px solid #d5d5d5",
              marginBottom: 20,
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
              <h2 style={{ margin: 0 }}>
                Pedido #{pedido.id}
              </h2>

              <strong>
                {moeda.format(Number(pedido.valorTotal))}
              </strong>
            </header>

            <p>
              <time dateTime={pedido.criadoEm.toISOString()}>
                {data.format(pedido.criadoEm)}
              </time>
            </p>

            <p style={{ lineHeight: 1.7 }}>
              Cliente: {pedido.usuario.nome}{" "}
              {pedido.usuario.sobrenome}
              <br />
              {pedido.usuario.email}
            </p>

            <p style={{ fontWeight: 700 }}>
              Situação do pedido:{" "}
              {situacoes[pedido.status] ?? "Em análise"}
            </p>

            <p>
              Última tentativa de pagamento:{" "}
              {pagamento
                ? pagamentos[pagamento] ?? "Em análise"
                : "Não iniciada"}
              .
            </p>

            {emRevisao && (
              <p style={{ fontWeight: 700 }}>
                Pagamento aprovado — revisão necessária
                antes de atender ou reembolsar.
              </p>
            )}

            <details style={{ marginTop: 20 }}>
              <summary
                style={{
                  cursor: "pointer",
                  padding: "12px 0",
                }}
              >
                Ver produtos e histórico recente
              </summary>

              <ul style={{ lineHeight: 1.8 }}>
                {pedido.itens.map((item, indice) => (
                  <li key={indice}>
                    {item.quantidade} × {item.nomeProduto}
                    {" — "}
                    {item.cor} / {item.tamanho}
                  </li>
                ))}
              </ul>

              <h3>Últimos registros</h3>

              <ul style={{ lineHeight: 1.8 }}>
                {pedido.historico.map((registro, indice) => (
                  <li key={indice}>
                    <time
                      dateTime={registro.criadoEm.toISOString()}
                    >
                      {data.format(registro.criadoEm)}
                    </time>
                    {" — "}
                    {registro.descricao}
                  </li>
                ))}
              </ul>
            </details>
          </article>
        );
      })}

      <nav
        aria-label="Paginação dos pedidos"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginTop: 24,
        }}
      >
        {antesDe !== undefined && (
          <Link
            href={`/admin/pedidos?situacao=${filtro}`}
            style={{ ...estiloLink, color: "#171717" }}
          >
            MAIS RECENTES
          </Link>
        )}

        {possuiMais && ultimo && (
          <Link
            href={`/admin/pedidos?situacao=${filtro}&antesDe=${ultimo.id}`}
            style={{ ...estiloLink, color: "#171717" }}
          >
            VER PEDIDOS ANTERIORES
          </Link>
        )}
      </nav>
    </main>
  );
}