const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const prisma = require('./prisma');
const {
  STATUS,
  validarPedido,
  validarProduto,
  calcularTotal,
  podeTransitar,
} = require('./services/pedidoService');

const app = express();

// ---------- Segurança ----------
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || false }));
app.use(express.json({ limit: '10kb' }));
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: Number(process.env.RATE_LIMIT || 300),
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const asyncH = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const parseId = (v) => (/^\d+$/.test(v) ? Number(v) : null);

// ---------- Health check ----------
app.get(
  '/health',
  asyncH(async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', banco: 'conectado' });
  })
);

// ---------- Produtos (cardápio) ----------
app.get(
  '/produtos',
  asyncH(async (_req, res) => {
    const produtos = await prisma.produto.findMany({ orderBy: [{ categoria: 'asc' }, { nome: 'asc' }] });
    res.json(produtos);
  })
);

app.post(
  '/produtos',
  asyncH(async (req, res) => {
    const erros = validarProduto(req.body);
    if (erros.length) return res.status(400).json({ erros });
    const { nome, descricao, preco, categoria, disponivel } = req.body;
    const produto = await prisma.produto.create({
      data: { nome: nome.trim(), descricao, preco: Number(preco).toFixed(2), categoria: categoria.trim(), disponivel },
    });
    res.status(201).json(produto);
  })
);

app.put(
  '/produtos/:id',
  asyncH(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ erros: ['id inválido'] });
    const erros = validarProduto(req.body, { parcial: true });
    if (erros.length) return res.status(400).json({ erros });
    const { nome, descricao, preco, categoria, disponivel } = req.body;
    const data = {};
    if (nome !== undefined) data.nome = nome.trim();
    if (descricao !== undefined) data.descricao = descricao;
    if (preco !== undefined) data.preco = Number(preco).toFixed(2);
    if (categoria !== undefined) data.categoria = categoria.trim();
    if (disponivel !== undefined) data.disponivel = disponivel;
    const produto = await prisma.produto.update({ where: { id }, data });
    res.json(produto);
  })
);

app.delete(
  '/produtos/:id',
  asyncH(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ erros: ['id inválido'] });
    // Remoção lógica: preserva o histórico de pedidos.
    await prisma.produto.update({ where: { id }, data: { disponivel: false } });
    res.status(204).end();
  })
);

// ---------- Pedidos ----------
app.post(
  '/pedidos',
  asyncH(async (req, res) => {
    const erros = validarPedido(req.body);
    if (erros.length) return res.status(400).json({ erros });

    const ids = [...new Set(req.body.itens.map((i) => i.produtoId))];
    const produtos = await prisma.produto.findMany({ where: { id: { in: ids } } });
    const porId = new Map(produtos.map((p) => [p.id, p]));

    const problemas = [];
    for (const id of ids) {
      const p = porId.get(id);
      if (!p) problemas.push(`produto ${id} não existe`);
      else if (!p.disponivel) problemas.push(`produto "${p.nome}" indisponível`);
    }
    if (problemas.length) return res.status(422).json({ erros: problemas });

    // O preço vem SEMPRE do banco, nunca do cliente.
    const itens = req.body.itens.map((i) => ({
      produtoId: i.produtoId,
      quantidade: i.quantidade,
      precoUnitario: porId.get(i.produtoId).preco.toString(),
    }));

    const pedido = await prisma.pedido.create({
      data: { cliente: req.body.cliente.trim(), total: calcularTotal(itens), itens: { create: itens } },
      include: { itens: true },
    });
    res.status(201).json(pedido);
  })
);

app.get(
  '/pedidos',
  asyncH(async (req, res) => {
    const where = {};
    if (req.query.status) {
      if (!STATUS.includes(req.query.status)) return res.status(400).json({ erros: ['status inválido'] });
      where.status = req.query.status;
    }
    const pedidos = await prisma.pedido.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      take: 100,
      include: { itens: { include: { produto: { select: { nome: true } } } } },
    });
    res.json(pedidos);
  })
);

app.get(
  '/pedidos/:id',
  asyncH(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ erros: ['id inválido'] });
    const pedido = await prisma.pedido.findUnique({
      where: { id },
      include: { itens: { include: { produto: { select: { nome: true } } } } },
    });
    if (!pedido) return res.status(404).json({ erros: ['pedido não encontrado'] });
    res.json(pedido);
  })
);

app.patch(
  '/pedidos/:id/status',
  asyncH(async (req, res) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ erros: ['id inválido'] });
    const novo = req.body?.status;
    if (!STATUS.includes(novo)) return res.status(400).json({ erros: ['status inválido'] });

    const atual = await prisma.pedido.findUnique({ where: { id } });
    if (!atual) return res.status(404).json({ erros: ['pedido não encontrado'] });
    if (!podeTransitar(atual.status, novo)) {
      return res.status(409).json({ erros: [`transição ${atual.status} -> ${novo} não permitida`] });
    }
    const pedido = await prisma.pedido.update({ where: { id }, data: { status: novo } });
    res.json(pedido);
  })
);

// ---------- Erros ----------
app.use((_req, res) => res.status(404).json({ erros: ['rota não encontrada'] }));

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.code === 'P2025') return res.status(404).json({ erros: ['registro não encontrado'] });
  if (err.code === 'P2002') return res.status(409).json({ erros: ['registro duplicado'] });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ erros: ['JSON inválido'] });
  console.error('[erro]', err); // detalhes ficam só no log, nunca na resposta
  res.status(500).json({ erros: ['erro interno do servidor'] });
});

module.exports = app;
