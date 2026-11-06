/**
 * First installation, on an empty platform (specs/08-administration/maintenance-install.md ADM-MNT-003;
 * controller/Install.hx doDefault).
 *
 * The database is reset before every test, so a test can empty the user table itself to reach the
 * "nobody has an account yet" state that the installation page looks at.
 */
import { test, expect } from '../../src/fixtures.js';
import { execute, query, queryOne } from '../../src/db/client.js';
import { md5Password } from '../../src/encodings/passwords.js';
import { SiteRight } from '../../src/encodings/flags.js';

const INSTALL = { amapName: 'Mon AMAP', firstName: 'Alice', lastName: 'Admin' };

async function emptyPlatform() {
  await execute('DELETE FROM `User`');
  expect(await query('SELECT id FROM `User`')).toEqual([]);
}

test.describe('first installation', () => {
  test('on an empty platform the installation creates the default superadmin admin@camap.tld with the password "admin"', { tag: ['@ADM-MNT-003', '@ADM-MNT-002'] }, async ({ app, as }) => {
    await emptyPlatform();
    const visitor = await as('anon');

    const res = await app.actions.install.run(visitor.request, INSTALL);

    expect(res.status).toBe(302);
    expect(res.location).toBe('/');
    // (the confirmation message names admin@camap.tld and "admin", but it is lost: "/" redirects again for a visitor)
    const users = await query<{ email: string; firstName: string; lastName: string; pass: string; rights: number }>('SELECT email, firstName, lastName, pass, rights FROM `User`');
    expect(users).toHaveLength(1);
    // hx stores last names in capitals
    expect(users[0]).toMatchObject({ email: 'admin@camap.tld', firstName: 'Alice', lastName: 'ADMIN', pass: md5Password('admin') });
    // the site right "Admin" (superadmin)
    expect(users[0].rights & (1 << SiteRight.Admin)).not.toBe(0);
  });

  test('the new superadmin can log in with it and open the back-office', { tag: ['@ADM-MNT-003'] }, async ({ app, as }) => {
    await emptyPlatform();
    await app.actions.install.run((await as('anon')).request, INSTALL);

    const admin = await as({ email: 'admin@camap.tld', password: 'admin' });
    const home = await app.views.admin.dashboard(admin.request);

    expect(home.status).toBe(200);
    expect(home.text).toContain("Console d'administration");
  });

  test('it also creates the group with the new user as member and contact, and an example place, vendor, catalog and two products', { tag: ['@ADM-MNT-003', '@ADM-MNT-002'] }, async ({ app, as }) => {
    await emptyPlatform();

    await app.actions.install.run((await as('anon')).request, INSTALL);

    const user = (await queryOne<{ id: number }>("SELECT id FROM `User` WHERE email = 'admin@camap.tld'"))!;
    const group = (await queryOne<{ id: number; name: string; userId: number; hasMembership: number }>('SELECT id, name, userId, hasMembership FROM `Group`'))!;
    expect(group).toMatchObject({ name: 'Mon AMAP', userId: user.id, hasMembership: 1 });
    expect(await query('SELECT userId FROM UserGroup WHERE groupId = ?', [group.id])).toEqual([{ userId: user.id }]);
    expect(await query('SELECT id FROM Place WHERE groupId = ?', [group.id])).toHaveLength(1);
    expect(await query('SELECT id FROM Vendor')).toHaveLength(1);
    const catalogs = await query<{ id: number; type: number; userId: number; vendorId: number }>('SELECT id, type, userId, vendorId FROM Catalog WHERE groupId = ?', [group.id]);
    expect(catalogs).toHaveLength(1);
    expect(catalogs[0]).toMatchObject({ type: 0, userId: user.id });
    const products = await query<{ price: number }>('SELECT price FROM Product WHERE catalogId = ? ORDER BY price', [catalogs[0].id]);
    expect(products.map((p) => p.price)).toEqual([10, 20]);
  });

  test('the form asks for the name of the group and the first and last names of the user, and nothing else', { tag: ['@ADM-MNT-003'] }, async ({ app, as }) => {
    await emptyPlatform();
    const visitor = await as('anon');

    const page = await app.views.platform.install(visitor.request);

    expect(page.status).toBe(200);
    expect(page.text).toContain("Installation de CAMAP");
    expect(page.text).not.toMatch(/mot de passe|password|e-?mail/i);
  });
});
