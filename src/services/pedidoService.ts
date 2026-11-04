
/* =========================================================
   PEDIDO SERVICE - PÁDUA CULTURE
   =========================================================
   Responsável pelas regras de negócio dos pedidos.

   Funcionalidades:
   - Validar o endereço selecionado.
   - Validar produtos e quantidades.
   - Conferir disponibilidade de estoque.
   - Validar a modalidade de frete.
   - Calcular os valores oficiais do pedido.
   - Encaminhar os dados para o Repository.

   IMPORTANTE:
   Os valores enviados pelo navegador nunca são
   considerados preços oficiais.
   ========================================================= */

import {
  montarVolumesFrete,
  EmbalagemFreteError,
  type UnidadeEmbalagem,
} from "./embalagemFreteService";

import { cotarFreteMelhorEnvio } from "./melhorEnvioService";

import { Prisma } from "@prisma/client";

import {
  buscarEnderecoDoCliente,
  buscarVariantesDoPedido,
  buscarPedidoPorChaveIdempotencia,
  registrarPedido,
} from "../repositories/pedidoRepository";

// Função nativa do Node.js para gerar o SHA-256.
import { createHash } from "node:crypto";



/* =========================================================
   TIPOS DE ENTRADA
   ========================================================= */

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
   DADOS DE FINALIZAÇÃO DO CHECKOUT
   =========================================================
   A chave identifica uma tentativa de compra.

   Ela deve permanecer igual quando o cliente
   repetir a mesma tentativa de checkout.
   ========================================================= */

