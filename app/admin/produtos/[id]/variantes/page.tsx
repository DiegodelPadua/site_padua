
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

  return (
    <main className="padua-variantes">
      {/* Estilos locais: não alteram outras páginas do painel. */}
      <style>{`
        .padua-variantes { min-height:100vh; background:#f5f5f5; color:#171717; padding:36px 24px 80px; box-sizing:border-box; }
        .pv-wrap { max-width:1200px; margin:0 auto; }
        .pv-back { display:inline-block; color:#555; text-decoration:none; font-size:12px; font-weight:700; letter-spacing:.05em; margin-bottom:24px; }
        .pv-header { margin-bottom:30px; }
        .pv-header h1 { font-size:clamp(34px,4.5vw,56px); font-weight:800; letter-spacing:-.045em; line-height:1.05; margin:0 0 10px; }
        .pv-header p { font-size:16px; color:#666; margin:0; }
        .pv-stats { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; margin-bottom:22px; }
        .pv-card { background:#fff; border:1px solid #ddd; padding:28px 30px; margin-bottom:22px; box-sizing:border-box; }
        .pv-stats .pv-card { margin:0; min-height:112px; }
        .pv-stat-label { font-size:12px; font-weight:700; letter-spacing:.045em; margin:0 0 10px; }
        .pv-stat-number { font-size:32px; font-weight:800; line-height:1; }
        .pv-card h2 { font-size:24px; line-height:1.2; letter-spacing:-.025em; margin:0 0 22px; }
        .pv-description { color:#666; font-size:14px; line-height:1.5; margin:-8px 0 24px; }
        .pv-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px 24px; }
        .pv-field { display:flex; flex-direction:column; gap:8px; min-width:0; font-size:14px; font-weight:600; }
        .pv-input { display:block; width:100%; min-width:0; height:48px; box-sizing:border-box; padding:0 14px; border:1px solid #ccc; border-radius:0; background:#fff; color:#171717; font:400 15px inherit; font-size:15px; }
        .pv-input:focus { outline:2px solid #171717; outline-offset:1px; }
        .pv-actions { display:flex; flex-wrap:wrap; gap:12px; margin-top:24px; }
        .pv-button { display:inline-flex; align-items:center; justify-content:center; min-width:200px; height:46px; padding:0 20px; box-sizing:border-box; border:1px solid #171717; background:#171717; color:#fff; font-size:12px; font-weight:700; cursor:pointer; text-align:center; }
        .pv-button.secondary { background:#fff; color:#171717; }
        .pv-button:disabled { opacity:.5; cursor:not-allowed; }
        .pv-message { margin:20px 0 0; font-size:14px; }
        .pv-message.error { color:#b91c1c; }
        .pv-message.success { color:#15803d; }
        .pv-table-wrap { width:100%; overflow-x:auto; }
        .pv-table { width:100%; min-width:690px; border-collapse:collapse; table-layout:fixed; text-align:left; }
        .pv-table th { font-size:12px; font-weight:700; padding:14px 12px; border-bottom:2px solid #171717; }
        .pv-table td { font-size:14px; padding:16px 12px; border-bottom:1px solid #eee; vertical-align:middle; overflow-wrap:anywhere; }
        .pv-table .pv-button { width:140px; min-width:0; height:42px; }
        .pv-status { font-size:12px; font-weight:700; }
        @media(max-width:640px) {
          .padua-variantes { padding:24px 14px 60px; }
          .pv-card { padding:22px 18px; }
          .pv-stats { gap:12px; }
          .pv-stats .pv-card { padding:20px 16px; }
          .pv-grid { grid-template-columns:1fr; gap:16px; }
          .pv-actions { flex-direction:column; }
          .pv-button { width:100%; }
          .pv-header h1 { font-size:36px; }
        }
      `}</style>
      <div className="pv-wrap">
        <Link href="/admin/produtos" className="pv-back">← VOLTAR AOS PRODUTOS</Link>
        <header className="pv-header">
          <h1>Variantes e estoque</h1>
          <p>{produto ? `Produto: ${produto.nome}` : "Carregando produto..."}</p>
        </header>

        {/* Indicadores: dois cartões com a mesma altura e proporção. */}
        <section className="pv-stats" aria-label="Indicadores de estoque">
          <div className="pv-card">
            <p className="pv-stat-label">VARIANTES</p>
            <strong className="pv-stat-number">{variantes.length}</strong>
          </div>
          <div className="pv-card">
            <p className="pv-stat-label">UNIDADES EM ESTOQUE</p>
            <strong className="pv-stat-number">{estoqueTotal}</strong>
          </div>
        </section>

        {/* Cadastro: dois campos por linha, com dimensões idênticas às da edição. */}
        <section className="pv-card">
          <h2>Nova variante</h2>
          <form onSubmit={cadastrarVariante}>
            <div className="pv-grid">
              <label className="pv-field">Tamanho
                <input className="pv-input" value={tamanho} onChange={(e) => setTamanho(e.target.value)} placeholder="Ex.: M" maxLength={30} required />
              </label>
              <label className="pv-field">Cor
                <input className="pv-input" value={cor} onChange={(e) => setCor(e.target.value)} placeholder="Ex.: Preto" maxLength={60} required />
              </label>
              <label className="pv-field">SKU (opcional)
                <input className="pv-input" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="PAD-BRA-M-PRE" maxLength={100} />
              </label>
              <label className="pv-field">Quantidade em estoque
                <input className="pv-input" type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} min={0} max={2147483647} step={1} required />
              </label>
            </div>
            {erro && <p className="pv-message error" role="alert">{erro}</p>}
            {mensagem && <p className="pv-message success" role="status">{mensagem}</p>}
            <div className="pv-actions">
              <button className="pv-button" type="submit" disabled={salvando || salvandoEdicao || carregando}>
                {salvando ? "SALVANDO..." : "CADASTRAR VARIANTE"}
              </button>
            </div>
          </form>
        </section>

        {/* Listagem: colunas fixas e rolagem horizontal em telas menores. */}
        <section className="pv-card">
          <h2>Variantes cadastradas ({variantes.length})</h2>
          {carregando ? (
            <p>Carregando variantes...</p>
          ) : variantes.length === 0 ? (
            <p style={{ color: "#666" }}>Nenhuma variante cadastrada.</p>
          ) : (
            <div className="pv-table-wrap">
              <table className="pv-table">
                <colgroup>
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "19%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "18%" }} />
                </colgroup>
                <thead><tr>
                  { ["TAMANHO", "COR", "SKU", "ESTOQUE", "STATUS", "AÇÕES"].map((titulo) => (
                    <th scope="col" key={titulo}>{titulo}</th>
                  )) }
                </tr></thead>
                <tbody>
                  {variantes.map((variante) => (
                    <tr key={variante.id}>
                      <td>{variante.tamanho}</td>
                      <td>{variante.cor}</td>
                      <td>{variante.sku || "—"}</td>
                      <td>{variante.quantidade}</td>
                      <td><strong className="pv-status" style={{ color: variante.ativa ? "#237a36" : "#b42318" }}>
                        {variante.ativa ? "ATIVA" : "INATIVA"}
                      </strong></td>
                      <td><button className="pv-button" type="button" disabled={salvando || salvandoEdicao} onClick={() => iniciarEdicao(variante)}>EDITAR</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Edição: mesma grade, altura de campos e botões do cadastro. */}
        {varianteEditando !== null && (
          <section className="pv-card" aria-label="Editar variante">
            <h2>Editar variante #{varianteEditando}</h2>
            <p className="pv-description">Ajuste os dados e o estoque. Mudanças na quantidade serão registradas no histórico de movimentações.</p>
            <form onSubmit={salvarEdicao}>
              <div className="pv-grid">
                <label className="pv-field">Tamanho
                  <input className="pv-input" value={editTamanho} onChange={(e) => setEditTamanho(e.target.value)} maxLength={30} required disabled={salvandoEdicao} />
                </label>
                <label className="pv-field">Cor
                  <input className="pv-input" value={editCor} onChange={(e) => setEditCor(e.target.value)} maxLength={60} required disabled={salvandoEdicao} />
                </label>
                <label className="pv-field">SKU (opcional)
                  <input className="pv-input" value={editSku} onChange={(e) => setEditSku(e.target.value)} maxLength={100} disabled={salvandoEdicao} />
                </label>
                <label className="pv-field">Quantidade em estoque
                  <input className="pv-input" type="number" value={editQuantidade} onChange={(e) => setEditQuantidade(e.target.value)} min={0} max={2147483647} step={1} required disabled={salvandoEdicao} />
                </label>
                <label className="pv-field">Status da variante
                  <select className="pv-input" value={editAtiva ? "ativa" : "inativa"} onChange={(e) => setEditAtiva(e.target.value === "ativa")} disabled={salvandoEdicao}>
                    <option value="ativa">ATIVA</option>
                    <option value="inativa">INATIVA</option>
                  </select>
                </label>
              </div>
              {erro && <p className="pv-message error" role="alert">{erro}</p>}
              <div className="pv-actions">
                <button className="pv-button" type="submit" disabled={salvandoEdicao || salvando}>
                  {salvandoEdicao ? "SALVANDO..." : "SALVAR ALTERAÇÕES"}
                </button>
                <button className="pv-button secondary" type="button" onClick={cancelarEdicao} disabled={salvandoEdicao}>CANCELAR</button>
              </div>
            </form>
          </section>
        )}
      </div>
    </main>
  );
}
