import { jsql } from 'postgremote/jsql';

/**
 * Table and column tests
 */

// default values types
jsql.table('TestTable', [
  // type of string but default value is boolean
  jsql.column('testColumn1', { type: String, defaultValue: true }),
  // type of number but default value is string
  jsql.column('testColumn2', { type: Number, defaultValue: '2' }),
  // type of boolean but default value is number
  jsql.column('testColumn3', { type: Boolean, defaultValue: 0 })
]);

/**
 * Insert tests
 */

const TestTable = jsql.table('TestTable', [
  jsql.column('isNullable', { type: Boolean, nullable: true }),
  jsql.column('withDefault', {
    type: Number,
    defaultValue: 2,
    defaultable: true
  }),
  jsql.column('withDefaultAndNullable', {
    type: String,
    defaultValue: 'string',
    defaultable: true,
    nullable: true
  }),
  jsql.column('required', { type: String })
]);

jsql.insert(TestTable, {
  // here should be a required column, because it neither have default value
  // nor can have a null as a value
});

jsql.insert(TestTable, {
  // the same, should be required column
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
