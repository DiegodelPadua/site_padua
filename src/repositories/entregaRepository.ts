import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export class EntregaError extends Error {
  constructor(
    mensagem: string,
    public readonly status = 409
  ) {
    super(mensagem);
    this.name = "EntregaError";
  }
}

export type AcaoEntrega =
  | "preparar"
  | "enviar"
  | "entregar";

export type EnvioManual = {
  transportadora: string;
  codigoRastreamento: string;
  urlRastreamento: string | null;
};

const etapas = {
  preparar: {
    origem: "CONFIRMADO",
    destino: "EM_PREPARACAO",
    entrega: "PREPARANDO",
  },
  enviar: {
    origem: "EM_PREPARACAO",
    destino: "ENVIADO",
    entrega: "POSTADO",
  },
  entregar: {
    origem: "ENVIADO",
    destino: "ENTREGUE",
    entrega: "ENTREGUE",
  },
} as const;

const selecao = {
  id: true,
  status: true,
  valorTotal: true,

  entrega: {
    select: {
      status: true,
      transportadora: true,
      codigoRastreamento: true,
      urlRastreamento: true,
      melhorEnvioId: true,
      dataPostagem: true,
      dataEntrega: true,
    },
  },

  solicitacoesCancelamento: {
    where: {
      status: {
        in: [
          "SOLICITADA",
          "EM_ANALISE",
          "APROVADA_PARA_REEMBOLSO",
        ],
      },
    },
    take: 1,
    select: { id: true },
  },

  pagamentos: {
    take: 2,

    select: {
      status: true,
      valor: true,
      identificadorExterno: true,

      reembolso: {
        select: { id: true },
      },

      transacoes: {
        take: 2,
        select: {
          tipo: true,
          status: true,
          valor: true,
          identificadorExterno: true,
        },
      },
    },
  },

  itens: {
    select: {
      varianteId: true,
      quantidade: true,
    },
  },

  movimentacoesEstoque: {
    select: {
      varianteId: true,
      tipo: true,
      quantidade: true,
    },
  },
} satisfies Prisma.PedidoSelect;

type Pedido = Prisma.PedidoGetPayload<{
  select: typeof selecao;
}>;

function conferir(p: Pedido) {
  const pg = p.pagamentos[0];
  const t = pg?.transacoes[0];

  if (
    ![
      "CONFIRMADO",
      "EM_PREPARACAO",
      "ENVIADO",
      "ENTREGUE",
    ].includes(p.status) ||
    p.pagamentos.length !== 1 ||
    !pg ||
    pg.status !== "APROVADO" ||
    pg.reembolso ||
    !pg.identificadorExterno ||
    !pg.valor.greaterThan(0) ||
    !pg.valor.equals(p.valorTotal) ||
    pg.transacoes.length !== 1 ||
    !t ||
    t.tipo !== "APROVACAO_MP" ||
    t.status !== "CONFIRMADO" ||
    !t.identificadorExterno ||
    !t.valor.equals(pg.valor)
  ) {
    throw new EntregaError(
      "O pedido precisa estar confirmado, com pagamento aprovado e conciliado, sem reembolso."
    );
  }

  if (p.solicitacoesCancelamento.length > 0) {
    throw new EntregaError(
      "Há uma solicitação de cancelamento em aberto. Resolva a análise antes de avançar a entrega."
    );
  }

  if (!p.entrega) {
    throw new EntregaError(
      "Entrega não encontrada para este pedido."
    );
  }

  if (p.entrega.melhorEnvioId) {
    throw new EntregaError(
      "Esta entrega está vinculada a uma etiqueta do Melhor Envio e exige seu fluxo próprio."
    );
  }

  const itens = new Map<number, number>();
  const reservas = new Map<number, number>();

  if (
    p.itens.length === 0 ||
    p.itens.length > 100
  ) {
    throw new EntregaError(
      "Itens do pedido exigem revisão."
    );
  }

  for (const i of p.itens) {
    if (
      !i.varianteId ||
      !Number.isSafeInteger(i.quantidade) ||
      i.quantidade <= 0
    ) {
      throw new EntregaError(
        "Item sem variante ou quantidade válida."
      );
    }

    itens.set(
      i.varianteId,
      (itens.get(i.varianteId) ?? 0) +
        i.quantidade
    );
  }

  for (const m of p.movimentacoesEstoque) {
    if (
      m.tipo !== "RESERVA" ||
      !itens.has(m.varianteId) ||
      !Number.isSafeInteger(m.quantidade) ||
      m.quantidade <= 0
    ) {
      throw new EntregaError(
        "O estoque foi liberado ou possui movimentações que exigem revisão."
      );
    }

    reservas.set(
      m.varianteId,
      (reservas.get(m.varianteId) ?? 0) +
        m.quantidade
    );
  }

  for (const [id, quantidade] of itens) {
    if (reservas.get(id) !== quantidade) {
      throw new EntregaError(
        "A reserva de estoque não corresponde aos itens do pedido."
      );
    }
  }

  return p.entrega;
}

