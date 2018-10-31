import { Pool } from 'pg';
import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import { jsql, Query } from './jsql';

export const app = express();
app.use(cookieParser());
app.use(bodyParser.json());

app.post('/', async (req, res) => {
  const pool: Pool = app.get('pool');
  const client = await pool.connect();
  try {
    const { rows } = await client.query(jsql(req.body as Query));
    res.send(rows);
  } finally {
    client.release();
  }
});
