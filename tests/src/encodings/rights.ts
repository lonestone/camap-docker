/**
 * Group rights as stored in UserGroup.rights: a JSON array of
 * {right, params}, written by Haxe `haxe.Json.stringify`
 * (camap-hx/src/db/UserGroup.hx giveRight). `params` is null for a right
 * without parameter; ContractAdmin(catalogId) stores the id as a string.
 */

export type JsonRight = { right: string; params: string[] | null };

export const Right = {
  GroupAdmin: (): JsonRight => ({ right: 'GroupAdmin', params: null }),
  /** No id: all catalogs of the group. */
  ContractAdmin: (catalogId?: number): JsonRight => ({
    right: 'ContractAdmin',
    params: catalogId == null ? null : [String(catalogId)],
  }),
  Membership: (): JsonRight => ({ right: 'Membership', params: null }),
  Messages: (): JsonRight => ({ right: 'Messages', params: null }),
};

/** Value for UserGroup.rights; `null` (no right) when the list is empty, like a fresh hx member. */
export function encodeRights(rights: JsonRight[]): string | null {
  return rights.length === 0 ? null : JSON.stringify(rights);
}

export function decodeRights(value: string | null): JsonRight[] {
  if (value == null || value === '') return [];
  try {
    return JSON.parse(value) as JsonRight[];
  } catch {
    return []; // UserGroup.parseRights swallows bad JSON too
  }
}
