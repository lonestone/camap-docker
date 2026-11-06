/**
 * Haxe SFlags<E> bitfields: bit n is set when the enum constructor of index n
 * is in the set. Ordinals are copied from the Haxe enums (the TS enums drop
 * some constructors, e.g. AllowInformationNotifs, so they cannot be used).
 * Haxe SEnum<E> columns store the constructor index as an int.
 */

/** camap-hx/src/db/Group.hx GroupFlags */
export const GroupFlag = {
  __HasMembership: 0,
  __ShopMode: 1,
  __HasPayments: 2,
  __ComputeMargin: 3,
  __CamapNetwork: 4,
  __CustomizedCategories: 5,
  HidePhone: 6,
  PhoneRequired: 7,
  AddressRequired: 8,
  __UnUsed: 9,
  __Show3rdCategoryLevel: 10,
  AllowInformationNotifs: 11,
  AllowAlertNotifs: 12,
} as const;

/** camap-hx/src/db/Catalog.hx CatalogFlags */
export const CatalogFlag = {
  UsersCanOrder: 0,
  StockManagement: 1,
  PercentageOnOrders: 2,
  DisplayPricesOnGroupPage: 3,
  NotifyVendorOnOrderEnd: 4,
  NotifyContactOnOrderEnd: 5,
} as const;

/** camap-hx/src/db/User.hx UserFlags */
export const UserFlag = {
  HasEmailNotif4h: 0,
  HasEmailNotif24h: 1,
  HasEmailNotifOuverture: 2,
} as const;

/** camap-hx/src/db/User.hx RightSite (User.rights) */
export const SiteRight = {
  Admin: 0,
} as const;

/** camap-hx/src/db/Group.hx RegOption (Group.regOption, SEnum) */
export const RegOption = {
  Closed: 0,
  WaitingList: 1,
  Open: 2,
  Full: 3,
} as const;
export type RegOptionName = keyof typeof RegOption;

/** camap-hx/src/db/Catalog.hx TYPE_* (Catalog.type) */
export const CatalogType = {
  ConstantOrders: 0,
  VariableOrders: 1,
} as const;

/** Build an SFlags int from bit indexes (or names of `table`). */
export function flags<T extends Record<string, number>>(table: T, ...names: (keyof T)[]): number {
  return names.reduce((acc, n) => acc | (1 << table[n]), 0);
}

export function hasFlag(value: number, bit: number): boolean {
  return (value & (1 << bit)) !== 0;
}

export function flagNames<T extends Record<string, number>>(table: T, value: number): (keyof T)[] {
  return (Object.keys(table) as (keyof T)[]).filter((k) => hasFlag(value, table[k]));
}
