
/**
 * Serviço de cotação de frete da Pádua Culture via Melhor Envio.
 * Executado somente no servidor.
 *
 * Peso, dimensões e valor segurado devem ser calculados
 * pelo backend a partir dos produtos cadastrados no banco.
 */
import "server-only";

export type VolumeFrete = {
  width: number;  // Largura externa em cm
  height: number; // Altura externa em cm
  length: number; // Comprimento externo em cm
  weight: number; // Peso total em kg
};

export type CotacaoEntrada = {
  cepDestino: string;
  volumes: VolumeFrete[];
  valorSegurado: number;
};

type ServicoMelhorEnvio = {
  id?: number;
  name?: string;
  price?: string | number;
  custom_price?: string | number;
  delivery_time?: number;
  custom_delivery_time?: number;
  company?: { name?: string };
  error?: string;
};

export type OpcaoFrete = {
  id: number;
  nome: string;
  transportadora: string;
  preco: number;
  prazoDias: number | null;
};

const CEP_REGEX = /^\d{8}$/;

// Verifica se o CEP possui exatamente 8 números.
function cepValido(cep: string): boolean {
  return CEP_REGEX.test(cep);
}

// Verifica se um número é válido e maior que zero.
function numeroPositivo(valor: number): boolean {
  return Number.isFinite(valor) && valor > 0;
}

/**
 * Consulta os serviços disponíveis na Melhor Envio.
 * Esta função não compra nem gera etiquetas.
 */
export async function cotarFreteMelhorEnvio({
  cepDestino,
  volumes,
  valorSegurado,
}: CotacaoEntrada): Promise<OpcaoFrete[]> {
  const token = process.env.MELHOR_ENVIO_TOKEN?.trim();

  const cepOrigem =
    process.env.MELHOR_ENVIO_CEP_ORIGEM?.replace(/\D/g, "");

  const userAgent =
    process.env.MELHOR_ENVIO_USER_AGENT?.trim();

  const ambiente = process.env.MELHOR_ENVIO_AMBIENTE;
  const destino = cepDestino.replace(/\D/g, "");

  // Verifica se as variáveis de ambiente estão configuradas.
  if (!token || !cepOrigem || !userAgent) {
    throw new Error(
      "Integração de frete não configurada no servidor."
    );
  }

  if (ambiente !== "producao" && ambiente !== "sandbox") {
    throw new Error("Ambiente da Melhor Envio inválido.");
  }

  // Valida os CEPs.
  if (!cepValido(cepOrigem) || !cepValido(destino)) {
    throw new Error("CEP de origem ou destino inválido.");
  }

  // Valida as dimensões e o peso dos volumes.
  if (
    !Array.isArray(volumes) ||
    volumes.length === 0 ||
    volumes.length > 20 ||
    volumes.some(
      ({ width, height, length, weight }) =>
        !numeroPositivo(width) ||
        !numeroPositivo(height) ||
        !numeroPositivo(length) ||
        !numeroPositivo(weight)
    )
  ) {
    throw new Error("Volumes inválidos para a cotação.");
  }

  // Valida o valor segurado.
  if (!numeroPositivo(valorSegurado)) {
    throw new Error("Valor segurado inválido.");
  }

  // Define a URL conforme o ambiente configurado.
  const baseUrl =
    ambiente === "producao"
      ? "https://www.melhorenvio.com.br"
      : "https://sandbox.melhorenvio.com.br";

  // Solicita a cotação à Melhor Envio.
  const resposta = await fetch(
    `${baseUrl}/api/v2/me/shipment/calculate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": userAgent,
      },

      body: JSON.stringify({
        from: {
          postal_code: cepOrigem,
        },
        to: {
          postal_code: destino,
        },
        volumes,
        options: {
          insurance_value: valorSegurado,
          receipt: false,
          own_hand: false,
        },
      }),

      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    }
  );

  // Trata erros HTTP sem expor credenciais.
  if (!resposta.ok) {
    console.error(
      "[FRETE] Erro HTTP da Melhor Envio:",
      resposta.status
    );

    throw new Error(
      "Não foi possível consultar os fretes agora."
    );
  }

  const dados: unknown = await resposta.json();

  if (!Array.isArray(dados)) {
    throw new Error(
      "Resposta inesperada da Melhor Envio."
    );
  }

  // Retorna apenas as opções de frete válidas.
  return (dados as ServicoMelhorEnvio[])
    .filter(
      (servico) =>
        !servico.error &&
        typeof servico.id === "number"
    )
    .map((servico) => ({
      id: servico.id as number,
      nome: servico.name ?? "Entrega",
      transportadora: servico.company?.name ?? "",
      preco: Number(
        servico.custom_price ?? servico.price
      ),
      prazoDias:
        servico.custom_delivery_time ??
        servico.delivery_time ??
        null,
    }))
    .filter(
      (servico) =>
        Number.isFinite(servico.preco) &&
        servico.preco >= 0
    );
}
