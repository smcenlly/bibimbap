import SqlString from 'sqlstring';

export function escapeId(string: string): string {
  if (typeof string !== 'string') {
    throw new TypeError(
      'Function escapeId takes only values type of string as an argument'
    );
  }
  const forbiddenCharacters = Array.from(`'"&$%;`);
  if (
    forbiddenCharacters.some(forbidednCharacter =>
      string.includes(forbidednCharacter)
    )
  ) {
    throw new TypeError(
      `Characters ${forbiddenCharacters} are denied to use in query identifiers`
    );
  }
  return SqlString.escapeId(string).replace(/`/g, '"');
}

export function escape(string: string): string {
  if (typeof string !== 'string') {
    throw new TypeError(
      'Function escape takes only values type of string as an argument'
    );
  }
  return `E${SqlString.escape(string).replace(/(\$|\`)/g, '\\$1')}`;
}

enum JSQLType {
  COLUMN,
  TABLE,
  ROLE
}

type ColumnSettings<
  DataType extends (...args: any[]) => any,
  DataDefaultable extends boolean | undefined,
  DataNullable extends boolean | undefined
> = {
  type: DataType;
  defaultValue?: ReturnType<DataType>;
  nullable?: DataNullable;
  defaultable?: DataDefaultable;
};

enum ColumnKind {
  LINKED,
  FREE,
  ASTERISK
}
type ColumnFree<
  ColumnName extends string,
  DataType extends (...args: any[]) => any,
  DataDefaultable extends boolean | undefined,
  DataNullable extends boolean | undefined
> = {
  $: JSQLType.COLUMN;
  kind: ColumnKind.FREE;
  columnName: ColumnName;
  columnSettings: ColumnSettings<DataType, DataDefaultable, DataNullable>;
};

type ColumnLinked<
  TableName extends string,
  ColumnName extends string,
  DataType extends (...args: any[]) => any,
  DataDefaultable extends boolean | undefined,
  DataNullable extends boolean | undefined,
  AliasName extends string = ''
> = {
  $: JSQLType.COLUMN;
  kind: ColumnKind.LINKED;
  tableName: TableName;
  columnName: ColumnName;
  aliasName?: AliasName;
  columnSettings: ColumnSettings<DataType, DataDefaultable, DataNullable>;
};

type ColumnAsterisk<TableName extends string> = {
  $: JSQLType.COLUMN;
  kind: ColumnKind.ASTERISK;
  tableName: TableName;
};

function makeColumn<
  ColumnName extends string,
  DataType extends (...args: any[]) => any,
  DataDefaultable extends boolean | undefined,
  DataNullable extends boolean | undefined
>(
  columnName: ColumnName,
  columnSettings: ColumnSettings<DataType, DataDefaultable, DataNullable>
): ColumnFree<ColumnName, DataType, DataDefaultable, DataNullable> {
  return {
    $: JSQLType.COLUMN,
    kind: ColumnKind.FREE,
    columnName: columnName,
    columnSettings: columnSettings
  };
}

type Table<
  TableName extends string,
  Columns extends ColumnFree<any, any, any, any>
> = {
  $: JSQLType.TABLE;
  // table name does not user 'tableName' property to minimize possibility
  // of name intersection
  $$: TableName;
  ['*']: ColumnAsterisk<TableName>;
} & {
  [ColumnName in Columns['columnName']]: ColumnLinked<
    TableName,
    ColumnName,
    Columns['columnSettings']['type'],
    Columns['columnSettings']['defaultValue'],
    Columns['columnSettings']['nullable']
  > & {
    as<AliasName extends string>(
      aliasName: AliasName
    ): ColumnLinked<
      TableName,
      ColumnName,
      Columns['columnSettings']['type'],
      Columns['columnSettings']['defaultValue'],
      Columns['columnSettings']['nullable'],
      AliasName
    >;
  }
};

function makeTable<
  TableName extends string,
  Column extends ColumnFree<any, any, any, any>
>(tableName: TableName, columns: Column[]): Table<TableName, Column> {
  const result = { $: JSQLType.TABLE } as Table<TableName, Column>;

  result['$$'] = tableName;

  result['*'] = {
    $: JSQLType.COLUMN,
    kind: ColumnKind.ASTERISK,
    tableName: tableName
  };

  for (const column of columns) {
    const columnLinked: ColumnLinked<
      TableName,
      Column['columnName'],
      Column['columnSettings']['type'],
      Column['columnSettings']['defaultValue'],
      Column['columnSettings']['nullable']
    > = {
      $: JSQLType.COLUMN,
      kind: ColumnKind.LINKED,
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

type UnpackedColumns<OfTable> = OfTable extends Table<any, infer Columns>
  ? Columns
  : never;

type NullableColumns<
  UnpackedColumnsOfTable
> = UnpackedColumnsOfTable extends ColumnFree<any, any, any, true>
  ? UnpackedColumnsOfTable
  : never;

type DefaultableColumns<
  UnpackedColumnsOfTable
> = UnpackedColumnsOfTable extends ColumnFree<any, any, true, any>
  ? UnpackedColumnsOfTable
  : never;

type RequiredColumns<
  AllColumnsOfTable,
  NonrequiredColumnsOfTable
> = AllColumnsOfTable extends NonrequiredColumnsOfTable
  ? never
  : AllColumnsOfTable;

type NamedUnpackedColumn<
  ColumnName extends string,
  UnpackedColumnsOfTable
> = UnpackedColumnsOfTable extends ColumnFree<ColumnName, any, any, any>
  ? UnpackedColumnsOfTable
  : never;

type UnpackedColumnType<
  OfTable,
  UnpackedColumnName extends string
> = ReturnType<
  NamedUnpackedColumn<
    UnpackedColumnName,
    UnpackedColumns<OfTable>
  >['columnSettings']['type']
>;

type TableProperties<OfTable> = {
  [UnpackedColumnName in NullableColumns<
    UnpackedColumns<OfTable>
  >['columnName']]+?: UnpackedColumnType<OfTable, UnpackedColumnName>
} &
  {
    [UnpackedColumnName in DefaultableColumns<
      UnpackedColumns<OfTable>
    >['columnName']]+?: UnpackedColumnType<OfTable, UnpackedColumnName>
  } &
  {
    [UnpackedColumnName in RequiredColumns<
      UnpackedColumns<OfTable>,
      | NullableColumns<UnpackedColumns<OfTable>>
      | DefaultableColumns<UnpackedColumns<OfTable>>
    >['columnName']]: UnpackedColumnType<OfTable, UnpackedColumnName>
  };

function* extractTableColumns(
  table: Table<any, any>
): IterableIterator<ColumnLinked<any, any, any, any, any>> {
  for (const columnName of Object.getOwnPropertyNames(table)) {
    if (columnName === '*' || columnName === '$' || columnName === '$$') {
      continue;
    }
    yield table[columnName];
  }
}

type SelectExpression =
  | ColumnAsterisk<any>
  | ColumnLinked<any, any, any, any, any>
  | ColumnLinked<any, any, any, any, any, any>;

type FromExpression = Table<any, any>;

export enum QueryKind {
  CREATE,
  DROP,
  SELECT,
  INSERT,
  GRANT,
  REVOKE
}

interface Select {
  kind: QueryKind.SELECT;
  select: SelectExpression[];
  from: FromExpression;
}

enum InsertKind {
  VALUES
}

interface InsertValues<Into> {
  kind: QueryKind.INSERT;
  insertType: InsertKind.VALUES;
  into: Into;
  values: TableProperties<Into>;
}

type Insert<Into> = InsertValues<Into>;

type QueryObject = {
  text: string;
  values: any[];
};

export type Query =
  | Select
  | Insert<any>;

export class JSQLError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, JSQLError.prototype);
  }
}

const jsqlCompileSelect = (query: Select) => {
  if (!query.from) {
    throw new JSQLError(`FROM statement is required`);
  }

  const selectExpression = query.select
    .map(expression => {
      switch (expression.kind) {
        case ColumnKind.ASTERISK:
          return `${escapeId(expression.tableName)}.*`;

        case ColumnKind.LINKED:
          const partsOfExpressionToRender = [
            escapeId(`${expression.tableName}.${expression.columnName}`)
          ];
          if (expression.aliasName) {
            partsOfExpressionToRender.push(escapeId(expression.aliasName));
          }
          return partsOfExpressionToRender.join(' as ');
      }
    })
    .join(', ');

  return {
    text: `SELECT ${selectExpression} FROM ${escapeId(query.from.$$)}`,
    values: []
  };
};

const jsqlCompileInsert = <Into extends Table<any, any>>(
  query: Insert<Into>
) => {
  switch (query.insertType) {
    case InsertKind.VALUES:
      const columns = [];
      const values = [];
      const placeholders = [];
      let placeholderNumber = 0;

      const columnNames = Array.from(extractTableColumns(query.into)).map(
        column => column.columnName
      );

      for (const key of Object.getOwnPropertyNames(query.values)) {
        if (!columnNames.includes(key)) {
          throw new JSQLError(
            `Table ${query.into.$$} does not have column with name ${key}`
          );
        }
        columns.push(escapeId(key));
        placeholders.push(`$${++placeholderNumber}`);
        values.push(query.values[key]);
      }

      return {
        text: `INSERT INTO ${escapeId(query.into.$$)} (${columns.join(
          ', '
        )}) VALUES (${placeholders.join(', ')})`,
        values
      };
  }
};

export function jsql(query: Query): QueryObject {
  if (query) {
    switch (query.kind) {
      case QueryKind.SELECT:
        return jsqlCompileSelect(query);
      case QueryKind.INSERT:
        return jsqlCompileInsert(query);
    }
  }
  throw new JSQLError('JSQL cannot build query out of the provided object');
}

jsql.table = makeTable;
jsql.column = makeColumn;

abstract class QueryGenerator<T extends Query> {
  abstract toJSQL(): T;

  toQueryObject() {
    return jsql(this.toJSQL());
  }
}

jsql.select = function select(...selectExpressions: SelectExpression[]) {
  return new class SelectGenerator extends QueryGenerator<Select> {
    private fromExpression?: FromExpression;

    from(fromExpression: Table<any, any>) {
      this.fromExpression = fromExpression;
      return this;
    }

    toJSQL(): Select {
      if (!this.fromExpression) {
        throw new JSQLError(
          `You should setup from where you want to do select`
        );
      }

      return {
        kind: QueryKind.SELECT,
        select: selectExpressions,
        from: this.fromExpression
      };
    }
  }();
};

jsql.insert = function insert<Into extends Table<any, any>>(
  table: Into,
  values: TableProperties<Into>
) {
  if (Object.getOwnPropertyNames(values).length === 0) {
    throw new JSQLError('You should pass at least one column');
  }
  return new class InsertGenerator extends QueryGenerator<Insert<Into>> {
    toJSQL(): Insert<Into> {
      return {
        kind: QueryKind.INSERT,
        insertType: InsertKind.VALUES,
        into: table,
        values
      };
    }
  }();
};
