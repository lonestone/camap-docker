/**
 * User administration: search, user sheet, membership sheet (specs/08-administration/admin-users.md;
 * controller/admin/User.hx doDefault, doSearch, doView, doUserGroup, templates admin/user/*.mtt).
 *
 * Every route is `@admin`: anyone who is not a superadmin is sent to "/".
 */
import { test, expect } from '../../src/fixtures.js';
import * as make from '../../src/factories/index.js';

const days = (n: number) => new Date(Date.now() + n * 24 * 3600 * 1000);

test.describe('searching for a user', () => {
  test('the user administration home offers a search', { tag: ['@ADM-USR-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.usersHome(admin.request);

    expect(res.status).toBe(200);
    expect(res.offersSearch).toBe(true);
  });

  test('the search finds users by last name, first name or email, whatever the case', { tag: ['@ADM-USR-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const byLast = await app.views.admin.userSearch(admin.request, 'coordinatrice');
    const byFirst = await app.views.admin.userSearch(admin.request, 'COLETTE');
    const byEmail = await app.views.admin.userSearch(admin.request, 'coordinator@camap');

    for (const res of [byLast, byFirst, byEmail]) {
      expect(res.status).toBe(200);
      expect(res.users.map((u) => u.id)).toEqual([s.users.coordinator.id]);
    }
    expect(byLast.users[0].email).toBe('coordinator@camap.test');
  });

  test('the search also looks at the second person of a household', { tag: ['@ADM-USR-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const couple = await make.user({ firstName: 'Anne', lastName: 'Dupont', email: 'dupont@camap.test', firstName2: 'Bertrand', lastName2: 'Lefèvre', email2: 'bertrand@camap.test' });
    const admin = await as(s.users.superadmin);

    const bySecondLast = await app.views.admin.userSearch(admin.request, 'Lefèvre');
    const bySecondFirst = await app.views.admin.userSearch(admin.request, 'Bertrand');
    const bySecondEmail = await app.views.admin.userSearch(admin.request, 'bertrand@');

    for (const res of [bySecondLast, bySecondFirst, bySecondEmail]) expect(res.users.map((u) => u.id)).toEqual([couple.id]);
  });

  test('the search finds users of any group, or of none, the newest first', { tag: ['@ADM-USR-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.userSearch(admin.request, 'Mar');

    // Martine and Marc, both in the group; the later account comes first
    expect(res.users.map((u) => u.id)).toEqual([s.users.member2.id, s.users.member.id]);
    const outsider = await app.views.admin.userSearch(admin.request, 'Nonmembre');
    expect(outsider.users.map((u) => u.id)).toEqual([s.users.nonMember.id]);
  });

  test('a search that matches nothing gives an empty list, and spaces around the text are ignored', { tag: ['@ADM-USR-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const none = await app.views.admin.userSearch(admin.request, 'introuvable');
    const padded = await app.views.admin.userSearch(admin.request, '  Coordinatrice  ');

    expect(none.status).toBe(200);
    expect(none.users).toEqual([]);
    expect(padded.users.map((u) => u.id)).toEqual([s.users.coordinator.id]);
  });

  test('only a superadmin can search', { tag: ['@ADM-USR-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();

    for (const who of [await as(s.users.groupAdmin), await as(s.users.member), await as('anon')]) {
      const home = await app.views.admin.usersHome(who.request);
      const res = await app.views.admin.userSearch(who.request, 'Membre');
      expect(home.location).toBe('/');
      expect(res.status).toBe(302);
      expect(res.location).toBe('/');
      expect(res.users).toEqual([]);
    }
  });
});

test.describe('the sheet of a user', () => {
  test('it shows the contact details, the number of orders and the groups with the rights held', { tag: ['@ADM-USR-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.user(admin.request, s.users.groupAdmin.id);

    expect(res.status).toBe(200);
    expect(res.text).toContain(`Utilisateur #${s.users.groupAdmin.id}`);
    expect(res.email).toBe('groupadmin@camap.test');
    expect(res.orderCount).toBe(0);
    expect(res.memberships.map((m) => m.groupId)).toEqual([s.group.id]);
    expect(res.memberships[0].rights).not.toBe('');
  });

  test('a user who belongs to several groups is listed with each of them', { tag: ['@ADM-USR-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre AMAP' });
    await make.userGroup({ user: s.users.member, group: other });
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.user(admin.request, s.users.member.id);

    expect(res.memberships.map((m) => m.groupId).sort()).toEqual([s.group.id, other.id].sort());
  });

  test('the order count counts the orders of the user, as first or second person', { tag: ['@ADM-USR-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const p = s.products.const[0];
    const b1 = await make.basket({ user: s.users.member, multiDistrib: s.multiDistribs[0] });
    await make.userOrder({ user: s.users.member, product: p, distribution: s.distributions[0].const, basket: b1 });
    const b2 = await make.basket({ user: s.users.member2, multiDistrib: s.multiDistribs[1] });
    await make.userOrder({ user: s.users.member2, user2: s.users.member, product: p, distribution: s.distributions[1].const, basket: b2 });
    const b3 = await make.basket({ user: s.users.member2, multiDistrib: s.multiDistribs[2] });
    await make.userOrder({ user: s.users.member2, product: p, distribution: s.distributions[2].const, basket: b3 });
    const admin = await as(s.users.superadmin);

    expect((await app.views.admin.user(admin.request, s.users.member.id)).orderCount).toBe(2);
    expect((await app.views.admin.user(admin.request, s.users.member2.id)).orderCount).toBe(2);
    expect((await app.views.admin.user(admin.request, s.users.coordinator.id)).orderCount).toBe(0);
  });

  test('it offers to log in as the user and to delete the account', { tag: ['@ADM-USR-001', '@ADM-USR-003', '@ADM-USR-005'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.user(admin.request, s.users.member.id);

    expect(res.offers).toEqual({ loginAs: true, delete: true });
  });

  test('only a superadmin can open it', { tag: ['@ADM-USR-001'] }, async ({ app, as }) => {
    const s = await make.amapScenario();

    for (const who of [await as(s.users.groupAdmin), await as(s.users.member), await as('anon')]) {
      const res = await app.views.admin.user(who.request, s.users.member.id);
      expect(res.status).toBe(302);
      expect(res.location).toBe('/');
      expect(res.email).toBeNull();
    }
  });
});

test.describe('the membership sheet of a user in a group', () => {
  test('it shows the member and the group', { tag: ['@ADM-USR-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.userGroup(admin.request, s.users.member.id, s.group.id);

    expect(res.status).toBe(200);
    expect(res.memberName).toMatch(/membre/i);
    expect(res.groupName).toBe('AMAP des Tests');
  });

  test('it lists the distributions of the last and next three months with the basket of the member', { tag: ['@ADM-USR-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario(); // 4 weekly days, from now + 7 days
    const place = s.place;
    const past = await make.multiDistrib({ group: s.group, place, start: days(-30) });
    const farPast = await make.multiDistrib({ group: s.group, place, start: days(-150) });
    const farFuture = await make.multiDistrib({ group: s.group, place, start: days(150) });
    const basket = await make.basket({ user: s.users.member, multiDistrib: s.multiDistribs[1] });
    await make.userOrder({ user: s.users.member, product: s.products.const[0], distribution: s.distributions[1].const, basket });
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.userGroup(admin.request, s.users.member.id, s.group.id);

    const ids = res.distributionIds;
    expect(ids).toEqual(expect.arrayContaining([past.id, ...s.multiDistribs.map((m) => m.id)]));
    expect(ids).not.toContain(farPast.id);
    expect(ids).not.toContain(farFuture.id);
    // a basket only where the member ordered
    const byDistrib = new Map(ids.map((id, i) => [id, res.basketIds[i]]));
    expect(byDistrib.get(s.multiDistribs[1].id)).toBe(basket.id);
    expect(byDistrib.get(s.multiDistribs[0].id)).toBeNull();
    expect(byDistrib.get(past.id)).toBeNull();
  });

  test('it only shows the orders of the member asked for', { tag: ['@ADM-USR-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const basket = await make.basket({ user: s.users.member2, multiDistrib: s.multiDistribs[0] });
    await make.userOrder({ user: s.users.member2, product: s.products.const[0], distribution: s.distributions[0].const, basket });
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.userGroup(admin.request, s.users.member.id, s.group.id);

    expect(res.basketIds.every((b) => b === null)).toBe(true);
  });

  test('it lists the last operations of the member in that group only', { tag: ['@ADM-USR-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre AMAP' });
    await make.userGroup({ user: s.users.member, group: other });
    await make.operation({ user: s.users.member, group: s.group, type: 'Payment', amount: 20, name: 'Chèque de mars' });
    await make.operation({ user: s.users.member, group: s.group, type: 'Payment', amount: 10, name: 'Espèces de mai' });
    await make.operation({ user: s.users.member, group: other, type: 'Payment', amount: 5, name: 'Ailleurs' });
    await make.operation({ user: s.users.member2, group: s.group, type: 'Payment', amount: 7, name: 'Autre membre' });
    const admin = await as(s.users.superadmin);

    const res = await app.views.admin.userGroup(admin.request, s.users.member.id, s.group.id);

    expect(res.operationCount).toBe(2);
    expect(res.text).toContain('Chèque de mars');
    expect(res.text).toContain('Espèces de mai');
    expect(res.text).not.toContain('Ailleurs');
    expect(res.text).not.toContain('Autre membre');
  });

  test('only a superadmin can open it', { tag: ['@ADM-USR-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario();

    for (const who of [await as(s.users.groupAdmin), await as(s.users.member), await as('anon')]) {
      const res = await app.views.admin.userGroup(who.request, s.users.member.id, s.group.id);
      expect(res.status).toBe(302);
      expect(res.location).toBe('/');
      expect(res.memberName).toBeNull();
    }
  });
});
