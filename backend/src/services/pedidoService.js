// Regras de negócio puras (sem acesso a banco) - facilmente testáveis (testes unitários).

const STATUS = ['PENDENTE', 'EM_PREPARO', 'PRONTO', 'ENTREGUE', 'CANCELADO'];

// Fluxo permitido de status do pedido.
const TRANSICOES = {
  PENDENTE: ['EM_PREPARO', 'CANCELADO'],
  EM_PREPARO: ['PRONTO', 'CANCELADO'],
  PRONTO: ['ENTREGUE'],
  ENTREGUE: [],
  CANCELADO: [],
};

/** Valida o corpo de criação de pedido. Retorna lista de erros (vazia = válido). */
function validarPedido(body) {
  const erros = [];
  if (!body || typeof body !== 'object') return ['Corpo da requisição inválido'];

  const cliente = typeof body.cliente === 'string' ? body.cliente.trim() : '';
  if (cliente.length < 2 || cliente.length > 80) {
    erros.push('cliente deve ter entre 2 e 80 caracteres');
  }

  if (!Array.isArray(body.itens) || body.itens.length === 0) {
    erros.push('itens deve ser uma lista com pelo menos 1 item');
  } else if (body.itens.length > 50) {
    erros.push('itens deve ter no máximo 50 itens');
  } else {
    body.itens.forEach((item, i) => {
      if (!Number.isInteger(item?.produtoId) || item.produtoId <= 0) {
        erros.push(`itens[${i}].produtoId deve ser um inteiro positivo`);
      }
      if (!Number.isInteger(item?.quantidade) || item.quantidade < 1 || item.quantidade > 20) {
        erros.push(`itens[${i}].quantidade deve ser um inteiro entre 1 e 20`);
      }
    });
  }
  return erros;
}

/** Valida o corpo de criação/edição de produto. */
function validarProduto(body, { parcial = false } = {}) {
  const erros = [];
  if (!body || typeof body !== 'object') return ['Corpo da requisição inválido'];

  if (!parcial || body.nome !== undefined) {
    if (typeof body.nome !== 'string' || body.nome.trim().length < 2 || body.nome.length > 80) {
      erros.push('nome deve ter entre 2 e 80 caracteres');
    }
  }
  if (!parcial || body.preco !== undefined) {
    const preco = Number(body.preco);
    if (!Number.isFinite(preco) || preco <= 0 || preco > 9999) {
      erros.push('preco deve ser um número maior que 0 e até 9999');
    }
  }
  if (!parcial || body.categoria !== undefined) {
    if (typeof body.categoria !== 'string' || body.categoria.trim().length < 2) {
      erros.push('categoria é obrigatória');
    }
  }
  if (body.disponivel !== undefined && typeof body.disponivel !== 'boolean') {
    erros.push('disponivel deve ser booleano');
  }
  return erros;
}

/** Soma o total em centavos para evitar erros de ponto flutuante. Retorna string "0.00". */
function calcularTotal(itens) {
  const centavos = itens.reduce(
    (soma, item) => soma + Math.round(Number(item.precoUnitario) * 100) * item.quantidade,
    0
  );
  return (centavos / 100).toFixed(2);
}

function podeTransitar(de, para) {
  return Boolean(TRANSICOES[de] && TRANSICOES[de].includes(para));
}

module.exports = { STATUS, TRANSICOES, validarPedido, validarProduto, calcularTotal, podeTransitar };
