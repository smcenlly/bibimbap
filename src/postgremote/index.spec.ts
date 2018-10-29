import { Pool } from 'pg';
import express from 'express';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import request from 'supertest';
import { jsql, JSQLQuery } from './jsql';

const connectionParams = {
  user: 'postgremote',
  host: 'localhost',
  database: 'postgremote',
  password: ''
};

const app = express();
app.use(cookieParser());
app.use(bodyParser.json());

app.post('/', async (req, res) => {
  const pool: Pool = app.get('pool');
  const client = await pool.connect();
  try {
    const { rows } = await client.query(jsql(req.body as JSQLQuery));
    res.send(rows);
  } finally {
    client.release();
  }
});

describe('making a query using an API end point', async () => {
  let pool: Pool;

  beforeAll(() => {
    pool = new Pool(connectionParams);
    app.set('pool', pool);
  });

  afterAll(() => {
    pool.end();
  });

  it('should make a query and return result as JSON', async () => {
    const { body, error } = await request(app)
      .post('/')
      .send({
        select: 1
      });

    expect(error).toBeFalsy();
    expect(body).toEqual([{ '?column?': 1 }]);
  });
});
