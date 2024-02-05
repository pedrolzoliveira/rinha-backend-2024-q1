
CREATE TYPE tipo_transacao AS ENUM (
  'c',
  'd'
);

CREATE TABLE clientes (
  id SERIAL PRIMARY KEY,
  limite INT NOT NULL DEFAULT 0,
  saldo INT NOT NULL DEFAULT 0 CHECK (saldo >= limite * -1)
);


CREATE TABLE transacoes (
  cliente_id INT REFERENCES clientes (id),
  valor INT NOT NULL,
  descricao VARCHAR(10) NOT NULL CHECK (LENGTH(descricao) >= 1),
  tipo tipo_transacao NOT NULL
);


CREATE INDEX transacao_realizada_em_idx ON transacoes (realizada_em);
