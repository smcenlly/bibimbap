import { Pool } from 'pg';
import request from 'supertest';
import { app } from './index';

const connectionParams = {
  user: 'postgremote',
  host: 'localhost',
  database: 'postgremote',
  password: ''
};

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
