/**
 * The page of a place (specs/03-catalogs/places.md; controller/Place.hx doView).
 */
import { test, expect } from '../../src/fixtures.js';
import * as make from '../../src/factories/index.js';

test('a member opens the page of a place: name and address are shown', { tag: ['@CAT-PLC-009'] }, async ({ app, as }) => {
  const s = await make.amapScenario();
  const p = await make.place({ group: s.group, name: 'Halle du marché', address1: '12 place du Marché', zipCode: '35000', city: 'Rennes', main: false });
  const member = await as(s.users.member);

  const res = await app.actions.places.view(member.request, p.id);

  expect(res.status).toBe(200);
  expect(res.text).toContain('Halle du marché');
  expect(res.text).toContain('12 place du Marché');
  expect(res.text).toContain('35000 Rennes');
});

test('a visitor is sent to the login page', { tag: ['@CAT-PLC-009'] }, async ({ app, anon }) => {
  const s = await make.amapScenario();

  const res = await app.actions.places.view(anon.request, s.place.id);

  expect(res.status).toBe(302);
  expect(res.location).toMatch(/^\/\?__redirect=/);
});
