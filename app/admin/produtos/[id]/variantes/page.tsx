
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
              disabled={salvando || carregando}
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
