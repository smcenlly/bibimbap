import { Pool } from 'pg';
import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import { jsql, Query, escapeId } from './jsql';
import { verify } from 'jsonwebtoken';

export const app = express();
app.use(cookieParser());
app.use(bodyParser.json());

app.post('/', async (req, res) => {
  const pool: Pool = app.get('pool');
  const client = await pool.connect();
  try {
    if (req.cookies.jwt) {
      const { sub } = verify(req.cookies.jwt, app.get('secret')) as {
        [key: string]: any;
      };
      await client.query(`SET ROLE ${escapeId(sub)}`);
    }
    const { rows } = await client.query(jsql(req.body as Query));
    res.send(rows);
  } catch (error) {
    res.status(403);
    res.send(error.message);
  } finally {
    client.release();
  }
});
