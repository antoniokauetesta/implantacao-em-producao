const {
  validarPedido,
  validarProduto,
  calcularTotal,
  podeTransitar,
} = require('../../src/services/pedidoService');

describe('calcularTotal', () => {
  test('soma preço x quantidade', () => {
    expect(calcularTotal([
      { precoUnitario: '6.50', quantidade: 2 },
      { precoUnitario: '3.00', quantidade: 1 },
    ])).toBe('16.00');
  });

  test('não sofre com erro de ponto flutuante (0.1 + 0.2)', () => {
    expect(calcularTotal([
      { precoUnitario: '0.10', quantidade: 1 },
      { precoUnitario: '0.20', quantidade: 1 },
    ])).toBe('0.30');
  });

  test('lista vazia resulta em 0.00', () => {
    expect(calcularTotal([])).toBe('0.00');
  });
});

describe('validarPedido', () => {
  const valido = { cliente: 'Maria', itens: [{ produtoId: 1, quantidade: 2 }] };

  test('aceita pedido válido', () => {
    expect(validarPedido(valido)).toEqual([]);
  });

  test('rejeita corpo vazio', () => {
    expect(validarPedido(undefined)).not.toEqual([]);
  });

  test('rejeita cliente curto', () => {
    expect(validarPedido({ ...valido, cliente: 'A' })).toContain('cliente deve ter entre 2 e 80 caracteres');
  });

  test('rejeita lista de itens vazia', () => {
    expect(validarPedido({ ...valido, itens: [] })).not.toEqual([]);
  });

  test('rejeita quantidade zero, negativa, decimal ou acima do limite', () => {
    for (const quantidade of [0, -1, 1.5, 21, '2']) {
      expect(validarPedido({ ...valido, itens: [{ produtoId: 1, quantidade }] })).not.toEqual([]);
    }
  });

  test('rejeita produtoId inválido', () => {
    expect(validarPedido({ ...valido, itens: [{ produtoId: 'abc', quantidade: 1 }] })).not.toEqual([]);
  });
});

describe('validarProduto', () => {
  test('aceita produto válido', () => {
    expect(validarProduto({ nome: 'Pizza', preco: 8, categoria: 'Salgados' })).toEqual([]);
  });

  test('rejeita preço negativo ou não numérico', () => {
    expect(validarProduto({ nome: 'Pizza', preco: -1, categoria: 'Salgados' })).not.toEqual([]);
    expect(validarProduto({ nome: 'Pizza', preco: 'x', categoria: 'Salgados' })).not.toEqual([]);
  });

  test('modo parcial valida só os campos enviados', () => {
    expect(validarProduto({ preco: 9 }, { parcial: true })).toEqual([]);
    expect(validarProduto({ preco: 0 }, { parcial: true })).not.toEqual([]);
  });
});

describe('podeTransitar (fluxo do pedido)', () => {
  test('permite o fluxo normal', () => {
    expect(podeTransitar('PENDENTE', 'EM_PREPARO')).toBe(true);
    expect(podeTransitar('EM_PREPARO', 'PRONTO')).toBe(true);
    expect(podeTransitar('PRONTO', 'ENTREGUE')).toBe(true);
  });

  test('permite cancelar antes de ficar pronto', () => {
    expect(podeTransitar('PENDENTE', 'CANCELADO')).toBe(true);
    expect(podeTransitar('EM_PREPARO', 'CANCELADO')).toBe(true);
  });

  test('bloqueia saltos e estados finais', () => {
    expect(podeTransitar('PENDENTE', 'ENTREGUE')).toBe(false);
    expect(podeTransitar('ENTREGUE', 'PENDENTE')).toBe(false);
    expect(podeTransitar('CANCELADO', 'EM_PREPARO')).toBe(false);
    expect(podeTransitar('PRONTO', 'CANCELADO')).toBe(false);
  });
});
