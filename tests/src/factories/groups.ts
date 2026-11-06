/**
 * Group, place, waiting list, membership. Defaults: camap-hx/src/db/Group.hx new().
 */
import { insert, update } from '../db/client.js';
import { RegOption, type RegOptionName } from '../encodings/flags.js';
import { toSqlDate } from '../encodings/dates.js';
import { clock } from '../clock.js';
import { bool, nextSeq, nowSql, sqlDateTime } from './util.js';

/** Group.hx defaults, verbatim (the cron fills the [TOKENS]). */
export const DEFAULT_VOLUNTEERS_MAIL = `<b>Rappel : Vous êtes inscrit·e à la permanence du [DATE_DISTRIBUTION],</b><br/>
		Lieu de distribution : [LIEU_DISTRIBUTION]<br/>
		<br/>
		Voici la liste des bénévoles inscrits :<br/>
		[LISTE_BENEVOLES]<br/>`;
export const DEFAULT_ALERT_MAIL = `Nous avons besoin de <b>bénévoles pour la permanence du [DATE_DISTRIBUTION]</b><br/>
		Lieu de distribution : [LIEU_DISTRIBUTION]<br/>
		Les roles suivants sont à pourvoir :<br/>
		[ROLES_MANQUANTS]<br/>
		Cliquez sur "calendrier des permanences" pour vous inscrire !`;

export type GroupRow = { id: number; name: string };

export type GroupInput = Partial<{
  name: string;
  regOption: RegOptionName;
  /** SFlags<GroupFlags>, build with flags(GroupFlag, ...). */
  flags: number;
  contact: { id: number } | null;
  hasMembership: boolean;
  membershipFee: number | null;
  /** 'YYYY-MM-DD' (only its month and day matter); null = none. */
  membershipRenewalDate: string | null;
  /** Link of the group's own website (shown for a moved group). */
  extUrl: string | null;
  disabled: 'BLOCKED_BY_ADMIN' | 'MOVED' | 'SUSPENDED' | null;
  txtIntro: string | null;
  volunteersMailDaysBeforeDutyPeriod: number;
  vacantVolunteerRolesMailDaysBeforeDutyPeriod: number;
  volunteersMailContent: string;
  alertMailContent: string;
  daysBeforeDutyPeriodsOpen: number;
  allowedPaymentsType: string | null;
}>;

export async function group(input: GroupInput = {}): Promise<GroupRow> {
  const n = nextSeq();
  const name = input.name ?? `AMAP Test ${n}`;
  const id = await insert('Group', {
    name,
    flags: input.flags ?? 0,
    regOption: RegOption[input.regOption ?? 'Open'],
    userId: input.contact?.id ?? null,
    hasMembership: bool(input.hasMembership ?? false),
    membershipFee: input.membershipFee ?? null,
    membershipRenewalDate: input.membershipRenewalDate ?? null,
    cdate: nowSql(),
    currency: '€',
    currencyCode: 'EUR',
    checkOrder: '',
    vatRates: JSON.stringify([
      { label: 'TVA alimentaire', value: 5.5 },
      { label: 'TVA standard', value: 20 },
    ]),
    txtIntro: input.txtIntro ?? null,
    daysBeforeDutyPeriodsOpen: input.daysBeforeDutyPeriodsOpen ?? 60,
    daysAfterClosingBeforeHidingDutyPeriods: 30,
    volunteersMailDaysBeforeDutyPeriod: input.volunteersMailDaysBeforeDutyPeriod ?? 4,
    volunteersMailContent: input.volunteersMailContent ?? DEFAULT_VOLUNTEERS_MAIL,
    vacantVolunteerRolesMailDaysBeforeDutyPeriod: input.vacantVolunteerRolesMailDaysBeforeDutyPeriod ?? 7,
    alertMailContent: input.alertMailContent ?? DEFAULT_ALERT_MAIL,
    allowedPaymentsType: input.allowedPaymentsType ?? null,
    disabled: input.disabled ?? null,
    extUrl: input.extUrl ?? null,
  });
  return { id, name };
}

/** Set the group's main contact (Group.userId) after its users exist. */
export async function setGroupContact(g: { id: number }, contact: { id: number }): Promise<void> {
  await update('Group', { id: g.id }, { userId: contact.id });
}

export type PlaceRow = { id: number; name: string; groupId: number };

export async function place(
  input: { group: { id: number } } & Partial<{
    name: string;
    city: string;
    zipCode: string;
    address1: string | null;
    address2: string | null;
    country: string | null;
    lat: number | null;
    lng: number | null;
    /** Make it the group's main place (default). */
    main: boolean;
  }>,
): Promise<PlaceRow> {
  const name = input.name ?? `Lieu ${nextSeq()}`;
  const id = await insert('Place', {
    name,
    address1: input.address1 === undefined ? '1 rue de la Ferme' : input.address1,
    address2: input.address2 ?? null,
    zipCode: input.zipCode ?? '44000',
    city: input.city ?? 'Nantes',
    country: input.country === undefined ? 'FR' : input.country,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    groupId: input.group.id,
  });
  if (input.main !== false) await update('Group', { id: input.group.id }, { placeId: id });
  return { id, name, groupId: input.group.id };
}

export async function waitingList(input: { group: { id: number }; user: { id: number }; message?: string; date?: Date | string }): Promise<void> {
  await insert('WaitingList', {
    amapId: input.group.id,
    userId: input.user.id,
    date: sqlDateTime(input.date) ?? nowSql(),
    message: input.message ?? '',
  });
}

export async function membership(input: {
  group: { id: number };
  user: { id: number };
  year?: number;
  amount?: number;
  date?: Date;
  operation?: { id: number } | null;
}): Promise<void> {
  await insert('Membership', {
    groupId: input.group.id,
    userId: input.user.id,
    year: input.year ?? clock.now().getFullYear(),
    amount: input.amount ?? 10,
    date: toSqlDate(input.date ?? clock.now()),
    operationId: input.operation?.id ?? null,
  });
}
