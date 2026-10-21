
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

/* =========================================================
   PÁDUA CULTURE — GERENCIAMENTO DE IMAGENS

   - Consulta o produto e suas imagens no MySQL.
   - Envia imagens para a Hostinger.
   - Associa cada imagem ao produto.
   - Exibe a galeria e identifica a foto principal.

   APIs utilizadas:
   POST /api/admin/upload
   GET  /api/admin/produtos/[id]/imagens
   POST /api/admin/produtos/[id]/imagens
   ========================================================= */

type Produto = {
  id: number;
  nome: string;
  slug: string;
};

type ImagemProduto = {
  id: number;
  url: string;
  textoAlt: string | null;
  ordem: number;
  principal: boolean;
};

export default function AdminImagensPage() {
  const parametros = useParams<{ id: string }>();
  const produtoId = parametros.id;

  // Informações carregadas do MySQL.
  const [produto, setProduto] = useState<Produto | null>(null);
  const [imagens, setImagens] = useState<ImagemProduto[]>([]);

  // Controles da interface.
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [textoAlt, setTextoAlt] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  /* =======================================================
     CONSULTAR IMAGENS DO PRODUTO
     ======================================================= */

  const carregarImagens = useCallback(async () => {
    const resposta = await fetch(
      `/api/admin/produtos/${produtoId}/imagens`,
      { cache: "no-store" }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        dados.erro || "Não foi possível consultar as imagens."
      );
    }

    setProduto(dados.produto);
    setImagens(dados.imagens || []);
  }, [produtoId]);

  /* =======================================================
     CARREGAMENTO INICIAL
     ======================================================= */

  useEffect(() => {
    async function iniciar() {
      try {
        setCarregando(true);
        setErro("");
        await carregarImagens();
      } catch (error) {
        setErro(
          error instanceof Error
            ? error.message
            : "Erro ao carregar imagens."
        );
      } finally {
        setCarregando(false);
      }
    }

    void iniciar();
  }, [carregarImagens]);

  /* =======================================================
     ENVIAR E ASSOCIAR IMAGEM
     ======================================================= */

  async function enviarImagem(
    evento: React.FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();
    setErro("");
    setMensagem("");

    if (!arquivo) {
      setErro("Selecione uma imagem.");
      return;
    }

    // Confirma o tamanho antes de enviar ao servidor.
    if (arquivo.size === 0 || arquivo.size > 5 * 1024 * 1024) {
      setErro("A imagem deve ter até 5 MB.");
      return;
    }

    try {
      setEnviando(true);

      /* ETAPA 1 — Enviar arquivo para a Hostinger. */
      const formulario = new FormData();
      formulario.append("imagem", arquivo);

      const respostaUpload = await fetch("/api/admin/upload", {
        method: "POST",
        credentials: "same-origin",
        body: formulario,
      });

      const dadosUpload = await respostaUpload.json();

      if (!respostaUpload.ok) {
        throw new Error(
          dadosUpload.erro || "Falha ao enviar imagem."
        );
      }

      /* ETAPA 2 — Associar imagem ao produto no MySQL. */
      const respostaAssociacao = await fetch(
        `/api/admin/produtos/${produtoId}/imagens`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            arquivo: dadosUpload.arquivo,
            textoAlt: textoAlt.trim(),
          }),
        }
      );

      const dadosAssociacao = await respostaAssociacao.json();

      if (!respostaAssociacao.ok) {
        throw new Error(
          dadosAssociacao.erro ||
            "A imagem foi enviada, mas não pôde ser associada ao produto."
        );
      }

      // Limpa os campos após o cadastro.
      setArquivo(null);
      setTextoAlt("");

      // Limpa também o seletor visual de arquivos.
      const seletor = document.getElementById(
        "imagem-produto"
      ) as HTMLInputElement | null;

      if (seletor) {
        seletor.value = "";
      }

      setMensagem("Imagem cadastrada com sucesso!");

      // Atualiza a galeria com os registros do banco.
      await carregarImagens();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao enviar imagem."
      );
    } finally {
      setEnviando(false);
    }
  }

  /* =======================================================
     INTERFACE
     ======================================================= */

  return (
    <main
      style={{
        padding: "40px",
        minHeight: "100vh",
        backgroundColor: "#f5f5f5",
        color: "#171717",
      }}
    >
      <Link
        href="/admin/produtos"
        style={{
          color: "#171717",
          textDecoration: "underline",
          fontWeight: 700,
        }}
      >
        ← VOLTAR PARA PRODUTOS
      </Link>

      <h1
        style={{
          fontSize: "clamp(36px, 6vw, 68px)",
          fontWeight: 800,
          letterSpacing: "-2px",
          marginTop: "28px",
        }}
      >
        Gerenciar imagens
      </h1>

      <p style={{ color: "#666", fontSize: "18px" }}>
        {produto
          ? `Produto: ${produto.nome} (ID ${produto.id})`
          : "Carregando informações do produto..."}
      </p>

      {/* Mensagens de erro e sucesso. */}
      {erro && (
        <p role="alert" style={{ color: "#b91c1c", marginTop: "20px" }}>
          {erro}
        </p>
      )}

      {mensagem && (
        <p role="status" style={{ color: "#15803d", marginTop: "20px" }}>
          {mensagem}
        </p>
      )}

      {/* ===================================================
          FORMULÁRIO DE UPLOAD
          =================================================== */}

      <section
        style={{
          backgroundColor: "#fff",
          border: "1px solid #ddd",
          padding: "30px",
          marginTop: "30px",
        }}
      >
        <h2 style={{ fontSize: "26px", marginBottom: "22px" }}>
          Adicionar fotografia
        </h2>

        <form onSubmit={enviarImagem}>
          <label
            htmlFor="imagem-produto"
            style={{ display: "block", marginBottom: "10px" }}
          >
            Selecione uma imagem (JPG, PNG ou WebP, até 5 MB)
          </label>

          <input
            id="imagem-produto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(evento) =>
              setArquivo(evento.target.files?.[0] || null)
            }
            disabled={enviando}
            required
          />

          <label
            htmlFor="texto-alt"
            style={{
              display: "block",
              marginTop: "22px",
              marginBottom: "10px",
            }}
          >
            Descrição da imagem (opcional)
          </label>

          <input
            id="texto-alt"
            type="text"
            value={textoAlt}
            onChange={(evento) => setTextoAlt(evento.target.value)}
            maxLength={255}
            placeholder="Ex.: Camiseta Pádua Brazil — frente"
            style={{
              display: "block",
              width: "100%",
              maxWidth: "600px",
              padding: "14px",
              border: "1px solid #ccc",
              boxSizing: "border-box",
            }}
          />

          <button
            type="submit"
            disabled={enviando || carregando || !arquivo}
            style={{
              display: "block",
              marginTop: "24px",
              padding: "16px 28px",
              backgroundColor: "#171717",
              color: "#fff",
              border: "none",
              fontWeight: 700,
              opacity: enviando ? 0.6 : 1,
              cursor: enviando ? "wait" : "pointer",
            }}
          >
            {enviando ? "ENVIANDO..." : "ADICIONAR IMAGEM"}
          </button>
        </form>
      </section>

      {/* ===================================================
          GALERIA DO PRODUTO
          =================================================== */}

      <section
        style={{
          backgroundColor: "#fff",
          border: "1px solid #ddd",
          padding: "30px",
          marginTop: "30px",
        }}
      >
        <h2 style={{ fontSize: "26px", marginBottom: "24px" }}>
          Imagens cadastradas ({imagens.length})
        </h2>

        {carregando ? (
          <p>Carregando imagens...</p>
        ) : imagens.length === 0 ? (
          <p>Este produto ainda não possui fotografias cadastradas.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(180px, 1fr))",
              gap: "20px",
            }}
          >
            {imagens.map((imagem) => (
              <article
                key={imagem.id}
                style={{
                  border: "1px solid #ddd",
                  padding: "12px",
                }}
              >
                {/* A imagem é servida pela API pública da Pádua. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagem.url}
                  alt={imagem.textoAlt || produto?.nome || "Produto Pádua"}
                  style={{
                    width: "100%",
                    aspectRatio: "3 / 4",
                    objectFit: "cover",
                    backgroundColor: "#eee",
                  }}
                />

                <p style={{ marginTop: "12px", fontWeight: 700 }}>
                  {imagem.principal ? "FOTO PRINCIPAL" : "FOTO ADICIONAL"}
                </p>

                <p style={{ color: "#666", fontSize: "13px" }}>
                  Ordem: {imagem.ordem}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
