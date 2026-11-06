/**
 * Claiming a vendor record (specs/03-catalogs/vendor-claim.md).
 * Claiming exists only in camap-ts (vendors.resolver.ts, vendor.service.ts claim/consolidateVendors):
 * camap-hx has no claim flow, so these tests go through the GraphQL API served on the hx origin.
 */
import { test, expect } from '../../src/fixtures.js';
import { query, queryOne, update } from '../../src/db/client.js';
import * as make from '../../src/factories/index.js';

const CLAIMABLE = `query { getClaimableVendors { id name email } }`;
const CLAIM = `mutation($id: Int!) { claimVendor(vendorId: $id) }`;
const CONSOLIDATE = `mutation($id: Int!) { consolidateVendors(vendorId: $id) }`;
const EMAIL_CHECK = `query($id: Int!) { getVendorWithEmailCheck(vendorId: $id) { id email } }`;
const CATALOG = `query($id: Int!) { catalog(id: $id) { id name } }`;

const vendorRow = (id: number) => queryOne<{ id: number; userId: number | null }>('SELECT id, userId FROM Vendor WHERE id = ?', [id]);
const catalogVendor = async (id: number) => (await queryOne<{ vendorId: number }>('SELECT vendorId FROM Catalog WHERE id = ?', [id]))?.vendorId;
const memberOf = async (userId: number) =>
  (await query<{ groupId: number }>('SELECT groupId FROM UserGroup WHERE userId = ? ORDER BY groupId', [userId])).map((r) => r.groupId);

/** A group with a place, and the vendor's catalog in it (active by default). */
async function groupWithCatalog(vendor: { id: number }, over: Partial<Parameters<typeof make.catalog>[0]> = {}) {
  const group = await make.group();
  await make.place({ group });
  const catalog = await make.catalog({ group, vendor, ...over });
  return { group, catalog };
}

test.describe('the vendor records a user can claim', () => {
  test('a user sees the unclaimed vendors that have their primary email', { tag: ['@CAT-VCL-001'] }, async ({ app, as }) => {
    const me = await make.user({ email: 'paul@ferme.test' });
    const mine = await make.vendor({ name: 'Ma ferme', email: 'paul@ferme.test' });
    await make.vendor({ name: 'Ferme voisine', email: 'voisin@ferme.test' });
    const user = await as(me);

    const res = await app.graphql(user.request, CLAIMABLE);

    expect(res.errors).toBeNull();
    expect(res.data.getClaimableVendors).toEqual([{ id: mine.id, name: 'Ma ferme', email: 'paul@ferme.test' }]);
  });

  test('the secondary email counts too', { tag: ['@CAT-VCL-001'] }, async ({ app, as }) => {
    const me = await make.user({ email: 'paul@ferme.test', email2: 'paul@autre.test' });
    const byPrimary = await make.vendor({ email: 'paul@ferme.test' });
    const bySecondary = await make.vendor({ email: 'paul@autre.test' });
    const user = await as(me);

    const res = await app.graphql(user.request, CLAIMABLE);

    expect(res.errors).toBeNull();
    expect(res.data.getClaimableVendors.map((v: { id: number }) => v.id).sort()).toEqual([byPrimary.id, bySecondary.id].sort());
  });

  test('a vendor that is already claimed is not listed', { tag: ['@CAT-VCL-001'] }, async ({ app, as }) => {
    const owner = await make.user();
    const me = await make.user({ email: 'paul@ferme.test' });
    await make.vendor({ name: 'Déjà prise', email: 'paul@ferme.test', user: owner });
    const free = await make.vendor({ name: 'Libre', email: 'paul@ferme.test' });
    const user = await as(me);

    const res = await app.graphql(user.request, CLAIMABLE);

    expect(res.errors).toBeNull();
    expect(res.data.getClaimableVendors.map((v: { id: number }) => v.id)).toEqual([free.id]);
  });

  test('the list is empty when no vendor has the user\'s email', { tag: ['@CAT-VCL-001'] }, async ({ app, as }) => {
    const me = await make.user({ email: 'nobody@camap.test' });
    await make.vendor({ email: 'someone@ferme.test' });
    const user = await as(me);

    const res = await app.graphql(user.request, CLAIMABLE);

    expect(res.errors).toBeNull();
    expect(res.data.getClaimableVendors).toEqual([]);
  });

  test('a visitor cannot list claimable vendors', { tag: ['@CAT-VCL-001'] }, async ({ app, anon }) => {
    await make.vendor({ email: 'paul@ferme.test' });

    const res = await app.graphql(anon.request, CLAIMABLE);

    expect(res.errors).not.toBeNull();
    expect(res.data?.getClaimableVendors ?? null).toBeNull();
  });
});

