import { useEffect, useState, useCallback } from 'react';
import { api, moeda } from './api.js';

const PROXIMO = { PENDENTE: 'EM_PREPARO', EM_PREPARO: 'PRONTO', PRONTO: 'ENTREGUE' };
const ROTULO = {
  PENDENTE: 'Pendente',
  EM_PREPARO: 'Em preparo',
  PRONTO: 'Pronto',
  ENTREGUE: 'Entregue',
  CANCELADO: 'Cancelado',
};

function Cardapio() {
  const [produtos, setProdutos] = useState([]);
  const [carrinho, setCarrinho] = useState({}); // { produtoId: quantidade }
  const [cliente, setCliente] = useState('');
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api.produtos().then(setProdutos).catch((e) => setMsg({ tipo: 'erro', texto: e.message }));
  }, []);

  const disponiveis = produtos.filter((p) => p.disponivel);
  const categorias = [...new Set(disponiveis.map((p) => p.categoria))];
  const itens = Object.entries(carrinho).filter(([, q]) => q > 0);
  const total = itens.reduce((s, [id, q]) => s + Number(produtos.find((p) => p.id === Number(id)).preco) * q, 0);

  const alterar = (id, delta) =>
    setCarrinho((c) => ({ ...c, [id]: Math.min(20, Math.max(0, (c[id] || 0) + delta)) }));

  async function enviar(e) {
    e.preventDefault();
    try {
      const pedido = await api.criarPedido({
        cliente,
        itens: itens.map(([id, q]) => ({ produtoId: Number(id), quantidade: q })),
      });
      setMsg({ tipo: 'ok', texto: `Pedido #${pedido.id} enviado! Total ${moeda(pedido.total)}` });
      setCarrinho({});
      setCliente('');
    } catch (err) {
      setMsg({ tipo: 'erro', texto: err.message });
    }
  }

  return (
    <div className="grid">
      <section>
        {categorias.map((cat) => (
          <div key={cat}>
            <h2>{cat}</h2>
            <ul className="lista">
              {disponiveis.filter((p) => p.categoria === cat).map((p) => (
                <li key={p.id} className="card">
                  <div>
                    <strong>{p.nome}</strong>
                    {p.descricao && <small>{p.descricao}</small>}
                    <span className="preco">{moeda(p.preco)}</span>
                  </div>
                  <div className="qtd">
                    <button onClick={() => alterar(p.id, -1)} aria-label={`Remover ${p.nome}`}>−</button>
                    <span>{carrinho[p.id] || 0}</span>
                    <button onClick={() => alterar(p.id, 1)} aria-label={`Adicionar ${p.nome}`}>+</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <aside className="card carrinho">
        <h2>Seu pedido</h2>
        {itens.length === 0 ? (
          <p className="vazio">Adicione itens do cardápio.</p>
        ) : (
          <ul>
            {itens.map(([id, q]) => {
              const p = produtos.find((x) => x.id === Number(id));
              return <li key={id}>{q}× {p.nome} <b>{moeda(Number(p.preco) * q)}</b></li>;
            })}
          </ul>
        )}
        <form onSubmit={enviar}>
          <input
            placeholder="Seu nome"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
            minLength={2}
            maxLength={80}
            required
          />
          <button className="primario" disabled={itens.length === 0}>Enviar pedido · {moeda(total)}</button>
        </form>
        {msg && <p className={msg.tipo}>{msg.texto}</p>}
      </aside>
    </div>
  );
}

function Painel() {
  const [pedidos, setPedidos] = useState([]);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(() => {
    api.pedidos().then(setPedidos).catch((e) => setErro(e.message));
  }, []);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 5000); // atualização automática
    return () => clearInterval(t);
  }, [carregar]);

  async function mudar(id, status) {
    try {
      setErro(null);
      await api.mudarStatus(id, status);
      carregar();
    } catch (e) {
      setErro(e.message);
    }
  }

  return (
    <section>
      <h2>Pedidos da cantina</h2>
      {erro && <p className="erro">{erro}</p>}
      {pedidos.length === 0 && <p className="vazio">Nenhum pedido ainda.</p>}
      <ul className="lista">
        {pedidos.map((p) => (
          <li key={p.id} className="card pedido">
            <div>
              <strong>#{p.id} · {p.cliente}</strong>
              <small>{p.itens.map((i) => `${i.quantidade}× ${i.produto.nome}`).join(', ')}</small>
              <span className="preco">{moeda(p.total)}</span>
            </div>
            <div className="acoes">
              <span className={`status ${p.status}`}>{ROTULO[p.status]}</span>
              {PROXIMO[p.status] && (
                <button className="primario" onClick={() => mudar(p.id, PROXIMO[p.status])}>
                  → {ROTULO[PROXIMO[p.status]]}
                </button>
              )}
              {(p.status === 'PENDENTE' || p.status === 'EM_PREPARO') && (
                <button onClick={() => mudar(p.id, 'CANCELADO')}>Cancelar</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function App() {
  const [aba, setAba] = useState('cardapio');
  return (
    <>
      <header>
        <h1>🥪 EstuLanches</h1>
        <nav>
          <button className={aba === 'cardapio' ? 'ativo' : ''} onClick={() => setAba('cardapio')}>Cardápio</button>
          <button className={aba === 'painel' ? 'ativo' : ''} onClick={() => setAba('painel')}>Painel da cantina</button>
        </nav>
      </header>
      <main>{aba === 'cardapio' ? <Cardapio /> : <Painel />}</main>
    </>
  );
}
