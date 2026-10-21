
"use client";

import { useEffect, useState } from "react";

/* =========================================================
   PÁDUA CULTURE — GERENCIAMENTO DE CATEGORIAS
   =========================================================
   - Consulta categorias no MySQL pela API.
   - Cadastra novas categorias.
   - Exibe o status das categorias.
   - Utiliza a navegação compartilhada do AdminLayout.
   ========================================================= */

type Categoria = {
  id: number;
  nome: string;
  slug: string;
  ativa: boolean;
  criadoEm: string;
  atualizadoEm: string;
};

// Estilos compartilhados com o padrão visual administrativo.
const estiloCartao: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #ddd",
  padding: "32px",
};

const estiloCelula: React.CSSProperties = {
  padding: "16px 12px",
  borderBottom: "1px solid #eee",
  fontSize: 14,
};

export default function AdminCategoriasPage() {
  // Dados reais retornados pelo MySQL.
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  // Campo de cadastro.
  const [nome, setNome] = useState("");

  // Estados da interface.
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  /* =======================================================
     CONSULTAR CATEGORIAS
     ======================================================= */

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

      setCategorias(dados.categorias || []);
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

  // Consulta as categorias quando a página é aberta.
  useEffect(() => {
    void carregarCategorias();
  }, []);

  /* =======================================================
     CADASTRAR NOVA CATEGORIA
     ======================================================= */

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

      // Reconsulta o MySQL após o cadastro.
      await carregarCategorias();

      setMensagem("Categoria cadastrada com sucesso!");
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

  /* =======================================================
     INTERFACE ADMINISTRATIVA
     ======================================================= */

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f5f5f5",
        color: "#171717",
        padding: "40px 24px 80px",
      }}
    >
      <div
        style={{
          maxWidth: "1200px",
          margin: "0 auto",
        }}
      >
        {/* CABEÇALHO DA PÁGINA */}
        <header style={{ marginBottom: "36px" }}>
          <h1
            style={{
              fontSize: "clamp(40px, 6vw, 76px)",
              fontWeight: 800,
              letterSpacing: "-3px",
              lineHeight: 1,
              margin: "0 0 12px",
            }}
          >
            Categorias
          </h1>

          <p
            style={{
              color: "#666",
              fontSize: "18px",
              margin: 0,
            }}
          >
            Organize as seções da loja e cadastre novas
            categorias de produtos.
          </p>
        </header>

        {/* FORMULÁRIO DE CADASTRO */}
        <section style={estiloCartao}>
          <h2
            style={{
              fontSize: "26px",
              margin: "0 0 24px",
            }}
          >
            Nova categoria
          </h2>

          <form
            onSubmit={cadastrarCategoria}
            style={{
              display: "flex",
              gap: "16px",
              flexWrap: "wrap",
              alignItems: "stretch",
            }}
          >
            <input
              type="text"
              value={nome}
              onChange={(evento) => setNome(evento.target.value)}
              placeholder="Ex.: Calças"
              maxLength={100}
              required
              aria-label="Nome da categoria"
              style={{
                flex: "1 1 240px",
                minWidth: 0,
                padding: "16px",
                border: "1px solid #ccc",
                background: "#fff",
                fontSize: "16px",
                boxSizing: "border-box",
              }}
            />

            <button
              type="submit"
              disabled={salvando}
              style={{
                padding: "16px 32px",
                background: "#171717",
                color: "#fff",
                border: "none",
                fontWeight: 700,
                cursor: salvando ? "wait" : "pointer",
                opacity: salvando ? 0.6 : 1,
              }}
            >
              {salvando ? "SALVANDO..." : "CADASTRAR"}
            </button>
          </form>

          {/* MENSAGENS DE ERRO E SUCESSO */}
          {erro && (
            <p
              role="alert"
              style={{
                color: "#b91c1c",
                marginTop: "16px",
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
                marginTop: "16px",
              }}
            >
              {mensagem}
            </p>
          )}
        </section>

        {/* LISTAGEM DAS CATEGORIAS */}
        <section
          style={{
            ...estiloCartao,
            marginTop: "32px",
          }}
        >
          <h2
            style={{
              fontSize: "26px",
              margin: "0 0 24px",
            }}
          >
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
                  <tr
                    style={{
                      borderBottom: "2px solid #171717",
                    }}
                  >
                    {["ID", "NOME", "SLUG", "STATUS"].map(
                      (titulo) => (
                        <th
                          key={titulo}
                          style={{
                            padding: "14px 12px",
                            fontSize: "12px",
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
                            fontSize: "12px",
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
