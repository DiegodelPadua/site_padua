
"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

// Estrutura retornada pela API de variantes.
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

export default function AdminVariantesPage() {
  const params = useParams<{ id: string }>();
  const produtoId = params.id;

  // Dados do produto e de suas variantes.
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

  // Consulta as variantes cadastradas no banco.
  const carregarVariantes = useCallback(async () => {
    const resposta = await fetch(
      `/api/admin/produtos/${produtoId}/variantes`,
      { cache: "no-store" }
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

  // Carrega os dados ao acessar a página.
  useEffect(() => {
    async function iniciar() {
      try {
        setCarregando(true);
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

  // Cadastra uma nova variante.
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

      // Limpa o formulário após o cadastro.
      setTamanho("");
      setCor("");
      setSku("");
      setQuantidade("0");

      setMensagem("Variante cadastrada com sucesso!");

      // Atualiza a tabela com os registros do MySQL.
      await carregarVariantes();
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

  const estiloCampo: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "14px",
    marginTop: "8px",
    border: "1px solid #ccc",
    background: "#fff",
    boxSizing: "border-box",
    fontSize: "16px",
  };

  const estoqueTotal = variantes.reduce(
    (total, variante) => total + variante.quantidade,
    0
  );

  return (
    <main
      style={{
        padding: "clamp(16px, 4vw, 40px)",
        minHeight: "100vh",
        background: "#f5f5f5",
        color: "#171717",
      }}
    >
      <Link
        href="/admin/produtos"
        style={{ color: "#171717", textDecoration: "underline" }}
      >
        ← Voltar aos produtos
      </Link>

      <h1
        style={{
          fontSize: "clamp(32px, 5vw, 64px)",
          fontWeight: 800,
          marginTop: "24px",
        }}
      >
        Variantes e estoque
      </h1>

      <p style={{ color: "#666", marginTop: "8px" }}>
        {produto
          ? `Produto: ${produto.nome}`
          : "Carregando produto..."}
      </p>

      <div
        style={{
          display: "flex",
          gap: "16px",
          flexWrap: "wrap",
          marginTop: "24px",
        }}
      >
        <div style={{ background: "#fff", padding: "20px", flex: 1 }}>
          <strong>VARIANTES</strong>
          <p style={{ fontSize: "32px" }}>{variantes.length}</p>
        </div>

        <div style={{ background: "#fff", padding: "20px", flex: 1 }}>
          <strong>UNIDADES EM ESTOQUE</strong>
          <p style={{ fontSize: "32px" }}>{estoqueTotal}</p>
        </div>
      </div>

      <section
        style={{
          background: "#fff",
          border: "1px solid #ddd",
          padding: "clamp(16px, 3vw, 32px)",
          marginTop: "32px",
        }}
      >
        <h2 style={{ fontSize: "24px", marginBottom: "24px" }}>
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
                onChange={(e) => setTamanho(e.target.value)}
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
                onChange={(e) => setCor(e.target.value)}
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
                onChange={(e) => setSku(e.target.value)}
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
                onChange={(e) => setQuantidade(e.target.value)}
                min={0}
                step={1}
                required
              />
            </label>
          </div>

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

          <button
            type="submit"
            disabled={salvando || carregando}
            style={{
              background: "#171717",
              color: "#fff",
              padding: "18px 30px",
              border: "none",
              marginTop: "24px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {salvando ? "SALVANDO..." : "CADASTRAR VARIANTE"}
          </button>
        </form>
      </section>

      <section
        style={{
          background: "#fff",
          border: "1px solid #ddd",
          padding: "clamp(16px, 3vw, 32px)",
          marginTop: "32px",
        }}
      >
        <h2 style={{ fontSize: "24px", marginBottom: "24px" }}>
          Variantes cadastradas
        </h2>

        {carregando ? (
          <p>Carregando...</p>
        ) : variantes.length === 0 ? (
          <p>Nenhuma variante cadastrada.</p>
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
                  {["TAMANHO", "COR", "SKU", "ESTOQUE", "STATUS"].map(
                    (titulo) => (
                      <th
                        key={titulo}
                        style={{
                          padding: "14px",
                          borderBottom: "2px solid #171717",
                        }}
                      >
                        {titulo}
                      </th>
                    )
                  )}
                </tr>
              </thead>

              <tbody>
                {variantes.map((variante) => (
                  <tr key={variante.id}>
                    <td style={{ padding: "14px" }}>
                      {variante.tamanho}
                    </td>
                    <td style={{ padding: "14px" }}>
                      {variante.cor}
                    </td>
                    <td style={{ padding: "14px" }}>
                      {variante.sku || "—"}
                    </td>
                    <td style={{ padding: "14px" }}>
                      {variante.quantidade}
                    </td>
                    <td style={{ padding: "14px" }}>
                      {variante.ativa ? "ATIVA" : "INATIVA"}
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
