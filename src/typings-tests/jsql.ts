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

const TestTable0 = jsql.table('TestTable', [
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

jsql.insert(TestTable0, {
  // here should be a required column, because it neither have default value
  // nor can have a null as a value
});

jsql.insert(TestTable0, {
  // the same, should be required column
  isNullable: false
});

jsql.insert(TestTable0, {
  required: 'this field is required'
});

jsql.insert(TestTable0, {
  isNullable: false,
  required: 'this field is required'
});

jsql.insert(TestTable0, {
  isNullable: false,
  withDefault: 20,
  required: 'this field is required'
});

jsql.insert(TestTable0, {
  isNullable: false,
  withDefault: 20,
  withDefaultAndNullable: 'should work',
  required: 'this field is required'
});

/**
 * Function calls
 */
const noArgs = jsql.function('noArgs', [], Boolean);
const oneArgRequiredTwoOptional = jsql.function(
  'oneArg',
  [
    jsql.column('arg', { type: String }),
    jsql.column('nullable', { type: Number, nullable: true }),
    jsql.column('defaultable', { type: Boolean, defaultable: true })
  ],
  String
);

// wrong no args call
noArgs();

noArgs({});

// here too for the same reason as above
oneArgRequiredTwoOptional({});

oneArgRequiredTwoOptional({ arg: 'string' });

// wrong type of arg
oneArgRequiredTwoOptional({ arg: 1 });
// wrong type of arg
oneArgRequiredTwoOptional({
  arg: '',
  defaultable: 'string instead of boolean'
});
// wrong type of arg
oneArgRequiredTwoOptional({ arg: '', nullable: 'string instead of number' });
