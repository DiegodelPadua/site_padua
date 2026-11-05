import Link from "next/link";

export default function PaginaRetornoPagamento() {
  return (
    <main style={{
      minHeight: "70vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "48px 24px",
      textAlign: "center"
    }}>
      <section style={{ maxWidth: 520 }}>
        <h1>Pagamento não concluído</h1>
        <p style={{ marginTop: 20, lineHeight: 1.7 }}>
          Não foi possível concluir o pagamento. Você poderá tentar novamente após verificar seu pedido.
        </p>
        <p style={{ marginTop: 16, fontSize: 14 }}>
          O status definitivo depende da confirmação do Mercado Pago.
        </p>
        <Link
          href="/minha-conta"
          style={{ display: "inline-block", marginTop: 32 }}
        >
          Voltar para minha conta
        </Link>
      </section>
    </main>
  );
}
