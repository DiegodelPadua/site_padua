
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
        {/* RETORNO AO PRODUTO */}
        <Link
          href="/admin/produtos"
          style={{
            color: "#555555",
            textDecoration: "none",
            fontSize: "12px",
            fontWeight: 700,
          }}
        >
          ← VOLTAR AOS PRODUTOS
        </Link>

        {/* CABEÇALHO DA PÁGINA */}
        <header
          style={{
            marginTop: "32px",
            marginBottom: "36px",
          }}
        >
          <h1
            style={{
              fontSize: "clamp(40px, 6vw, 76px)",
              fontWeight: 800,
              letterSpacing: "-3px",
              lineHeight: 1,
              margin: "0 0 12px",
            }}
          >
            Variantes e estoque
          </h1>

          <p
            style={{
              color: "#666666",
              fontSize: "18px",
              margin: 0,
            }}
          >
            {produto
              ? `Produto: ${produto.nome}`
              : "Carregando produto..."}
          </p>
        </header>

        {/* INDICADORES */}
        <section
          aria-label="Indicadores de estoque"
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "20px",
          }}
        >
          <div style={estiloCartao}>
            <p
              style={{
                fontSize: "12px",
                margin: "0 0 8px",
              }}
            >
              VARIANTES
            </p>

            <strong
              style={{
                fontSize: "32px",
                display: "block",
              }}
            >
              {variantes.length}
            </strong>
          </div>

          <div style={estiloCartao}>
            <p
              style={{
                fontSize: "12px",
                margin: "0 0 8px",
              }}
            >
              UNIDADES EM ESTOQUE
            </p>

            <strong
              style={{
                fontSize: "32px",
                display: "block",
              }}
            >
              {estoqueTotal}
            </strong>
          </div>
        </section>

        {/* FORMULÁRIO DE CADASTRO */}
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
            Nova variante
          </h2>

          <form onSubmit={cadastrarVariante}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "20px",
              }}
            >
              <label>
                Tamanho
                <input
                  style={estiloCampo}
                  value={tamanho}
                  onChange={(evento) =>
                    setTamanho(evento.target.value)
                  }
                  placeholder="Ex.: M"
                  maxLength={30}
                  required
                />
              </label>

              <label>
                Cor
                <input
                  style={estiloCampo}
                  value={cor}
                  onChange={(evento) =>
                    setCor(evento.target.value)
                  }
                  placeholder="Ex.: Preto"
                  maxLength={60}
                  required
                />
              </label>

              <label>
                SKU
                <input
                  style={estiloCampo}
                  value={sku}
                  onChange={(evento) =>
                    setSku(evento.target.value)
                  }
                  placeholder="PAD-ESS-M-PRE"
                  maxLength={100}
                />
              </label>

              <label>
                Quantidade
                <input
                  type="number"
                  style={estiloCampo}
                  value={quantidade}
                  onChange={(evento) =>
                    setQuantidade(evento.target.value)
                  }
                  min={0}
                  step={1}
                  required
                />
              </label>
            </div>

            {/* MENSAGENS */}
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

            <button
              type="submit"
              disabled={salvando || salvandoEdicao || carregando}
              style={{
                background: "#171717",
                color: "#ffffff",
                padding: "16px 32px",
                border: "none",
                marginTop: "24px",
                fontWeight: 700,
                cursor:
                  salvando || carregando
                    ? "wait"
                    : "pointer",
                opacity:
                  salvando || carregando ? 0.6 : 1,
              }}
            >
              {salvando
                ? "SALVANDO..."
                : "CADASTRAR VARIANTE"}
            </button>
          </form>
        </section>

        {/* TABELA DE VARIANTES */}
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
            Variantes cadastradas ({variantes.length})
          </h2>

          {carregando ? (
            <p>Carregando variantes...</p>
          ) : variantes.length === 0 ? (
            <p style={{ color: "#666666" }}>
              Nenhuma variante cadastrada.
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
                    {[
                      "TAMANHO",
                      "COR",
                      "SKU",
                      "ESTOQUE",
                      "STATUS",
                      "AÇÕES",
                    ].map((titulo) => (
                      <th
                        key={titulo}
                        style={{
                          padding: "14px 12px",
                          borderBottom:
                            "2px solid #171717",
                          fontSize: "12px",
                        }}
                      >
                        {titulo}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {variantes.map((variante) => (
                    <tr key={variante.id}>
                      <td style={estiloCelula}>
                        {variante.tamanho}
                      </td>

                      <td style={estiloCelula}>
                        {variante.cor}
                      </td>

                      <td style={estiloCelula}>
                        {variante.sku || "—"}
                      </td>

                      <td style={estiloCelula}>
                        {variante.quantidade}
                      </td>

                      <td style={estiloCelula}>
                        <strong
                          style={{
                            fontSize: "12px",
                            color: variante.ativa
                              ? "#237a36"
                              : "#b42318",
                          }}
                        >
                          {variante.ativa
                            ? "ATIVA"
                            : "INATIVA"}
                        </strong>
                      </td>

                      <td style={estiloCelula}>
                        <button
                          type="button"
                          disabled={salvando || salvandoEdicao}
                          onClick={() => iniciarEdicao(variante)}
                          style={{
                            padding: "10px 16px",
                            background: "#171717",
                            color: "#fff",
                            border: "none",
                            fontWeight: 700,
                            cursor: "pointer",
                            opacity: salvando || salvandoEdicao ? 0.5 : 1,
                          }}
                        >
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

        {/* EDIÇÃO: preserva o cadastro e usa a API PATCH existente. */}
        {varianteEditando !== null && (
          <section
            aria-label="Editar variante"
            style={{ ...estiloCartao, marginTop: "32px" }}
          >
            <h2 style={{ fontSize: "26px", margin: "0 0 8px" }}>
              Editar variante #{varianteEditando}
            </h2>
            <p style={{ color: "#666", marginBottom: "24px" }}>
              Ajuste os dados e o estoque. Mudanças na quantidade serão
              registradas no histórico de movimentações.
            </p>
            <form onSubmit={salvarEdicao}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "20px",
              }}>
                <label>
                  Tamanho
                  <input style={estiloCampo} value={editTamanho}
                    onChange={(e) => setEditTamanho(e.target.value)}
                    maxLength={30} required disabled={salvandoEdicao} />
                </label>
                <label>
                  Cor
                  <input style={estiloCampo} value={editCor}
                    onChange={(e) => setEditCor(e.target.value)}
                    maxLength={60} required disabled={salvandoEdicao} />
                </label>
                <label>
                  SKU (opcional)
                  <input style={estiloCampo} value={editSku}
                    onChange={(e) => setEditSku(e.target.value)}
                    maxLength={100} disabled={salvandoEdicao} />
                </label>
                <label>
                  Quantidade em estoque
                  <input type="number" style={estiloCampo}
                    value={editQuantidade}
                    onChange={(e) => setEditQuantidade(e.target.value)}
                    min={0} max={2147483647} step={1} required
                    disabled={salvandoEdicao} />
                </label>
                <label>
                  Status da variante
                  <select style={estiloCampo} value={editAtiva ? "ativa" : "inativa"}
                    onChange={(e) => setEditAtiva(e.target.value === "ativa")}
                    disabled={salvandoEdicao}>
                    <option value="ativa">ATIVA</option>
                    <option value="inativa">INATIVA</option>
                  </select>
                </label>
              </div>
              {erro && <p role="alert" style={{ color: "#b91c1c", marginTop: 20 }}>{erro}</p>}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 24 }}>
                <button type="submit" disabled={salvandoEdicao || salvando}
                  style={{ background: "#171717", color: "#fff", border: "none",
                    padding: "16px 28px", fontWeight: 700, cursor: "pointer" }}>
                  {salvandoEdicao ? "SALVANDO..." : "SALVAR ALTERAÇÕES"}
                </button>
                <button type="button" onClick={cancelarEdicao}
                  disabled={salvandoEdicao}
                  style={{ background: "#fff", border: "1px solid #aaa",
                    padding: "16px 28px", fontWeight: 700, cursor: "pointer" }}>
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