export type DadosCheckoutPedido = DadosNovoPedido & {
  chaveIdempotencia: string;
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
   VALIDAR CHAVE DE IDEMPOTÊNCIA
   =========================================================
   Aceita somente UUIDs no formato convencional.

   A chave não pode ser criada novamente pelo servidor
   a cada repetição da mesma tentativa de checkout.
   ========================================================= */

export function validarChaveIdempotencia(
  valor: unknown
): string {
  if (
    typeof valor !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(valor)
  ) {
    throw new PedidoServiceError(
      "Chave de idempotência inválida.",
      400
    );
  }

  return valor.toLowerCase();
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
     1. VALIDAR ENDEREÇO
     ===================================================== */

  if (!inteiroPositivo(dados.enderecoId)) {
    throw new PedidoServiceError(
      "Selecione um endereço de entrega válido."
    );
  }

  /* =====================================================
     2. VALIDAR FRETE
     =====================================================
     O identificador será conferido novamente com
     uma cotação oficial realizada no servidor.
     ===================================================== */

  if (!inteiroPositivo(dados.freteId)) {
    throw new PedidoServiceError(
      "Selecione uma modalidade de frete válida."
    );
  }

  /* =====================================================
     3. VALIDAR ITENS
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

  // Agrupa variantes repetidas na mesma compra.
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
     4. RETORNAR DADOS NORMALIZADOS
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
   Valida o checkout e consulta os dados oficiais
   armazenados no banco.

   Não cria pedidos, pagamentos ou movimentações
   de estoque nesta etapa.
   ========================================================= */

export async function prepararNovoPedido(
  usuarioId: number,
  entrada: unknown
) {
  /* =====================================================
     1. VALIDAR CLIENTE E DADOS RECEBIDOS
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

  // Facilita a localização de cada variante pelo ID.
  const variantesPorId = new Map(
    variantes.map((variante) => [
      variante.id,
      variante,
    ])
  );

  /* =====================================================
     4. VERIFICAR ESTOQUE E CALCULAR SUBTOTAL
     =====================================================
     Prisma.Decimal evita imprecisões nos cálculos
     monetários.
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

    // Confere o estoque disponível no momento da consulta.
    if (variante.quantidade < item.quantity) {
      throw new PedidoServiceError(
        `Estoque insuficiente para ${variante.produto.nome} (${variante.cor}, ${variante.tamanho}).`,
        409
      );
    }

    // Aplica o preço promocional quando estiver definido.
    const preco =
      variante.produto.precoPromocional ??
      variante.produto.preco;

    if (preco.lessThan(0)) {
      throw new PedidoServiceError(
        "Preço inválido para um dos produtos.",
        409
      );
    }

    const subtotalItem = preco.mul(item.quantity);

    subtotal = subtotal.plus(subtotalItem);

    // Preserva os dados do produto para o pedido.
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
     O frete ainda será validado na próxima função.
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
   - Validar cliente, endereço e produtos.
   - Montar as embalagens.
   - Consultar novamente o Melhor Envio.
   - Conferir a modalidade escolhida.
   - Calcular o valor total.

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
    // Cada produto precisa possuir peso válido.
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

    // Adiciona uma unidade para cada peça comprada.
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

     O preço do frete nunca é aceito diretamente
     do navegador.
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
     ===================================================== */

  const valorFrete = new Prisma.Decimal(
    freteSelecionado.preco.toFixed(2)
  );

  const valorTotal = pedido.subtotal.plus(valorFrete);

  /* =====================================================
     7. RETORNAR PEDIDO PREPARADO
     =====================================================
     Os dados estão prontos para o Repository,
     mas ainda não foram gravados.
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
} // CORREÇÃO: encerra prepararPedidoComFrete()

/* =========================================================
   CRIAR PEDIDO - PÁDUA CULTURE
   =========================================================
   Responsabilidades:
   1. Validar cliente, endereço e produtos.
   2. Consultar novamente o Melhor Envio.
   3. Calcular os valores oficiais.
   4. Registrar o pedido no banco de dados.

   IMPORTANTE:
   - Não processa pagamentos.
   - Não reserva nem desconta estoque.
   - Não gera etiquetas de envio.
   - Não impede pedidos duplicados.

   Esta função não deve ser exposta publicamente
   antes da implementação dessas proteções.
   ========================================================= */



/* =========================================================
   CRIAR PEDIDO - PÁDUA CULTURE
   =========================================================
   Responsabilidades:
   1. Validar os dados do cliente e dos produtos.
   2. Conferir o frete com o Melhor Envio.
   3. Preparar a identificação do pedido.
   4. Definir o prazo da reserva de estoque.
   5. Enviar os dados ao Repository.

   IMPORTANTE:
   A idempotência definitiva e a liberação automática
   do estoque serão implementadas nas próximas etapas.
   ========================================================= */

export async function criarNovoPedido(
  usuarioId: number,
  entrada: unknown
) {
  /* =====================================================
     1. PREPARAR E VALIDAR O PEDIDO
     ===================================================== */

/* =====================================================
   1. VALIDAR A SOLICITAÇÃO DO CHECKOUT
   ===================================================== */

// Confere os dados enviados pelo cliente.
const dadosValidados = validarDadosNovoPedido(entrada);

/* =====================================================
   GERAR A IDENTIFICAÇÃO DOS DADOS DO CHECKOUT
   =====================================================
   O hash considera:
   - Cliente autenticado.
   - Endereço selecionado.
   - Modalidade de frete.
   - Produtos e quantidades.

   Ordenamos os produtos para que a mesma compra
   gere o mesmo hash, independentemente da ordem
   em que os itens foram enviados.
   ===================================================== */

// Organiza os produtos em uma ordem consistente.
const itensOrdenados = [...dadosValidados.itens].sort(
  (a, b) => a.variantId - b.variantId
);

// Monta a representação normalizada da compra.
const dadosParaHash = {
  usuarioId,
  enderecoId: dadosValidados.enderecoId,
  freteId: dadosValidados.freteId,
  itens: itensOrdenados.map((item) => ({
    variantId: item.variantId,
    quantity: item.quantity,
  })),
};

// Calcula o SHA-256 dos dados da tentativa de checkout.
const hashCheckout = createHash("sha256")
  .update(JSON.stringify(dadosParaHash))
  .digest("hex");

// Obtém a chave estável da tentativa de compra.
const chaveIdempotencia = validarChaveIdempotencia(
  (entrada as Record<string, unknown>).chaveIdempotencia
);

/* =====================================================
   2. CONSULTAR TENTATIVA ANTERIOR
   ===================================================== */

const pedidoExistente =
  await buscarPedidoPorChaveIdempotencia(chaveIdempotencia);

/* =====================================================
   VERIFICAR SE A TENTATIVA JÁ FOI REGISTRADA
   ===================================================== */

if (pedidoExistente) {
  // Impede que um cliente acesse pedidos de outro usuário.
  if (pedidoExistente.usuarioId !== usuarioId) {
    throw new PedidoServiceError(
      "Chave de idempotência já utilizada.",
      409
    );
  }

  // Impede reutilizar a mesma chave com outra compra.
  // Pedidos antigos sem hash não podem ser comparados.
  if (
    !pedidoExistente.hashCheckout ||
    pedidoExistente.hashCheckout !== hashCheckout
  ) {
    throw new PedidoServiceError(
      "Esta chave de idempotência já foi utilizada com dados diferentes.",
      409
    );
  }

  // Retorna a compra original sem reservar estoque novamente.
  // O status e o prazo da reserva continuam sendo os originais.
  return {
    id: pedidoExistente.id,
    status: pedidoExistente.status,
    valorTotal: pedidoExistente.valorTotal,
    criadoEm: pedidoExistente.criadoEm,
  };
}

/* =====================================================
   3. PREPARAR UM NOVO PEDIDO
   ===================================================== */

// Somente pedidos inéditos chegam à cotação de frete.
const pedidoPreparado = await prepararPedidoComFrete(
  usuarioId,
  dadosValidados
);

  /* =====================================================
     2. GERAR A IDENTIFICAÇÃO DA TENTATIVA
     =====================================================
     Por enquanto, geramos um UUID no servidor.

     Esta implementação é temporária:
     a idempotência real exigirá uma chave estável
     para a mesma tentativa de checkout.
     ===================================================== */



  /* =====================================================
     3. DEFINIR A EXPIRAÇÃO DA RESERVA
     =====================================================
     A reserva terá um prazo inicial de 15 minutos.

     Isso apenas registra a data no banco.
     Não existe liberação automática nesta etapa.
     ===================================================== */

  const reservaExpiraEm = new Date(
    Date.now() + 15 * 60 * 1000
  );

  /* =====================================================
     4. REGISTRAR O PEDIDO NO BANCO
     =====================================================
     O Repository será responsável por:
     - Criar o pedido.
     - Reservar o estoque.
     - Registrar os itens.
     - Salvar o endereço.
     - Registrar a entrega.
     - Criar o histórico.

     Todas essas operações devem ocorrer dentro
     da mesma transação Prisma.
     ===================================================== */

  // Tenta registrar o pedido e reservar o estoque.
  // Se outra requisição já utilizou a mesma chave,
  // o erro será tratado sem criar uma segunda compra.
  try {

    const pedidoRegistrado = await registrarPedido({
      // Identificação do cliente.
      usuarioId: pedidoPreparado.usuarioId,

      // Identificação da tentativa de checkout.
      chaveIdempotencia,

      // Identifica os dados originais da compra.
      // Será comparado nas tentativas repetidas.
      hashCheckout,

      // Prazo de validade da reserva.
      reservaExpiraEm,

      // Valores calculados pelo servidor.
      subtotal: pedidoPreparado.subtotal,
      valorFrete: pedidoPreparado.valorFrete,
      valorTotal: pedidoPreparado.valorTotal,

      /* =================================================
        ENDEREÇO DE ENTREGA
        ================================================= */

      endereco: {
        destinatario: pedidoPreparado.endereco.destinatario,
        cep: pedidoPreparado.endereco.cep,
        logradouro: pedidoPreparado.endereco.logradouro,
        numero: pedidoPreparado.endereco.numero,
        complemento: pedidoPreparado.endereco.complemento,
        bairro: pedidoPreparado.endereco.bairro,
        cidade: pedidoPreparado.endereco.cidade,
        estado: pedidoPreparado.endereco.estado,
      },

      /* =================================================
        INFORMAÇÕES DO FRETE
        ================================================= */

      frete: {
        nome: pedidoPreparado.frete.nome,
        transportadora: pedidoPreparado.frete.transportadora,
      },

      /* =================================================
        PRODUTOS DO PEDIDO
        ================================================= */

      itens: pedidoPreparado.itens.map((item) => ({
        varianteId: item.varianteId,
        nomeProduto: item.nomeProduto,
        tamanho: item.tamanho,
        cor: item.cor,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        subtotal: item.subtotal,
      })),
    });

  /* =====================================================
     5. RETORNAR O PEDIDO REGISTRADO
     ===================================================== */

  // Primeira tentativa concluída: retorna o pedido criado.
  return pedidoRegistrado;

} catch (erro: unknown) {
  /*
   * P2002: violação de restrição UNIQUE do Prisma.
   *
   * Pode ocorrer quando duas requisições tentam
   * registrar a mesma chave simultaneamente.
   */
  if (
    erro instanceof Prisma.PrismaClientKnownRequestError &&
    erro.code === "P2002"
  ) {
    // Consulta novamente o pedido que venceu a concorrência.
    const pedidoExistente =
      await buscarPedidoPorChaveIdempotencia(chaveIdempotencia);

    // Se não existir pedido com essa chave, o conflito
    // pode ter ocorrido em outra restrição UNIQUE.
    if (!pedidoExistente) {
      throw erro;
    }

    // Impede acesso a pedidos de outro cliente.
    if (pedidoExistente.usuarioId !== usuarioId) {
      throw new PedidoServiceError(
        "Chave de idempotência já utilizada.",
        409
      );
    }

    // A chave não pode representar duas compras diferentes.
    if (
      !pedidoExistente.hashCheckout ||
      pedidoExistente.hashCheckout !== hashCheckout
    ) {
      throw new PedidoServiceError(
        "Esta chave já foi utilizada com dados diferentes.",
        409
      );
    }

    // Retorna o pedido original sem reservar estoque novamente.
    return {
      id: pedidoExistente.id,
      status: pedidoExistente.status,
      valorTotal: pedidoExistente.valorTotal,
      criadoEm: pedidoExistente.criadoEm,
    };
  }

  // Erros de estoque, banco ou outros problemas
  // não devem ser tratados como pedidos duplicados.
  throw erro;
}
}


