"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import "./login.css";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");

/* =========================================================
   ENVIO DO FORMULÁRIO
   ========================================================= */

const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();

  /* =======================================================
     LOGIN
     =======================================================
     Será conectado ao banco depois do cadastro.
     ======================================================= */

  if (mode === "login") {
    alert("Login será conectado ao banco no próximo passo.");
    return;
  }

  /* =======================================================
     DADOS DO FORMULÁRIO DE CADASTRO
     ======================================================= */

  const form = e.currentTarget;
  const formData = new FormData(form);

  const nome = formData.get("name")?.toString().trim() || "";
  const sobrenome = formData.get("surname")?.toString().trim() || "";
  const email = formData.get("email")?.toString().trim() || "";
  const telefone = formData.get("phone")?.toString().trim() || "";
  const senha = formData.get("password")?.toString() || "";
  const confirmarSenha =
    formData.get("confirmPassword")?.toString() || "";

  /* =======================================================
     CONFIRMAÇÃO DA SENHA
     ======================================================= */

  if (senha !== confirmarSenha) {
    alert("As senhas não são iguais.");
    return;
  }

  /* =======================================================
     ENVIAR CADASTRO PARA A API
     ======================================================= */

  try {
    const response = await fetch("/api/auth/cadastro", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify({
        nome,
        sobrenome,
        email,
        telefone,
        senha,
      }),
    });

    /* =====================================================
       RESPOSTA DA API
       ===================================================== */

    const data = await response.json();

    if (!response.ok) {
      alert(data.erro || "Não foi possível criar sua conta.");
      return;
    }

    /* =====================================================
       CADASTRO REALIZADO
       ===================================================== */

    alert("Conta criada com sucesso!");

    form.reset();

    // Volta para a tela de login após criar a conta.
    setMode("login");
  } catch (error) {
    console.error("Erro ao realizar cadastro:", error);

    alert("Não foi possível conectar ao servidor.");
  }
};

  return (
    <main className="loginPage">
      <header className="loginHeader">
        <Link href="/" className="loginLogo">
          PÁDUA
        </Link>

        <Link href="/" className="backHome">
          ← VOLTAR À LOJA
        </Link>
      </header>

      <section className="loginContainer">
        <div className="loginIntro">
          <span className="loginNumber">01 / ACCOUNT</span>

          <h1>
            SUA CONTA.
            <br />
            <em>SEU ESPAÇO.</em>
          </h1>

          <p>
            Acompanhe seus pedidos, salve seus dados e tenha acesso às
            novidades da Pádua.
          </p>
        </div>

        <div className="formArea">
          <div className="formTabs">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => setMode("login")}
            >
              ENTRAR
            </button>

            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => setMode("register")}
            >
              CRIAR CONTA
            </button>
          </div>

          {mode === "login" ? (
            <form className="accountForm" onSubmit={handleSubmit}>
              <div className="formTitle">
                <span>CLIENTE PÁDUA</span>
                <h2>Bem-vindo de volta.</h2>
              </div>

              <label>
                E-MAIL
                <input
                  type="email"
                  name="email"
                  placeholder="seu@email.com"
                  required
                />
              </label>

              <label>
                SENHA
                <input
                  type="password"
                  name="password"
                  placeholder="••••••••"
                  required
                />
              </label>

              <div className="formOptions">
                <label className="remember">
                  <input type="checkbox" />
                  <span>LEMBRAR DE MIM</span>
                </label>

                <button type="button" className="forgotPassword">
                  ESQUECEU A SENHA?
                </button>
              </div>

              <button type="submit" className="mainButton">
                ENTRAR
                <span>→</span>
              </button>

              <p className="changeMode">
                Ainda não tem uma conta?
                <button type="button" onClick={() => setMode("register")}>
                  CRIAR CONTA
                </button>
              </p>
            </form>
          ) : (
            <form className="accountForm" onSubmit={handleSubmit}>
              <div className="formTitle">
                <span>NOVO CLIENTE</span>
                <h2>Faça parte da Pádua.</h2>
              </div>

              <div className="twoColumns">
                <label>
                  NOME
                  <input
                    type="text"
                    name="name"
                    placeholder="Seu nome"
                    required
                  />
                </label>

                <label>
                  SOBRENOME
                  <input
                    type="text"
                    name="surname"
                    placeholder="Seu sobrenome"
                    required
                  />
                </label>
              </div>

              <label>
                E-MAIL
                <input
                  type="email"
                  name="email"
                  placeholder="seu@email.com"
                  required
                />
              </label>

              <label>
                TELEFONE
                <input
                  type="tel"
                  name="phone"
                  placeholder="(11) 99999-9999"
                />
              </label>

              <label>
                SENHA
                <input
                  type="password"
                  name="password"
                  placeholder="Mínimo 8 caracteres"
                  minLength={8}
                  required
                />
              </label>

              <label>
                CONFIRMAR SENHA
                <input
                  type="password"
                  name="confirmPassword"
                  placeholder="Digite novamente"
                  minLength={8}
                  required
                />
              </label>

              <label className="terms">
                <input type="checkbox" required />

                <span>
                  Concordo com os termos de uso e política de privacidade.
                </span>
              </label>

              <button type="submit" className="mainButton">
                CRIAR MINHA CONTA
                <span>→</span>
              </button>

              <p className="changeMode">
                Já possui uma conta?
                <button type="button" onClick={() => setMode("login")}>
                  ENTRAR
                </button>
              </p>
            </form>
          )}
        </div>
      </section>

      <footer className="loginFooter">
        <span>© 2026 PÁDUA</span>
        <span>BRASIL</span>
      </footer>
    </main>
  );
}