test.describe('claiming a vendor record', () => {
  test('a user claims the vendor that has their primary email', { tag: ['@CAT-VCL-002'] }, async ({ app, as }) => {
    const me = await make.user({ email: 'paul@ferme.test' });
    const v = await make.vendor({ email: 'paul@ferme.test' });
    const user = await as(me);

    const res = await app.graphql(user.request, CLAIM, { id: v.id });

    expect(res.errors).toBeNull();
    expect(res.data.claimVendor).toBe(v.id);
    expect(await vendorRow(v.id)).toEqual({ id: v.id, userId: me.id });
  });

  test('a user claims the vendor that has their secondary email', { tag: ['@CAT-VCL-002'] }, async ({ app, as }) => {
    const me = await make.user({ email: 'paul@ferme.test', email2: 'paul@autre.test' });
    const v = await make.vendor({ email: 'paul@autre.test' });
    const user = await as(me);

    const res = await app.graphql(user.request, CLAIM, { id: v.id });

    expect(res.errors).toBeNull();
    expect(res.data.claimVendor).toBe(v.id);
    expect((await vendorRow(v.id))?.userId).toBe(me.id);
  });

  test('a vendor with another email cannot be claimed', { tag: ['@CAT-VCL-002'] }, async ({ app, as }) => {
    const me = await make.user({ email: 'paul@ferme.test' });
    const v = await make.vendor({ email: 'autre@ferme.test' });
    const user = await as(me);

    const res = await app.graphql(user.request, CLAIM, { id: v.id });

    expect(res.errors?.[0].message).toMatch(/does not have the same email/);
    expect((await vendorRow(v.id))?.userId).toBeNull();
  });

  test('a vendor that is already claimed cannot be claimed again', { tag: ['@CAT-VCL-002'] }, async ({ app, as }) => {
    const owner = await make.user();
    const me = await make.user({ email: 'paul@ferme.test' });
    const v = await make.vendor({ email: 'paul@ferme.test', user: owner });
    const user = await as(me);

    const res = await app.graphql(user.request, CLAIM, { id: v.id });

    expect(res.errors?.[0].message).toMatch(/already claimed/);
    expect((await vendorRow(v.id))?.userId).toBe(owner.id);
  });

  test('an unknown vendor is refused', { tag: ['@CAT-VCL-002'] }, async ({ app, as }) => {
    const user = await as(await make.user());

    const res = await app.graphql(user.request, CLAIM, { id: 999999 });

    expect(res.errors?.[0].message).toMatch(/Unkown vendor/);
  });

  test('a visitor cannot claim', { tag: ['@CAT-VCL-002'] }, async ({ app, anon }) => {
    const v = await make.vendor({ email: 'paul@ferme.test' });

    const res = await app.graphql(anon.request, CLAIM, { id: v.id });

    expect(res.errors).not.toBeNull();
    expect((await vendorRow(v.id))?.userId).toBeNull();
  });

  // The listing matches emails with the database collation (case-insensitive), but the claim compares them
  // as strings: a vendor stored as "Paul@Ferme.test" is listed to paul@ferme.test, then refused (characterised).
  test('the claim compares emails with case (characterised)', { tag: ['@CAT-VCL-001', '@CAT-VCL-002'] }, async ({ app, as }) => {
    const me = await make.user({ email: 'paul@ferme.test' });
    const v = await make.vendor({ email: 'Paul@Ferme.test' });
    const user = await as(me);

    const listed = await app.graphql(user.request, CLAIMABLE);
    const claimed = await app.graphql(user.request, CLAIM, { id: v.id });

    expect(listed.data.getClaimableVendors.map((x: { id: number }) => x.id)).toEqual([v.id]);
    expect(claimed.errors?.[0].message).toMatch(/does not have the same email/);
    expect((await vendorRow(v.id))?.userId).toBeNull();
  });
});

