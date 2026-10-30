
/* =========================================================
   EMBALAGEM FRETE SERVICE - PÁDUA CULTURE
   =========================================================
   Centraliza as regras de embalagem utilizadas pelo
   checkout e pelo sistema de pedidos.

   Não consulta o banco de dados.
   Não realiza cotação.
   Não compra etiquetas do Melhor Envio.
   ========================================================= */

import "server-only";

import type { VolumeFrete } from "./melhorEnvioService";

/* =========================================================
   CONFIGURAÇÕES DAS EMBALAGENS
   ========================================================= */

export const EMBALAGEM_PADUA = {
  width: 25,
  height: 5,
  length: 30,
  pesoGramas: 200,
} as const;

export const MAX_EMBALAGENS_FRETE = 20;

/* =========================================================
   TIPOS
   ========================================================= */

export type UnidadeEmbalagem = {
  pesoGramas: number;
  valor: number;
  categoria: string;
};

type CaixaEmbalagem = {
  unidades: UnidadeEmbalagem[];
  capacidade: number;
  categoria: string;
};

export class EmbalagemFreteError extends Error {
  constructor(mensagem: string) {
    super(mensagem);
    this.name = "EmbalagemFreteError";
  }
}

/* =========================================================
   CAPACIDADE POR CATEGORIA
   =========================================================
   Camisetas: 2 unidades por caixa.
   Calças, bonés e shorts: 1 unidade por caixa.

   Upcycling e outras categorias precisam de
   configuração específica antes de serem cotadas.
   ========================================================= */

export function capacidadePorCategoria(
  slug: string
): number | null {
  const normalizado = slug.toLowerCase().trim();

  if (normalizado === "camisetas") {
    return 2;
  }

  if (
    ["calcas", "bonés", "bones", "shorts"].includes(
      normalizado
    )
  ) {
    return 1;
  }

  return null;
}

/* =========================================================
   MONTAR VOLUMES PARA O MELHOR ENVIO
   =========================================================
   Não mistura categorias na mesma embalagem.

   Recebe uma unidade por peça, exatamente como
   a rota de cotação atual já trabalha.
   ========================================================= */

export function montarVolumesFrete(
  unidades: UnidadeEmbalagem[]
): {
  volumes: VolumeFrete[];
  valorSegurado: number;
  embalagem: {
    comprimentoCm: number;
    larguraCm: number;
    alturaCm: number;
    pesoTotalKg: number;
  };
} {
  if (!Array.isArray(unidades) || unidades.length === 0) {
    throw new EmbalagemFreteError(
      "Não existem produtos para calcular o frete."
    );
  }

  const caixas: CaixaEmbalagem[] = [];

  /* =====================================================
     VALIDAR E DISTRIBUIR AS UNIDADES
     ===================================================== */

  for (const unidade of unidades) {
    if (
      !Number.isSafeInteger(unidade.pesoGramas) ||
      unidade.pesoGramas <= 0 ||
      !Number.isFinite(unidade.valor) ||
      unidade.valor <= 0
    ) {
      throw new EmbalagemFreteError(
        "Peso ou valor inválido para embalagem."
      );
    }

    const capacidade = capacidadePorCategoria(
      unidade.categoria
    );

    if (capacidade === null) {
      throw new EmbalagemFreteError(
        `A categoria ${unidade.categoria} ainda não possui embalagem configurada.`
      );
    }

    let caixa = caixas.find(
      (atual) =>
        atual.categoria === unidade.categoria &&
        atual.unidades.length < atual.capacidade
    );

    if (!caixa) {
      caixa = {
        unidades: [],
        capacidade,
        categoria: unidade.categoria,
      };

      caixas.push(caixa);
    }

    caixa.unidades.push(unidade);

    if (caixas.length > MAX_EMBALAGENS_FRETE) {
      throw new EmbalagemFreteError(
        "O pedido excede o limite de embalagens para cotação automática."
      );
    }
  }

  /* =====================================================
     CONVERTER CAIXAS EM VOLUMES
     ===================================================== */

  const volumes: VolumeFrete[] = caixas.map((caixa) => {
    const pesoProdutos = caixa.unidades.reduce(
      (soma, unidade) => soma + unidade.pesoGramas,
      0
    );

    return {
      width: EMBALAGEM_PADUA.width,
      height: EMBALAGEM_PADUA.height,
      length: EMBALAGEM_PADUA.length,
      weight:
        (pesoProdutos + EMBALAGEM_PADUA.pesoGramas) /
        1000,
    };
  });

  /* =====================================================
     CALCULAR VALOR SEGURADO
     ===================================================== */

  const valorSegurado =
    Math.round(
      unidades.reduce(
        (soma, unidade) => soma + unidade.valor,
        0
      ) * 100
    ) / 100;

  /* =====================================================
     RETORNAR RESULTADO
     ===================================================== */

  return {
    volumes,
    valorSegurado,
    embalagem: {
      comprimentoCm: EMBALAGEM_PADUA.length,
      larguraCm: EMBALAGEM_PADUA.width,
      alturaCm: EMBALAGEM_PADUA.height,
      pesoTotalKg: volumes.reduce(
        (soma, volume) => soma + volume.weight,
        0
      ),
    },
  };
}
