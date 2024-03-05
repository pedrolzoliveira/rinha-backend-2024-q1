const http = require('http');

const CLIENTES = {
  1: {
    limite: 100000,
    saldo: 0,
    transacoes: []
  },
  2: {
    limite: 80000,
    saldo: 0,
    transacoes: []
  },
  3: {
    limite: 1000000,
    saldo: 0,
    transacoes: []
  },
  4: {
    limite: 10000000,
    saldo: 0,
    transacoes: []
  },
  5: {
    limite: 500000,
    saldo: 0,
    transacoes: []
  }
}

const criarTransacao = (clienteId, valor, descricao, tipo) => {
  const cliente = CLIENTES[clienteId];

  const novoSaldo = cliente.saldo + (tipo === 'c' ? valor : -valor)

  if (tipo === 'd' && -cliente.limite > novoSaldo) {
    return null;
  }

  cliente.saldo = novoSaldo;
  cliente.transacoes.unshift({
    valor,
    descricao,
    tipo,
    realizada_em: new Date()
  });

  return { saldo: cliente.saldo, limite: cliente.limite };
}

const CLIENTES_IDS = ['1', '2', '3', '4', '5'];

const extrato = (clienteId) => {
  const cliente = CLIENTES[clienteId];

  return JSON.stringify({
    saldo: {
      total: cliente.saldo,
      data_extrato: new Date(),
      limite: cliente.limite,
    },
    ultimas_transacoes: cliente.transacoes.slice(0, 10)
  })
}

http.createServer((req, res) => {
  const method = req.method;
  const clienteId = req.url.split('/').filter(Boolean).at(1);

  if (!['POST', 'GET'].includes(method)) {
    return res.writeHead(400).end();
  }

  if (!CLIENTES_IDS.includes(clienteId)) {
    return res.writeHead( method === "GET" ? 404 : 422 ).end();
  }

  if (method === 'GET') {
    const writableData = extrato(clienteId);
    return res.writeHead(200).end(writableData);
  }

  if (method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        body =  JSON.parse(body);
      } catch (e) {
        return res.writeHead(422).end();
      }

      const { valor, tipo, descricao } = body;

      if (
        !['c', 'd'].includes(tipo) ||
        typeof descricao !== 'string' ||
        descricao === "" ||
        descricao.length > 10 ||
        !Number.isInteger(valor) ||
        valor < 0
      ) {
        return res.writeHead(422).end();
      }

      const result = criarTransacao(clienteId, valor, descricao, tipo);

      if (!result) {
        return res.writeHead(422).end();
      }

      const writableData = JSON.stringify(result);

      return res.writeHead(200).end(writableData);

    });
  }
}).listen(9999);
