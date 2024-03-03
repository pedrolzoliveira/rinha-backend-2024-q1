import http from 'http';
import fastJson from 'fast-json-stringify';
import pg from 'pg';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  application_name: 'rinha-backend'
});

const stringifyExtratoResponse = fastJson({
  type: 'object',
  properties: {
    saldo: {
      type: 'object',
      properties: {
        total: { type: 'number' },
        data_extrato: { type: 'string' },
        limite: { type: 'number' }
      },
    },
    ultimas_transacoes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          valor: { type: 'number' },
          tipo: { type: 'string' },
          descricao: { type: 'string' },
          realizada_em: { type: 'string' }
        }
      }
    }
  },
  
});

const stringifyTransacaoResponse = fastJson({
  type: 'object',
  properties: {
    limite: { type: 'number' },
    saldo: { type: 'number' }
  }
});

const DB_ERRORS_TO_HTTP = Object.freeze({
  '23514': 422,
  '23503': 404,
  'P0001': 404
});

const server = http.createServer((req, res) => {
  pool.connect((err, db) => {
    try {
      if (err) {
        throw err;
      }

      switch (req.method) {
        case "GET": {
          const paths = req.url?.split('/').filter(Boolean);
          if (!paths) {
            res.writeHead(404).end();
            return;
          }
  
          if (paths[0] !== 'clientes' || paths[2] !== 'extrato') {
            res.writeHead(404).end();
            return;
          }
  
          const clienteId = Number(paths[1]);
  
          if (!Number.isInteger(clienteId)) {
            res.writeHead(422).end(); 
            return;
          }
  
          const query = `
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
          `;
  
          db.query(query, [clienteId], (error, result) => {
            if (error) {
              res.writeHead(500).end();
              return;
            }
  
            const [{ resultado: { saldo, ultimas_transacoes } }] = result.rows;
  
            if (!saldo) {
              res.writeHead(404).end();
              return; 
            }
  
            const writableData = stringifyExtratoResponse({
              saldo,
              ultimas_transacoes: ultimas_transacoes ?? []
            });
  
            res.writeHead(200).end(writableData);
            return;
          });
  
          break;
        }
        case "POST": {
          const paths = req.url?.split('/').filter(Boolean);
          if (!paths) {
            res.writeHead(404).end();
            return;
          }
  
          if (paths[0] !== 'clientes' || paths[2] !== 'transacoes') {
            res.writeHead(404).end();
            return;
          }
  
          const clienteId = Number(paths[1]);
  
          if (!Number.isInteger(clienteId)) {
            res.writeHead(422).end(); 
            return;
          }
  
          let data = '';
          req.on('data', chunk => { data += chunk.toString(); });
          req.on('end', () => {
            try {
              const { valor, tipo, descricao } =  JSON.parse(data);
              if (
                !Number.isInteger(valor) ||
                valor < 0 ||
                (tipo !== 'c' && tipo !== 'd') ||
                typeof descricao !== 'string' ||
                descricao.length > 10 ||
                descricao.length < 1
              ) {
                res.writeHead(422).end();
                return;
              }
  
              const query = 'SELECT cliente_saldo AS saldo, cliente_limite AS limite FROM create_transacao($1::int, $2::int, $3::tipo_transacao, $4::varchar(10));';
  
              db.query(query, [clienteId, valor, tipo, descricao], (error, result) => {
                if (error) {
                  res.writeHead(DB_ERRORS_TO_HTTP[error.code] || 400).end();
                  return;
                }
        
                const [row] = result.rows;
        
                const writableData = stringifyTransacaoResponse(row);
        
                res.writeHead(200).end(writableData);
                return;
              });
            } catch (error) {
              res.writeHead(422).end();
              return;
            }
          });
  
          break;
        }
        default: {
          res.writeHead(404).end();
          return;
        }
      }
    } catch (error) {
      res.writeHead(500).end();
      return;
    } finally {
      db.release();
    }
  })
});

server.listen(process.env.PORT, () => {
  console.log(`listening on port: ${process.env.PORT}`);
});
