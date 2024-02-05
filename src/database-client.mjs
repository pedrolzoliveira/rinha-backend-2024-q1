import pg from 'pg';

export const db = new pg.Client('postgres://postgres:1234@localhost/rinha');

await db.connect();
