import http from 'http';
import { db } from './database-client.mjs';

/**
 * 
 * @param {http.IncomingMessage} req 
 * @param {(error: Error | null, data: any) => any} cb
 */
function withBody(req, cb) {
  let data = '';

  req.on('data', (chunk) => { data += chunk.toString(); });
  req.on('end', () => {
    try {
      const body = JSON.parse(data);
      cb(null, body); 
    } catch (error) {
      cb(error, null);
    }
  });
}

const CONTROLLERS = Object.freeze({
  /**
   * @param {http.IncomingMessage & { params: Params }} req 
   * @param {http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage }} res 
   */
  'GET /clientes/(\\d+)/extrato': function(req, res) {
    const [clienteId] = req.params.values;
    if (!clienteId) {
      res.writeHead(400);
      res.end();
      return;
    }

    db.query(`
    WITH ultimas_transacoes AS (
      SELECT valor, tipo, descricao, realizada_em
      FROM transacoes
      WHERE cliente_id = $1::int
      ORDER BY realizada_em DESC
      LIMIT 10
    ),
    saldo AS (
      SELECT saldo AS total, NOW() AS data_extrato, limite
      FROM clientes
      WHERE id = $1::int
    )
    SELECT json_build_object(
      'saldo', (SELECT row_to_json(s) FROM saldo s),
      'ultimas_transacoes', (SELECT json_agg(u) FROM ultimas_transacoes u)
    ) AS resultado;
    `, [clienteId], (error, result) => {
      if (error) {
        res.writeHead(500);
        res.end();
        return;
      }

      const [{ resultado: { saldo, ultimas_transacoes } }] = result.rows;

      if (!saldo) {
        res.writeHead(404);
        res.end();
        return; 
      }

      const writableData = JSON.stringify({
        saldo,
        ultimas_transacoes: ultimas_transacoes ?? []
      });

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.write(writableData);
      res.end();
      return;
    });
  },

  /**
   * @param {http.IncomingMessage & { params: Params }} req 
   * @param {http.ServerResponse<http.IncomingMessage> & { req: http.IncomingMessage }} res 
   */
  'POST /clientes/(\\d+)/transacoes': function(req, res) {
    const [clienteId] = req.params.values;
    if (!clienteId) {
      res.writeHead(400);
      res.end();
      return;
    }

    withBody(req, (error, { valor, tipo, descricao }) => {
      if (
        error ||
        !Number.isInteger(valor) ||
        (tipo !== 'c' && tipo !== 'd') ||
        typeof descricao !== 'string' ||
        descricao.length > 10 ||
        descricao.length < 1
      ) {
        res.writeHead(422);
        res.end();
        return;
      }

      db.query('SELECT cliente_saldo AS saldo, cliente_limite AS limite FROM create_transacao($1::int, $2::int, $3::tipo_transacao, $4::varchar(10));', [clienteId, valor, tipo, descricao], (error, result) => {
        if (error) {
          res.writeHead(DB_ERRORS_TO_HTTP[error.code] || 400);
          res.end();
          return;
        }

        const [data] = result.rows;

        const writableData = JSON.stringify(data);

        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.write(writableData);
        res.end();
        return;
      });
    });
  }
});

const CONTROLLERS_ROUTES = Object.freeze(Object.keys(CONTROLLERS));

const DB_ERRORS_TO_HTTP = Object.freeze({
  '23514': 422,
  '23503': 404
});

class Route {
  /**
   * 
   * @param {string} method 
   * @param {string} url 
   */
  constructor(method, url) {
    this.method = method;
    this.url = url;

    /**
     * @type {string | undefined}
     */
    this.routeString = CONTROLLERS_ROUTES.find(route => {
      const regex = new RegExp(route);
      return regex.test(`${this.method} ${this.url}`);
    });
  }
}

class Params {
  /**
   * @param {Route} route 
   */
  constructor(route) {
    const urlSlices = route.url.split('/');
    urlSlices.shift();

    const routeSlices = route.routeString.split('/');
    routeSlices.shift();

    const paramRegex = new RegExp('\\(.+\\)');
    const paramsIndexes = routeSlices.reduce((indexes, routeSlice, index) => {
      if (paramRegex.test(routeSlice)) {
        indexes.push(index);
      }
      return indexes;
    }, [])

    const values = [];

    paramsIndexes.forEach(index => {
      values.push(urlSlices[index]);
    });

    this.values = values;
  }
}

const server = http.createServer((req, res) => {
  const route = new Route(req.method, req.url);
  const controllerHandler = CONTROLLERS[route.routeString];

  if (!controllerHandler) {
    res.writeHead(404);
    res.end();
    return;
  }

  req.params = new Params(route);

  controllerHandler(req, res);
});

server.listen(9999);
