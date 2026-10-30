
/* =========================================================
   PEDIDO SERVICE - PÁDUA CULTURE
   =========================================================
   Responsável pelas regras de negócio dos pedidos.

   Nesta etapa:
   - Validar o endereço selecionado.
   - Validar os produtos e suas quantidades.
   - Validar a opção de frete selecionada.
   - Preparar os dados para o Repository.

   IMPORTANTE:
   Valores de produtos e frete enviados pelo navegador
   nunca serão considerados preços oficiais.
   ========================================================= */

/* =========================================================
   TIPOS DE ENTRADA
   ========================================================= */
import {
  montarVolumesFrete,
  EmbalagemFreteError,
  type UnidadeEmbalagem,
} from "./embalagemFreteService";

import {
  cotarFreteMelhorEnvio,
} from "./melhorEnvioService";



import { Prisma } from "@prisma/client";

import {
  buscarEnderecoDoCliente,
  buscarVariantesDoPedido,
} from "../repositories/pedidoRepository";

export type ItemNovoPedido = {
  variantId: number;
  quantity: number;
};

export type DadosNovoPedido = {
  enderecoId: number;
  freteId: number;
  itens: ItemNovoPedido[];
};

/* =========================================================
   ERRO DE REGRA DE NEGÓCIO
   ========================================================= */

export class PedidoServiceError extends Error {
  constructor(
    mensagem: string,
    public readonly status: number = 400
  ) {
    super(mensagem);
    this.name = "PedidoServiceError";
  }
}

/* =========================================================
   VALIDAR INTEIRO POSITIVO
   ========================================================= */

function inteiroPositivo(valor: unknown): valor is number {
  return (
    typeof valor === "number" &&
    Number.isSafeInteger(valor) &&
    valor > 0
  );
}

/* =========================================================
   VALIDAR DADOS DO NOVO PEDIDO
   ========================================================= */

export function validarDadosNovoPedido(
  entrada: unknown
): DadosNovoPedido {
  if (
    !entrada ||
    typeof entrada !== "object" ||
    Array.isArray(entrada)
  ) {
    throw new PedidoServiceError(
      "Dados do pedido inválidos."
    );
  }

  const dados = entrada as Record<string, unknown>;

  /* =====================================================
     VALIDAR ENDEREÇO
     ===================================================== */

  if (!inteiroPositivo(dados.enderecoId)) {
    throw new PedidoServiceError(
      "Selecione um endereço de entrega válido."
    );
  }

  /* =====================================================
     VALIDAR FRETE
     =====================================================
     O identificador da modalidade será posteriormente
     conferido com uma cotação oficial no servidor.
     ===================================================== */

  if (!inteiroPositivo(dados.freteId)) {
    throw new PedidoServiceError(
      "Selecione uma modalidade de frete válida."
    );
  }

  /* =====================================================
     VALIDAR ITENS
     ===================================================== */

  if (
    !Array.isArray(dados.itens) ||
    dados.itens.length === 0 ||
    dados.itens.length > 30
  ) {
    throw new PedidoServiceError(
      "O pedido deve conter entre 1 e 30 itens."
    );
  }

  const itensAgrupados = new Map<number, number>();

  for (const item of dados.itens) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item)
    ) {
      throw new PedidoServiceError(
        "Um dos itens do pedido é inválido."
      );
    }

    const atual = item as Record<string, unknown>;

    if (
      !inteiroPositivo(atual.variantId) ||
      !inteiroPositivo(atual.quantity) ||
      atual.quantity > 100
    ) {
      throw new PedidoServiceError(
        "Produto ou quantidade inválida."
      );
    }

    const quantidadeAnterior =
      itensAgrupados.get(atual.variantId) ?? 0;

    const quantidadeTotal =
      quantidadeAnterior + atual.quantity;

    if (quantidadeTotal > 100) {
      throw new PedidoServiceError(
        "Quantidade máxima excedida para um produto."
      );
    }

    itensAgrupados.set(
      atual.variantId,
      quantidadeTotal
    );
  }

  /* =====================================================
     RETORNAR DADOS NORMALIZADOS
     ===================================================== */

  return {
    enderecoId: dados.enderecoId,
    freteId: dados.freteId,
    itens: Array.from(
      itensAgrupados,
      ([variantId, quantity]) => ({
        variantId,
        quantity,
      })
    ),
  };
}


/* =========================================================
   PREPARAR PEDIDO - PÁDUA CULTURE
   =========================================================
   Valida os dados do checkout e consulta o banco.

   Não cria pedido, pagamento ou movimentação de estoque.
   ========================================================= */

