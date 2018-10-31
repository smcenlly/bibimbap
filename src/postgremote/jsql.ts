type Nominal<K, T> = K & { __nominal: T };

export type Table = Nominal<string, 'Table'>;

export type Column = Nominal<string, 'Column'>;

export type OutputName = Nominal<string, 'OutputName'>;

export type SelectList = Array<Column | { column: Column; as: OutputName }>;

export type SelectExpression = number | boolean | '*' | SelectList;

export type FromExpression = Table;

interface Select {
  select: SelectExpression;
  from?: FromExpression;
}

export type Query = Select;

export class JSQLError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, JSQLError.prototype);
  }
}

export function jsql(query: Query): string {
  if (query && query.select !== undefined) {
    let expression: string = 'NULL';

    if (query.select === '*') {
      expression = query.select;
    } else if (typeof query.select === 'boolean') {
      expression = query.select ? 'TRUE' : 'FALSE';
    } else if (typeof query.select === 'number') {
      expression = query.select.toString();
    } else if (Array.isArray(query.select)) {
      expression = query.select
        .map(
          item =>
            typeof item === 'object' && 'column' in item
              ? [`"${item.column}"`, `"${item.as}"`].join(' as ')
              : `"${item}"`
        )
        .join(', ');
    }

    const fromExpression = query.from ? `FROM "${query.from}"` : '';

    return [`SELECT ${expression}`, fromExpression].filter(i => i).join(' ');
  }
  throw new JSQLError('JSQL cannot build query out of the provided object');
}

export namespace jsql {
  class SelectGenerator {
    private selectExpression: SelectExpression;
    private fromExpression: FromExpression | undefined;

    constructor(expression: SelectExpression) {
      this.selectExpression = expression;
    }

    from(expression: FromExpression) {
      this.fromExpression = expression;
      return this;
    }

    toString() {
      return jsql({
        select: this.selectExpression,
        from: this.fromExpression
      });
    }
  }

  export const select = (expression: SelectExpression) =>
    new SelectGenerator(expression);
}
