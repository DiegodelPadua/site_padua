import Link from "next/link";

export default function PaginaRetornoPagamento() {
  return (
    <main
      style={{
        minHeight: "80vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "64px 24px",
      }}
    >
      <section
        aria-labelledby="titulo-retorno"
        style={{
          width: "100%",
          maxWidth: 560,
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: "0 0 24px",
            fontSize: 11,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          Pádua Culture · Pagamento
        </p>

        <h1
          id="titulo-retorno"
          style={{
            margin: 0,
            fontSize: "clamp(28px, 5vw, 40px)",
            lineHeight: 1.15,
            fontWeight: 700,
            letterSpacing: "-0.03em",
          }}
        >
          Você voltou à Pádua.
        </h1>

        <p
          style={{
            margin: "24px 0 0",
            fontSize: 16,
            lineHeight: 1.75,
          }}
        >
          Consulte sua conta para acompanhar o pedido e a
          confirmação do pagamento.
        </p>

        <p
          style={{
            margin: "16px 0 0",
            fontSize: 14,
            lineHeight: 1.7,
            color: "#555",
          }}
        >
          O retorno a esta página não confirma a aprovação.
          O status do pedido depende da confirmação do Mercado Pago.
        </p>

        <Link
          href="/minha-conta"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 20,
            width: "100%",
            boxSizing: "border-box",
            minHeight: 64,
            marginTop: 36,
            padding: "20px 24px",
            backgroundColor: "#111",
            color: "#fff",
            border: "1px solid #111",
            textDecoration: "none",
            textAlign: "left",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          <span>Ir para minha conta</span>
          <span aria-hidden="true" style={{ fontSize: 24 }}>
            →
          </span>
        </Link>

        <Link
          href="/"
          style={{
            display: "inline-block",
            marginTop: 24,
            padding: "12px 8px",
            color: "#333",
            fontSize: 13,
            textDecoration: "underline",
            textUnderlineOffset: 4,
          }}
        >
          Voltar à loja
        </Link>
      </section>
    </main>
  );
}