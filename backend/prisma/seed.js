// Popula o cardápio inicial apenas se a tabela estiver vazia (idempotente).
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const produtos = [
  { nome: 'Coxinha', descricao: 'Coxinha de frango', preco: '6.50', categoria: 'Salgados' },
  { nome: 'Pão de queijo', descricao: 'Porção com 3 unidades', preco: '5.00', categoria: 'Salgados' },
  { nome: 'Misto quente', descricao: 'Pão, queijo e presunto', preco: '7.00', categoria: 'Lanches' },
  { nome: 'Suco de laranja', descricao: 'Copo de 300 ml', preco: '5.50', categoria: 'Bebidas' },
  { nome: 'Água mineral', descricao: 'Garrafa de 500 ml', preco: '3.00', categoria: 'Bebidas' },
  { nome: 'Brigadeiro', descricao: 'Doce tradicional', preco: '3.50', categoria: 'Doces' },
];

async function main() {
  const total = await prisma.produto.count();
  if (total > 0) {
    console.log(`[seed] Cardápio já possui ${total} produtos. Nada a fazer.`);
    return;
  }
  await prisma.produto.createMany({ data: produtos });
  console.log(`[seed] ${produtos.length} produtos criados.`);
}

main()
  .catch((e) => {
    console.error('[seed] erro:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
