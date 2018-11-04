import { jsql, JSQLError, escape, escapeId } from './jsql';

describe(`DSL`, () => {
  describe(`escaping`, () => {
    it(`should escape string constants using C-style escapes`, () => {
      expect(escape(`This is sql string " ' \" \' \` $$ $ hahaha \n `)).toBe(
        `E'This is sql string \\" \\' \\" \\' \\\` \\$\\$ \\$ hahaha \\n '`
      );
    });

    it(`should escape query identifiers with double quote`, () => {
      expect(escapeId('TableName')).toBe('"TableName"');
      expect(escapeId('property')).toBe('"property"');
      expect(escapeId('UserTable.property')).toBe('"UserTable"."property"');
    });

    it(`should not allow to use special characters for query identifiers`, () => {
      expect(() => escapeId("'")).toThrow();
      expect(() => escapeId('"')).toThrow();
      expect(() => escapeId('&')).toThrow();
      expect(() => escapeId(';')).toThrow();
      expect(() => escapeId('%')).toThrow();
      expect(() => escapeId('$')).toThrow();
    });

    it(`should not allow any other value except string`, () => {
      expect(() =>
        // @ts-ignore
        escape(124)
      ).toThrow();

      expect(() =>
        // @ts-ignore
        escapeId(124)
      ).toThrow();
    });
  });

  describe(`create table`, () => {
    test(`CREATE TABLE "TableName" ("column" text DEFAULT E'default value')`, () => {
      const TableName = jsql.table('TableName', [
        jsql.column('column', {
          type: String,
          defaultValue: 'default value'
        })
      ]);

      expect(jsql.create(TableName).toQueryObject()).toEqual({
        text: `CREATE TABLE "TableName" ("column" text DEFAULT E'default value')`,
        values: []
      });
    });
  });

  describe(`create role`, () => {
    test(`CREATE ROLE "TestRole"`, () => {
      const TestRole = jsql.role('TestRole');

      expect(jsql.create(TestRole).toQueryObject()).toEqual({
        text: `CREATE ROLE "TestRole"`,
        values: []
      });
    });
  });

  describe(`select`, () => {
    it(`should implement JSQLQuery type, otherwiser throw error`, () => {
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

      expect(
        jsql
          .select(TableName['*'])
          .from(TableName)
          .toQueryObject()
      ).toEqual({ text: `SELECT "TableName".* FROM "TableName"`, values: [] });
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

      expect(
        jsql
          .select(User.firstName, User.lastName)
          .from(User)
          .toQueryObject()
      ).toEqual({
        text: `SELECT "User"."firstName", "User"."lastName" FROM "User"`,
        values: []
      });
    });

    test(`SELECT "User"."username" as "firstName", "User"."lastName" FROM "User"`, () => {
      const User = jsql.table('User', [
        jsql.column('username', { type: String }),
        jsql.column('lastName', { type: String })
      ]);

      expect(
        jsql
          .select(User.username.as('firstName'), User.lastName)
          .from(User)
          .toQueryObject()
      ).toEqual({
        text: `SELECT "User"."username" as "firstName", "User"."lastName" FROM "User"`,
        values: []
      });
    });
  });

  describe(`insert`, () => {
    test(`INSERT INTO "User" ("firstName", "lastName") VALUES ($1, $2)`, () => {
      const User = jsql.table('User', [
        jsql.column('firstName', { type: String }),
        jsql.column('lastName', { type: String })
      ]);

      expect(
        jsql
          .insert(User, {
            firstName: 'Alexander',
            lastName: 'Yatkevich'
          })
          .toQueryObject()
      ).toEqual({
        text: `INSERT INTO "User" ("firstName", "lastName") VALUES ($1, $2)`,
        values: ['Alexander', 'Yatkevich']
      });
    });

    it(`should throw an error if you try to insert a value
        for a column that does not exist`, () => {
      const TestTable = jsql.table('TestTable', [
        jsql.column('testColumn', { type: String })
      ]);
      expect(() => {
        jsql.insert(TestTable, {
          // @ts-ignore
          testColumn2: 'value'
        }).toQueryObject();
      }).toThrowError(JSQLError);
    });
  });
});
