import {
  EntregaError,
  consultarEntregaNoBanco,
  registrarEtapaEntrega,
  type EnvioManual,
} from "../repositories/entregaRepository";

export { EntregaError };

function validarId(id: number) {
  if (
    !Number.isSafeInteger(id) ||
    id <= 0 ||
    id > 2147483647
  ) {
    throw new EntregaError(
      "Identificação inválida.",
      400
    );
  }
}

export async function consultarEntregaAdministrativa(
  pedidoId: number
) {
  validarId(pedidoId);

  return consultarEntregaNoBanco(pedidoId);
}

export async function atualizarEntregaComoAdministrador(
  dados: Record<string, unknown>,
  administradorId: number
) {
  const {
    pedidoId,
    acao,
    situacaoEsperada,
  } = dados;

  if (typeof pedidoId !== "number") {
    throw new EntregaError(
      "Pedido inválido.",
      400
    );
  }

  validarId(pedidoId);
  validarId(administradorId);

  if (
    acao !== "preparar" &&
    acao !== "enviar" &&
    acao !== "entregar"
  ) {
    throw new EntregaError(
      "Ação inválida.",
      400
    );
  }

  const campos =
    acao === "enviar"
      ? [
          "pedidoId",
          "acao",
          "situacaoEsperada",
          "transportadora",
          "codigoRastreamento",
          "urlRastreamento",
        ]
      : [
          "pedidoId",
          "acao",
          "situacaoEsperada",
        ];

  const esperada =
    acao === "preparar"
      ? "CONFIRMADO"
      : acao === "enviar"
        ? "EM_PREPARACAO"
        : "ENVIADO";

  if (
    Object.keys(dados).length !==
      campos.length ||
    !Object.keys(dados).every(
      (k) => campos.includes(k)
    ) ||
    situacaoEsperada !== esperada
  ) {
    throw new EntregaError(
      "Campos ou situação inicial inválidos.",
      400
    );
  }

  let envio: EnvioManual | null = null;

  if (acao === "enviar") {
    const {
      transportadora,
      codigoRastreamento,
      urlRastreamento,
    } = dados;

    if (
      typeof transportadora !== "string" ||
      transportadora.trim().length < 2 ||
      transportadora.trim().length > 100 ||
      /[\x00-\x1f\x7f]/.test(transportadora) ||
      typeof codigoRastreamento !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._/-]{2,149}$/.test(
        codigoRastreamento.trim()
      ) ||
      typeof urlRastreamento !== "string" ||
      urlRastreamento.trim().length > 1000
    ) {
      throw new EntregaError(
        "Informe uma transportadora válida e um código de rastreamento de 3 a 150 caracteres. O link é opcional.",
        400
      );
    }

    let link: string | null = null;

    if (urlRastreamento.trim()) {
      let url: URL;

      try {
        url = new URL(
          urlRastreamento.trim()
        );
      } catch {
        throw new EntregaError(
          "Link de rastreamento inválido.",
          400
        );
      }

      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        url.port ||
        url.toString().length > 1000
      ) {
        throw new EntregaError(
          "Use um link HTTPS de rastreamento sem usuário, senha ou porta personalizada.",
          400
        );
      }

      link = url.toString();
    }

    envio = {
      transportadora: transportadora.trim(),
      codigoRastreamento:
        codigoRastreamento.trim(),
      urlRastreamento: link,
    };
  }

  return registrarEtapaEntrega(
    pedidoId,
    administradorId,
    acao,
    esperada,
    envio
  );
}