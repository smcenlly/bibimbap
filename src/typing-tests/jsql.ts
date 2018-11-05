import { jsql } from 'postgremote/jsql';

const TestTable = jsql.table('TestTable', [
  jsql.column('isNullable', { type: Boolean, nullable: true }),
  jsql.column('withDefault', { type: Number, defaultValue: 2 }),
  jsql.column('withDefaultAndNullable', {
    type: String,
    defaultValue: 'string',
    nullable: true
  }),
  jsql.column('required', { type: String })
]);

jsql.insert(TestTable, {});

jsql.insert(TestTable, {
  isNullable: false
});

jsql.insert(TestTable, {
  required: 'this field is required'
});

jsql.insert(TestTable, {
  isNullable: false,
  required: 'this field is required'
});

jsql.insert(TestTable, {
  isNullable: false,
  withDefault: 20,
  required: 'this field is required'
});

jsql.insert(TestTable, {
  isNullable: false,
  withDefault: 20,
  withDefaultAndNullable: 'should work',
  required: 'this field is required'
});
