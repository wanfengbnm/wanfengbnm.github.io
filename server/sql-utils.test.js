import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isSafeIdent, backtick, STRICT_IDENT_RE, isValidColumnType,
  sqlDefaultLiteral, maskLiterals, splitStatements,
  findForbiddenKeyword, csvField,
} from './sql-utils.js';

test('isSafeIdent 基本规则', () => {
  assert.equal(isSafeIdent('users'), true);
  assert.equal(isSafeIdent('my-table'), true);
  assert.equal(isSafeIdent('订单表'), true);
  assert.equal(isSafeIdent(''), false);
  assert.equal(isSafeIdent(null), false);
  assert.equal(isSafeIdent(42), false);
  assert.equal(isSafeIdent('a`b'), false);
  assert.equal(isSafeIdent('a\\b'), false);
  assert.equal(isSafeIdent('a\nb'), false);
  assert.equal(isSafeIdent('x'.repeat(65)), false);
  assert.equal(isSafeIdent('x'.repeat(64)), true);
});

test('backtick 包裹或拒绝', () => {
  assert.equal(backtick('users'), '`users`');
  assert.equal(backtick('drop`table'), null);
});

test('STRICT_IDENT_RE', () => {
  assert.match('age', STRICT_IDENT_RE);
  assert.match('_private2', STRICT_IDENT_RE);
  assert.doesNotMatch('2age', STRICT_IDENT_RE);
  assert.doesNotMatch('a-b', STRICT_IDENT_RE);
});

test('isValidColumnType 白名单', () => {
  assert.equal(isValidColumnType('INT'), true);
  assert.equal(isValidColumnType('varchar(255)'), true);
  assert.equal(isValidColumnType('DECIMAL(10, 2)'), true);
  assert.equal(isValidColumnType('DATETIME'), true);
  assert.equal(isValidColumnType("INT; DROP TABLE users"), false);
  assert.equal(isValidColumnType('INT NOT NULL'), false);
  assert.equal(isValidColumnType('VARCHAR(255) DEFAULT "x"'), false);
  assert.equal(isValidColumnType(''), false);
  assert.equal(isValidColumnType(null), false);
});

test('sqlDefaultLiteral 转义', () => {
  assert.equal(sqlDefaultLiteral(0), '0');
  assert.equal(sqlDefaultLiteral('0'), '0');
  assert.equal(sqlDefaultLiteral(-1.5), '-1.5');
  assert.equal(sqlDefaultLiteral('abc'), `'abc'`);
  assert.equal(sqlDefaultLiteral("o'k"), `'o''k'`);
  assert.equal(sqlDefaultLiteral('a\\b'), `'a\\\\b'`);
  assert.equal(sqlDefaultLiteral('CURRENT_TIMESTAMP'), 'CURRENT_TIMESTAMP');
  assert.equal(sqlDefaultLiteral('current_timestamp'), 'CURRENT_TIMESTAMP');
});

test('splitStatements 字符串/注释内的分号不切分', () => {
  assert.equal(splitStatements('SELECT 1').length, 1);
  assert.equal(splitStatements("SELECT 'a;b'").length, 1);
  assert.equal(splitStatements('SELECT "a;b"').length, 1);
  assert.equal(splitStatements('SELECT `a;b` FROM t').length, 1);
  assert.equal(splitStatements("INSERT INTO t VALUES ('x;y')").length, 1);
  assert.equal(splitStatements("SELECT 'it''s; ok'").length, 1);
  assert.equal(splitStatements("SELECT 'a\\'b; c'").length, 1);
  assert.equal(splitStatements('SELECT 1 -- 注释; SELECT 2').length, 1);
  assert.equal(splitStatements('# 注释; x\nSELECT 1').length, 1);
  assert.equal(splitStatements('/* a;b */ SELECT 1').length, 1);
  assert.equal(splitStatements('SELECT 1; SELECT 2').length, 2);
  assert.equal(splitStatements('SELECT 1;;').length, 1);
  assert.equal(splitStatements('  ;  ').length, 0);
});

test('反引号内反斜杠不是转义（与 MySQL 一致）', () => {
  // `a\` 中的反引号是结束符，后面的内容不应被吞掉
  assert.equal(splitStatements('SELECT `a\\`; TRUNCATE t').length, 2);
  const masked = maskLiterals('SELECT `a\\`; TRUNCATE t');
  assert.ok(masked.includes('TRUNCATE'));
});

test('findForbiddenKeyword', () => {
  const kw = ['DROP DATABASE', 'TRUNCATE', 'ALTER DATABASE'];
  assert.equal(findForbiddenKeyword('TRUNCATE TABLE t', kw), 'TRUNCATE');
  assert.equal(findForbiddenKeyword('drop database x', kw), 'DROP DATABASE');
  assert.equal(findForbiddenKeyword('ALTER   DATABASE x', kw), 'ALTER DATABASE');
  assert.equal(findForbiddenKeyword('SELECT 1; TRUNCATE t', kw), 'TRUNCATE');
  // 字符串/注释/标识符内的关键字不算
  assert.equal(findForbiddenKeyword("SELECT * FROM t WHERE note='please TRUNCATE first'", kw), null);
  assert.equal(findForbiddenKeyword('SELECT `truncate` FROM t', kw), null);
  assert.equal(findForbiddenKeyword('-- TRUNCATE t\nSELECT 1', kw), null);
  assert.equal(findForbiddenKeyword('SELECT 1', kw), null);
});

test('csvField 转义', () => {
  assert.equal(csvField('plain'), 'plain');
  assert.equal(csvField('a,b'), '"a,b"');
  assert.equal(csvField('a"b'), '"a""b"');
  assert.equal(csvField('a\nb'), '"a\nb"');
  assert.equal(csvField(null), '');
  assert.equal(csvField(undefined), '');
  assert.equal(csvField(123), '123');
});
