/**
 * MultiDistrib (a distribution day of a group), Distribution (one catalog on
 * that day), cycles, volunteer roles and volunteers.
 */
import { insert } from '../db/client.js';
import { addDaysWall, addHours, atWallTime } from '../encodings/dates.js';
import { volunteerRolesIds } from '../encodings/columns.js';
import { clock } from '../clock.js';
import { bool, nextSeq, sqlDateTime } from './util.js';

export type MultiDistribRow = {
  id: number;
  groupId: number;
  placeId: number;
  distribStartDate: Date;
  distribEndDate: Date;
  orderStartDate: Date;
  orderEndDate: Date;
};

export type MultiDistribInput = {
  group: { id: number };
  place: { id: number };
} & Partial<{
  /** Default: in 7 days at 18:00 (Paris). */
  start: Date;
  /** Default: start + 2h. */
  end: Date;
  /** Default: start - 10 days. */
  orderStart: Date;
  /** Default: start - 1 day. */
  orderEnd: Date;
  volunteerRoles: { id: number }[];
  cycle: { id: number } | null;
}>;

export async function multiDistrib(input: MultiDistribInput): Promise<MultiDistribRow> {
  const start = input.start ?? atWallTime(addDaysWall(clock.now(), 7), 18);
  const end = input.end ?? addHours(start, 2);
  const orderStart = input.orderStart ?? addDaysWall(start, -10);
  const orderEnd = input.orderEnd ?? addDaysWall(start, -1);
  const id = await insert('MultiDistrib', {
    groupId: input.group.id,
    placeId: input.place.id,
    distribStartDate: sqlDateTime(start),
    distribEndDate: sqlDateTime(end),
    orderStartDate: sqlDateTime(orderStart),
    orderEndDate: sqlDateTime(orderEnd),
    // hx createMd writes "" (not NULL) for a session with no roles; NULL only exists on legacy rows
    volunteerRolesIds: input.volunteerRoles ? volunteerRolesIds.encode(input.volunteerRoles.map((r) => r.id)) : '',
    distributionCycleId: input.cycle?.id ?? null,
  });
  return {
    id,
    groupId: input.group.id,
    placeId: input.place.id,
    distribStartDate: start,
    distribEndDate: end,
    orderStartDate: orderStart,
    orderEndDate: orderEnd,
  };
}

export type DistributionRow = { id: number; catalogId: number; multiDistribId: number; date: Date; orderEndDate: Date };

/** Attach a catalog to a multidistrib. Dates are copied from the multidistrib unless given. */
export async function distribution(
  input: { catalog: { id: number }; multiDistrib: MultiDistribRow } & Partial<{
    date: Date;
    end: Date;
    orderStart: Date;
    orderEnd: Date;
    /** 1 = normal; >1 when orders of other distributions were shifted here. */
    quantities: number;
  }>,
): Promise<DistributionRow> {
  const md = input.multiDistrib;
  const date = input.date ?? md.distribStartDate;
  const orderEnd = input.orderEnd ?? md.orderEndDate;
  const id = await insert('Distribution', {
    catalogId: input.catalog.id,
    multiDistribId: md.id,
    placeId: md.placeId,
    date: sqlDateTime(date),
    end: sqlDateTime(input.end ?? md.distribEndDate),
    orderStartDate: sqlDateTime(input.orderStart ?? md.orderStartDate),
    orderEndDate: sqlDateTime(orderEnd),
    quantities: input.quantities ?? 1,
  });
  return { id, catalogId: input.catalog.id, multiDistribId: md.id, date, orderEndDate: orderEnd };
}

/** camap-hx/src/db/DistributionCycle.hx CycleType */
export const CycleType = { Weekly: 0, Monthly: 1, BiWeekly: 2, TriWeekly: 3 } as const;

export async function distributionCycle(
  input: { group: { id: number }; place: { id: number }; startDate: Date; endDate: Date } & Partial<{
    cycleType: keyof typeof CycleType;
    daysBeforeOrderStart: number;
    daysBeforeOrderEnd: number;
    startHour: Date;
    endHour: Date;
  }>,
): Promise<{ id: number }> {
  const startHour = input.startHour ?? atWallTime(input.startDate, 18);
  const endHour = input.endHour ?? addHours(startHour, 2);
  const id = await insert('DistributionCycle', {
    groupId: input.group.id,
    placeId: input.place.id,
    cycleType: CycleType[input.cycleType ?? 'Weekly'],
    startDate: sqlDateTime(input.startDate),
    endDate: sqlDateTime(input.endDate),
    startHour: sqlDateTime(startHour),
    endHour: sqlDateTime(endHour),
    openingHour: sqlDateTime(startHour),
    closingHour: sqlDateTime(startHour),
    daysBeforeOrderStart: input.daysBeforeOrderStart ?? 10,
    daysBeforeOrderEnd: input.daysBeforeOrderEnd ?? 1,
  });
  return { id };
}

export type VolunteerRoleRow = { id: number; name: string };

/** A duty role; generic when `catalog` is null. */
export async function volunteerRole(
  input: { group: { id: number } } & Partial<{ name: string; catalog: { id: number } | null; enabledByDefault: boolean }>,
): Promise<VolunteerRoleRow> {
  const name = input.name ?? `Rôle ${nextSeq()}`;
  const id = await insert('VolunteerRole', {
    name,
    groupId: input.group.id,
    catalogId: input.catalog?.id ?? null,
    enabledByDefault: bool(input.enabledByDefault ?? true),
  });
  return { id, name };
}

/** Register `user` for `role` on `multiDistrib`. */
export async function volunteer(input: { user: { id: number }; multiDistrib: { id: number }; role: { id: number } }): Promise<void> {
  await insert('Volunteer', {
    userId: input.user.id,
    multiDistribId: input.multiDistrib.id,
    volunteerRoleId: input.role.id,
  });
}

/** Shift orders onto a distribution (Distribution.quantities > 1). */
export async function setDistributionQuantities(distributionId: number, quantities: number): Promise<void> {
  const { update } = await import('../db/client.js');
  await update('Distribution', { id: distributionId }, { quantities });
}
