"use client";

import {
  useRef,
  useState,
} from "react";

import { useRouter } from "next/navigation";

export default function SincronizarPagamento({
  pedidoId,
}: {
  pedidoId: number;
}) {
  const router = useRouter();
  const trava = useRef(false);

  const [ocupado, setOcupado] =
    useState(false);

  const [aguardando, setAguardando] =
    useState(false);

  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] =
    useState("");

  async function consultar() {
    if (
      trava.current ||
      aguardando
    ) {
      return;
    }

    trava.current = true;
    setOcupado(true);
    setErro("");
    setMensagem("");

    try {
      const resposta = await fetch(
        "/api/admin/pedidos/sincronizar-pagamento",
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
          }),
        }
      );

      const dados =
        await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.erro ??
            "Não foi possível verificar o pagamento."
        );
      }

      if (
        dados.pedidoId !== pedidoId ||
        typeof dados.processado !==
          "boolean" ||
        typeof dados.confirmado !==
          "boolean" ||
        typeof dados.mensagem !==
          "string"
      ) {
        throw new Error(
          "Resultado inválido. Atualize o painel para conferir."
        );
      }

      setMensagem(dados.mensagem);

      setAguardando(
        dados.confirmado ||
        dados.exigeRevisao === true
      );

      router.refresh();
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : "Atualize o painel para conferir o resultado."
      );

      router.refresh();
    } finally {
      setOcupado(false);
      trava.current = false;
    }
  }

  return (
    <section
      aria-label="Verificar pagamento existente"
      style={{
        margin: "20px 0",
        lineHeight: 1.7,
      }}
    >
      <p>
        Consulta o pagamento já realizado
        e atualiza sua confirmação no site.
      </p>

      <button
        type="button"
        disabled={ocupado || aguardando}
        onClick={() =>
          void consultar()
        }
        style={{
          padding: "14px 18px",
          background: "#171717",
          color: "#fff",
          border: "1px solid #171717",
          cursor:
            ocupado ? "wait" : "pointer",
          opacity:
            ocupado || aguardando
              ? 0.6
              : 1,
        }}
      >
        {ocupado
          ? "VERIFICANDO..."
          : aguardando
            ? "ATUALIZANDO PAINEL..."
            : "VERIFICAR E ATUALIZAR PAGAMENTO"}
      </button>

      {erro && (
        <p role="alert">{erro}</p>
      )}

      {mensagem && (
        <p role="status">
          {mensagem}
        </p>
      )}
    </section>
  );
}