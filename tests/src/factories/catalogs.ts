/**
 * Vendor, catalog, product. Defaults: camap-hx/src/db/{Vendor,Catalog,Product}.hx new().
 */
import { insert } from '../db/client.js';
import { CatalogFlag, CatalogType, flags } from '../encodings/flags.js';
import { addDaysWall } from '../encodings/dates.js';
import { clock } from '../clock.js';
import { bool, nextSeq, nowSql, sqlDateTime } from './util.js';

export type VendorRow = { id: number; name: string; email: string | null };

export async function vendor(
  input: Partial<{
    name: string;
    email: string | null;
    user: { id: number } | null;
    city: string;
    zipCode: string;
    disabled: number | null;
    companyNumber: string | null;
    profession: number | null;
    phone: string | null;
    showEmail: boolean;
    showPhone: boolean;
    desc: string | null;
    lat: number | null;
    lng: number | null;
  }> = {},
): Promise<VendorRow> {
  const n = nextSeq();
  const name = input.name ?? `Ferme ${n}`;
  const email = input.email === undefined ? `ferme${n}@camap.test` : input.email;
  const id = await insert('Vendor', {
    name,
    email,
    userId: input.user?.id ?? null,
    zipCode: input.zipCode ?? '44000',
    city: input.city ?? 'Nantes',
    country: 'FR',
    directory: 1,
    showEmail: input.showEmail === false ? 0 : 1,
    showPhone: input.showPhone === false ? 0 : 1,
    phone: input.phone ?? null,
    companyNumber: input.companyNumber ?? null,
    profession: input.profession ?? null,
    desc: input.desc ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    cdate: nowSql(),
    disabled: input.disabled ?? null,
  });
  return { id, name, email };
}

export type CatalogRow = { id: number; name: string; groupId: number; type: number };

export type CatalogInput = {
  group: { id: number };
  vendor: { id: number };
} & Partial<{
  name: string;
  type: keyof typeof CatalogType;
  contact: { id: number } | null;
  startDate: Date | string;
  endDate: Date | string;
  /** SFlags<CatalogFlags>; default UsersCanOrder like Catalog.new(). */
  flags: number;
  distribMinOrdersTotal: number;
  catalogMinOrdersTotal: number;
  absentDistribsMaxNb: number;
  absencesStartDate: Date | string | null;
  absencesEndDate: Date | string | null;
  orderStartDaysBeforeDistrib: number | null;
  orderEndHoursBeforeDistrib: number | null;
  description: string | null;
}>;

export async function catalog(input: CatalogInput): Promise<CatalogRow> {
  const now = clock.now();
  const name = input.name ?? `Contrat ${nextSeq()}`;
  const type = CatalogType[input.type ?? 'ConstantOrders'];
  const id = await insert('Catalog', {
    name,
    type,
    groupId: input.group.id,
    vendorId: input.vendor.id,
    userId: input.contact?.id ?? null,
    startDate: sqlDateTime(input.startDate ?? addDaysWall(now, -30)),
    endDate: sqlDateTime(input.endDate ?? addDaysWall(now, 335)),
    flags: input.flags ?? flags(CatalogFlag, 'UsersCanOrder'),
    distributorNum: 0,
    distribMinOrdersTotal: input.distribMinOrdersTotal ?? 0,
    catalogMinOrdersTotal: input.catalogMinOrdersTotal ?? 0,
    absentDistribsMaxNb: input.absentDistribsMaxNb ?? 0,
    absencesStartDate: sqlDateTime(input.absencesStartDate ?? null),
    absencesEndDate: sqlDateTime(input.absencesEndDate ?? null),
    orderStartDaysBeforeDistrib: input.orderStartDaysBeforeDistrib ?? null,
    orderEndHoursBeforeDistrib: input.orderEndHoursBeforeDistrib ?? null,
    description: input.description ?? null,
  });
  return { id, name, groupId: input.group.id, type };
}

export type ProductRow = { id: number; name: string; price: number; catalogId: number };

export async function product(
  input: { catalog: { id: number } } & Partial<{ name: string; price: number; vat: number; active: boolean; stock: number | null; qt: number }>,
): Promise<ProductRow> {
  const name = input.name ?? `Produit ${nextSeq()}`;
  const price = input.price ?? 10;
  const id = await insert('Product', {
    name,
    price,
    vat: input.vat ?? 5.5,
    catalogId: input.catalog.id,
    active: bool(input.active ?? true),
    organic: 0,
    variablePrice: 0,
    multiWeight: 0,
    bulk: 0,
    qt: input.qt ?? 1,
    unitType: 0, // Unit.Piece
    stockTracking: 0, // StockTracking.Disabled
    stockTrackingPerDistrib: 0,
    stock: input.stock ?? null,
  });
  return { id, name, price, catalogId: input.catalog.id };
}

/** Set product columns the factory does not expose (multiWeight, bulk, variablePrice, stock tracking). */
export async function setProduct(productId: number, columns: Record<string, unknown>): Promise<void> {
  const { update } = await import('../db/client.js');
  await update('Product', { id: productId }, columns);
}

/** Set catalog columns after creation (minimums, flags...). */
export async function setCatalog(catalogId: number, columns: Record<string, unknown>): Promise<void> {
  const { update } = await import('../db/client.js');
  await update('Catalog', { id: catalogId }, columns);
}
