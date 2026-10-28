"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
/* =========================================================
   PÁDUA CULTURE — GERENCIAMENTO DE PRODUTOS
   Funcionalidades:
   - Consultar categorias ativas.
   - Consultar produtos cadastrados.
   - Cadastrar novos produtos.
   - Gerenciar variantes de cada produto.
   - Acessar o gerenciamento de imagens.
   ========================================================= */
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
  // Peso individual armazenado no MySQL.
  pesoGramas: number | null;
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
  // Dados do produto que será cadastrado.
  const [preco, setPreco] = useState("");
  const [pesoGramas, setPesoGramas] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  // Controle da interface.
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  // Identifica o produto cuja publicação está sendo alterada.
  const [publicandoId, setPublicandoId] = useState<number | null>(
    null
  );
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  /* =======================================================
   ESTADOS DA EDIÇÃO DE PRODUTOS
   ======================================================= */
// Identifica o produto selecionado para edição.
const [produtoEditando, setProdutoEditando] = useState<number | null>(null);
// Campos independentes do formulário de cadastro.
const [editNome, setEditNome] = useState("");
const [editDescricao, setEditDescricao] = useState("");
const [editPreco, setEditPreco] = useState("");
const [editPesoGramas, setEditPesoGramas] = useState("");
const [editCategoriaId, setEditCategoriaId] = useState("");
// Controla o envio das alterações.
const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  /* =======================================================
     CONSULTAR CATEGORIAS
     ======================================================= */
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
  /* =======================================================
     CONSULTAR PRODUTOS
     ======================================================= */
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
  /* =======================================================
     CARREGAMENTO INICIAL
     ======================================================= */
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
  /* =======================================================
     NORMALIZAR PREÇO
     ======================================================= */
  function normalizarPreco(valor: string): string | null {
    const texto = valor.trim().replace(/^R\$\s*/, "");
    // Aceita 149,90 ou 149.90, sem separador de milhar.
    if (!/^\d{1,8}[,.]\d{2}$/.test(texto)) {
      return null;
    }
    return texto.replace(",", ".");
  }
  /* =======================================================
     CADASTRAR PRODUTO
     ======================================================= */
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
    // O peso é obrigatório para calcular o frete.
    // Aceitamos somente números inteiros positivos em gramas.
    const pesoNumerico = Number(pesoGramas);
    if (
      !/^[1-9]\d*$/.test(pesoGramas.trim()) ||
      !Number.isSafeInteger(pesoNumerico) ||
      pesoNumerico > 100000
    ) {
      setErro("Informe um peso válido em gramas, entre 1 e 100000.");
      return;
    }
    try {
      setSalvando(true);
      // Envia os dados para a API administrativa.
      const resposta = await fetch("/api/admin/produtos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: nome.trim(),
          descricao: descricao.trim(),
          preco: precoFormatado,
          pesoGramas: pesoNumerico,
          categoriaId: Number(categoriaId),
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(
          dados.erro || "Não foi possível cadastrar o produto."
        );
      }
      // Limpa todos os campos após cadastrar o produto.
      setNome("");
      setDescricao("");
      setPreco("");
      setPesoGramas("");
      setCategoriaId("");
      setMensagem("Produto cadastrado com sucesso!");
      // Atualiza a lista com os dados reais do MySQL.
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
/* =========================================================
   PUBLICAR / RETORNAR PARA RASCUNHO
   ========================================================= */
  async function alterarPublicacao(produto: Produto) {
    const novoStatus = !produto.ativo;
    // Confirma a alteração antes de enviar ao servidor.
    const confirmado = window.confirm(
      novoStatus
        ? `Deseja publicar "${produto.nome}" na loja?`
        : `Deseja retirar "${produto.nome}" da loja?`
    );
    if (!confirmado) return;
    setErro("");
    setMensagem("");
    setPublicandoId(produto.id);
    try {
      const resposta = await fetch(
        `/api/admin/produtos/${produto.id}/publicacao`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ativo: novoStatus,
          }),
        }
      );
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(
          dados.erro || "Não foi possível alterar a publicação."
        );
      }
      // Reconsulta os produtos para refletir o MySQL.
      await carregarProdutos();
      setMensagem(dados.mensagem);
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao alterar publicação."
      );
    } finally {
      setPublicandoId(null);
    }
  }
  /* =======================================================
     FORMATAÇÃO DE PREÇOS
     ======================================================= */
  function formatarMoeda(valor: string) {
    return Number(valor).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }
  /* =======================================================
   INICIAR EDIÇÃO DE PRODUTO
   ======================================================= */
