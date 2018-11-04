enum JSQLType {
  COLUMN,
  TABLE,
  ROLE
}

type ColumnSettings = {
  type: Function;
  defaultValue?: any;
  notNull?: boolean;
};

enum ColumnType {
  LINKED,
  FREE,
  ASTERISK
}
type ColumnFree<ColumnName extends string> = {
  type: JSQLType.COLUMN;
  kind: ColumnType.FREE;
  columnName: ColumnName;
  columnSettings: ColumnSettings;
};

type ColumnLinked<
  TableName extends string,
  ColumnName extends string,
  AliasName extends string = ''
> = {
  type: JSQLType.COLUMN;
  kind: ColumnType.LINKED;
  tableName: TableName;
  columnName: ColumnName;
  aliasName?: AliasName;
  columnSettings: ColumnSettings;
};

type ColumnAsterisk<TableName extends string> = {
  type: JSQLType.COLUMN;
  kind: ColumnType.ASTERISK;
  tableName: TableName;
};

function makeColumn<TableName extends string>(
  columnName: TableName,
  columnSettings: ColumnSettings
): ColumnFree<TableName> {
  return {
    type: JSQLType.COLUMN,
    kind: ColumnType.FREE,
    columnName: columnName,
    columnSettings: columnSettings
  };
}

type Table<TableName extends string, Columns extends ColumnFree<any>> = {
  type: JSQLType.TABLE;
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
  const result = { type: JSQLType.TABLE } as Table<TableName, Column>;

  result['$'] = tableName;

  result['*'] = {
    type: JSQLType.COLUMN,
    kind: ColumnType.ASTERISK,
    tableName: tableName
  };

  for (const column of columns) {
    const columnLinked: ColumnLinked<TableName, Column['columnName']> = {
      type: JSQLType.COLUMN,
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

type Role<RoleName extends string> = {
  type: JSQLType.ROLE;
  roleName: RoleName;
};

function makeRole<RoleName extends string>(roleName: RoleName): Role<RoleName> {
  return {
    type: JSQLType.ROLE,
    roleName
  };
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
  TABLE,
  ROLE
}

interface CreateTable {
  kind: QueryType.CREATE;
  createType: CreateType.TABLE;
  entity: Table<any, any>;
}

interface CreateRole {
  kind: QueryType.CREATE;
  createType: CreateType.ROLE;
  entity: Role<any>;
}

type Create = CreateTable | CreateRole;

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
};

const jsqlCompileCreate = (query: Create) => {
  switch (query.createType) {
    case CreateType.TABLE:
      const tableName = `"${query.entity.$}"`;
      const columnExpressions = [];
      for (const columnName of Object.keys(query.entity)) {
        if (columnName === '*' || columnName === '$' || columnName === 'type') {
          continue;
        }
        const column = query.entity[columnName];
        const columnExpression = [`"${columnName}"`];
        if (column.columnSettings.type === String) {
          columnExpression.push('text');
        }
        if (column.columnSettings.defaultValue) {
          columnExpression.push(
            `DEFAULT '${column.columnSettings.defaultValue}'`
          );
        }
        columnExpressions.push(columnExpression.join(' '));
      }
      return `CREATE TABLE ${tableName} (${columnExpressions.join(', ')})`;

    case CreateType.ROLE:
      return `CREATE ROLE "${query.entity.roleName}"`;
  }
};

export function jsql(query: Select | Create): string {
  if (query) {
    switch (query.kind) {
      case QueryType.SELECT:
        return jsqlCompileSelect(query);
      case QueryType.CREATE:
        return jsqlCompileCreate(query);
    }
  }
  throw new JSQLError('JSQL cannot build query out of the provided object');
}

export namespace jsql {
  export const table = makeTable;
  export const column = makeColumn;
  export const role = makeRole;

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

  export const create = (entity: Table<any, any> | Role<any>) =>
    new class CreateGenerator {
      valueOf(): Create {
        switch (entity.type) {
          case JSQLType.TABLE:
            return {
              kind: QueryType.CREATE,
              createType: CreateType.TABLE,
              entity
            };
          case JSQLType.ROLE:
            return {
              kind: QueryType.CREATE,
              createType: CreateType.ROLE,
              entity
            };
        }
      }

      toString() {
        return jsql(this.valueOf());
      }
    }();
}
