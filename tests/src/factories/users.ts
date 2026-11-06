/**
 * User and group membership. Column names: tests/db/schema.sql (TypeORM
 * entities). Defaults: camap-hx/src/db/User.hx new().
 */
import { insert } from '../db/client.js';
import { SiteRight, UserFlag, flags } from '../encodings/flags.js';
import { DEFAULT_PASSWORD, bcryptPassword, md5Password } from '../encodings/passwords.js';
import { encodeRights, type JsonRight } from '../encodings/rights.js';
import { nextSeq, nowSql, sqlDateTime } from './util.js';

export type UserRow = {
  id: number;
  email: string;
  /** Plain password, for logging in (not a column). */
  password: string;
  firstName: string;
  lastName: string;
  email2: string | null;
};

export type UserInput = Partial<{
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  email2: string | null;
  /** Two-letter interface language (User.lang), default 'fr'. */
  lang: string;
  firstName2: string | null;
  lastName2: string | null;
  phone: string | null;
  superadmin: boolean;
  /** SFlags<UserFlags>; default HasEmailNotif24h like User.new(). */
  flags: number;
  ldate: Date | string | null;
  cdate: Date | string;
  /** Write only the md5 `pass` (account created before bcrypt, ACC-LOG-003). */
  legacyPasswordOnly: boolean;
}>;

export async function user(input: UserInput = {}): Promise<UserRow> {
  const n = nextSeq();
  const password = input.password ?? DEFAULT_PASSWORD;
  const row = {
    email: input.email ?? `user${n}@camap.test`,
    firstName: input.firstName ?? `Prénom${n}`,
    lastName: input.lastName ?? `Nom${n}`,
    email2: input.email2 ?? null,
  };
  const id = await insert('User', {
    lang: input.lang ?? 'fr',
    pass: md5Password(password),
    pass2: input.legacyPasswordOnly ? '' : bcryptPassword(password),
    rights: input.superadmin ? flags(SiteRight, 'Admin') : 0,
    ...row,
    firstName2: input.firstName2 ?? null,
    lastName2: input.lastName2 ?? null,
    phone: input.phone ?? null,
    flags: input.flags ?? flags(UserFlag, 'HasEmailNotif24h'),
    cdate: sqlDateTime(input.cdate) ?? nowSql(),
    ldate: sqlDateTime(input.ldate) ?? null,
  });
  return { id, password, ...row };
}

export type UserGroupInput = {
  user: { id: number };
  group: { id: number };
  rights?: JsonRight[];
  balance?: number;
};

/** Make `user` a member of `group`, with group rights (see encodings/rights.ts). */
export async function userGroup(input: UserGroupInput): Promise<void> {
  await insert('UserGroup', {
    userId: input.user.id,
    groupId: input.group.id,
    rights: encodeRights(input.rights ?? []),
    balance: input.balance ?? 0,
  });
}
