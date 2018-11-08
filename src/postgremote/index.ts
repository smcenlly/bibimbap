import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
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
  const tokenTypeID: number | undefined = app.get('tokenTypeID');
  const secret: string = app.get('secret');
  const defaultRole = app.get('defaultRole');

  const client = await pool.connect();
  try {
    let role = defaultRole;
    if (req.cookies.jwt) {
      const { sub } = verify(req.cookies.jwt, secret) as {
        [key: string]: any;
      };
      role = sub;
    }
    await client.query(`SET ROLE ${escapeId(role)}`);

    const response = await client.query(jsql(req.body as Query));
    const tokenField = response.fields.find(
      field => field.dataTypeID === tokenTypeID
    );
    let result: any[] | any = response.rows;
    if (tokenField) {
      const [, sub] = response.rows[0][tokenField.name].match(/^\((.*)\)$/);
      const token = jwt.sign({ sub }, secret);
      res.cookie('jwt', token, {
        secure: true,
        httpOnly: true,
        maxAge: app.get('tokenExpiresIn'),
        sameSite: 'Strict'
      });
      result = true;
    }
    res.send(result);
  } catch (error) {
    res.status(403);
    res.send(error.message);
  } finally {
    client.release();
  }
});
