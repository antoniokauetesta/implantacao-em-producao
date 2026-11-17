// Testes de INTEGRAÇÃO: API (Express) + Prisma + PostgreSQL reais.
// Exigem DATABASE_URL apontando para um banco com as migrations aplicadas.
const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/prisma');

let coxinha;
let suco;

beforeAll(async () => {
  await prisma.itemPedido.deleteMany();
  await prisma.pedido.deleteMany();
  await prisma.produto.deleteMany();
  coxinha = await prisma.produto.create({
    data: { nome: 'Coxinha', preco: '6.50', categoria: 'Salgados' },
  });
  suco = await prisma.produto.create({
    data: { nome: 'Suco', preco: '5.50', categoria: 'Bebidas', disponivel: false },
  });
});

afterAll(async () => {
  await prisma.itemPedido.deleteMany();
  await prisma.pedido.deleteMany();
  await prisma.produto.deleteMany();
  await prisma.$disconnect();
});

describe('GET /health', () => {
  test('confirma conexão com o banco', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', banco: 'conectado' });
  });
});

describe('Produtos', () => {
  test('lista o cardápio', async () => {
    const res = await request(app).get('/produtos');
    expect(res.status).toBe(200);
    expect(res.body.map((p) => p.nome)).toEqual(expect.arrayContaining(['Coxinha', 'Suco']));
  });

  test('cria, atualiza e remove (logicamente) um produto', async () => {
    const criado = await request(app).post('/produtos').send({ nome: 'Pastel', preco: 7.9, categoria: 'Salgados' });
    expect(criado.status).toBe(201);
    expect(criado.body.preco).toBe('7.9');

    const atualizado = await request(app).put(`/produtos/${criado.body.id}`).send({ preco: 8.5 });
    expect(atualizado.status).toBe(200);
    expect(atualizado.body.preco).toBe('8.5');

    const removido = await request(app).delete(`/produtos/${criado.body.id}`);
    expect(removido.status).toBe(204);
    const noBanco = await prisma.produto.findUnique({ where: { id: criado.body.id } });
    expect(noBanco.disponivel).toBe(false);
  });

  test('rejeita produto inválido com 400', async () => {
    const res = await request(app).post('/produtos').send({ nome: 'X', preco: -5 });
    expect(res.status).toBe(400);
    expect(res.body.erros.length).toBeGreaterThan(0);
  });

  test('rejeita nome duplicado com 409', async () => {
    const res = await request(app).post('/produtos').send({ nome: 'Coxinha', preco: 5, categoria: 'Salgados' });
    expect(res.status).toBe(409);
  });
});

describe('Pedidos', () => {
  test('cria pedido calculando o total a partir do preço do BANCO', async () => {
    const res = await request(app)
      .post('/pedidos')
      .send({ cliente: 'João', itens: [{ produtoId: coxinha.id, quantidade: 3, precoUnitario: '0.01' }] });
    expect(res.status).toBe(201);
    expect(res.body.total).toBe('19.5'); // 3 x 6,50 (ignora o preço enviado pelo cliente)
    expect(res.body.status).toBe('PENDENTE');
    expect(res.body.itens).toHaveLength(1);
  });

  test('rejeita produto indisponível (422) e inexistente (422)', async () => {
    const indisp = await request(app).post('/pedidos').send({ cliente: 'Ana', itens: [{ produtoId: suco.id, quantidade: 1 }] });
    expect(indisp.status).toBe(422);
    const inexist = await request(app).post('/pedidos').send({ cliente: 'Ana', itens: [{ produtoId: 999999, quantidade: 1 }] });
    expect(inexist.status).toBe(422);
  });

  test('rejeita pedido sem itens (400)', async () => {
    const res = await request(app).post('/pedidos').send({ cliente: 'Ana', itens: [] });
    expect(res.status).toBe(400);
  });

  test('segue o fluxo de status e bloqueia transições inválidas', async () => {
    const { body: pedido } = await request(app)
      .post('/pedidos')
      .send({ cliente: 'Carlos', itens: [{ produtoId: coxinha.id, quantidade: 1 }] });

    const invalida = await request(app).patch(`/pedidos/${pedido.id}/status`).send({ status: 'ENTREGUE' });
    expect(invalida.status).toBe(409);

    for (const status of ['EM_PREPARO', 'PRONTO', 'ENTREGUE']) {
      const ok = await request(app).patch(`/pedidos/${pedido.id}/status`).send({ status });
      expect(ok.status).toBe(200);
      expect(ok.body.status).toBe(status);
    }
  });

  test('busca por id e filtra por status', async () => {
    const lista = await request(app).get('/pedidos?status=PENDENTE');
    expect(lista.status).toBe(200);
    expect(lista.body.every((p) => p.status === 'PENDENTE')).toBe(true);

    const um = await request(app).get(`/pedidos/${lista.body[0].id}`);
    expect(um.status).toBe(200);

    expect((await request(app).get('/pedidos/999999')).status).toBe(404);
    expect((await request(app).get('/pedidos?status=XYZ')).status).toBe(400);
  });
});

describe('Segurança', () => {
  test('envia cabeçalhos do helmet e não expõe x-powered-by', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('tentativa de SQL injection no id é rejeitada', async () => {
    const res = await request(app).get('/pedidos/1;DROP TABLE "Pedido"');
    expect(res.status).toBe(400);
  });

  test('JSON malformado retorna 400 sem vazar detalhes', async () => {
    const res = await request(app).post('/pedidos').set('Content-Type', 'application/json').send('{ruim');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toMatch(/stack|at /);
  });
});
