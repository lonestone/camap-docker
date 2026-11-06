/**
 * The outgoing mail queue (BufferedJsonMail). Defaults: db/BufferedJsonMail.hx new() and
 * BufferedJsonMailer.send (tries 0, no sent date, JSON recipients and headers).
 */
import { insert } from '../db/client.js';
import { nowSql, sqlDateTime } from './util.js';

export type QueuedMailInput = {
  title: string;
  recipients: { email: string; name?: string | null; userId?: number | null }[];
} & Partial<{
  htmlBody: string;
  textBody: string | null;
  sender: { name: string; email: string; userId?: number | null } | null;
  /** Mail headers, e.g. `{ 'Reply-To': 'x@y.z' }`. */
  headers: Record<string, string>;
  tries: number;
  cdate: Date | string;
  /** Set for an entry that has been sent (Nest deletes sent mails; only old rows have it). */
  sdate: Date | string | null;
  rawStatus: string | null;
  attachments: unknown[] | null;
}>;

export type QueuedMailRow = { id: number; title: string };

export async function queuedMail(input: QueuedMailInput): Promise<QueuedMailRow> {
  const id = await insert('BufferedJsonMail', {
    title: input.title,
    htmlBody: input.htmlBody ?? `<p>${input.title}</p>`,
    textBody: input.textBody ?? null,
    mailerType: 'smtp',
    tries: input.tries ?? 0,
    cdate: sqlDateTime(input.cdate) ?? nowSql(),
    sdate: sqlDateTime(input.sdate ?? null),
    rawStatus: input.rawStatus ?? null,
    headers: JSON.stringify(input.headers ?? {}),
    sender: input.sender === undefined ? null : JSON.stringify(input.sender),
    recipients: JSON.stringify(input.recipients),
    attachments: input.attachments === undefined ? null : input.attachments === null ? null : JSON.stringify(input.attachments),
  });
  return { id, title: input.title };
}
