CREATE OR REPLACE FUNCTION create_transacao (cliente_id int, valor int, tipo tipo_transacao, descricao varchar(10))
    RETURNS TABLE (cliente_saldo int, cliente_limite int)
    AS $$
DECLARE
  ajuste_valor int;
BEGIN
  IF tipo = 'd' THEN
    ajuste_valor := valor * - 1;
  ELSE
    ajuste_valor := valor;
  END IF;
  INSERT INTO transacoes (cliente_id, valor, tipo, descricao)
    VALUES(cliente_id, valor, tipo::tipo_transacao, descricao);
  RETURN QUERY
  UPDATE
    clientes
  SET
    saldo = saldo + ajuste_valor
  WHERE
    id = cliente_id
  RETURNING
    saldo,
    limite;
END;
$$
LANGUAGE plpgsql;
