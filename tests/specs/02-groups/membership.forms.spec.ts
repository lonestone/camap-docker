/**
 * The membership settings of the group (specs/02-groups/membership.md GRP-COT-001, GRP-COT-002;
 * controller/AmapAdmin.hx doMembership). The recording of memberships is in membership.graphql.spec.ts.
 */
import { test, expect } from '../../src/fixtures.js';
import { queryOne } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';
import type { CamapApp } from '../../src/targets/types.js';
import type { APIRequestContext } from '@playwright/test';

type Row = { hasMembership: number; membershipFee: number | null; membershipRenewalDate: string | null };
const rowOf = async (id: number) => (await queryOne<Row>('SELECT hasMembership, membershipFee, membershipRenewalDate FROM `Group` WHERE id = ?', [id]))!;

async function adminOf(app: CamapApp, as: (u: any) => Promise<{ request: APIRequestContext }>, s: Awaited<ReturnType<typeof make.amapScenario>>, who: 'groupAdmin' | 'member' | 'membershipManager' | 'coordinator' = 'groupAdmin') {
  const a = await as(s.users[who]);
  await app.actions.group.select(a.request, s.group.id);
  return a;
}

const UPDATED = /Paramètres d'adhésion mis à jour/;

test.describe('the membership settings form', () => {
  test('the form shows the settings of the group as they are', { tag: ['@GRP-COT-001', '@GRP-SET-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { hasMembership: true, membershipFee: 25, membershipRenewalDate: '2020-09-01' } });
    const a = await adminOf(app, as, s);

    const f = await app.actions.groupAdmin.membershipSettings(a.request);

    expect(f.status).toBe(200);
    expect(f.values).toEqual({ enabled: true, fee: '25', renewalDate: '2020-09-01' });
  });

  test('a group admin enables the memberships, sets a fee and a renewal date', { tag: ['@GRP-COT-001', '@GRP-SET-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const a = await adminOf(app, as, s);

    const res = await app.actions.groupAdmin.saveMembershipSettings(a.request, { enabled: true, fee: '30', renewalDate: '2020-09-01' });

    expect(res.status).toBe(302);
    expect(res.location).toBe('/amapadmin');
    expect(res.flash?.kind).toBe('ok');
    expect(res.flash?.text).toMatch(UPDATED);
    expect(await rowOf(s.group.id)).toEqual({ hasMembership: 1, membershipFee: 30, membershipRenewalDate: '2020-09-01' });
    expect((await app.actions.groupAdmin.membershipSettings(a.request)).values).toEqual({ enabled: true, fee: '30', renewalDate: '2020-09-01' });
  });

  test('a group admin disables the memberships', { tag: ['@GRP-COT-001', '@GRP-SET-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { hasMembership: true, membershipFee: 30, membershipRenewalDate: '2020-09-01' } });
    const a = await adminOf(app, as, s);

    const res = await app.actions.groupAdmin.saveMembershipSettings(a.request, { enabled: false, fee: '30', renewalDate: '2020-09-01' });

    expect(res.flash?.text).toMatch(UPDATED);
    expect((await rowOf(s.group.id)).hasMembership).toBe(0);
  });

  test('the fee and the renewal date can be left empty', { tag: ['@GRP-COT-001', '@GRP-SET-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { hasMembership: true, membershipFee: 30, membershipRenewalDate: '2020-09-01' } });
    const a = await adminOf(app, as, s);

    const res = await app.actions.groupAdmin.saveMembershipSettings(a.request, { enabled: true, fee: '', renewalDate: '' });

    expect(res.flash?.text).toMatch(UPDATED);
    expect(await rowOf(s.group.id)).toEqual({ hasMembership: 1, membershipFee: null, membershipRenewalDate: null });
  });

  test('only this group is changed', { tag: ['@GRP-COT-001', '@GRP-SET-011'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const other = await make.group({ name: 'Autre groupe' });
    const a = await adminOf(app, as, s);

    await app.actions.groupAdmin.saveMembershipSettings(a.request, { enabled: true, fee: '30', renewalDate: '2020-09-01' });

    expect(await rowOf(other.id)).toEqual({ hasMembership: 0, membershipFee: null, membershipRenewalDate: null });
  });

  const refused: ['member' | 'membershipManager' | 'coordinator', string][] = [
    ['member', 'a plain member'],
    ['membershipManager', 'a membership manager'],
    ['coordinator', 'a catalog coordinator'],
  ];
  for (const [who, label] of refused) {
    test(`${label} cannot open or post the form`, { tag: ['@GRP-COT-001', '@GRP-SET-011'] }, async ({ app, as }) => {
      const s = await make.amapScenario();
      const u = await adminOf(app, as, s, who);

      const form = await app.actions.groupAdmin.membershipSettings(u.request);
      const res = await app.actions.groupAdmin.saveMembershipSettings(u.request, { enabled: true, fee: '30', renewalDate: '2020-09-01' });

      expect(form).toMatchObject({ status: 302, location: '/' }); // "Access forbidden"
      expect(res).toMatchObject({ status: 302, location: '/' });
      expect(await rowOf(s.group.id)).toEqual({ hasMembership: 0, membershipFee: null, membershipRenewalDate: null });
    });
  }
});

test.describe('the membership fee (UND-032, characterised)', () => {
  // SUGGESTION of the spec: widen the column, allow an empty (variable) fee, treat 0 as free. Today the
  // fee is a signed tinyint column (max 127) and the form takes any integer.
  test('a fee of 0 is stored as 0', { tag: ['@GRP-COT-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { hasMembership: true, membershipFee: 10 } });
    const a = await adminOf(app, as, s);

    const res = await app.actions.groupAdmin.saveMembershipSettings(a.request, { enabled: true, fee: '0', renewalDate: '2020-09-01' });

    expect(res.flash?.text).toMatch(UPDATED);
    expect((await rowOf(s.group.id)).membershipFee).toBe(0);
  });

  test('the highest fee that fits is 127', { tag: ['@GRP-COT-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { hasMembership: true, membershipFee: 10 } });
    const a = await adminOf(app, as, s);

    const res = await app.actions.groupAdmin.saveMembershipSettings(a.request, { enabled: true, fee: '127', renewalDate: '2020-09-01' });

    expect(res.flash?.text).toMatch(UPDATED);
    expect((await rowOf(s.group.id)).membershipFee).toBe(127);
  });

  test('a fee above 127 is accepted, then silently stored as 127', { tag: ['@GRP-COT-002'] }, async ({ app, as }) => {
    const s = await make.amapScenario({ group: { hasMembership: true, membershipFee: 10 } });
    const a = await adminOf(app, as, s);

    const res = await app.actions.groupAdmin.saveMembershipSettings(a.request, { enabled: true, fee: '200', renewalDate: '2020-09-01' });

    // MySQL truncates the value to the column maximum: no error, no warning
    expect(res.flash?.kind).toBe('ok');
    expect((await rowOf(s.group.id)).membershipFee).toBe(127);
  });
});