function proximaEtapa(
  p: Pedido
): AcaoEntrega | null {
  const e = conferir(p);

  const semPostagem =
    !e.dataPostagem &&
    !e.dataEntrega &&
    !e.codigoRastreamento &&
    !e.urlRastreamento;

  if (
    p.status === "CONFIRMADO" &&
    e.status === "PENDENTE" &&
    semPostagem
  ) {
    return "preparar";
  }

  if (
    p.status === "EM_PREPARACAO" &&
    e.status === "PREPARANDO" &&
    semPostagem
  ) {
    return "enviar";
  }

  const postagemValida =
    !!e.dataPostagem &&
    e.dataPostagem.getTime() <= Date.now() &&
    !!e.transportadora?.trim() &&
    !!e.codigoRastreamento?.trim();

  if (
    p.status === "ENVIADO" &&
    [
      "POSTADO",
      "EM_TRANSITO",
      "SAIU_PARA_ENTREGA",
    ].includes(e.status) &&
    postagemValida &&
    !e.dataEntrega
  ) {
    return "entregar";
  }

  if (
    p.status === "ENTREGUE" &&
    e.status === "ENTREGUE" &&
    postagemValida &&
    e.dataEntrega &&
    e.dataEntrega >= e.dataPostagem! &&
    e.dataEntrega.getTime() <= Date.now()
  ) {
    return null;
  }

  throw new EntregaError(
    "A situação do pedido, as datas e a entrega estão inconsistentes. Confira antes de avançar."
  );
}

export async function consultarEntregaNoBanco(
  pedidoId: number
) {
  const p = await prisma.pedido.findUnique({
    where: { id: pedidoId },
    select: selecao,
  });

  if (!p) {
    throw new EntregaError(
      "Pedido não encontrado.",
      404
    );
  }

  let proximaAcao: AcaoEntrega | null = null;
  let motivoBloqueio: string | null = null;

  try {
    proximaAcao = proximaEtapa(p);
  } catch (erro) {
    if (erro instanceof EntregaError) {
      motivoBloqueio = erro.message;
    } else {
      throw erro;
    }
  }

  return {
    pedidoId,
    situacaoPedido: p.status,
    situacaoEntrega:
      p.entrega?.status ?? null,
    transportadora:
      p.entrega?.transportadora ?? null,
    codigoRastreamento:
      p.entrega?.codigoRastreamento ?? null,
    urlRastreamento:
      p.entrega?.urlRastreamento ?? null,
    dataPostagem:
      p.entrega?.dataPostagem?.toISOString() ??
      null,
    dataEntrega:
      p.entrega?.dataEntrega?.toISOString() ??
      null,
    proximaAcao,
    motivoBloqueio,
  };
}

export async function registrarEtapaEntrega(
  pedidoId: number,
  administradorId: number,
  acao: AcaoEntrega,
  situacaoEsperada: string,
  envio: EnvioManual | null
) {
  const etapa = etapas[acao];

  if (
    !etapa ||
    situacaoEsperada !== etapa.origem ||
    (
      acao === "enviar"
        ? !envio
        : envio !== null
    )
  ) {
    throw new EntregaError(
      "Transição de entrega inválida.",
      400
    );
  }

  return prisma.$transaction(async (tx) => {
    const linhas = await tx.$queryRaw<
      Array<{ id: number }>
    >`
      SELECT id
      FROM pedidos
      WHERE id = ${pedidoId}
      FOR UPDATE
    `;

    if (linhas.length !== 1) {
      throw new EntregaError(
        "Pedido não encontrado.",
        404
      );
    }

    const admin = await tx.usuario.findUnique({
      where: { id: administradorId },
      select: { perfil: true },
    });

    if (admin?.perfil !== "ADMIN") {
      throw new EntregaError(
        "Acesso administrativo necessário.",
        403
      );
    }

    const p = await tx.pedido.findUniqueOrThrow({
      where: { id: pedidoId },
      select: selecao,
    });

    const e = conferir(p);
    const proxima = proximaEtapa(p);

    // Repetir a mesma etapa não altera datas nem duplica histórico.
    if (p.status === etapa.destino) {
      if (
        acao === "enviar" &&
        (
          e.transportadora !==
            envio!.transportadora ||
          e.codigoRastreamento !==
            envio!.codigoRastreamento ||
          e.urlRastreamento !==
            envio!.urlRastreamento
        )
      ) {
        throw new EntregaError(
          "O envio já foi registrado com outros dados. Atualize a consulta."
        );
      }

      return {
        pedidoId,
        status: p.status,
        jaAplicado: true,
      };
    }

    if (
      p.status !== situacaoEsperada ||
      proxima !== acao
    ) {
      throw new EntregaError(
        "O pedido mudou. Atualize a consulta antes de continuar."
      );
    }

    const agora = new Date();

    await tx.entrega.update({
      where: { pedidoId },

      data: {
        status: etapa.entrega,

        ...(acao === "enviar"
          ? {
              ...envio!,
              dataPostagem: agora,
            }
          : {}),

        ...(acao === "entregar"
          ? { dataEntrega: agora }
          : {}),
      },
    });

    await tx.pedido.update({
      where: { id: pedidoId },
      data: {
        status: etapa.destino,
      },
    });

    const descricao =
      acao === "preparar"
        ? `Preparação iniciada pelo administrador #${administradorId}. Estoque já reservado, sem novo desconto.`
        : acao === "enviar"
          ? `Envio registrado pelo administrador #${administradorId}. Rastreamento: ${envio!.codigoRastreamento}.`
          : `Entrega registrada manualmente como concluída pelo administrador #${administradorId}.`;

    await tx.historicoPedido.create({
      data: {
        pedidoId,
        status: etapa.destino,
        descricao,
      },
    });

    return {
      pedidoId,
      status: etapa.destino,
      jaAplicado: false,
    };
  });
}