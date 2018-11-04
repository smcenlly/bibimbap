import { jsql, JSQLError } from './jsql';

describe(`DSL`, () => {
  describe(`create table`, () => {
    test(`CREATE TABLE "TableName" ("column" text DEFAULT 'default value')`, () => {
      const TableName = jsql.table('TableName', [
        jsql.column('column', {
          type: String,
          defaultValue: 'default value'
        })
      ]);

      expect(jsql.create(TableName).toString()).toBe(
        `CREATE TABLE "TableName" ("column" text DEFAULT 'default value')`
      );
    });
  });

  describe(`create role`, () => {
    test(`CREATE ROLE "TestRole"`, () => {
      const TestRole = jsql.role('TestRole');

      expect(jsql.create(TestRole).toString()).toBe(`CREATE ROLE "TestRole"`);
    });
  });

  describe(`select`, () => {
    test(`should implement JSQLQuery type, otherwiser throw error`, () => {
      expect(() => {
        // @ts-ignore: Statically incorrect argument type
        jsql();
      }).toThrowError(JSQLError);

      expect(() => {
        // @ts-ignore: Statically incorrect argument type
        jsql({});
      }).toThrowError(JSQLError);
    });

    test(`SELECT "TableName".* FROM "TableName"`, () => {
      const TableName = jsql.table('TableName', [
        jsql.column('column', { type: String })
      ]);

      expect(String(jsql.select(TableName['*']).from(TableName))).toBe(
        `SELECT "TableName".* FROM "TableName"`
      );
    });

    test(`SELECT "User"."firstName", "User"."lastName" FROM "User"`, () => {
      const User = jsql.table('User', [
        jsql.column('firstName', {
          type: String,
          notNull: true
        }),
        jsql.column('lastName', {
          type: String,
          notNull: true
        })
      ]);
      jsql.select(User.firstName).from(User);

      expect(
        String(jsql.select(User.firstName, User.lastName).from(User))
      ).toBe(`SELECT "User"."firstName", "User"."lastName" FROM "User"`);
    });

    test(`SELECT "User"."username" as "firstName", "User"."lastName" FROM "User"`, () => {
      const User = jsql.table('User', [
        jsql.column('username', { type: String }),
        jsql.column('lastName', { type: String })
      ]);

      expect(
        String(
          jsql.select(User.username.as('firstName'), User.lastName).from(User)
        )
      ).toBe(
        `SELECT "User"."username" as "firstName", "User"."lastName" FROM "User"`
      );
    });
  });
});
