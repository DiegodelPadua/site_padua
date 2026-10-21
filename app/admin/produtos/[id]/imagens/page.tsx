
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/* =========================================================
   PÁDUA CULTURE — GERENCIAMENTO DE IMAGENS

   Funcionalidades:
   - Consultar as imagens cadastradas.
   - Enviar imagens para a Hostinger.
   - Associar imagens ao produto no MySQL.
   - Definir a fotografia principal.
   - Alterar a ordem da galeria.
   - Excluir fotografias com confirmação.

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

type RespostaApi = {
  erro?: string;
  mensagem?: string;
  aviso?: boolean;
  arquivo?: string;
  produto?: Produto;
  imagens?: ImagemProduto[];
};

export default function AdminImagensPage() {
  const parametros = useParams<{ id: string }>();
  const produtoId = parametros.id;

  const seletorArquivo = useRef<HTMLInputElement>(null);

  // Dados recuperados do MySQL.
  const [produto, setProduto] = useState<Produto | null>(null);
  const [imagens, setImagens] = useState<ImagemProduto[]>([]);

  // Campos do formulário.
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [textoAlt, setTextoAlt] = useState("");

  // Estados da interface.
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [imagemEmOperacao, setImagemEmOperacao] =
    useState<number | null>(null);

  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  /* =======================================================
     CONSULTAR IMAGENS
     ======================================================= */

  const carregarImagens = useCallback(async () => {
    const resposta = await fetch(
      `/api/admin/produtos/${produtoId}/imagens`,
      {
        cache: "no-store",
        credentials: "same-origin",
      }
    );

    const dados: RespostaApi = await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        dados.erro || "Não foi possível consultar as imagens."
      );
    }

    setProduto(dados.produto || null);
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
     ENVIAR NOVA IMAGEM
     ======================================================= */

  async function enviarImagem(
    evento: React.FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();

    setErro("");
    setMensagem("");

    if (!arquivo) {
      setErro("Selecione uma fotografia.");
      return;
    }

    if (
      arquivo.size === 0 ||
      arquivo.size > 5 * 1024 * 1024
    ) {
      setErro("A imagem deve ter até 5 MB.");
      return;
    }

    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(arquivo.type)
    ) {
      setErro("Selecione uma imagem JPG, PNG ou WebP.");
      return;
    }

    try {
      setEnviando(true);

      // ETAPA 1 — Enviar o arquivo para a Hostinger.
      const formulario = new FormData();
      formulario.append("imagem", arquivo);

      const respostaUpload = await fetch(
        "/api/admin/upload",
        {
          method: "POST",
          credentials: "same-origin",
          body: formulario,
        }
      );

      const dadosUpload: RespostaApi =
        await respostaUpload.json();

      if (!respostaUpload.ok || !dadosUpload.arquivo) {
        throw new Error(
          dadosUpload.erro || "Falha no upload da fotografia."
        );
      }

      // ETAPA 2 — Associar o arquivo ao produto.
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

      const dadosAssociacao: RespostaApi =
        await respostaAssociacao.json();

      if (!respostaAssociacao.ok) {
        throw new Error(
          (dadosAssociacao.erro ||
            "Falha ao associar a imagem.") +
            " O arquivo já foi enviado ao servidor; " +
            "verifique o cadastro antes de tentar novamente."
        );
      }

      // Limpa os campos.
      setArquivo(null);
      setTextoAlt("");

      if (seletorArquivo.current) {
        seletorArquivo.current.value = "";
      }

      // Atualiza a galeria.
      await carregarImagens();

      setMensagem("Fotografia cadastrada com sucesso!");
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao enviar a imagem."
      );
    } finally {
      setEnviando(false);
    }
  }

  /* =======================================================
     ATUALIZAR IMAGEM
     ======================================================= */

  async function atualizarImagem(
    imagemId: number,
    acao: "definirPrincipal" | "alterarOrdem",
    direcao?: "subir" | "descer"
  ) {
    setErro("");
    setMensagem("");

    try {
      setImagemEmOperacao(imagemId);

      const resposta = await fetch(
        `/api/admin/produtos/${produtoId}/imagens/${imagemId}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            acao,
            ...(direcao ? { direcao } : {}),
          }),
        }
      );

      const dados: RespostaApi = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.erro || "Não foi possível atualizar a imagem."
        );
      }

      await carregarImagens();

      setMensagem(
        dados.mensagem || "Imagem atualizada com sucesso!"
      );
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao atualizar a imagem."
      );
    } finally {
      setImagemEmOperacao(null);
    }
  }

  /* =======================================================
     EXCLUIR IMAGEM
     ======================================================= */

  async function excluirImagem(imagem: ImagemProduto) {
    const confirmado = window.confirm(
      "Deseja realmente excluir esta fotografia?\n\n" +
        "O registro será removido do MySQL e o arquivo " +
        "também será removido da Hostinger.\n\n" +
        "Essa operação não poderá ser desfeita."
    );

    if (!confirmado) {
      return;
    }

    setErro("");
    setMensagem("");

    try {
      setImagemEmOperacao(imagem.id);

      const resposta = await fetch(
        `/api/admin/produtos/${produtoId}/imagens/${imagem.id}`,
        {
          method: "DELETE",
          credentials: "same-origin",
        }
      );

      const dados: RespostaApi = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.erro || "Não foi possível excluir a imagem."
        );
      }

      await carregarImagens();

      if (dados.aviso) {
        setErro(
          dados.mensagem ||
            "Imagem removida do cadastro, mas houve " +
              "um problema ao excluir o arquivo físico."
        );
      } else {
        setMensagem(
          dados.mensagem || "Imagem excluída com sucesso!"
        );
      }
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao excluir a imagem."
      );
    } finally {
      setImagemEmOperacao(null);
    }
  }

  /* =======================================================
     ORDENAR GALERIA PARA EXIBIÇÃO
     ======================================================= */

  // A posição da imagem é independente de ser principal.
  const imagensOrdenadas = [...imagens].sort(
    (a, b) => a.ordem - b.ordem || a.id - b.id
  );

  const operacaoEmAndamento =
    enviando || imagemEmOperacao !== null;

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
          : "Carregando produto..."}
      </p>

      {/* Mensagens do sistema. */}
      {erro && (
        <p
          role="alert"
          style={{
            color: "#b91c1c",
            marginTop: "20px",
          }}
        >
          {erro}
        </p>
      )}

      {mensagem && (
        <p
          role="status"
          style={{
            color: "#15803d",
            marginTop: "20px",
          }}
        >
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
        <h2 style={{ fontSize: "26px" }}>
          Adicionar fotografia
        </h2>

        <form onSubmit={enviarImagem}>
          <label
            htmlFor="imagem-produto"
            style={{
              display: "block",
              marginTop: "20px",
              marginBottom: "10px",
            }}
          >
            Selecione uma imagem (JPG, PNG ou WebP, até 5 MB)
          </label>

          <input
            ref={seletorArquivo}
            id="imagem-produto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(evento) =>
              setArquivo(evento.target.files?.[0] || null)
            }
            disabled={operacaoEmAndamento}
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
            onChange={(evento) =>
              setTextoAlt(evento.target.value)
            }
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
            disabled={
              operacaoEmAndamento ||
              carregando ||
              !arquivo
            }
            style={{
              marginTop: "24px",
              padding: "16px 28px",
              backgroundColor: "#171717",
              color: "#fff",
              border: "none",
              fontWeight: 700,
              cursor: operacaoEmAndamento
                ? "wait"
                : "pointer",
              opacity: operacaoEmAndamento ? 0.6 : 1,
            }}
          >
            {enviando
              ? "ENVIANDO..."
              : "ADICIONAR IMAGEM"}
          </button>
        </form>
      </section>

      {/* ===================================================
          GALERIA
          =================================================== */}

      <section
        style={{
          backgroundColor: "#fff",
          border: "1px solid #ddd",
          padding: "30px",
          marginTop: "30px",
        }}
      >
        <h2 style={{ fontSize: "26px", marginBottom: "12px" }}>
          Imagens cadastradas ({imagens.length})
        </h2>

        <p
          style={{
            color: "#666",
            marginBottom: "24px",
          }}
        >
          Escolha a foto principal e organize a sequência
          de apresentação do produto.
        </p>

        {carregando ? (
          <p>Carregando imagens...</p>
        ) : imagensOrdenadas.length === 0 ? (
          <p>
            Este produto ainda não possui fotografias cadastradas.
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(230px, 1fr))",
              gap: "20px",
            }}
          >
            {imagensOrdenadas.map((imagem, indice) => {
              const ocupada = operacaoEmAndamento;

              return (
                <article
                  key={imagem.id}
                  style={{
                    border: imagem.principal
                      ? "2px solid #171717"
                      : "1px solid #ddd",
                    padding: "14px",
                    backgroundColor: "#fff",
                  }}
                >
                  {/* Fotografia servida pela API pública. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagem.url}
                    alt={
                      imagem.textoAlt ||
                      produto?.nome ||
                      "Produto Pádua"
                    }
                    style={{
                      width: "100%",
                      aspectRatio: "3 / 4",
                      objectFit: "cover",
                      backgroundColor: "#eee",
                    }}
                  />

                  <p
                    style={{
                      fontWeight: 800,
                      marginTop: "12px",
                    }}
                  >
                    {imagem.principal
                      ? "★ FOTO PRINCIPAL"
                      : "FOTO ADICIONAL"}
                  </p>

                  <p
                    style={{
                      color: "#666",
                      fontSize: "13px",
                    }}
                  >
                    Posição na galeria: {indice + 1}
                  </p>

                  {imagem.textoAlt && (
                    <p
                      style={{
                        color: "#555",
                        fontSize: "13px",
                        marginTop: "8px",
                      }}
                    >
                      {imagem.textoAlt}
                    </p>
                  )}

                  {/* Definir imagem principal. */}
                  {!imagem.principal && (
                    <button
                      type="button"
                      disabled={ocupada}
                      onClick={() =>
                        void atualizarImagem(
                          imagem.id,
                          "definirPrincipal"
                        )
                      }
                      style={{
                        width: "100%",
                        padding: "12px",
                        marginTop: "14px",
                        backgroundColor: "#171717",
                        color: "#fff",
                        border: "none",
                        fontWeight: 700,
                        cursor: ocupada
                          ? "wait"
                          : "pointer",
                      }}
                    >
                      DEFINIR COMO PRINCIPAL
                    </button>
                  )}

                  {/* Controles de ordenação. */}
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      marginTop: "12px",
                    }}
                  >
                    <button
                      type="button"
                      disabled={ocupada || indice === 0}
                      onClick={() =>
                        void atualizarImagem(
                          imagem.id,
                          "alterarOrdem",
                          "subir"
                        )
                      }
                      style={{
                        flex: 1,
                        padding: "12px 8px",
                        border: "1px solid #ccc",
                        backgroundColor: "#f5f5f5",
                        cursor: "pointer",
                        opacity:
                          ocupada || indice === 0
                            ? 0.4
                            : 1,
                      }}
                    >
                      ← MOVER
                    </button>

                    <button
                      type="button"
                      disabled={
                        ocupada ||
                        indice === imagensOrdenadas.length - 1
                      }
                      onClick={() =>
                        void atualizarImagem(
                          imagem.id,
                          "alterarOrdem",
                          "descer"
                        )
                      }
                      style={{
                        flex: 1,
                        padding: "12px 8px",
                        border: "1px solid #ccc",
                        backgroundColor: "#f5f5f5",
                        cursor: "pointer",
                        opacity:
                          ocupada ||
                          indice === imagensOrdenadas.length - 1
                            ? 0.4
                            : 1,
                      }}
                    >
                      MOVER →
                    </button>
                  </div>

                  {/* Exclusão com confirmação. */}
                  <button
                    type="button"
                    disabled={ocupada}
                    onClick={() =>
                      void excluirImagem(imagem)
                    }
                    style={{
                      width: "100%",
                      padding: "12px",
                      marginTop: "12px",
                      border: "1px solid #b91c1c",
                      backgroundColor: "#fff",
                      color: "#b91c1c",
                      fontWeight: 700,
                      cursor: ocupada
                        ? "wait"
                        : "pointer",
                    }}
                  >
                    {imagemEmOperacao === imagem.id
                      ? "PROCESSANDO..."
                      : "EXCLUIR IMAGEM"}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
