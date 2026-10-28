"use client";

import { useEffect, useState } from "react";

/* PÁDUA CULTURE — Categorias: preserva GET/POST e padroniza a interface. */
type Categoria = {
  id: number;
  nome: string;
  slug: string;
  ativa: boolean;
  criadoEm: string;
  atualizadoEm: string;
};

const cartao: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #ddd",
  padding: "clamp(20px, 3vw, 32px)",
};
const celula: React.CSSProperties = {
  padding: "16px 12px",
  borderBottom: "1px solid #eee",
  textAlign: "left",
  verticalAlign: "middle",
  fontSize: 14,
};
const botao: React.CSSProperties = {
  minWidth: 180,
  minHeight: 50,
  padding: "12px 24px",
  background: "#171717",
  color: "#fff",
  border: "none",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};

export default function AdminCategoriasPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nome, setNome] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  // Mantém a consulta à API existente.
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
        throw new Error(dados.erro || "Não foi possível carregar as categorias.");
      }
      setCategorias(dados.categorias || []);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao consultar categorias.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    void carregarCategorias();
  }, []);

  // Mantém o cadastro e a atualização da listagem após o POST.
  async function cadastrarCategoria(evento: React.FormEvent<HTMLFormElement>) {
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
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ nome: nomeCategoria }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(dados.erro || "Não foi possível cadastrar a categoria.");
      }
      setNome("");
      await carregarCategorias();
      setMensagem("Categoria cadastrada com sucesso!");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao cadastrar categoria.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f5f5f5", color: "#171717", padding: "40px clamp(12px, 3vw, 32px) 80px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ marginBottom: 36 }}>
          <h1 style={{ fontSize: "clamp(40px, 6vw, 76px)", fontWeight: 800, letterSpacing: "-3px", lineHeight: 1, margin: "0 0 12px" }}>
            Categorias
          </h1>
          <p style={{ color: "#666", fontSize: 18, margin: 0 }}>
            Organize as seções da loja e cadastre novas categorias de produtos.
          </p>
        </header>

        <section style={cartao}>
          <h2 style={{ fontSize: 26, margin: "0 0 24px" }}>Nova categoria</h2>
          <form onSubmit={cadastrarCategoria} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))", gap: 16, alignItems: "end" }}>
            <label style={{ display: "block", minWidth: 0 }}>
              <span style={{ display: "block", marginBottom: 8, fontSize: 14 }}>Nome da categoria</span>
              <input type="text" value={nome} onChange={(evento) => setNome(evento.target.value)} placeholder="Ex.: Calças" maxLength={100} required
                style={{ width: "100%", minHeight: 50, padding: "14px 16px", border: "1px solid #ccc", background: "#fff", fontSize: 16, boxSizing: "border-box" }} />
            </label>
            <button type="submit" disabled={salvando} style={{ ...botao, justifySelf: "start", opacity: salvando ? 0.6 : 1, cursor: salvando ? "wait" : "pointer" }}>
              {salvando ? "SALVANDO..." : "CADASTRAR"}
            </button>
          </form>
          {erro && <p role="alert" style={{ color: "#b91c1c", marginTop: 16 }}>{erro}</p>}
          {mensagem && <p role="status" style={{ color: "#15803d", marginTop: 16 }}>{mensagem}</p>}
        </section>

        <section style={{ ...cartao, marginTop: 32 }}>
          <h2 style={{ fontSize: 26, margin: "0 0 24px" }}>Categorias cadastradas ({categorias.length})</h2>
          {carregando ? <p>Carregando categorias...</p> : categorias.length === 0 ? (
            <p style={{ color: "#666" }}>Nenhuma categoria cadastrada.</p>
          ) : (
            <div style={{ width: "100%", overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 600, tableLayout: "fixed", borderCollapse: "collapse", textAlign: "left" }}>
                <colgroup>
                  <col style={{ width: "10%" }} />
                  <col style={{ width: "38%" }} />
                  <col style={{ width: "34%" }} />
                  <col style={{ width: "18%" }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: "2px solid #171717" }}>
                    {["ID", "NOME", "SLUG", "STATUS"].map((titulo) => (
                      <th key={titulo} scope="col" style={{ padding: "14px 12px", fontSize: 12, textAlign: "left" }}>{titulo}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {categorias.map((categoria) => (
                    <tr key={categoria.id}>
                      <td style={celula}>{categoria.id}</td>
                      <td style={{ ...celula, overflowWrap: "anywhere" }}><strong>{categoria.nome}</strong></td>
                      <td style={{ ...celula, overflowWrap: "anywhere" }}>{categoria.slug}</td>
                      <td style={celula}>
                        <strong style={{ fontSize: 12, color: categoria.ativa ? "#237a36" : "#b42318" }}>
                          {categoria.ativa ? "ATIVA" : "INATIVA"}
                        </strong>
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
