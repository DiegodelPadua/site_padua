import { Prisma } from "@prisma/client";

import {
  buscarDadosPreparacaoEnvio,
} from "../repositories/preparacaoEnvioRepository";

import {
  consultarEntregaNoBanco,
  EntregaError,
} from "../repositories/entregaRepository";

import {
  montarVolumesFrete,
  type UnidadeEmbalagem,
} from "./embalagemFreteService";

import type {
  VolumeFrete,
} from "./melhorEnvioService";

export class PreparacaoEnvioError extends Error {
  constructor(
    mensagem: string,
    public readonly status = 409
  ) {
    super(mensagem);
  }
}

type Opcao = {
  id: number;
  nome: string;
  transportadora: string;
  preco: string;
};

export function interpretarOpcoesSandbox(
  corpo: unknown
): Opcao[] {
  if (!Array.isArray(corpo)) {
    throw new PreparacaoEnvioError(
      "Resposta inesperada da simulação de frete.",
      502
    );
  }

  const opcoes: Opcao[] = [];
  const ids = new Set<number>();

  for (const item of corpo) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      continue;
    }

    const s =
      item as Record<string, unknown>;

    if (s.error) continue;

    const empresa =
      s.company &&
      typeof s.company === "object" &&
      !Array.isArray(s.company)
        ? s.company as Record<string, unknown>
        : null;

    const preco =
      s.custom_price ?? s.price;

    if (
      typeof s.id !== "number" ||
      !Number.isSafeInteger(s.id) ||
      s.id <= 0 ||
      ids.has(s.id) ||
      typeof s.name !== "string" ||
      !s.name.trim() ||
      s.name.length > 100 ||
      typeof empresa?.name !== "string" ||
      !empresa.name.trim() ||
      empresa.name.length > 100 ||
      ![
        "string",
        "number",
      ].includes(typeof preco) ||
      !/^\d{1,8}(\.\d{1,2})?$/.test(
        String(preco)
      )
    ) {
      continue;
    }

    ids.add(s.id);

    opcoes.push({
      id: s.id,
      nome: s.name,
      transportadora: empresa.name,
      preco: new Prisma.Decimal(
        String(preco)
      ).toFixed(2),
    });
  }

  return opcoes;
}

async function simularFrete(
  cepOrigem: string,
  cepDestino: string,
  volumes: VolumeFrete[],
  valorSegurado: number
) {
  // Usa exclusivamente a credencial de teste.
  const token =
    process.env.MELHOR_ENVIO_SANDBOX_TOKEN
      ?.trim();

  const agente =
    process.env.MELHOR_ENVIO_USER_AGENT
      ?.trim();

  if (
    !token ||
    !agente ||
    !/^\d{8}$/.test(cepOrigem)
  ) {
    return {
      opcoes: [] as Opcao[],
      aviso:
        "Configure o token exclusivo do Sandbox, o User-Agent e o CEP de origem para simular o frete.",
    };
  }

  try {
    const resposta = await fetch(
      "https://sandbox.melhorenvio.com.br/api/v2/me/shipment/calculate",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": agente,
        },

        body: JSON.stringify({
          from: {
            postal_code: cepOrigem,
          },

          to: {
            postal_code: cepDestino,
          },

          volumes,

          options: {
            insurance_value:
              valorSegurado,
            receipt: false,
            own_hand: false,
          },
        }),

        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!resposta.ok) {
      return {
        opcoes: [] as Opcao[],
        aviso:
          `A simulação Sandbox retornou HTTP ${resposta.status}. Confira a configuração do ambiente de teste.`,
      };
    }

    const opcoes =
      interpretarOpcoesSandbox(
        await resposta.json()
      );

    return {
      opcoes,
      aviso: opcoes.length
        ? null
        : "Nenhum serviço disponível para esta simulação.",
    };
  } catch {
    return {
      opcoes: [] as Opcao[],
      aviso:
        "Não foi possível consultar o Sandbox agora. Nenhuma etiqueta foi criada.",
    };
  }
}

