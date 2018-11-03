type ColumnSettings = {};

enum ColumnType {
  LINKED,
  FREE,
  ASTERISK
}
type ColumnFree<ColumnName extends string> = {
  kind: ColumnType.FREE;
  columnName: ColumnName;
  columnSettings: ColumnSettings;
};

type ColumnLinked<
  TableName extends string,
  ColumnName extends string,
  AliasName extends string = ''
> = {
  kind: ColumnType.LINKED;
  tableName: TableName;
  columnName: ColumnName;
  aliasName?: AliasName;
  columnSettings: ColumnSettings;
};

type ColumnAsterisk<TableName extends string> = {
  kind: ColumnType.ASTERISK;
  tableName: TableName;
};

function makeColumn<TableName extends string>(
  columnName: TableName,
  columnSettings: ColumnSettings
): ColumnFree<TableName> {
  return {
    kind: ColumnType.FREE,
    columnName: columnName,
    columnSettings: columnSettings
  };
}

type Table<TableName extends string, Columns extends ColumnFree<any>> = {
  $: TableName;
  ['*']: ColumnAsterisk<TableName>;
} & {
  [ColumnName in Columns['columnName']]: ColumnLinked<TableName, ColumnName> & {
    as<AliasName extends string>(
      aliasName: AliasName
    ): ColumnLinked<TableName, ColumnName, AliasName>;
  }
};

function makeTable<TableName extends string, Column extends ColumnFree<any>>(
  tableName: TableName,
  columns: Column[]
): Table<TableName, Column> {
  const result = {} as Table<TableName, Column>;

  result['$'] = tableName;

  result['*'] = {
    kind: ColumnType.ASTERISK,
    tableName: tableName
  };

  for (const column of columns) {
    const columnLinked: ColumnLinked<TableName, Column['columnName']> = {
      kind: ColumnType.LINKED,
      tableName: tableName,
      columnName: column.columnName,
      columnSettings: column.columnSettings
    };
    result[column.columnName] = {
      ...columnLinked,

      as(aliasName) {
        return {
          ...columnLinked,
          aliasName
        };
      }
    };
  }

  return result;
}

export type SelectExpression =
  | ColumnAsterisk<any>
  | ColumnLinked<any, any>
  | ColumnLinked<any, any, any>;

export type FromExpression = Table<any, any>;

export enum QueryType {
  SELECT,
  CREATE
}

interface Select {
  kind: QueryType.SELECT;
  select: SelectExpression[];
  from: FromExpression;
}

export enum CreateType {
  TABLE
}

interface Create {
  kind: QueryType.CREATE;
  create: CreateType;
  entitytName: string;
}

export class JSQLError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, JSQLError.prototype);
  }
}

export function jsql(query: Select | Create): string {
  if (query) {
    switch (query.kind) {
      case QueryType.SELECT:
        const selectExpression = query.select
          .map(expression => {
            switch (expression.kind) {
              case ColumnType.ASTERISK:
                return `"${expression.tableName}".*`;

              case ColumnType.LINKED:
                const partsOfExpressionToRender = [
                  `"${expression.tableName}"."${expression.columnName}"`
                ];
                if (expression.aliasName) {
                  partsOfExpressionToRender.push(`"${expression.aliasName}"`);
                }
                return partsOfExpressionToRender.join(' as ');
            }
          })
          .join(', ');

        const fromExpression = query.from ? `FROM "${query.from.$}"` : '';

        return [`SELECT ${selectExpression}`, fromExpression]
          .filter(i => i)
          .join(' ');
    }
  }
  throw new JSQLError('JSQL cannot build query out of the provided object');
}

export namespace jsql {
  export const table = makeTable;
  export const column = makeColumn;

  export const select = (...selectExpressions: SelectExpression[]) =>
    new class SelectGenerator {
      private fromExpression?: FromExpression;

      from(fromExpression: Table<any, any>) {
        this.fromExpression = fromExpression;
        return this;
      }

      valueOf(): Select {
        if (!this.fromExpression) {
          throw new JSQLError(
            `you should setup from where you want to do select`
          );
        }

        return {
          kind: QueryType.SELECT,
          select: selectExpressions,
          from: this.fromExpression
        };
      }

      toString() {
        return jsql(this.valueOf());
      }
    }();

  export const create = () =>
    new class CreateGenerator {
      constructor() {}

      toString() {
        return '';
      }
    }();
}
