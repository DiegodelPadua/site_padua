
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

// Estruturas dos dados recebidos das APIs.
type Categoria = {
  id: number;
  nome: string;
  ativa: boolean;
};

type Produto = {
  id: number;
  nome: string;
  descricao: string | null;
  preco: string;
  ativo: boolean;
  categoria: {
    id: number;
    nome: string;
  };
};

export default function AdminProdutosPage() {
  // Dados carregados do MySQL por meio das APIs.
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);

  // Campos do formulário.
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [preco, setPreco] = useState("");
  const [categoriaId, setCategoriaId] = useState("");

  // Controle da interface.
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  // Busca as categorias cadastradas.
  const carregarCategorias = useCallback(async () => {
    const resposta = await fetch("/api/admin/categorias", {
      cache: "no-store",
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.erro || "Erro ao buscar categorias.");
    }

    setCategorias(
      (dados.categorias || []).filter(
        (categoria: Categoria) => categoria.ativa
      )
    );
  }, []);

  // Busca os produtos cadastrados.
  const carregarProdutos = useCallback(async () => {
    const resposta = await fetch("/api/admin/produtos", {
      cache: "no-store",
    });

    const dados = await resposta.json();

    if (!resposta.ok) {
      throw new Error(dados.erro || "Erro ao buscar produtos.");
    }

    setProdutos(dados.produtos || []);
  }, []);

  // Carrega os dados ao abrir a página.
  useEffect(() => {
    async function iniciar() {
      try {
        setCarregando(true);
        await Promise.all([
          carregarCategorias(),
          carregarProdutos(),
        ]);
      } catch (error) {
        setErro(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar os dados."
        );
      } finally {
        setCarregando(false);
      }
    }

    void iniciar();
  }, [carregarCategorias, carregarProdutos]);

  // Converte valores digitados em reais para o formato da API.
  function normalizarPreco(valor: string): string | null {
    const texto = valor.trim().replace(/^R\$\s*/, "");

    // Aceita 149,90 ou 149.90, sem separador de milhar.
    if (!/^\d{1,8}[,.]\d{2}$/.test(texto)) {
      return null;
    }

    return texto.replace(",", ".");
  }

  // Envia o cadastro do produto para o backend.
  async function cadastrarProduto(
    evento: React.FormEvent<HTMLFormElement>
  ) {
    evento.preventDefault();
    setErro("");
    setMensagem("");

    const precoFormatado = normalizarPreco(preco);

    if (!precoFormatado) {
      setErro("Informe o preço no formato 149,90.");
      return;
    }

    if (!categoriaId) {
      setErro("Selecione uma categoria.");
      return;
    }

    try {
      setSalvando(true);

      const resposta = await fetch("/api/admin/produtos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: nome.trim(),
          descricao: descricao.trim(),
          preco: precoFormatado,
          categoriaId: Number(categoriaId),
        }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(
          dados.erro || "Não foi possível cadastrar o produto."
        );
      }

      // Limpa o formulário após salvar.
      setNome("");
      setDescricao("");
      setPreco("");
      setCategoriaId("");

      setMensagem("Produto cadastrado com sucesso!");

      // Atualiza a lista com os dados reais do banco.
      await carregarProdutos();
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao cadastrar."
      );
    } finally {
      setSalvando(false);
    }
  }

  // Formatação de valores monetários.
  function formatarMoeda(valor: string) {
    return Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  const estiloCampo: React.CSSProperties = {
    width: "100%",
    padding: "16px",
    border: "1px solid #ccc",
    backgroundColor: "#fff",
    fontSize: "16px",
    boxSizing: "border-box",
  };

  return (
    <main
      style={{
        padding: "40px",
        backgroundColor: "#f5f5f5",
        minHeight: "100vh",
        color: "#171717",
      }}
    >
      <h1
        style={{
          fontSize: "clamp(40px, 6vw, 76px)",
          fontWeight: 800,
          letterSpacing: "-3px",
          marginBottom: "12px",
        }}
      >
        Produtos
      </h1>

      <p style={{ color: "#666", fontSize: "18px" }}>
        Gerencie o catálogo de roupas da Pádua Culture.
      </p>

      <section
        style={{
          background: "#fff",
          border: "1px solid #ddd",
          padding: "32px",
          marginTop: "36px",
        }}
      >
        <h2 style={{ fontSize: "26px", marginBottom: "24px" }}>
          Novo produto
        </h2>

        <form onSubmit={cadastrarProduto}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "20px",
            }}
          >
            <label>
              Nome do produto
              <input
                style={{ ...estiloCampo, marginTop: "8px" }}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Pádua Essential"
                maxLength={150}
                required
              />
            </label>

            <label>
              Categoria
              <select
                style={{ ...estiloCampo, marginTop: "8px" }}
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                required
              >
                <option value="">Selecione uma categoria</option>
                {categorias.map((categoria) => (
                  <option key={categoria.id} value={categoria.id}>
                    {categoria.nome}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Preço (R$)
              <input
                style={{ ...estiloCampo, marginTop: "8px" }}
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                placeholder="149,90"
                inputMode="decimal"
                required
              />
            </label>
          </div>

          <label
            style={{ display: "block", marginTop: "20px" }}
          >
            Descrição
            <textarea
              style={{
                ...estiloCampo,
                marginTop: "8px",
                minHeight: "110px",
                resize: "vertical",
              }}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva a peça..."
              maxLength={10000}
            />
          </label>

          {erro && (
            <p role="alert" style={{ color: "#b91c1c", marginTop: "16px" }}>
              {erro}
            </p>
          )}

          {mensagem && (
            <p role="status" style={{ color: "#15803d", marginTop: "16px" }}>
              {mensagem}
            </p>
          )}

          <button
            type="submit"
            disabled={salvando || carregando}
            style={{
              marginTop: "24px",
              padding: "18px 32px",
              background: "#171717",
              color: "#fff",
              border: "none",
              fontWeight: 700,
              cursor: salvando ? "wait" : "pointer",
              opacity: salvando ? 0.6 : 1,
            }}
          >
            {salvando ? "SALVANDO..." : "CADASTRAR PRODUTO"}
          </button>
        </form>
      </section>

      <section
        style={{
          background: "#fff",
          border: "1px solid #ddd",
          padding: "32px",
          marginTop: "32px",
        }}
      >
        <h2 style={{ fontSize: "26px", marginBottom: "24px" }}>
          Produtos cadastrados ({produtos.length})
        </h2>

        {carregando ? (
          <p>Carregando produtos...</p>
        ) : produtos.length === 0 ? (
          <p>Nenhum produto cadastrado ainda.</p>
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
                <tr style={{ borderBottom: "2px solid #171717" }}>
                  {["ID", "PRODUTO", "CATEGORIA", "PREÇO", "STATUS", "AÇÕES"].map(
                    (titulo) => (
                      <th key={titulo} style={{ padding: "14px" }}>
                        {titulo}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {produtos.map((produto) => (
                  <tr
                    key={produto.id}
                    style={{ borderBottom: "1px solid #eee" }}
                  >
                    <td style={{ padding: "16px" }}>{produto.id}</td>
                    <td style={{ padding: "16px", fontWeight: 700 }}>
                      {produto.nome}
                    </td>
                    <td style={{ padding: "16px" }}>
                      {produto.categoria.nome}
                    </td>
                    <td style={{ padding: "16px" }}>
                      {formatarMoeda(produto.preco)}
                    </td>
                    <td style={{ padding: "16px" }}>
                      {produto.ativo ? "ATIVO" : "RASCUNHO"}
                    </td>
                    {/* Acesso às variantes do produto selecionado. */}
                    <td style={{ padding: "16px" }}>
                    <Link
                        href={`/admin/produtos/${produto.id}/variantes`}
                        style={{
                        display: "inline-block",
                        padding: "12px 18px",
                        backgroundColor: "#171717",
                        color: "#ffffff",
                        textDecoration: "none",
                        fontSize: "13px",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        }}
                    >
                        GERENCIAR VARIANTES
                    </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
