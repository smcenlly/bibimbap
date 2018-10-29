type Nominal<K, T> = K & { __nominal: T };

export type Table = Nominal<string, 'Table'>;

export type Column = Nominal<string, 'Column'>;

export type OutputName = Nominal<string, 'OutputName'>;

export type SelectList = Array<Column | { column: Column; as: OutputName }>;

interface Select {
  select: number | boolean | '*' | SelectList;
  from?: Table;
}

export type Query = Select;

export class JSQLError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, JSQLError.prototype);
  }
}

export const jsql = (query: Query): string => {
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
};