test.describe('a user without a secondary email', () => {
  test('claims a vendor with their primary email', { tag: ['@CAT-VCL-003'] }, async ({ app, as }) => {
    const me = await make.user({ email: 'paul@ferme.test', email2: null });
    const v = await make.vendor({ email: 'paul@ferme.test' });
    const user = await as(me);

    const listed = await app.graphql(user.request, CLAIMABLE);
    const claimed = await app.graphql(user.request, CLAIM, { id: v.id });

    expect(listed.errors).toBeNull();
    expect(listed.data.getClaimableVendors).toHaveLength(1);
    expect(claimed.errors).toBeNull();
    expect((await vendorRow(v.id))?.userId).toBe(me.id);
  });

  // UND-048 (undecided): the email check query reads email2.toLowerCase(). It is only reached when the primary
  // email differs (the && short-circuits), so a matching primary email does not crash, contrary to the statement.
  test('passes the email check query that precedes the claim when the primary email matches', { tag: ['@CAT-VCL-003'] }, async ({ app, as }) => {
    const me = await make.user({ email: 'paul@ferme.test', email2: null });
    const v = await make.vendor({ email: 'PAUL@ferme.test' });
    const user = await as(me);

    const res = await app.graphql(user.request, EMAIL_CHECK, { id: v.id });

    expect(res.errors).toBeNull();
    expect(res.data.getVendorWithEmailCheck.id).toBe(v.id);
  });

  // Characterised (UND-048): with no email2 and another primary email, the query crashes on null.toLowerCase()
  // instead of answering "unauthorized" like it does for a user with an email2.
  test('crashes the email check query when the primary email differs (characterised, UND-048)', { tag: ['@CAT-VCL-003'] }, async ({ app, as }) => {
    const v = await make.vendor({ email: 'autre@ferme.test' });
    const withoutSecond = await as(await make.user({ email: 'paul@ferme.test', email2: null }));
    const withSecond = await as(await make.user({ email: 'pierre@ferme.test', email2: 'pierre@autre.test' }));

    const crash = await app.graphql(withoutSecond.request, EMAIL_CHECK, { id: v.id });
    const refused = await app.graphql(withSecond.request, EMAIL_CHECK, { id: v.id });

    expect(crash.errors?.[0].message).toMatch(/toLowerCase|Internal server error/i);
    expect(refused.errors?.[0].message).toMatch(/Unauthorized/i);
  });

  test('the email check query works when the user has a secondary email', { tag: ['@CAT-VCL-003'] }, async ({ app, as }) => {
    const me = await make.user({ email: 'paul@ferme.test', email2: 'paul@autre.test' });
    const v = await make.vendor({ email: 'PAUL@Ferme.test' });
    const user = await as(me);

    const res = await app.graphql(user.request, EMAIL_CHECK, { id: v.id });

    expect(res.errors).toBeNull();
    expect(res.data.getVendorWithEmailCheck.id).toBe(v.id);
  });
});

test.describe('the groups of a claimed vendor', () => {
  test('the claimer joins the group of each active catalog of the vendor', { tag: ['@CAT-VCL-004'] }, async ({ app, as }) => {
    const me = await make.user({ email: 'paul@ferme.test' });
    const v = await make.vendor({ email: 'paul@ferme.test' });
    const a = await groupWithCatalog(v);
    const b = await groupWithCatalog(v);
    const user = await as(me);
    expect(await memberOf(me.id)).toEqual([]);

    const res = await app.graphql(user.request, CLAIM, { id: v.id });

    expect(res.errors).toBeNull();
    expect(await memberOf(me.id)).toEqual([a.group.id, b.group.id].sort((x, y) => x - y));
  });

  test('a group where the vendor has only an ended or a future catalog is not joined', { tag: ['@CAT-VCL-004'] }, async ({ app, as, clock }) => {
    const me = await make.user({ email: 'paul@ferme.test' });
    const v = await make.vendor({ email: 'paul@ferme.test' });
    const now = clock.now();
    const day = 24 * 3600 * 1000;
    const active = await groupWithCatalog(v);
    await groupWithCatalog(v, { startDate: new Date(now.getTime() - 60 * day), endDate: new Date(now.getTime() - 10 * day) });
    await groupWithCatalog(v, { startDate: new Date(now.getTime() + 10 * day), endDate: new Date(now.getTime() + 60 * day) });
    const user = await as(me);

    const res = await app.graphql(user.request, CLAIM, { id: v.id });

    expect(res.errors).toBeNull();
    expect(await memberOf(me.id)).toEqual([active.group.id]);
  });

  test('a user who is already a member of the group keeps their rights', { tag: ['@CAT-VCL-004'] }, async ({ app, as }) => {
    const me = await make.user({ email: 'paul@ferme.test' });
    const v = await make.vendor({ email: 'paul@ferme.test' });
    const { group } = await groupWithCatalog(v);
    await make.userGroup({ user: me, group, balance: 12 });
    const user = await as(me);

    const res = await app.graphql(user.request, CLAIM, { id: v.id });

    expect(res.errors).toBeNull();
    const rows = await query('SELECT balance FROM UserGroup WHERE userId = ? AND groupId = ?', [me.id, group.id]);
    expect(rows).toEqual([{ balance: 12 }]);
  });

  test('a refused claim adds the user to no group', { tag: ['@CAT-VCL-004'] }, async ({ app, as }) => {
    const me = await make.user({ email: 'paul@ferme.test' });
    const v = await make.vendor({ email: 'autre@ferme.test' });
    await groupWithCatalog(v);
    const user = await as(me);

    await app.graphql(user.request, CLAIM, { id: v.id });

    expect(await memberOf(me.id)).toEqual([]);
  });
});

