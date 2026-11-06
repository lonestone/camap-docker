/**
 * Unit tests of the DB encodings (project "unit", no stack needed).
 * Expected values are what hx writes (see the source pointers in each module).
 */
import { expect, test } from '@playwright/test';
import { CatalogFlag, GroupFlag, RegOption, SiteRight, UserFlag, flagNames, flags, hasFlag } from './flags.js';
import { Right, decodeRights, encodeRights } from './rights.js';
import { bcryptMatches, bcryptPassword, cronKey, md5Password } from './passwords.js';
import { absentDistribIds, defaultOrders, volunteerRolesIds } from './columns.js';
import { addDaysWall, atWallTime, fromSqlDateTime, parseRelative, toSqlDateTime } from './dates.js';

test.describe('flags', () => {
  test('SFlags bit n = enum index n', () => {
    expect(flags(UserFlag, 'HasEmailNotif24h')).toBe(2); // User.new() default
    expect(flags(SiteRight, 'Admin')).toBe(1);
    expect(flags(CatalogFlag, 'UsersCanOrder')).toBe(1); // Catalog.new() default
    expect(flags(GroupFlag, 'AllowInformationNotifs', 'AllowAlertNotifs')).toBe((1 << 11) | (1 << 12));
    expect(hasFlag(6144, GroupFlag.AllowAlertNotifs)).toBe(true);
    expect(flagNames(GroupFlag, 2048)).toEqual(['AllowInformationNotifs']);
  });
  test('RegOption ordinals', () => {
    expect(RegOption).toEqual({ Closed: 0, WaitingList: 1, Open: 2, Full: 3 });
  });
});

test.describe('rights', () => {
  test('JSON shape written by UserGroup.giveRight', () => {
    expect(encodeRights([Right.GroupAdmin(), Right.ContractAdmin(12), Right.ContractAdmin()])).toBe(
      '[{"right":"GroupAdmin","params":null},{"right":"ContractAdmin","params":["12"]},{"right":"ContractAdmin","params":null}]',
    );
    expect(encodeRights([])).toBeNull();
    expect(decodeRights(null)).toEqual([]);
    expect(decodeRights('not json')).toEqual([]);
  });
});

test.describe('passwords', () => {
  test('md5(KEY + password), lowercase hex', () => {
    // printf keypassword | md5sum
    expect(md5Password('password', 'key')).toBe('084201e2889684a768a54ea3b0e05d6d');
    expect(cronKey('key')).toBe(md5Password('crons', 'key'));
  });
  test('bcrypt round trip', () => {
    const h = bcryptPassword('test1234');
    expect(h).toMatch(/^\$2[aby]\$04\$/);
    expect(bcryptMatches('test1234', h)).toBe(true);
    expect(bcryptMatches('nope', h)).toBe(false);
  });
});

test.describe('list columns', () => {
  test('absentDistribIds sorted CSV, null when empty', () => {
    expect(absentDistribIds.encode([18, 12, 15])).toBe('12,15,18');
    expect(absentDistribIds.encode([])).toBeNull();
    expect(absentDistribIds.decode('3,1')).toEqual([3, 1]);
    expect(absentDistribIds.decode(null)).toEqual([]);
  });
  test('volunteerRolesIds keeps order', () => {
    expect(volunteerRolesIds.encode([3, 1])).toBe('3,1');
  });
  test('defaultOrders JSON', () => {
    const o = [{ productId: 1, productPrice: 15, quantity: 2 }];
    expect(defaultOrders.decode(defaultOrders.encode(o))).toEqual(o);
  });
});

test.describe('dates (Europe/Paris wall clock)', () => {
  test('winter and summer offsets', () => {
    expect(toSqlDateTime(new Date('2026-01-15T12:00:00Z'))).toBe('2026-01-15 13:00:00');
    expect(toSqlDateTime(new Date('2026-07-15T12:00:00Z'))).toBe('2026-07-15 14:00:00');
    expect(fromSqlDateTime('2026-07-15 14:00:00').toISOString()).toBe('2026-07-15T12:00:00.000Z');
    expect(fromSqlDateTime('2026-01-15 13:00:00').toISOString()).toBe('2026-01-15T12:00:00.000Z');
  });
  test('calendar days across DST keep the wall-clock time', () => {
    // 2026-03-29: Paris goes from +01:00 to +02:00
    const before = fromSqlDateTime('2026-03-28 18:00:00');
    expect(toSqlDateTime(addDaysWall(before, 1))).toBe('2026-03-29 18:00:00');
    expect(toSqlDateTime(atWallTime(before, 9, 30))).toBe('2026-03-28 09:30:00');
  });
  test('relative specs', () => {
    expect(parseRelative('+2d')).toBe(2 * 86_400_000);
    expect(parseRelative('-3h')).toBe(-3 * 3_600_000);
    expect(parseRelative('+1d+30m')).toBe(86_400_000 + 30 * 60_000);
    expect(() => parseRelative('tomorrow')).toThrow();
  });
});
