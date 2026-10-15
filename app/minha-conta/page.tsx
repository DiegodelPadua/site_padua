
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import "./minha-conta.css";

/* =========================================================
   TIPOS DO USUÁRIO
   ========================================================= */

type Usuario = {
  id: number;
  nome: string;
  sobrenome: string;
  email: string;
  telefone?: string | null;
  perfil: string;
};

/* =========================================================
   TIPO DO FORMULÁRIO CADASTRAL
   ========================================================= */

type FormularioCadastro = {
  nome: string;
  sobrenome: string;
  telefone: string;
};

export default function MinhaContaPage() {
  const router = useRouter();

  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [saindo, setSaindo] = useState(false);
  const [erro, setErro] = useState("");
  /* =========================================================
   ESTADOS DA ALTERAÇÃO DE SENHA
   ========================================================= */

    const [editandoSenha, setEditandoSenha] = useState(false);
    const [salvandoSenha, setSalvandoSenha] = useState(false);
    const [senhaAtual, setSenhaAtual] = useState("");
    const [novaSenha, setNovaSenha] = useState("");
    const [confirmarNovaSenha, setConfirmarNovaSenha] = useState("");
    const [erroSenha, setErroSenha] = useState("");
    const [sucessoSenha, setSucessoSenha] = useState("");

  /* =========================================================
     ESTADOS DA EDIÇÃO CADASTRAL
     ========================================================= */

  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState("");

  const [formulario, setFormulario] =
    useState<FormularioCadastro>({
      nome: "",
      sobrenome: "",
      telefone: "",
    });

  /* =========================================================
     CONSULTAR SESSÃO
     ========================================================= */

  useEffect(() => {
    const controller = new AbortController();

    async function carregarUsuario() {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });

        // Sem sessão válida, volta para o login.
        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) {
          throw new Error("Falha ao consultar a sessão.");
        }

        const data = await response.json();

        if (!data.autenticado || !data.usuario) {
          router.replace("/login");
          return;
        }

        if (!controller.signal.aborted) {
          setUsuario(data.usuario);
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        console.error("Erro ao carregar conta:", error);
        setErro("Não foi possível carregar sua conta.");
      } finally {
        if (!controller.signal.aborted) {
          setCarregando(false);
        }
      }
    }

    carregarUsuario();

    return () => controller.abort();
  }, [router]);

  /* =========================================================
     INICIAR EDIÇÃO
     =========================================================
     Preenche o formulário com os dados atuais.
     ========================================================= */

  function iniciarEdicao() {
    if (!usuario) return;

    setFormulario({
      nome: usuario.nome,
      sobrenome: usuario.sobrenome,
      telefone: usuario.telefone || "",
    });

    setErro("");
    setMensagemSucesso("");
    setEditando(true);
  }

  /* =========================================================
     CANCELAR EDIÇÃO
     =========================================================
     Descarta alterações que ainda não foram salvas.
     ========================================================= */

  function cancelarEdicao() {
    setEditando(false);
    setErro("");
  }

  /* =========================================================
     SALVAR ALTERAÇÕES
     =========================================================
     Envia os dados ao backend utilizando PUT /api/auth/me.

     O e-mail atual é enviado porque o Service existente
     exige esse campo. Não permitimos sua edição na tela.
     ========================================================= */

  async function salvarAlteracoes(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!usuario || salvando) return;

    setErro("");
    setMensagemSucesso("");

    const nome = formulario.nome.trim();
    const sobrenome = formulario.sobrenome.trim();
    const telefone = formulario.telefone.trim();

    if (!nome || !sobrenome) {
      setErro("Nome e sobrenome são obrigatórios.");
      return;
    }

    setSalvando(true);

    try {
      const response = await fetch("/api/auth/me", {
        method: "PUT",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nome,
          sobrenome,
          email: usuario.email,
          telefone: telefone || null,
        }),
      });

      const data = await response.json();

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(
          data.erro || "Não foi possível atualizar os dados."
        );
      }

      // Atualiza imediatamente os dados exibidos na página.
      setUsuario(data.usuario);
      setEditando(false);
      setMensagemSucesso("Dados atualizados com sucesso.");
    } catch (error) {
      console.error("Erro ao atualizar cadastro:", error);

      setErro(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar as alterações."
      );
    } finally {
      setSalvando(false);
    }
  }

  /* =========================================================
     ENCERRAR SESSÃO
     ========================================================= */

  async function sairDaConta() {
    setSaindo(true);
    setErro("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error("Falha ao encerrar sessão.");
      }

      // Navegação completa para atualizar o estado da loja.
      window.location.assign("/");
    } catch (error) {
      console.error("Erro ao sair da conta:", error);
      setErro("Não foi possível sair da conta. Tente novamente.");
      setSaindo(false);
    }
  }
  
