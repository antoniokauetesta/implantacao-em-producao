const app = require('./app');
const prisma = require('./prisma');

const PORT = Number(process.env.PORT || 3000);
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[estulanches] API ouvindo na porta ${PORT}`);
});

// Encerramento gracioso (docker stop envia SIGTERM)
async function encerrar(sinal) {
  console.log(`[estulanches] ${sinal} recebido, encerrando...`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}
process.on('SIGTERM', () => encerrar('SIGTERM'));
process.on('SIGINT', () => encerrar('SIGINT'));
