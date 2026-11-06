/**
 * Scenario presets: a ready-made group with one user per spec actor.
 * Every user's password is DEFAULT_PASSWORD ("test1234").
 */
import { addDaysWall, atWallTime } from '../encodings/dates.js';
import { Right } from '../encodings/rights.js';
import { clock } from '../clock.js';
import { catalog, product, vendor, type CatalogRow, type ProductRow, type VendorRow } from './catalogs.js';
import { distribution, multiDistrib, type DistributionRow, type MultiDistribRow } from './distributions.js';
import { group, place, setGroupContact, type GroupInput, type GroupRow, type PlaceRow } from './groups.js';
import { user, userGroup, type UserRow } from './users.js';

export type AmapScenario = {
  group: GroupRow;
  place: PlaceRow;
  vendor: VendorRow;
  /** Constant-orders CSA catalog, absences allowed (2 max, over the scenario distributions). */
  constCatalog: CatalogRow;
  /** Variable-orders catalog. */
  varCatalog: CatalogRow;
  products: { const: ProductRow[]; var: ProductRow[] };
  /** Upcoming distribution days, weekly from now + 7 days, 18:00-20:00. */
  multiDistribs: MultiDistribRow[];
  /** distributions[i] = the two catalogs' Distribution rows on multiDistribs[i]. */
  distributions: { const: DistributionRow; var: DistributionRow }[];
  users: {
    /** Plain member, no right. */
    member: UserRow;
    /** Another plain member. */
    member2: UserRow;
    /** ContractAdmin on both catalogs, contact of the catalogs. */
    coordinator: UserRow;
    /** Membership right. */
    membershipManager: UserRow;
    /** Messages right. */
    messagesManager: UserRow;
    /** GroupAdmin + all rights, contact of the group. */
    groupAdmin: UserRow;
    /** Linked to the vendor (Vendor.userId), not a member. */
    vendor: UserRow;
    /** Site admin, not a member. */
    superadmin: UserRow;
    /** Logged-in user who belongs to no group. */
    nonMember: UserRow;
  };
};

export type AmapScenarioOptions = {
  group?: GroupInput;
  /** Number of upcoming distribution days (default 4). */
  distribs?: number;
};

export async function amapScenario(opts: AmapScenarioOptions = {}): Promise<AmapScenario> {
  const now = clock.now();
  const g = await group({ name: 'AMAP des Tests', allowedPaymentsType: JSON.stringify(['cash', 'check']), ...opts.group });
  const pl = await place({ group: g, name: 'Salle des fêtes' });

  const users = {
    member: await user({ firstName: 'Martine', lastName: 'Membre', email: 'member@camap.test' }),
    member2: await user({ firstName: 'Marc', lastName: 'Membre', email: 'member2@camap.test' }),
    coordinator: await user({ firstName: 'Colette', lastName: 'Coordinatrice', email: 'coordinator@camap.test' }),
    membershipManager: await user({ firstName: 'Adèle', lastName: 'Adhésions', email: 'membership@camap.test' }),
    messagesManager: await user({ firstName: 'Max', lastName: 'Messages', email: 'messages@camap.test' }),
    groupAdmin: await user({ firstName: 'Gaston', lastName: 'Admin', email: 'groupadmin@camap.test' }),
    vendor: await user({ firstName: 'Paul', lastName: 'Producteur', email: 'vendor@camap.test' }),
    superadmin: await user({ firstName: 'Sophie', lastName: 'Superadmin', email: 'superadmin@camap.test', superadmin: true }),
    nonMember: await user({ firstName: 'Nina', lastName: 'Nonmembre', email: 'nonmember@camap.test' }),
  };

  const v = await vendor({ name: 'Ferme du Test', email: 'ferme@camap.test', user: users.vendor });

  const n = opts.distribs ?? 4;
  const days = Array.from({ length: n }, (_, i) => atWallTime(addDaysWall(now, 7 * (i + 1)), 18));
  const absencesStart = addDaysWall(days[0], -1);
  const absencesEnd = addDaysWall(days[n - 1], 1);

  const constCatalog = await catalog({
    group: g,
    vendor: v,
    name: 'Légumes (contrat AMAP)',
    type: 'ConstantOrders',
    contact: users.coordinator,
    absentDistribsMaxNb: 2,
    absencesStartDate: atWallTime(absencesStart, 0),
    absencesEndDate: atWallTime(absencesEnd, 23, 59, 59),
  });
  const varCatalog = await catalog({ group: g, vendor: v, name: 'Œufs (contrat variable)', type: 'VariableOrders', contact: users.coordinator });

  const products = {
    const: [await product({ catalog: constCatalog, name: 'Panier de légumes', price: 15 })],
    var: [await product({ catalog: varCatalog, name: 'Boîte de 6 œufs', price: 2.4 }), await product({ catalog: varCatalog, name: 'Boîte de 12 œufs', price: 4.5 })],
  };

  const multiDistribs: MultiDistribRow[] = [];
  const distributions: AmapScenario['distributions'] = [];
  for (const start of days) {
    const md = await multiDistrib({ group: g, place: pl, start });
    multiDistribs.push(md);
    distributions.push({
      const: await distribution({ catalog: constCatalog, multiDistrib: md }),
      var: await distribution({ catalog: varCatalog, multiDistrib: md }),
    });
  }

  const rights = {
    member: [],
    member2: [],
    coordinator: [Right.ContractAdmin(constCatalog.id), Right.ContractAdmin(varCatalog.id)],
    membershipManager: [Right.Membership()],
    messagesManager: [Right.Messages()],
    groupAdmin: [Right.GroupAdmin(), Right.Membership(), Right.Messages(), Right.ContractAdmin()],
  } as const;
  for (const [actor, r] of Object.entries(rights)) {
    await userGroup({ user: users[actor as keyof typeof rights], group: g, rights: [...r] });
  }
  await setGroupContact(g, users.groupAdmin);

  return { group: g, place: pl, vendor: v, constCatalog, varCatalog, products, multiDistribs, distributions, users };
}