/* =========================================================
   CANCELAR ALTERAÇÃO DE SENHA
   ========================================================= */

function cancelarAlteracaoSenha() {
  setEditandoSenha(false);
  setSenhaAtual("");
  setNovaSenha("");
  setConfirmarNovaSenha("");
  setErroSenha("");
}

/* =========================================================
   SALVAR NOVA SENHA
   ========================================================= */

async function salvarNovaSenha(
  event: React.FormEvent<HTMLFormElement>
) {
  event.preventDefault();

  if (salvandoSenha) return;

  setErroSenha("");
  setSucessoSenha("");

  if (novaSenha.length < 8) {
    setErroSenha("A nova senha deve ter pelo menos 8 caracteres.");
    return;
  }

  if (novaSenha !== confirmarNovaSenha) {
    setErroSenha("As novas senhas não correspondem.");
    return;
  }

  setSalvandoSenha(true);

  try {
    const response = await fetch("/api/auth/senha", {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        senhaAtual,
        novaSenha,
        confirmarNovaSenha,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Uma senha atual incorreta também retorna 401.
      // Por isso não redirecionamos automaticamente.
      throw new Error(
        data.erro || "Não foi possível alterar a senha."
      );
    }

        /* =========================================================
        SENHA ALTERADA COM SUCESSO
        =========================================================
        O backend já removeu o cookie de autenticação.
        Redirecionamos o cliente para realizar novo login.
        ========================================================= */

        // Limpa os campos de senha.
        setSenhaAtual("");
        setNovaSenha("");
        setConfirmarNovaSenha("");

        // Encerra a edição.
        setEditandoSenha(false);

        // Informa o usuário antes de sair da página.
        window.alert(
        "Sua senha foi alterada com sucesso! Faça login novamente com a nova senha."
        );

        // Redireciona para a página de login.
        window.location.replace("/login");

  } catch (error) {
    setErroSenha(
      error instanceof Error
        ? error.message
        : "Não foi possível alterar a senha."
    );
  } finally {
    setSalvandoSenha(false);
  }
}


  /* =========================================================
     ESTADOS DA PÁGINA
     ========================================================= */

  if (carregando) {
    return (
      <main className="accountPage">
        <p>CARREGANDO SUA CONTA...</p>
      </main>
    );
  }

  if (erro && !usuario) {
    return (
      <main className="accountPage">
        <p role="alert">{erro}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
        >
          TENTAR NOVAMENTE
        </button>
      </main>
    );
  }

  if (!usuario) {
    return (
      <main className="accountPage">
        <p>REDIRECIONANDO...</p>
      </main>
    );
  }

  return (
    <main className="accountPage">
      <header className="accountHeader">
        <Link href="/" className="accountLogo">
          PÁDUA.CULTURE
        </Link>

        <Link href="/" className="accountBack">
          ← VOLTAR À LOJA
        </Link>
      </header>

      <section className="accountContent">
        <div className="accountIntro">
          <span className="accountEyebrow">
            01 / ÁREA DO CLIENTE
          </span>

          <h1>
            MINHA
            <br />
            <em>CONTA.</em>
          </h1>

          <p>
            Olá, {usuario.nome}. Este é o seu espaço na Pádua.
          </p>
        </div>

        <div className="accountDetails">
          <div className="accountSectionTitle">
            <span>DADOS CADASTRAIS</span>
            <h2>Suas informações.</h2>
          </div>

          {/* =================================================
              MENSAGENS DE CONFIRMAÇÃO E ERRO
              ================================================= */}

          {mensagemSucesso && (
            <p className="accountSuccess" role="status">
              {mensagemSucesso}
            </p>
          )}

          {erro && (
            <p className="accountError" role="alert">
              {erro}
            </p>
          )}

          {/* =================================================
              VISUALIZAÇÃO DOS DADOS
              ================================================= */}

          {!editando ? (
            <>
              <div className="accountField">
                <span>NOME COMPLETO</span>
                <strong>
                  {usuario.nome} {usuario.sobrenome}
                </strong>
              </div>

              <div className="accountField">
                <span>E-MAIL</span>
                <strong>{usuario.email}</strong>
              </div>

              <div className="accountField">
                <span>TELEFONE</span>
                <strong>
                  {usuario.telefone || "Não informado"}
                </strong>
              </div>

              <button
                type="button"
                className="accountEditButton"
                onClick={iniciarEdicao}
              >
                EDITAR DADOS
                <span>↗</span>
              </button>
            </>
          ) : (
            /* ===============================================
               FORMULÁRIO DE EDIÇÃO
               =============================================== */

            <form
              className="accountEditForm"
              onSubmit={salvarAlteracoes}
            >
              <label htmlFor="accountNome">NOME</label>
              <input
                id="accountNome"
                type="text"
                value={formulario.nome}
                onChange={(event) =>
                  setFormulario({
                    ...formulario,
                    nome: event.target.value,
                  })
                }
                required
                maxLength={100}
                autoComplete="given-name"
              />

              <label htmlFor="accountSobrenome">
                SOBRENOME
              </label>
              <input
                id="accountSobrenome"
                type="text"
                value={formulario.sobrenome}
                onChange={(event) =>
                  setFormulario({
                    ...formulario,
                    sobrenome: event.target.value,
                  })
                }
                required
                maxLength={100}
                autoComplete="family-name"
              />

              <label htmlFor="accountEmail">E-MAIL</label>
              <input
                id="accountEmail"
                type="email"
                value={usuario.email}
                disabled
              />

              <p className="accountFormHint">
                A alteração de e-mail será disponibilizada
                após implementarmos a confirmação de identidade.
              </p>

              <label htmlFor="accountTelefone">
                TELEFONE
              </label>
              <input
                id="accountTelefone"
                type="tel"
                value={formulario.telefone}
                onChange={(event) =>
                  setFormulario({
                    ...formulario,
                    telefone: event.target.value,
                  })
                }
                maxLength={20}
                autoComplete="tel"
              />

              <div className="accountFormActions">
                <button
                  type="button"
                  className="accountCancelButton"
                  onClick={cancelarEdicao}
                  disabled={salvando}
                >
                  CANCELAR
                </button>

                <button
                  type="submit"
                  className="accountSaveButton"
                  disabled={salvando}
                >
                  {salvando
                    ? "SALVANDO..."
                    : "SALVAR ALTERAÇÕES"}
                </button>
              </div>
            </form>
          )}

          {/* =================================================
              HISTÓRICO DE PEDIDOS
              ================================================= */}
              
{/* =================================================
    SEGURANÇA DA CONTA
    ================================================= */}

<div className="accountSectionTitle accountSecurity">
  <span>SEGURANÇA DA CONTA</span>
  <h2>Proteja sua conta.</h2>
</div>

{sucessoSenha && (
  <p className="accountSuccess" role="status">
    {sucessoSenha}
  </p>
)}

{erroSenha && (
  <p className="accountError" role="alert">
    {erroSenha}
  </p>
)}

{!editandoSenha ? (
  <button
    type="button"
    className="accountEditButton"
    onClick={() => {
      setErroSenha("");
      setSucessoSenha("");
      setEditandoSenha(true);
    }}
  >
    ALTERAR SENHA
    <span>↗</span>
  </button>
) : (
  <form
    className="accountEditForm"
    onSubmit={salvarNovaSenha}
  >
    <label htmlFor="senhaAtual">
      SENHA ATUAL
    </label>
    <input
      id="senhaAtual"
      type="password"
      value={senhaAtual}
      onChange={(event) => setSenhaAtual(event.target.value)}
      autoComplete="current-password"
      required
    />

    <label htmlFor="novaSenha">
      NOVA SENHA
    </label>
    <input
      id="novaSenha"
      type="password"
      value={novaSenha}
      onChange={(event) => setNovaSenha(event.target.value)}
      autoComplete="new-password"
      minLength={8}
      required
    />

    <label htmlFor="confirmarNovaSenha">
      CONFIRMAR NOVA SENHA
    </label>
    <input
      id="confirmarNovaSenha"
      type="password"
      value={confirmarNovaSenha}
      onChange={(event) =>
        setConfirmarNovaSenha(event.target.value)
      }
      autoComplete="new-password"
      minLength={8}
      required
    />

    <div className="accountFormActions">
      <button
        type="button"
        className="accountCancelButton"
        onClick={cancelarAlteracaoSenha}
        disabled={salvandoSenha}
      >
        CANCELAR
      </button>

      <button
        type="submit"
        className="accountSaveButton"
        disabled={salvandoSenha}
      >
        {salvandoSenha
          ? "SALVANDO..."
          : "SALVAR NOVA SENHA"}
      </button>
    </div>
  </form>
)}


          <div className="accountSectionTitle accountOrders">
            <span>MEUS PEDIDOS</span>
            <h2>Histórico de compras.</h2>
            <p>
              O acompanhamento de pedidos estará disponível
              quando integrarmos o checkout ao banco de dados.
            </p>
          </div>

          {/* =================================================
              LOGOUT
              ================================================= */}

          <button
            type="button"
            className="accountLogout"
            onClick={sairDaConta}
            disabled={saindo}
          >
            {saindo ? "SAINDO..." : "SAIR DA CONTA"}
            <span>→</span>
          </button>
        </div>
      </section>

      <footer className="accountFooter">
        <span>© 2026 PÁDUA</span>
        <span>BRASIL</span>
      </footer>
    </main>
  );
}
