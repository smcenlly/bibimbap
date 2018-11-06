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

enum JSQLKind {
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
  $: JSQLKind.COLUMN;
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
  $: JSQLKind.COLUMN;
  kind: ColumnKind.LINKED;
  tableName: TableName;
  columnName: ColumnName;
  aliasName?: AliasName;
  columnSettings: ColumnSettings<DataType, DataDefaultable, DataNullable>;
};

type ColumnAsterisk<TableName extends string> = {
  $: JSQLKind.COLUMN;
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
    $: JSQLKind.COLUMN,
    kind: ColumnKind.FREE,
    columnName: columnName,
    columnSettings: columnSettings
  };
}

type Table<
  TableName extends string,
  Columns extends ColumnFree<any, any, any, any>
> = {
  $: JSQLKind.TABLE;
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
  const result = { $: JSQLKind.TABLE } as Table<TableName, Column>;

  result['$$'] = tableName;

  result['*'] = {
    $: JSQLKind.COLUMN,
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
      $: JSQLKind.COLUMN,
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

type Role<RoleName extends string> = {
  $: JSQLKind.ROLE;
  roleName: RoleName;
};

function makeRole<RoleName extends string>(roleName: RoleName): Role<RoleName> {
  return {
    $: JSQLKind.ROLE,
    roleName
  };
}

type SelectExpression =
  | ColumnAsterisk<any>
  | ColumnLinked<any, any, any, any, any>
  | ColumnLinked<any, any, any, any, any, any>;

type FromExpression = Table<any, any>;

enum QueryKind {
  SELECT,
  CREATE,
  INSERT,
  GRANT,
  REVOKE
}

interface Select {
  kind: QueryKind.SELECT;
  select: SelectExpression[];
  from: FromExpression;
}

enum CreateKind {
  TABLE,
  ROLE
}

interface CreateTable {
  kind: QueryKind.CREATE;
  createType: CreateKind.TABLE;
  entity: Table<any, any>;
}

interface CreateRole {
  kind: QueryKind.CREATE;
  createType: CreateKind.ROLE;
  entity: Role<any>;
}

type Create = CreateTable | CreateRole;

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

type Grant<Privelege extends string, On, To> = {
  kind: QueryKind.GRANT;
  privelege: Privelege;
  on: On;
  to: To;
};

type Revoke<Privelege extends string, On, From> = {
  kind: QueryKind.REVOKE;
  privelege: Privelege;
  on: On;
  from: From;
};

type QueryObject = {
  text: string;
  values: any[];
};

type Query =
  | Select
  | Create
  | Insert<any>
  | Grant<any, any, any>
  | Revoke<any, any, any>;

export class JSQLError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, JSQLError.prototype);
  }
}

const jsqlCompileSelect = (query: Select) => {
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

  const fromExpression = query.from ? `FROM ${escapeId(query.from.$$)}` : '';

  return {
    text: [`SELECT ${selectExpression}`, fromExpression]
      .filter(i => i)
      .join(' '),
    values: []
  };
};