function iniciarEdicao(produto: Produto) {
  // Limpa mensagens anteriores.
  setErro("");
  setMensagem("");
  // Identifica o produto e preenche os campos.
  setProdutoEditando(produto.id);
  setEditNome(produto.nome);
  setEditDescricao(produto.descricao ?? "");
  setEditPreco(Number(produto.preco).toFixed(2).replace(".", ","));
  setEditPesoGramas(
    produto.pesoGramas === null ? "" : String(produto.pesoGramas)
  );
  setEditCategoriaId(String(produto.categoria.id));
}
/* =======================================================
   CANCELAR EDIÇÃO
   ======================================================= */
function cancelarEdicao() {
  if (salvandoEdicao) return;
  setProdutoEditando(null);
  setErro("");
}
/* =======================================================
   SALVAR ALTERAÇÕES DO PRODUTO
   ======================================================= */
async function salvarEdicao(
  evento: React.FormEvent<HTMLFormElement>
) {
  evento.preventDefault();
  if (produtoEditando === null || salvandoEdicao) return;
  setErro("");
  setMensagem("");
  // Reutiliza a validação de preço do cadastro.
  const precoFormatado = normalizarPreco(editPreco);
  if (!precoFormatado || Number(precoFormatado) <= 0) {
    setErro("Informe um preço válido, como 149,90.");
    return;
  }
  // Valida o peso em gramas.
  const pesoTexto = editPesoGramas.trim();
  const pesoNumerico = Number(pesoTexto);
  if (
    !/^[1-9]\d*$/.test(pesoTexto) ||
    !Number.isSafeInteger(pesoNumerico) ||
    pesoNumerico > 100000
  ) {
    setErro("Informe um peso inteiro entre 1 e 100000 gramas.");
    return;
  }
  // Confirma a categoria selecionada.
  const categoriaNumero = Number(editCategoriaId);
  if (
    !Number.isSafeInteger(categoriaNumero) ||
    categoriaNumero <= 0
  ) {
    setErro("Selecione uma categoria válida.");
    return;
  }
  try {
    setSalvandoEdicao(true);
    // Atualiza apenas os dados principais do produto.
    const resposta = await fetch(
      `/api/admin/produtos/${produtoEditando}`,
      {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome: editNome.trim(),
          descricao: editDescricao.trim(),
          preco: precoFormatado,
          pesoGramas: pesoNumerico,
          categoriaId: categoriaNumero,
        }),
      }
    );
    const dados = await resposta.json();
    if (!resposta.ok) {
      throw new Error(
        dados.erro || "Não foi possível atualizar o produto."
      );
    }
    // Recarrega a lista diretamente do MySQL.
    await carregarProdutos();
    // Fecha o formulário após a atualização.
    setProdutoEditando(null);
    setMensagem("Produto atualizado com sucesso!");
  } catch (error) {
    setErro(
      error instanceof Error
        ? error.message
        : "Erro inesperado ao editar produto."
    );
  } finally {
    setSalvandoEdicao(false);
  }
}
  /* =======================================================
     ESTILOS COMPARTILHADOS
     ======================================================= */
  const estiloCampo: React.CSSProperties = {
    width: "100%",
    padding: "16px",
    border: "1px solid #ccc",
    backgroundColor: "#fff",
    fontSize: "16px",
    boxSizing: "border-box",
  };
  // Alinhamento compartilhado por todas as células da tabela.
  const estiloCelula: React.CSSProperties = {
    padding: "16px 12px",
    textAlign: "left",
    verticalAlign: "middle",
    overflowWrap: "break-word",
    fontSize: "14px",
  };
  // Estilo compartilhado dos botões de ação dos produtos.
  const estiloAcao: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "220px",
    maxWidth: "100%",
    minHeight: "44px",
    padding: "10px 12px",
    boxSizing: "border-box",
    backgroundColor: "#171717",
    color: "#ffffff",
    border: "none",
    textDecoration: "none",
    textAlign: "center",
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1.3,
    whiteSpace: "nowrap",
  };
  /* =======================================================
     INTERFACE
     ======================================================= */
  return (
    <main
      style={{
        padding: "40px 24px 80px",
        backgroundColor: "#f5f5f5",
        minHeight: "100vh",
        color: "#171717",
        maxWidth: "1248px",
        margin: "0 auto",
        boxSizing: "border-box",
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
      {/* ===================================================
          FORMULÁRIO DE CADASTRO
          =================================================== */}
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
                  <option
                    key={categoria.id}
                    value={categoria.id}
                  >
                    {categoria.nome}
                  </option>
                ))}
              </select>
            </label>
            {/* ===================================================
                CAMPO: PREÇO DO PRODUTO
                =================================================== */}
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
            {/* ===================================================
                CAMPO: PESO DO PRODUTO
                Utilizado no cálculo de frete da Melhor Envio.
                O peso deve ser informado em gramas.
                Exemplo: 300 = 300 gramas.
                =================================================== */}
            <label>
              Peso do produto (gramas)
              <input
                type="number"
                style={{ ...estiloCampo, marginTop: "8px" }}
                value={pesoGramas}
                onChange={(e) => setPesoGramas(e.target.value)}
                placeholder="Ex.: 300"
                min={1}
                max={100000}
                step={1}
                required
              />
            </label>
            {/* Fecha a grade dos campos principais do formulário. */}
            </div>
            {/* ===================================================
                CAMPO: DESCRIÇÃO DO PRODUTO
                =================================================== */}
            <label
              style={{
                display: "block",
                marginTop: "20px",
              }}
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
          {/* Mensagens de erro e sucesso. */}
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
            {salvando
              ? "SALVANDO..."
              : "CADASTRAR PRODUTO"}
          </button>
        </form>
      </section>
      {/* ===================================================
          LISTAGEM DOS PRODUTOS
          =================================================== */}
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
          <div style={{ overflowX: "auto", width: "100%" }}>
            {/* Rolagem horizontal preserva o alinhamento em telas pequenas. */}
            <table
              style={{
                width: "100%",
                minWidth: "950px",
                tableLayout: "fixed",
                borderCollapse: "collapse",
                textAlign: "left",
              }}
            >
              {/* Larguras únicas compartilhadas pelo cabeçalho e pelo corpo. */}
              <colgroup>
                <col style={{ width: "7%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "30%" }} />
              </colgroup>
              <thead>
                <tr style={{ borderBottom: "2px solid #171717" }}>
                  {["ID", "PRODUTO", "CATEGORIA", "PREÇO", "STATUS", "AÇÕES"].map(
                    (titulo) => (
                      <th
                        key={titulo}
                        scope="col"
                        style={{
                          padding: "14px 12px",
                          textAlign: "left",
                          verticalAlign: "middle",
                          fontSize: "13px",
                          whiteSpace: "nowrap",
                        }}
                      >
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
                    <td style={estiloCelula}>{produto.id}</td>
                    <td style={{ ...estiloCelula, fontWeight: 700 }}>
                      {produto.nome}
                    </td>
                    <td style={estiloCelula}>{produto.categoria.nome}</td>
                    <td style={estiloCelula}>{formatarMoeda(produto.preco)}</td>
                    <td style={estiloCelula}>
                      {produto.ativo ? "ATIVO" : "RASCUNHO"}
                    </td>
                    <td style={estiloCelula}>
                      {/* Cada ação é independente e ocupa a mesma largura. */}
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "flex-start",
                          gap: "8px",
                        }}
                      >
                        <button
                          type="button"
                          disabled={salvandoEdicao || salvando}
                          onClick={() => iniciarEdicao(produto)}
                          style={{
                            ...estiloAcao,
                            cursor: salvandoEdicao || salvando ? "not-allowed" : "pointer",
                            opacity: salvandoEdicao || salvando ? 0.5 : 1,
                          }}
                        >
                          EDITAR PRODUTO
                        </button>
                        <Link
                          href={`/admin/produtos/${produto.id}/variantes`}
                          style={estiloAcao}
                        >
                          GERENCIAR VARIANTES
                        </Link>
                        <Link
                          href={`/admin/produtos/${produto.id}/imagens`}
                          style={estiloAcao}
                        >
                          GERENCIAR IMAGENS
                        </Link>
                        <button
                          type="button"
                          disabled={publicandoId !== null}
                          onClick={() => alterarPublicacao(produto)}
                          style={{
                            ...estiloAcao,
                            cursor: publicandoId !== null ? "wait" : "pointer",
                            backgroundColor: produto.ativo ? "#666666" : "#171717",
                            opacity:
                              publicandoId !== null && publicandoId !== produto.id
                                ? 0.5
                                : 1,
                          }}
                        >
                          {publicandoId === produto.id
                            ? "SALVANDO..."
                            : produto.ativo
                              ? "VOLTAR PARA RASCUNHO"
                              : "PUBLICAR"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {/* ===================================================
          FORMULÁRIO DE EDIÇÃO DE PRODUTO
          Exibido somente quando um produto é selecionado.
          =================================================== */}
      {produtoEditando !== null && (
        <section
          aria-label="Editar produto"
          style={{
            background: "#fff",
            border: "1px solid #ddd",
            padding: "32px",
            marginTop: "32px",
          }}
        >
          <h2 style={{ fontSize: "26px", marginBottom: "12px" }}>
            Editar produto #{produtoEditando}
          </h2>
          <p style={{ color: "#666", marginBottom: "24px" }}>
            Atualize os dados principais do produto. As imagens,
            variantes, estoque e publicação serão preservados.
          </p>
          <form onSubmit={salvarEdicao}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "20px",
              }}
            >
              {/* Nome do produto */}
              <label>
                Nome do produto
                <input
                  style={{ ...estiloCampo, marginTop: "8px" }}
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  maxLength={150}
                  required
                  disabled={salvandoEdicao}
                />
              </label>
              {/* Categoria do produto */}
              <label>
                Categoria
                <select
                  style={{ ...estiloCampo, marginTop: "8px" }}
                  value={editCategoriaId}
                  onChange={(e) => setEditCategoriaId(e.target.value)}
                  required
                  disabled={salvandoEdicao}
                >
                  <option value="">Selecione uma categoria</option>
                  {categorias.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.nome}
                    </option>
                  ))}
                </select>
              </label>
              {/* Preço em reais */}
              <label>
                Preço (R$)
                <input
                  style={{ ...estiloCampo, marginTop: "8px" }}
                  value={editPreco}
                  onChange={(e) => setEditPreco(e.target.value)}
                  placeholder="149,90"
                  inputMode="decimal"
                  required
                  disabled={salvandoEdicao}
                />
              </label>
              {/* Peso usado na cotação do Melhor Envio */}
              <label>
                Peso do produto (gramas)
                <input
                  type="number"
                  style={{ ...estiloCampo, marginTop: "8px" }}
                  value={editPesoGramas}
                  onChange={(e) => setEditPesoGramas(e.target.value)}
                  min={1}
                  max={100000}
                  step={1}
                  placeholder="Ex.: 300"
                  required
                  disabled={salvandoEdicao}
                />
              </label>
            </div>
            {/* Descrição completa */}
            <label
              style={{
                display: "block",
                marginTop: "20px",
              }}
            >
              Descrição
              <textarea
                style={{
                  ...estiloCampo,
                  marginTop: "8px",
                  minHeight: "110px",
                  resize: "vertical",
                }}
                value={editDescricao}
                onChange={(e) => setEditDescricao(e.target.value)}
                maxLength={10000}
                disabled={salvandoEdicao}
              />
            </label>
            {/* Mensagem de erro da edição */}
            {erro && (
              <p
                role="alert"
                style={{ color: "#b91c1c", marginTop: "20px" }}
              >
                {erro}
              </p>
            )}
            {/* Botões para salvar ou cancelar */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                marginTop: "24px",
              }}
            >
              <button
                type="submit"
                disabled={salvandoEdicao}
                style={{
                  ...estiloAcao,
                  border: "none",
                  cursor: salvandoEdicao ? "wait" : "pointer",
                  opacity: salvandoEdicao ? 0.6 : 1,
                }}
              >
                {salvandoEdicao
                  ? "SALVANDO..."
                  : "SALVAR ALTERAÇÕES"}
              </button>
              <button
                type="button"
                onClick={cancelarEdicao}
                disabled={salvandoEdicao}
                style={{
                  padding: "12px 18px",
                  background: "#fff",
                  color: "#171717",
                  border: "1px solid #aaa",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                CANCELAR
              </button>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
