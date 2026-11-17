// Cliente da API. Em produção o Nginx encaminha /api para o backend.
const BASE = '/api';

async function req(path, options) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.erros?.join('; ') || `Erro ${res.status}`);
  return body;
}

export const api = {
  produtos: () => req('/produtos'),
  pedidos: () => req('/pedidos'),
  criarPedido: (dados) => req('/pedidos', { method: 'POST', body: JSON.stringify(dados) }),
  mudarStatus: (id, status) => req(`/pedidos/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

export const moeda = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