test.describe('merging vendor records', () => {
  test('claiming a second record merges it into the existing one', { tag: ['@CAT-VCL-005'] }, async ({ app, as }) => {
    const me = await make.user({ email: 'paul@ferme.test' });
    const mine = await make.vendor({ name: 'Ma fiche', email: 'paul@ferme.test', user: me });
    const other = await make.vendor({ name: 'Doublon', email: 'paul@ferme.test' });
    const ownCatalog = (await groupWithCatalog(mine)).catalog;
    const otherCatalog = (await groupWithCatalog(other)).catalog;
    const user = await as(me);

    const res = await app.graphql(user.request, CLAIM, { id: other.id });

    expect(res.errors).toBeNull();
    // the id of the record the user already had
    expect(res.data.claimVendor).toBe(mine.id);
    expect(await vendorRow(other.id)).toBeUndefined();
    expect((await vendorRow(mine.id))?.userId).toBe(me.id);
    expect(await catalogVendor(ownCatalog.id)).toBe(mine.id);
    expect(await catalogVendor(otherCatalog.id)).toBe(mine.id);
  });

  test('the checks of a claim apply before merging', { tag: ['@CAT-VCL-005'] }, async ({ app, as }) => {
    const me = await make.user({ email: 'paul@ferme.test' });
    const mine = await make.vendor({ email: 'paul@ferme.test', user: me });
    const foreign = await make.vendor({ email: 'autre@ferme.test' });
    const { catalog } = await groupWithCatalog(foreign);
    const user = await as(me);

    const res = await app.graphql(user.request, CLAIM, { id: foreign.id });

    expect(res.errors?.[0].message).toMatch(/does not have the same email/);
    expect(await vendorRow(foreign.id)).toEqual({ id: foreign.id, userId: null });
    expect(await catalogVendor(catalog.id)).toBe(foreign.id);
    expect((await vendorRow(mine.id))?.userId).toBe(me.id);
  });

  test('a vendor merges all their other records into a target record', { tag: ['@CAT-VCL-006'] }, async ({ app, as }) => {
    const me = await make.user({ email: 'paul@ferme.test' });
    const target = await make.vendor({ name: 'Cible', email: 'paul@ferme.test', user: me });
    const dup1 = await make.vendor({ name: 'Doublon 1', email: 'paul@ferme.test', user: me });
    const dup2 = await make.vendor({ name: 'Doublon 2', email: 'paul@ferme.test', user: me });
    const stranger = await make.vendor({ name: 'Autre propriétaire', email: 'x@ferme.test', user: await make.user() });
    const cTarget = (await groupWithCatalog(target)).catalog;
    const c1 = (await groupWithCatalog(dup1)).catalog;
    const c2 = (await groupWithCatalog(dup2)).catalog;
    const cStranger = (await groupWithCatalog(stranger)).catalog;
    const user = await as(me);

    const res = await app.graphql(user.request, CONSOLIDATE, { id: target.id });

    expect(res.errors).toBeNull();
    expect(res.data.consolidateVendors).toBe(true);
    expect(await vendorRow(dup1.id)).toBeUndefined();
    expect(await vendorRow(dup2.id)).toBeUndefined();
    expect((await vendorRow(target.id))?.userId).toBe(me.id);
    expect(await catalogVendor(cTarget.id)).toBe(target.id);
    expect(await catalogVendor(c1.id)).toBe(target.id);
    expect(await catalogVendor(c2.id)).toBe(target.id);
    // records of other users are left alone
    expect((await vendorRow(stranger.id))?.userId).not.toBeNull();
    expect(await catalogVendor(cStranger.id)).toBe(stranger.id);
  });

  test('merging with no other record changes nothing', { tag: ['@CAT-VCL-006'] }, async ({ app, as }) => {
    const me = await make.user();
    const only = await make.vendor({ user: me });
    const { catalog } = await groupWithCatalog(only);
    const user = await as(me);

    const res = await app.graphql(user.request, CONSOLIDATE, { id: only.id });

    expect(res.errors).toBeNull();
    expect(res.data.consolidateVendors).toBe(true);
    expect(await vendorRow(only.id)).toEqual({ id: only.id, userId: me.id });
    expect(await catalogVendor(catalog.id)).toBe(only.id);
  });

  test('the target must be a record of the user', { tag: ['@CAT-VCL-006'] }, async ({ app, as }) => {
    const me = await make.user();
    const mine = await make.vendor({ user: me });
    const theirs = await make.vendor({ user: await make.user() });
    const unclaimed = await make.vendor();
    const user = await as(me);

    for (const target of [theirs, unclaimed]) {
      const res = await app.graphql(user.request, CONSOLIDATE, { id: target.id });
      expect(res.errors?.[0].message).toMatch(/does not have access/);
    }
    const missing = await app.graphql(user.request, CONSOLIDATE, { id: 999999 });
    expect(missing.errors?.[0].message).toMatch(/not found/);
    expect(await vendorRow(mine.id)).toEqual({ id: mine.id, userId: me.id });
    expect(await vendorRow(theirs.id)).not.toBeUndefined();
    expect(await vendorRow(unclaimed.id)).not.toBeUndefined();
  });

  test('a visitor cannot merge', { tag: ['@CAT-VCL-006'] }, async ({ app, anon }) => {
    const v = await make.vendor({ user: await make.user() });

    const res = await app.graphql(anon.request, CONSOLIDATE, { id: v.id });

    expect(res.errors).not.toBeNull();
    expect(await vendorRow(v.id)).not.toBeUndefined();
  });
});

