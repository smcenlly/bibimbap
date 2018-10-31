import { jsql, JSQLError, Table, Column, OutputName } from './jsql';

describe(`DSL`, () => {
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

    test(`SELECT 1`, () => {
      expect(jsql({ select: 1 })).toBe(`SELECT 1`);
      expect(jsql.select(1).toString()).toBe(`SELECT 1`);
    });

    test(`SELECT TRUE`, () => {
      expect(jsql({ select: true })).toBe(`SELECT TRUE`);
      expect(jsql.select(true).toString()).toBe(`SELECT TRUE`);
    });

    test(`SELECT FALSE`, () => {
      expect(jsql({ select: false })).toBe(`SELECT FALSE`);
      expect(jsql.select(false).toString()).toBe(`SELECT FALSE`);
    });

    test(`SELECT * FROM "tableName"`, () => {
      expect(jsql({ select: '*', from: 'tableName' as Table })).toBe(
        `SELECT * FROM "tableName"`
      );

      expect(
        jsql
          .select('*')
          .from('tableName' as Table)
          .toString()
      ).toBe(`SELECT * FROM "tableName"`);
    });

    test(`SELECT "firstName", "lastName" FROM "users"`, () => {
      expect(
        jsql({
          select: ['firstName' as Column, 'lastName' as Column],
          from: 'users' as Table
        })
      ).toBe(`SELECT "firstName", "lastName" FROM "users"`);

      expect(
        '' +
          jsql
            .select(['firstName' as Column, 'lastName' as Column])
            .from('users' as Table)
      ).toBe(`SELECT "firstName", "lastName" FROM "users"`);
    });

    test(`SELECT "firstName" as "name", "lastName" FROM "users"`, () => {
      expect(
        jsql({
          select: [
            {
              column: 'firstName' as Column,
              as: 'name' as OutputName
            },
            'lastName' as Column
          ],
          from: 'users' as Table
        })
      ).toBe(`SELECT "firstName" as "name", "lastName" FROM "users"`);

      expect(
        String(
          jsql
            .select([
              {
                column: 'firstName' as Column,
                as: 'name' as OutputName
              },
              'lastName' as Column
            ])
            .from('users' as Table)
        )
      ).toBe(`SELECT "firstName" as "name", "lastName" FROM "users"`);
    });
  });
});