export async function prepararEnvioSandbox(
  pedidoId: number
) {
  if (
    !Number.isSafeInteger(pedidoId) ||
    pedidoId <= 0 ||
    pedidoId > 2147483647
  ) {
    throw new PreparacaoEnvioError(
      "Pedido inválido.",
      400
    );
  }

  let conferencia: Awaited<
    ReturnType<typeof consultarEntregaNoBanco>
  >;

  try {
    conferencia =
      await consultarEntregaNoBanco(
        pedidoId
      );
  } catch (erro) {
    if (erro instanceof EntregaError) {
      throw new PreparacaoEnvioError(
        erro.message,
        erro.status
      );
    }

    throw erro;
  }

  if (
    conferencia.motivoBloqueio ||
    ![
      "preparar",
      "enviar",
    ].includes(
      conferencia.proximaAcao ?? ""
    )
  ) {
    throw new PreparacaoEnvioError(
      conferencia.motivoBloqueio ??
        "A preparação de etiquetas está disponível antes do registro de envio."
    );
  }

  const p =
    await buscarDadosPreparacaoEnvio(
      pedidoId
    );

  if (
    !p ||
    p.status !==
      conferencia.situacaoPedido
  ) {
    throw new PreparacaoEnvioError(
      "O pedido mudou. Atualize o painel."
    );
  }

  const e = p.enderecoEntrega;

  if (
    !e ||
    !/^\d{8}$/.test(e.cep) ||
    !e.destinatario.trim() ||
    !e.logradouro.trim() ||
    !e.numero.trim() ||
    !e.bairro.trim() ||
    !e.cidade.trim() ||
    !/^[A-Z]{2}$/.test(e.estado)
  ) {
    throw new PreparacaoEnvioError(
      "O endereço preservado no pedido precisa de conferência."
    );
  }

  const unidades: UnidadeEmbalagem[] = [];
  let total = new Prisma.Decimal(0);

  for (const i of p.itens) {
    const produto =
      i.variante?.produto;

    if (
      !produto?.pesoGramas ||
      !Number.isSafeInteger(
        produto.pesoGramas
      ) ||
      produto.pesoGramas <= 0 ||
      !Number.isSafeInteger(i.quantidade) ||
      i.quantidade <= 0 ||
      unidades.length + i.quantidade > 100 ||
      !i.precoUnitario.greaterThan(0) ||
      !i.precoUnitario
        .mul(i.quantidade)
        .equals(i.subtotal)
    ) {
      throw new PreparacaoEnvioError(
        "Confira pesos, variantes e quantidades antes de preparar a etiqueta."
      );
    }

    total = total.plus(i.subtotal);

    for (
      let n = 0;
      n < i.quantidade;
      n++
    ) {
      unidades.push({
        pesoGramas:
          produto.pesoGramas,
        valor:
          i.precoUnitario.toNumber(),
        categoria:
          produto.categoria.slug,
      });
    }
  }

  if (!total.equals(p.subtotal)) {
    throw new PreparacaoEnvioError(
      "Os valores dos itens não correspondem ao pedido."
    );
  }

  let embalagem: ReturnType<
    typeof montarVolumesFrete
  >;

  try {
    embalagem =
      montarVolumesFrete(unidades);
  } catch {
    throw new PreparacaoEnvioError(
      "A embalagem dos produtos precisa ser configurada antes da simulação."
    );
  }

  const cepOrigem =
    process.env.MELHOR_ENVIO_CEP_ORIGEM
      ?.replace(/\D/g, "") ?? "";

  const cotacao = await simularFrete(
    cepOrigem,
    e.cep,
    embalagem.volumes,
    embalagem.valorSegurado
  );

  const pendencias = [
    "Completar os dados e o documento do remetente.",
    "Informar o CPF/CNPJ do destinatário no fluxo de emissão; esse dado ainda não está no pedido.",
    "Definir os dados fiscais do envio.",
    "Conferir fisicamente os volumes e salvar o serviço escolhido antes da criação da etiqueta.",
  ];

  if (
    !/^\d{10,11}$/.test(
      p.usuario.telefone
        ?.replace(/\D/g, "") ?? ""
    )
  ) {
    pendencias.push(
      "Completar o telefone do destinatário."
    );
  }

  return {
    pedidoId,
    ambiente: "sandbox",
    consultadoEm:
      new Date().toISOString(),

    freteDoPedido: {
      nome:
        p.entrega?.modalidadeFrete ?? null,
      transportadora:
        p.entrega?.transportadora ?? null,
      valor:
        p.valorFrete.toFixed(2),
    },

    destinatario: {
      nome: e.destinatario,
      cep: e.cep,
      logradouro: e.logradouro,
      numero: e.numero,
      complemento: e.complemento,
      bairro: e.bairro,
      cidade: e.cidade,
      estado: e.estado,
    },

    itens: p.itens.map((i) => ({
      nome: i.nomeProduto,
      cor: i.cor,
      tamanho: i.tamanho,
      quantidade: i.quantidade,
    })),

    volumes: embalagem.volumes,
    valorProdutos: total.toFixed(2),

    opcoes: cotacao.opcoes,
    avisoCotacao: cotacao.aviso,
    pendencias,

    observacao:
      "Prévia calculada com pesos e categorias do cadastro atual. Confira a embalagem física antes da emissão. A simulação não altera o frete cobrado no pedido.",
  };
}