test.describe('managing the catalogs of a claimed vendor', () => {
  test('the claimer manages every catalog of the vendor, in groups they only just joined', { tag: ['@CAT-VCL-007'] }, async ({ app, as }) => {
    const me = await make.user({ email: 'paul@ferme.test' });
    const other = await make.user();
    const v = await make.vendor({ email: 'paul@ferme.test' });
    const a = await groupWithCatalog(v);
    const b = await groupWithCatalog(v, { type: 'VariableOrders' });
    const user = await as(me);
    const stranger = await as(other);

    const before = await app.graphql(user.request, CATALOG, { id: a.catalog.id });
    expect(before.errors?.[0].message).toMatch(/do not have the authorization/);

    await app.graphql(user.request, CLAIM, { id: v.id });

    for (const c of [a.catalog, b.catalog]) {
      const res = await app.graphql(user.request, CATALOG, { id: c.id });
      expect(res.errors).toBeNull();
      expect(res.data.catalog.id).toBe(c.id);
    }
    // someone who is not the vendor still has no access
    const refused = await app.graphql(stranger.request, CATALOG, { id: a.catalog.id });
    expect(refused.errors?.[0].message).toMatch(/do not have the authorization/);
  });

  test('the claimed vendor manages a catalog that has no rights set for them in its group', { tag: ['@CAT-VCL-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    const vendor = await as(s.users.vendor);
    const member = await as(s.users.member);

    // scenario vendor user: linked to the vendor, not a member of the group, no group rights
    expect(await memberOf(s.users.vendor.id)).toEqual([]);
    const own = await app.graphql(vendor.request, CATALOG, { id: s.constCatalog.id });
    const asMember = await app.graphql(member.request, CATALOG, { id: s.constCatalog.id });

    expect(own.errors).toBeNull();
    expect(own.data.catalog.id).toBe(s.constCatalog.id);
    expect(asMember.errors?.[0].message).toMatch(/do not have the authorization/);
  });

  test('releasing the vendor record removes the right', { tag: ['@CAT-VCL-007'] }, async ({ app, as }) => {
    const s = await make.amapScenario();
    await update('Vendor', { id: s.vendor.id }, { userId: null });
    const vendor = await as(s.users.vendor);

    const res = await app.graphql(vendor.request, CATALOG, { id: s.constCatalog.id });

    expect(res.errors?.[0].message).toMatch(/do not have the authorization/);
  });
});
