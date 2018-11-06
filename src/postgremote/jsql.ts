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

type Role<RoleName extends string> = {
  $: JSQLType.ROLE;
  roleName: RoleName;
};

function makeRole<RoleName extends string>(roleName: RoleName): Role<RoleName> {
  return {
    $: JSQLType.ROLE,
    roleName
  };
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

enum CreateKind {
  TABLE,
  ROLE
}

interface CreateTable {
  kind: QueryKind.CREATE;
  createKind: CreateKind.TABLE;
  entity: Table<any, any>;
}

interface CreateRole {
  kind: QueryKind.CREATE;
  createKind: CreateKind.ROLE;
  entity: Role<any>;
}

type Create = CreateTable | CreateRole;

enum DropKind {
  TABLE,
  ROLE
}

interface DropTable {
  kind: QueryKind.DROP;
  dropKind: DropKind.TABLE;
  entity: Table<any, any>;
  ifExists?: boolean;
}

interface DropRole {
  kind: QueryKind.DROP;
  dropKind: DropKind.ROLE;
  entity: Role<any>;
  ifExists?: boolean;
}

type Drop = DropTable | DropRole;

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

export type Query =
  | Select
  | Create
  | Drop
  | Insert<any>
  | Grant<any, any, any>
  | Revoke<any, any, any>;

export class JSQLError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, JSQLError.prototype);
  }
}

const jsqlCompileCreate = (query: Create) => {
  switch (query.createKind) {
    case CreateKind.TABLE:
      const tableName = escapeId(query.entity.$$);
      const columnExpressions = [];
      for (const column of extractTableColumns(query.entity)) {
        const columnExpression = [escapeId(column.columnName)];
        columnExpression.push('text');
        columnExpression.push(
          `DEFAULT ${escape(column.columnSettings.defaultValue)}`
        );
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

const jsqlCompileDrop = (query: Drop) => {
  const dropKind = query.dropKind === DropKind.TABLE ? 'TABLE' : 'ROLE';
  const entityName =
    query.dropKind === DropKind.TABLE ? query.entity.$$ : query.entity.roleName;

  const ifExists = query.ifExists !== undefined ? ' IF EXISTS' : '';

  return {
    text: `DROP ${dropKind}${ifExists} ${escapeId(entityName)}`,
    values: []
  };
};

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
      case QueryKind.DROP:
        return jsqlCompileDrop(query);
      case QueryKind.INSERT:
        return jsqlCompileInsert(query);
      case QueryKind.GRANT:
      case QueryKind.REVOKE:
        return jsqlCompileGrantRevoke(query);
    }
  }
  throw new JSQLError('JSQL cannot build query out of the provided object');
}

jsql.table = makeTable;
jsql.column = makeColumn;
jsql.role = makeRole;

abstract class QueryGenerator<T extends Query> {
  abstract toJSQL(): T;

  toQueryObject() {
    return jsql(this.toJSQL());
  }
}

jsql.create = (entity: Table<any, any> | Role<any>) =>
  new class CreateGenerator extends QueryGenerator<Create> {
    toJSQL(): Create {
      switch (entity.$) {
        case JSQLType.TABLE:
          return {
            kind: QueryKind.CREATE,
            createKind: CreateKind.TABLE,
            entity
          };
        case JSQLType.ROLE:
          return {
            kind: QueryKind.CREATE,
            createKind: CreateKind.ROLE,
            entity
          };
      }
    }
  }();

jsql.drop = (entity: Table<any, any> | Role<any>) =>
  new class DropGenerator extends QueryGenerator<Drop> {
    private _ifExists?: boolean;

    ifExists() {
      this._ifExists = true;
      return this;
    }

    toJSQL(): Drop {
      switch (entity.$) {
        case JSQLType.TABLE:
          return {
            kind: QueryKind.DROP,
            dropKind: DropKind.TABLE,
            entity,
            ifExists: this._ifExists
          };
        case JSQLType.ROLE:
          return {
            kind: QueryKind.DROP,
            dropKind: DropKind.ROLE,
            entity,
            ifExists: this._ifExists
          };
      }
    }
  }();

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

type FunctionName<F extends Function> = F['name'];

jsql.grant = <
  Privelege extends typeof jsql.select | typeof jsql.insert,
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

jsql.revoke = <
  Privelege extends typeof jsql.select | typeof jsql.insert,
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
