import { Pool } from 'pg';
import request from 'supertest';
import { app } from './index';
import { jsql } from './jsql';

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

  it('should use middleware to verify jwt gathered from cookies', async () => {
    const client = await pool.connect();

    // we'll need two roles with different permissions and one table to whcih
    // these permissions should apply in order to make this test

    // just a simple table with default name
    @jsql.entity
    class TestTable extends Table {
      name: String = `I'm just a default value for a new table`;
    }

    // and a few of the roles
    @jsql.entity
    class TestRoleOne extends Role {}
    @jsql.entity
    class TestRoleTwo extends Role {}

    try {
      // we create all of the required entities
      await client.query(jsql.create(TestRoleOne));
      await client.query(jsql.create(TestRoleTwo));
      await client.query(jsql.create(TestTable));

      // and insert an entry into the test table
      await client.query(jsql.insert(new TestTable()));

      // now we grant select permission to the TestRoleOne
      await client.query(jsql.grant.select.on(TestTable).to(TestRoleOne));
      // and deny select to the TestRoleTwo
      await client.query(jsql.revoke.select.on(TestTable).from(TestRoleTwo));

      // now we're ready to perform a query to check if our server has
      // an authoriztion middleware

      // first of all let's sign a jwt token with a first role
      const testTokenOne = jwt.sign({ sub: TestRoleOne.name }, cert, {
        algoritm: 'RS512'
      });

      // when we make a request with jwt signed for the first role
      // we should have no any error
      const { body } = await request(app)
        .post('/')
        .set('Cookie', `jwt=${testTokenOne}`)
        .send(
          jsql
            .select('*')
            .from(TestTable)
            .toPlainObject()
        )
        .expect(200);
      // and it should actually return a list of rows as it usually does
      expect(body.rows).toEqual([
        { name: `I'm just a default value for a new table` }
      ]);

      // now let's try the test role two
      const testTokenTwo = jwt.sign({sub:TestRoleTwo.name}, cert, {
        algoritm: 'RS512'
      })

      // and here we get an error
      await request(app)
        .post('/')
        .set('Cookie', `jwt=${testTokenTwo}`)
        .send(
          jsql
            .select('*')
            .from(TestTable)
            .toPlainObject()
        )
        .expect(403);
    } finally {
      // clearing everything up
      await client.query(jsql.drop(TestTable).ifExists());
      await client.query(jsql.drop(TestRoleTwo).ifExists());
      await client.query(jsql.drop(TestRoleOne).ifExists());
      client.release();
    }
  });
});
