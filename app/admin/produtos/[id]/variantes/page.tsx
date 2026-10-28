
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

/* =========================================================
   PÁDUA CULTURE — VARIANTES E ESTOQUE

   Preserva:
   - Consulta das variantes pelo MySQL.
   - Cadastro de tamanho, cor, SKU e quantidade.
   - Indicadores de variantes e estoque.
   - Listagem e status das variantes.

   Utiliza a navegação global do AdminLayout.
   ========================================================= */

type Variante = {
  id: number;
  tamanho: string;
  cor: string;
  sku: string | null;
  quantidade: number;
  ativa: boolean;
};

type Produto = {
  id: number;
  nome: string;
};

// Padrão visual compartilhado com Produtos e Categorias.
const estiloCartao: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #dddddd",
  padding: "clamp(20px, 3vw, 32px)",
};

const estiloCampo: React.CSSProperties = {
  display: "block",
  width: "100%",
  padding: "14px",
  marginTop: "8px",
  border: "1px solid #cccccc",
  background: "#ffffff",
  boxSizing: "border-box",
  fontSize: "16px",
};

const estiloCelula: React.CSSProperties = {
  padding: "16px 12px",
  borderBottom: "1px solid #eeeeee",
  fontSize: "14px",
};

export default function AdminVariantesPage() {
  const params = useParams<{ id: string }>();
  const produtoId = params.id;

  // Dados reais do produto e das variantes.
  const [produto, setProduto] = useState<Produto | null>(null);
  const [variantes, setVariantes] = useState<Variante[]>([]);

  // Campos do formulário.
  const [tamanho, setTamanho] = useState("");
  const [cor, setCor] = useState("");
  const [sku, setSku] = useState("");
  const [quantidade, setQuantidade] = useState("0");

  // Estados da interface.
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");

  // Edição independente do formulário de cadastro.
  const [varianteEditando, setVarianteEditando] = useState<number | null>(null);
  const [editTamanho, setEditTamanho] = useState("");
  const [editCor, setEditCor] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editQuantidade, setEditQuantidade] = useState("0");
  const [editAtiva, setEditAtiva] = useState(true);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  /* =======================================================
     CONSULTAR VARIANTES
     ======================================================= */

  const carregarVariantes = useCallback(async () => {
    const resposta = await fetch(
      `/api/admin/produtos/${produtoId}/variantes`,
      {
        cache: "no-store",
        credentials: "same-origin",
      }
    );

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(
        dados.erro || "Não foi possível carregar as variantes."
      );
    }

    setProduto(dados.produto);
    setVariantes(dados.variantes);
  }, [produtoId]);

  // Consulta o banco ao acessar a página.
  useEffect(() => {
    async function iniciar() {
      try {
        setCarregando(true);
        setErro("");
        await carregarVariantes();
      } catch (error) {
        setErro(
          error instanceof Error
            ? error.message
            : "Erro ao carregar dados."
        );
      } finally {
        setCarregando(false);
      }
    }

    void iniciar();
  }, [carregarVariantes]);

  /* =======================================================
     CADASTRAR NOVA VARIANTE
     ======================================================= */

  async function cadastrarVariante(
    evento: React.FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();

    setErro("");
    setMensagem("");

    const quantidadeNumero = Number(quantidade);

    if (
      !Number.isSafeInteger(quantidadeNumero) ||
      quantidadeNumero < 0
    ) {
      setErro("Informe uma quantidade inteira não negativa.");
      return;
    }

    try {
      setSalvando(true);

      const resposta = await fetch(
        `/api/admin/produtos/${produtoId}/variantes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "same-origin",
          body: JSON.stringify({
            tamanho: tamanho.trim(),
            cor: cor.trim(),
            sku: sku.trim() || null,
            quantidade: quantidadeNumero,
          }),
        }
      );

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.erro || "Não foi possível cadastrar a variante."
        );
      }

      // Limpa o formulário após cadastrar.
      setTamanho("");
      setCor("");
      setSku("");
      setQuantidade("0");

      // Atualiza a listagem com os registros do MySQL.
      await carregarVariantes();

      setMensagem("Variante cadastrada com sucesso!");
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao cadastrar variante."
      );
    } finally {
      setSalvando(false);
    }
  }

  /* =======================================================
      EDITAR VARIANTE EXISTENTE
      ======================================================= */

  function iniciarEdicao(variante: Variante) {
    setErro("");
    setMensagem("");
    setVarianteEditando(variante.id);
    setEditTamanho(variante.tamanho);
    setEditCor(variante.cor);
    setEditSku(variante.sku || "");
    setEditQuantidade(String(variante.quantidade));
    setEditAtiva(variante.ativa);
  }

  function cancelarEdicao() {
    if (salvandoEdicao) return;
    setVarianteEditando(null);
    setErro("");
  }

  async function salvarEdicao(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (varianteEditando === null || salvandoEdicao) return;

    setErro("");
    setMensagem("");

    // Não permitir campo vazio, decimal, negativo ou valor acima do INT do MySQL.
    const valor = editQuantidade.trim();
    const quantidadeNumero = Number(valor);
    if (!/^\d+$/.test(valor) || !Number.isSafeInteger(quantidadeNumero) ||
        quantidadeNumero > 2147483647) {
      setErro("Informe uma quantidade inteira entre 0 e 2147483647.");
      return;
    }
    if (!editTamanho.trim() || !editCor.trim()) {
      setErro("Tamanho e cor são obrigatórios.");
      return;
    }

    try {
      setSalvandoEdicao(true);
      const resposta = await fetch(
        `/api/admin/produtos/${produtoId}/variantes/${varianteEditando}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tamanho: editTamanho.trim(),
            cor: editCor.trim(),
            sku: editSku.trim() || null,
            quantidade: quantidadeNumero,
            ativa: editAtiva,
          }),
        }
      );
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(dados.erro || "Não foi possível atualizar a variante.");
      }

      // O backend registra a movimentação de estoque; a tela apenas recarrega.
      setVarianteEditando(null);
      await carregarVariantes();
      setMensagem(dados.mensagem || "Variante atualizada com sucesso!");
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Erro ao editar variante.");
    } finally {
      setSalvandoEdicao(false);
    }
  }

  /* =======================================================
     INDICADORES
     ======================================================= */

  const estoqueTotal = variantes.reduce(
    (total, variante) => total + variante.quantidade,
    0
  );

  // Layout compartilhado entre cadastro e edição, sem alterar as APIs.
  const botaoBase: React.CSSProperties = {
    minHeight: 46, minWidth: 190, padding: "12px 22px", fontSize: 12,
    fontWeight: 800, letterSpacing: "0.025em", cursor: "pointer",
    borderRadius: 0, boxSizing: "border-box", textAlign: "center",
  };
  const tituloSecao: React.CSSProperties = {
    margin: 0, fontSize: "clamp(21px, 2.6vw, 28px)",
    letterSpacing: "-0.035em", lineHeight: 1.2,
  };
  const gradeCampos: React.CSSProperties = {
    display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 18, alignItems: "end",
  };
  const rotulo: React.CSSProperties = {
    display: "block", fontSize: 13, fontWeight: 600, minWidth: 0,
  };

  return (
    <main style={{ minHeight: "100vh", background: "#f5f5f5", color: "#171717", padding: "clamp(20px, 4vw, 48px) clamp(16px, 3vw, 32px) 80px" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        {/* Navegação e título padronizados com o restante do painel. */}
        <Link href="/admin/produtos" style={{ color: "#555", textDecoration: "none", fontSize: 12, fontWeight: 700, letterSpacing: "0.035em" }}>
          ← VOLTAR AOS PRODUTOS
        </Link>
        <header style={{ margin: "30px 0 32px" }}>
          <h1 style={{ fontSize: "clamp(36px, 5.5vw, 64px)", fontWeight: 800, letterSpacing: "-0.055em", lineHeight: 1.04, margin: "0 0 12px" }}>
            Variantes e estoque
          </h1>
          <p style={{ color: "#666", fontSize: 16, margin: 0 }}>
            {produto ? `Produto: ${produto.nome}` : "Carregando produto..."}
          </p>
        </header>

        {/* Indicadores com dimensões iguais. */}
        <section aria-label="Indicadores de estoque" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <div style={{ ...estiloCartao, minHeight: 128, boxSizing: "border-box" }}>
            <p style={{ fontSize: 12, fontWeight: 700, margin: "0 0 10px" }}>VARIANTES</p>
            <strong style={{ fontSize: 36, lineHeight: 1 }}>{variantes.length}</strong>
          </div>
          <div style={{ ...estiloCartao, minHeight: 128, boxSizing: "border-box" }}>
            <p style={{ fontSize: 12, fontWeight: 700, margin: "0 0 10px" }}>UNIDADES EM ESTOQUE</p>
            <strong style={{ fontSize: 36, lineHeight: 1 }}>{estoqueTotal}</strong>
          </div>
        </section>

        {/* Cadastro: mantém a chamada POST e suas validações existentes. */}
        <section style={{ ...estiloCartao, marginTop: 24 }}>
          <h2 style={{ ...tituloSecao, marginBottom: 24 }}>Nova variante</h2>
          <form onSubmit={cadastrarVariante}>
            <div style={gradeCampos}>
              <label style={rotulo}>Tamanho
                <input style={estiloCampo} value={tamanho} onChange={(e) => setTamanho(e.target.value)} placeholder="Ex.: M" maxLength={30} required disabled={salvando} />
              </label>
              <label style={rotulo}>Cor
                <input style={estiloCampo} value={cor} onChange={(e) => setCor(e.target.value)} placeholder="Ex.: Preto" maxLength={60} required disabled={salvando} />
              </label>
              <label style={rotulo}>SKU (opcional)
                <input style={estiloCampo} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="PAD-BRA-M-PRE" maxLength={100} disabled={salvando} />
              </label>
              <label style={rotulo}>Quantidade
                <input type="number" style={estiloCampo} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} min={0} max={2147483647} step={1} required disabled={salvando} />
              </label>
            </div>
            <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 12 }}>
              <button type="submit" disabled={salvando || salvandoEdicao || carregando} style={{ ...botaoBase, background: "#171717", color: "#fff", border: "1px solid #171717", opacity: salvando || salvandoEdicao || carregando ? 0.55 : 1 }}>
                {salvando ? "SALVANDO..." : "CADASTRAR VARIANTE"}
              </button>
            </div>
          </form>
        </section>

        {/* Mensagens compartilhadas: exibidas apenas uma vez na página. */}
        {erro && <p role="alert" style={{ padding: "14px 18px", background: "#fff0f0", border: "1px solid #e6b4b4", color: "#a21b1b", margin: "20px 0 0" }}>{erro}</p>}
        {mensagem && <p role="status" style={{ padding: "14px 18px", background: "#edf8ee", border: "1px solid #a9d7b0", color: "#216b30", margin: "20px 0 0" }}>{mensagem}</p>}

        {/* Tabela com colunas de largura controlada e rolagem em telas estreitas. */}
        <section style={{ ...estiloCartao, marginTop: 24 }}>
          <h2 style={{ ...tituloSecao, marginBottom: 24 }}>Variantes cadastradas ({variantes.length})</h2>
          {carregando ? (
            <p>Carregando variantes...</p>
          ) : variantes.length === 0 ? (
            <p style={{ color: "#666" }}>Nenhuma variante cadastrada.</p>
          ) : (
            <div style={{ width: "100%", overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 670, borderCollapse: "collapse", tableLayout: "fixed", textAlign: "left" }}>
                <colgroup>
                  <col style={{ width: "13%" }} /><col style={{ width: "18%" }} />
                  <col style={{ width: "24%" }} /><col style={{ width: "14%" }} />
                  <col style={{ width: "14%" }} /><col style={{ width: "17%" }} />
                </colgroup>
                <thead><tr>
                  {["TAMANHO", "COR", "SKU", "ESTOQUE", "STATUS", "AÇÕES"].map((titulo) => (
                    <th key={titulo} scope="col" style={{ padding: "14px 10px", borderBottom: "2px solid #171717", fontSize: 11, fontWeight: 800 }}>{titulo}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {variantes.map((variante) => (
                    <tr key={variante.id}>
                      <td style={estiloCelula}>{variante.tamanho}</td>
                      <td style={{ ...estiloCelula, overflowWrap: "anywhere" }}>{variante.cor}</td>
                      <td style={{ ...estiloCelula, overflowWrap: "anywhere" }}>{variante.sku || "—"}</td>
                      <td style={estiloCelula}>{variante.quantidade}</td>
                      <td style={estiloCelula}><strong style={{ fontSize: 11, color: variante.ativa ? "#237a36" : "#b42318" }}>{variante.ativa ? "ATIVA" : "INATIVA"}</strong></td>
                      <td style={estiloCelula}>
                        <button type="button" disabled={salvando || salvandoEdicao} onClick={() => iniciarEdicao(variante)} style={{ ...botaoBase, minWidth: 0, width: "100%", minHeight: 42, padding: "10px 8px", background: "#171717", color: "#fff", border: "1px solid #171717", opacity: salvando || salvandoEdicao ? 0.5 : 1 }}>
                          EDITAR
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Edição: mantém PATCH, alteração de status e histórico de estoque. */}
        {varianteEditando !== null && (
          <section aria-label="Editar variante" style={{ ...estiloCartao, marginTop: 24, borderTop: "3px solid #171717" }}>
            <h2 style={{ ...tituloSecao, marginBottom: 8 }}>Editar variante #{varianteEditando}</h2>
            <p style={{ color: "#666", fontSize: 14, lineHeight: 1.5, margin: "0 0 24px" }}>
              Ajuste os dados e o estoque. Mudanças na quantidade serão registradas no histórico de movimentações.
            </p>
            <form onSubmit={salvarEdicao}>
              <div style={gradeCampos}>
                <label style={rotulo}>Tamanho
                  <input style={estiloCampo} value={editTamanho} onChange={(e) => setEditTamanho(e.target.value)} maxLength={30} required disabled={salvandoEdicao} />
                </label>
                <label style={rotulo}>Cor
                  <input style={estiloCampo} value={editCor} onChange={(e) => setEditCor(e.target.value)} maxLength={60} required disabled={salvandoEdicao} />
                </label>
                <label style={rotulo}>SKU (opcional)
                  <input style={estiloCampo} value={editSku} onChange={(e) => setEditSku(e.target.value)} maxLength={100} disabled={salvandoEdicao} />
                </label>
                <label style={rotulo}>Quantidade em estoque
                  <input type="number" style={estiloCampo} value={editQuantidade} onChange={(e) => setEditQuantidade(e.target.value)} min={0} max={2147483647} step={1} required disabled={salvandoEdicao} />
                </label>
                <label style={rotulo}>Status da variante
                  <select style={estiloCampo} value={editAtiva ? "ativa" : "inativa"} onChange={(e) => setEditAtiva(e.target.value === "ativa")} disabled={salvandoEdicao}>
                    <option value="ativa">ATIVA</option><option value="inativa">INATIVA</option>
                  </select>
                </label>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
                <button type="submit" disabled={salvandoEdicao || salvando} style={{ ...botaoBase, background: "#171717", color: "#fff", border: "1px solid #171717", opacity: salvandoEdicao || salvando ? 0.55 : 1 }}>
                  {salvandoEdicao ? "SALVANDO..." : "SALVAR ALTERAÇÕES"}
                </button>
                <button type="button" onClick={cancelarEdicao} disabled={salvandoEdicao} style={{ ...botaoBase, background: "#fff", color: "#171717", border: "1px solid #aaa", opacity: salvandoEdicao ? 0.55 : 1 }}>
                  CANCELAR
                </button>
              </div>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
