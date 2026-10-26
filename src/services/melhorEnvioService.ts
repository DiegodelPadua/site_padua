
/**
 * Integração de cotação com a Melhor Envio.
 * Executada exclusivamente no servidor.
 */

type Volume = {
  width: number;
  height: number;
  length: number;
  weight: number;
};

type CotacaoEntrada = {
  cepDestino: string;
  volumes: Volume[];
  valorSegurado: number;
};

type ServicoMelhorEnvio = {
  id?: number;
  name?: string;
  price?: string;
  custom_price?: string;
  delivery_time?: number;
  custom_delivery_time?: number;
  company?: { name?: string };
  error?: string;
};

export async function cotarFreteMelhorEnvio({
  cepDestino,
  volumes,
  valorSegurado,
}: CotacaoEntrada) {
  const token = process.env.MELHOR_ENVIO_TOKEN;
  const cepOrigem = process.env.MELHOR_ENVIO_CEP_ORIGEM;
  const userAgent = process.env.MELHOR_ENVIO_USER_AGENT;

  if (!token || !cepOrigem || !userAgent) {
    throw new Error("Integração de frete não configurada.");
  }

  const ambiente = process.env.MELHOR_ENVIO_AMBIENTE;
  const baseUrl =
    ambiente === "producao"
      ? "https://www.melhorenvio.com.br"
      : "https://sandbox.melhorenvio.com.br";

  // A cotação não gera etiquetas nem movimenta a carteira.
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
        from: { postal_code: cepOrigem },
        to: { postal_code: cepDestino },
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

  if (!resposta.ok) {
    console.error(
      "[FRETE] Melhor Envio respondeu:",
      resposta.status
    );
    throw new Error("Não foi possível consultar os fretes.");
  }

  const dados: unknown = await resposta.json();

  if (!Array.isArray(dados)) {
    throw new Error("Resposta inesperada da transportadora.");
  }

  // Não retornamos dados internos nem credenciais ao navegador.
  return (dados as ServicoMelhorEnvio[])
    .filter(
      (servico) =>
        !servico.error &&
        typeof servico.id === "number" &&
        Boolean(servico.price || servico.custom_price)
    )
    .map((servico) => ({
      id: servico.id!,
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