export async function prepararNovoPedido(
  usuarioId: number,
  entrada: unknown
) {
  /* =====================================================
     1. VALIDAR OS DADOS RECEBIDOS
     ===================================================== */

  if (
    !Number.isSafeInteger(usuarioId) ||
    usuarioId <= 0
  ) {
    throw new PedidoServiceError(
      "Usuário inválido.",
      401
    );
  }

  const dados = validarDadosNovoPedido(entrada);

  /* =====================================================
     2. VERIFICAR SE O ENDEREÇO PERTENCE AO CLIENTE
     ===================================================== */

  const endereco = await buscarEnderecoDoCliente(
    usuarioId,
    dados.enderecoId
  );

  if (!endereco) {
    throw new PedidoServiceError(
      "Endereço não encontrado para este cliente.",
      404
    );
  }

  /* =====================================================
     3. CONSULTAR PRODUTOS ATIVOS
     ===================================================== */

  const variantes = await buscarVariantesDoPedido(
    dados.itens.map((item) => item.variantId)
  );

  if (variantes.length !== dados.itens.length) {
    throw new PedidoServiceError(
      "Um ou mais produtos não estão disponíveis.",
      409
    );
  }

  const variantesPorId = new Map(
    variantes.map((variante) => [
      variante.id,
      variante,
    ])
  );

  /* =====================================================
     4. VERIFICAR ESTOQUE E CALCULAR SUBTOTAL
     =====================================================
     Prisma.Decimal evita cálculos monetários com
     ponto flutuante do JavaScript.
     ===================================================== */

  let subtotal = new Prisma.Decimal(0);

  const itens = dados.itens.map((item) => {
    const variante = variantesPorId.get(item.variantId);

    if (!variante) {
      throw new PedidoServiceError(
        "Produto não encontrado.",
        409
      );
    }

    if (variante.quantidade < item.quantity) {
      throw new PedidoServiceError(
        `Estoque insuficiente para ${variante.produto.nome} (${variante.cor}, ${variante.tamanho}).`,
        409
      );
    }

    const preco = variante.produto.precoPromocional
      ?? variante.produto.preco;

    if (preco.lessThan(0)) {
      throw new PedidoServiceError(
        "Preço inválido para um dos produtos.",
        409
      );
    }

    const subtotalItem = preco.mul(item.quantity);

    subtotal = subtotal.plus(subtotalItem);

    return {
      varianteId: variante.id,
      nomeProduto: variante.produto.nome,
      tamanho: variante.tamanho,
      cor: variante.cor,
      quantidade: item.quantity,
      precoUnitario: preco,
      subtotal: subtotalItem,
      pesoGramas: variante.produto.pesoGramas,
      categoriaSlug: variante.produto.categoria.slug,
    };
  });

  /* =====================================================
     5. RETORNAR DADOS PREPARADOS
     =====================================================
     O frete ainda não está validado nesta etapa.

     Não utilizar este resultado para gerar cobranças
     ou gravar pedidos até integrar a cotação oficial.
     ===================================================== */

  return {
    usuarioId,
    endereco,
    freteId: dados.freteId,
    itens,
    subtotal,
  };
}


/* =========================================================
   VALIDAR FRETE DO PEDIDO - PÁDUA CULTURE
   =========================================================
   Responsabilidades:
   - Consultar os produtos já validados pelo Service.
   - Montar as embalagens.
   - Solicitar uma nova cotação ao Melhor Envio.
   - Conferir a modalidade selecionada pelo cliente.
   - Retornar o valor oficial do frete.

   Não cria pedidos, cobranças ou etiquetas.
   ========================================================= */

export async function prepararPedidoComFrete(
  usuarioId: number,
  entrada: unknown
) {
  /* =====================================================
     1. VALIDAR CLIENTE, ENDEREÇO E PRODUTOS
     ===================================================== */

  const pedido = await prepararNovoPedido(
    usuarioId,
    entrada
  );

  /* =====================================================
     2. MONTAR UNIDADES PARA EMBALAGEM
     ===================================================== */

  const unidades: UnidadeEmbalagem[] = [];

  for (const item of pedido.itens) {
    if (
      item.pesoGramas === null ||
      !Number.isSafeInteger(item.pesoGramas) ||
      item.pesoGramas <= 0
    ) {
      throw new PedidoServiceError(
        `O produto ${item.nomeProduto} não possui peso válido.`,
        422
      );
    }

    for (let i = 0; i < item.quantidade; i++) {
      unidades.push({
        pesoGramas: item.pesoGramas,
        valor: Number(item.precoUnitario),
        categoria: item.categoriaSlug,
      });
    }
  }

  /* =====================================================
     3. CALCULAR EMBALAGENS
     ===================================================== */

  let resultadoEmbalagem: ReturnType<
    typeof montarVolumesFrete
  >;

  try {
    resultadoEmbalagem = montarVolumesFrete(unidades);
  } catch (error) {
    if (error instanceof EmbalagemFreteError) {
      throw new PedidoServiceError(
        error.message,
        422
      );
    }

    throw error;
  }

  /* =====================================================
     4. CONSULTAR NOVAMENTE O MELHOR ENVIO
     =====================================================
     O CEP vem do endereço cadastrado no banco.

     O valor do frete nunca é recebido do navegador.
     ===================================================== */

  const opcoes = await cotarFreteMelhorEnvio({
    cepDestino: pedido.endereco.cep,
    volumes: resultadoEmbalagem.volumes,
    valorSegurado: resultadoEmbalagem.valorSegurado,
  });

  /* =====================================================
     5. CONFERIR A MODALIDADE SELECIONADA
     ===================================================== */

  const freteSelecionado = opcoes.find(
    (opcao) => opcao.id === pedido.freteId
  );

  if (!freteSelecionado) {
    throw new PedidoServiceError(
      "A modalidade de frete selecionada não está mais disponível. Faça uma nova cotação.",
      409
    );
  }

  /* =====================================================
     6. CALCULAR VALOR TOTAL DO PEDIDO
     =====================================================
     Os valores monetários são tratados com Decimal.
     ===================================================== */

  const valorFrete = new Prisma.Decimal(
    freteSelecionado.preco.toFixed(2)
  );

  const valorTotal = pedido.subtotal.plus(valorFrete);

  /* =====================================================
     7. RETORNAR PEDIDO PREPARADO
     =====================================================
     Ainda não existe gravação no banco.
     ===================================================== */

  return {
    ...pedido,
    frete: {
      id: freteSelecionado.id,
      nome: freteSelecionado.nome,
      transportadora: freteSelecionado.transportadora,
      prazoDias: freteSelecionado.prazoDias,
    },
    valorFrete,
    valorTotal,
  };
}
