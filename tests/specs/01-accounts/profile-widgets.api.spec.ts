/**
 * What the ordering widgets and the account page read and write about the user
 * (specs/01-accounts/profile.md ACC-PRO-008, ACC-PRO-011; camap-hx controller/api/User.hx doMe,
 * camap-ts users.resolver.ts / groups.resolver.ts myGroups).
 */
import { test, expect } from '../../src/fixtures.js';
import { queryOne } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';

test.describe('address and phone from the ordering widgets', () => {
  test('a logged-in user updates them, and reads them back', { tag: ['@ACC-PRO-008'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const m = await as(s.users.member);

    const res = await app.api.users.updateContact(m.request, { address1: '3 rue des Lilas', zipCode: '44000', city: 'Nantes', phone: '0611223344' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: s.users.member.id, address1: '3 rue des Lilas', zipCode: '44000', city: 'Nantes', phone: '0611223344' });
    expect(await queryOne('SELECT address1, zipCode, city, phone FROM User WHERE id = ?', [s.users.member.id])).toEqual({ address1: '3 rue des Lilas', zipCode: '44000', city: 'Nantes', phone: '0611223344' });
    expect((await app.api.users.me(m.request)).body).toMatchObject({ city: 'Nantes', phone: '0611223344' });
    // the other fields of the user are left alone, and so are the other users
    expect((await queryOne<{ firstName: string }>('SELECT firstName FROM User WHERE id = ?', [s.users.member.id]))!.firstName).toBe(s.users.member.firstName);
    expect((await queryOne<{ phone: string | null }>('SELECT phone FROM User WHERE id = ?', [s.users.member2.id]))!.phone).toBeNull();
  });

  test('a visitor is refused', { tag: ['@ACC-PRO-008'] }, async ({ app, anon }) => {
    const s = await make.amapScenario();

    const res = await app.api.users.updateContact(anon.request, { phone: '0611223344' });

    expect(res.status).toBe(401);
    expect((await queryOne<{ phone: string | null }>('SELECT phone FROM User WHERE id = ?', [s.users.member.id]))!.phone).toBeNull();
  });
});

test.describe('the groups of the account page', () => {
  test('a user sees the groups they belong to, and only those', { tag: ['@ACC-PRO-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre AMAP' });
    await make.userGroup({ user: s.users.member, group: other });
    await make.group({ name: 'Groupe inconnu' });
    const m = await as(s.users.member);

    const res = await app.graphql(m.request, `query { myGroups { id name } }`);

    expect(res.errors).toBeNull();
    expect(res.data.myGroups.map((g: { id: number }) => g.id).sort()).toEqual([s.group.id, other.id].sort());
  });
});
