import { jsql, JSQLError } from './jsql';

describe('DSL', () => {
  describe('select', () => {
    test('should implement JSQLQuery type, otherwiser throw error', () => {
      expect(() => {
        // @ts-ignore: Statically incorrect argument type
        jsql();
      }).toThrowError(JSQLError);

      expect(() => {
        // @ts-ignore: Statically incorrect argument type
        jsql({});
      }).toThrowError(JSQLError);
    });

    test('select 1', () => {
      expect(jsql({ select: 1 })).toBe('SELECT 1');
    });

    test('select true', () => {
      expect(jsql({ select: true })).toBe('SELECT TRUE');
    });

    test('select false', () => {
      expect(jsql({ select: false })).toBe('SELECT FALSE');
    });
  });
});
