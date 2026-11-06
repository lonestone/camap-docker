/**
 * Where the membership dialog is opened from (specs/02-groups/membership.md GRP-COT-013).
 * The dialog itself is a browser widget (not tested); the list entry is a button of the members table (browser only).
 * The member sheet is described in members.views.spec.ts.
 */
import { test, expect } from '../../src/fixtures.js';
import * as make from '../../src/factories/index.js';

test.describe('the membership dialog on the sheet of a member', () => {
  for (const who of ['membershipManager', 'groupAdmin'] as const) {
    test(`the sheet offers it to ${who === 'groupAdmin' ? 'a group admin' : 'a membership manager'} when the group has memberships`, { tag: ['@GRP-COT-013'] }, async ({ app, as }) => {
      const s = await make.amapScenario({ group: { hasMembership: true, membershipFee: 10 } });
      const u = await as(s.users[who]);
      await app.actions.group.select(u.request, s.group.id);

      const sheet = await app.views.member.sheet(u.request, s.users.member.id);

      expect(sheet.offers.membershipDialog).toBe(true);
    });
  }
});
