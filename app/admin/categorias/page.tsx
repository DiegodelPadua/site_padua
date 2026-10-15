
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* =========================================================
   PÁDUA CULTURE — GERENCIAMENTO DE CATEGORIAS
   =========================================================
   - Consulta categorias pela API administrativa
   - Cadastra novas categorias
   - Exibe status de cada categoria
   - Utiliza a sessão autenticada do administrador
   ========================================================= */

type Categoria = {
  id: number;
  nome: string;
  slug: string;
  ativa: boolean;
  criadoEm: string;
  atualizadoEm: string;
};

export default function AdminCategoriasPage() {
  // Categorias retornadas pelo banco de dados.
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  // Nome digitado para cadastrar uma nova categoria.
  const [nome, setNome] = useState("");

  // Estados de carregamento e mensagens.
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  // =======================================================
  // CONSULTAR CATEGORIAS
  // =======================================================

  async function carregarCategorias() {
    setCarregando(true);
    setErro("");

    try {
      const resposta = await fetch("/api/admin/categorias", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.erro || "Não foi possível carregar as categorias."
        );
      }

      setCategorias(dados.categorias);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao consultar categorias."
      );
    } finally {
      setCarregando(false);
    }
  }

  // Carrega as categorias ao abrir a página.
  useEffect(() => {
    void carregarCategorias();
  }, []);

  // =======================================================
  // CADASTRAR NOVA CATEGORIA
  // =======================================================

  async function cadastrarCategoria(
    evento: React.FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();

    const nomeCategoria = nome.trim();

    if (!nomeCategoria) {
      setErro("Informe o nome da categoria.");
      return;
    }

    setSalvando(true);
    setErro("");
    setMensagem("");

    try {
      const resposta = await fetch("/api/admin/categorias", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          nome: nomeCategoria,
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.erro || "Não foi possível cadastrar a categoria."
        );
      }

      setNome("");
      setMensagem("Categoria cadastrada com sucesso!");

      // Atualiza a lista com os dados gravados no MySQL.
      await carregarCategorias();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro ao cadastrar categoria."
      );
    } finally {
      setSalvando(false);
    }
  }

  // =======================================================
  // INTERFACE ADMINISTRATIVA
  // =======================================================

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        color: "#171717",
        padding: "48px 24px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Navegação de retorno ao painel. */}
        <Link
          href="/admin"
          style={{
            color: "#555",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          ← VOLTAR AO PAINEL
        </Link>

        <header style={{ marginTop: 32, marginBottom: 36 }}>
          <p
            style={{
              fontSize: 12,
              letterSpacing: 3,
              fontWeight: 700,
            }}
          >
            PÁDUA CULTURE / ADMIN
          </p>

          <h1
            style={{
              fontSize: "clamp(32px, 5vw, 54px)",
              letterSpacing: -2,
              margin: "12px 0",
            }}
          >
            Categorias
          </h1>

          <p style={{ color: "#666", fontSize: 15 }}>
            Organize as seções da loja e cadastre novas
            categorias de produtos.
          </p>
        </header>

        {/* Formulário de cadastro. */}
        <section
          style={{
            background: "#fff",
            border: "1px solid #ddd",
            padding: 28,
            marginBottom: 28,
          }}
        >
          <h2 style={{ fontSize: 20, marginTop: 0 }}>
            Nova categoria
          </h2>

          <form
            onSubmit={cadastrarCategoria}
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <input
              type="text"
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              placeholder="Ex.: Calças"
              maxLength={100}
              required
              style={{
                flex: "1 1 240px",
                padding: "15px",
                border: "1px solid #ccc",
                fontSize: 15,
              }}
            />

            <button
              type="submit"
              disabled={salvando}
              style={{
                background: "#171717",
                color: "#fff",
                border: "none",
                padding: "15px 24px",
                fontWeight: 700,
                cursor: salvando ? "wait" : "pointer",
                opacity: salvando ? 0.6 : 1,
              }}
            >
              {salvando ? "SALVANDO..." : "CADASTRAR"}
            </button>
          </form>

          {mensagem && (
            <p role="status" style={{ color: "#237a36" }}>
              {mensagem}
            </p>
          )}

          {erro && (
            <p role="alert" style={{ color: "#b42318" }}>
              {erro}
            </p>
          )}
        </section>

        {/* Listagem das categorias cadastradas. */}
        <section
          style={{
            background: "#fff",
            border: "1px solid #ddd",
            padding: 28,
          }}
        >
          <h2 style={{ fontSize: 20, marginTop: 0 }}>
            Categorias cadastradas ({categorias.length})
          </h2>

          {carregando ? (
            <p>Carregando categorias...</p>
          ) : categorias.length === 0 ? (
            <p style={{ color: "#666" }}>
              Nenhuma categoria cadastrada.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  textAlign: "left",
                }}
              >
                <thead>
                  <tr>
                    {["ID", "NOME", "SLUG", "STATUS"].map(
                      (titulo) => (
                        <th
                          key={titulo}
                          style={{
                            padding: "16px 12px",
                            borderBottom: "2px solid #171717",
                            fontSize: 12,
                          }}
                        >
                          {titulo}
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {categorias.map((categoria) => (
                    <tr key={categoria.id}>
                      <td style={estiloCelula}>
                        {categoria.id}
                      </td>

                      <td style={estiloCelula}>
                        <strong>{categoria.nome}</strong>
                      </td>

                      <td style={estiloCelula}>
                        {categoria.slug}
                      </td>

                      <td style={estiloCelula}>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: categoria.ativa
                              ? "#237a36"
                              : "#b42318",
                          }}
                        >
                          {categoria.ativa
                            ? "ATIVA"
                            : "INATIVA"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

// Estilo compartilhado pelas células da tabela.
const estiloCelula: React.CSSProperties = {
  padding: "16px 12px",
  borderBottom: "1px solid #eee",
  fontSize: 14,
};