const jsqlCompileCreate = (query: Create) => {
  switch (query.createType) {
    case CreateKind.TABLE:
      const tableName = escapeId(query.entity.$$);
      const columnExpressions = [];
      for (const column of extractTableColumns(query.entity)) {
        const columnExpression = [escapeId(column.columnName)];
        if (column.columnSettings.type === String) {
          columnExpression.push('text');
        }
        if (column.columnSettings.defaultValue) {
          columnExpression.push(
            `DEFAULT ${escape(column.columnSettings.defaultValue)}`
          );
        }
        columnExpressions.push(columnExpression.join(' '));
      }
      return {
        text: `CREATE TABLE ${tableName} (${columnExpressions.join(', ')})`,
        values: []
      };

    case CreateKind.ROLE:
      return {
        text: `CREATE ROLE ${escapeId(query.entity.roleName)}`,
        values: []
      };
  }
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

const jsqlCompileGrantRevoke = <
  Privelege extends string,
  On extends Table<any, any>,
  Subject extends Role<any>
>(
  query: Grant<Privelege, On, Subject> | Revoke<Privelege, On, Subject>
) => {
  let privelege: string;
  switch (query.privelege) {
    case 'select':
    case 'insert':
      privelege = query.privelege.toUpperCase();
      break;
    default:
      throw new JSQLError(
        `There is no such a privelege like ${query.privelege}`
      );
  }

  switch (query.kind) {
    case QueryKind.GRANT:
      return {
        text: `GRANT ${privelege} ON ${escapeId(query.on.$$)} TO ${escapeId(
          query.to.roleName
        )}`,
        values: []
      };
    case QueryKind.REVOKE:
      return {
        text: `REVOKE ${privelege} ON ${escapeId(query.on.$$)} FROM ${escapeId(
          query.from.roleName
        )}`,
        values: []
      };
  }
};

export function jsql(query: Query): QueryObject {
  if (query) {
    switch (query.kind) {
      case QueryKind.SELECT:
        return jsqlCompileSelect(query);
      case QueryKind.CREATE:
        return jsqlCompileCreate(query);
      case QueryKind.INSERT:
        return jsqlCompileInsert(query);
      case QueryKind.GRANT:
      case QueryKind.REVOKE:
        return jsqlCompileGrantRevoke(query);
    }
  }
  throw new JSQLError('JSQL cannot build query out of the provided object');
}

export namespace jsql {
  export const table = makeTable;
  export const column = makeColumn;
  export const role = makeRole;

  export abstract class QueryGenerator<T extends Query> {
    abstract toJSQL(): T;

    toQueryObject() {
      return jsql(this.toJSQL());
    }
  }

  export function select(...selectExpressions: SelectExpression[]) {
    return new class SelectGenerator extends QueryGenerator<Select> {
      private fromExpression?: FromExpression;

      from(fromExpression: Table<any, any>) {
        this.fromExpression = fromExpression;
        return this;
      }

      toJSQL(): Select {
        if (!this.fromExpression) {
          throw new JSQLError(
            `you should setup from where you want to do select`
          );
        }

        return {
          kind: QueryKind.SELECT,
          select: selectExpressions,
          from: this.fromExpression
        };
      }
    }();
  }

  export function create(entity: Table<any, any> | Role<any>) {
    return new class CreateGenerator extends QueryGenerator<Create> {
      toJSQL(): Create {
        switch (entity.$) {
          case JSQLKind.TABLE:
            return {
              kind: QueryKind.CREATE,
              createType: CreateKind.TABLE,
              entity
            };
          case JSQLKind.ROLE:
            return {
              kind: QueryKind.CREATE,
              createType: CreateKind.ROLE,
              entity
            };
        }
      }
    }();
  }

  export function insert<Into extends Table<any, any>>(
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
  }

  type FunctionName<F extends Function> = F['name'];

  export const grant = <
    Privelege extends typeof select | typeof insert,
    On extends Table<any, any>,
    To extends Role<any>
  >(
    privelege: Privelege,
    rule: { on: On; to: To }
  ) =>
    new class GrantGenerator extends QueryGenerator<
      Grant<FunctionName<Privelege>, On, To>
    > {
      toJSQL(): Grant<FunctionName<Privelege>, On, To> {
        return {
          kind: QueryKind.GRANT,
          privelege: privelege.name,
          on: rule.on,
          to: rule.to
        };
      }
    }();

  export const revoke = <
    Privelege extends typeof select | typeof insert,
    On extends Table<any, any>,
    From extends Role<any>
  >(
    privelege: Privelege,
    rule: { on: On; from: From }
  ) =>
    new class RevokeGenerator extends QueryGenerator<
      Revoke<FunctionName<Privelege>, On, From>
    > {
      toJSQL(): Revoke<FunctionName<Privelege>, On, From> {
        return {
          kind: QueryKind.REVOKE,
          privelege: privelege.name,
          on: rule.on,
          from: rule.from
        };
      }
    }();
}
