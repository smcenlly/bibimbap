interface JSQLSelect {
  select: number | boolean;
}

export type JSQLQuery = JSQLSelect;

export class JSQLError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, JSQLError.prototype);
  }
}

export const jsql = (query: JSQLQuery): string => {
  if (query && query.select !== undefined) {
    let expression: string = 'NULL';
    switch (typeof query.select) {
      case 'boolean':
        expression = query.select ? 'TRUE' : 'FALSE';
        break;

      case 'number':
        expression = query.select.toString();
    }
    return `SELECT ${expression}`;
  }
  throw new JSQLError('JSQL cannot build query out of the provided object');
};
