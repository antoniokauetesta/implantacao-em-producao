# 🥪 EstuLanches

Sistema de gestão de **cardápio e pedidos da cantina escolar**, implantado em produção com **Docker**.

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + Vite, servido por Nginx (sem root) |
| Backend | Node.js 20 + Express + **Prisma** (ORM) |
| Banco | PostgreSQL 16 + **pgAdmin 4** |
| Testes | Jest + Supertest (unitários e de integração) |
| Infra | Dockerfile multi-stage + Docker Compose |

## Como executar

Pré-requisito: Docker Desktop (ou Docker Engine + Compose v2).

```bash
cp .env.example .env        # (no Windows: copy .env.example .env) e troque as senhas
docker compose up -d --build
docker compose ps           # serviços e portas
docker compose logs         # auditoria dos logs
```

| Serviço | URL |
|---|---|
| Sistema (frontend) | http://localhost:8080 |
| API | http://localhost:3000/health |
| pgAdmin 4 | http://localhost:5050 (login = PGADMIN_EMAIL / PGADMIN_PASSWORD do `.env`) |

No pgAdmin o servidor **EstuLanches** já aparece cadastrado. Ao abrir, informe a senha `DB_PASSWORD` do `.env`.
Tabelas: *Servers → EstuLanches → Databases → estulanches → Schemas → public → Tables*.

## Testes

```bash
# Dentro do Docker (recomendado): migrations + unitários + integração, em schema separado ("test")
docker compose --profile test run --rm testes

# Ou localmente (precisa de um Postgres e DATABASE_URL)
cd backend && npm install && npx prisma migrate deploy && npm test
```

- `backend/tests/unit/` – regras de negócio puras: total, validações, fluxo de status.
- `backend/tests/integration/` – API + Prisma + PostgreSQL reais (cardápio, pedidos, segurança).

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| GET | `/health` | Verifica API e conexão com o banco |
| GET/POST | `/produtos` | Lista / cadastra produtos do cardápio |
| PUT/DELETE | `/produtos/:id` | Atualiza / desativa produto |
| POST | `/pedidos` | Cria pedido (`{cliente, itens:[{produtoId, quantidade}]}`) |
| GET | `/pedidos` `/pedidos/:id` | Lista (filtro `?status=`) / detalha |
| PATCH | `/pedidos/:id/status` | `PENDENTE → EM_PREPARO → PRONTO → ENTREGUE` (ou `CANCELADO`) |

## Segurança aplicada

- Senhas só em variáveis de ambiente (`.env` no `.gitignore`).
- Containers da API e do Nginx rodam **sem root**.
- Banco **sem porta publicada**; só a rede interna do Docker acessa.
- Prisma (queries parametrizadas) contra SQL injection; validação de toda entrada; limite de 10 KB no corpo.
- `helmet`, rate limit, CORS restrito, `x-powered-by` desativado.
- Preço do pedido vem **do banco**, nunca do cliente.
- Erros internos ficam no log; a resposta não vaza detalhes.
- Imagem de produção sem devDependencies (multi-stage) e com HEALTHCHECK.

## Escalabilidade (conceitual: 1 milhão de usuários, 100 mil simultâneos)

1. **Frontend estático em CDN** (CloudFront/Cloudflare): tira a maior parte do tráfego da aplicação.
2. **API stateless** em várias réplicas atrás de um **load balancer**, orquestrada com **Kubernetes** + autoscaling horizontal (HPA).
3. **Cache com Redis** para o cardápio (muito lido, pouco alterado).
4. **PostgreSQL gerenciado** com **réplicas de leitura**, **PgBouncer** (pool de conexões) e, se necessário, particionamento por região/escola.
5. **Fila de mensagens** (RabbitMQ/SQS) para absorver picos de pedidos (ex.: intervalo escolar).
6. **Observabilidade** (Prometheus + Grafana), health checks e deploy gradual (rolling/blue-green).
7. Múltiplas regiões/zonas de disponibilidade para alta disponibilidade.

## Estrutura

```
estulanches/
├── docker-compose.yml
├── .env.example
├── backend/   (Dockerfile, prisma/, src/, tests/)
├── frontend/  (Dockerfile, nginx.conf, src/)
├── pgadmin/   (servers.json)
└── docs/      (RDM.pdf, roteiro do vídeo, gerar_rdm.py)
```
