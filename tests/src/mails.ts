/**
 * Outgoing mail, read from the BufferedJsonMail queue. hx enqueues there
 * synchronously (camap-hx/src/mail/BufferedJsonMailer.hx) and Nest only
 * drains it, so reading the table does not depend on Nest's flush cron.
 * Rows are kept whatever their sent state. Mailpit (http://localhost:8026)
 * stays available to look at the real messages while debugging.
 */
import { query } from './db/client.js';
import { mailAddresses, type MailAddress } from './encodings/columns.js';

export type QueuedMail = {
  id: number;
  title: string;
  htmlBody: string | null;
  textBody: string | null;
  sender: MailAddress | null;
  recipients: MailAddress[];
  /** Lower-cased recipient emails, for easy assertions. */
  to: string[];
  cdate: string;
  /** Raw `headers` column parsed (reply-to etc.), null when absent. */
  headers: Record<string, unknown> | null;
};

async function maxId(): Promise<number> {
  const [r] = await query<{ m: number | null }>('SELECT MAX(id) AS m FROM BufferedJsonMail');
  return r?.m ?? 0;
}

function safeJson(v: string): Record<string, unknown> | null {
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

function parse(row: Record<string, any>): QueuedMail {
  const recipients = mailAddresses.decode(row.recipients);
  const sender = row.sender ? (JSON.parse(row.sender) as MailAddress) : null;
  return {
    id: row.id,
    title: row.title,
    htmlBody: row.htmlBody,
    textBody: row.textBody,
    sender,
    recipients,
    to: recipients.map((r) => r.email.toLowerCase()),
    cdate: row.cdate,
    headers: row.headers ? safeJson(row.headers) : null,
  };
}

export const mails = {
  /** Opaque position in the queue; pass it to `since()`. */
  mark: maxId,

  async since(mark: number): Promise<QueuedMail[]> {
    const rows = await query('SELECT * FROM BufferedJsonMail WHERE id > ? ORDER BY id', [mark]);
    return rows.map(parse);
  },

  async all(): Promise<QueuedMail[]> {
    return mails.since(0);
  },

  /** Mails whose recipients include `email`. */
  async to(email: string, mark = 0): Promise<QueuedMail[]> {
    const e = email.toLowerCase();
    return (await mails.since(mark)).filter((m) => m.to.includes(e));
  },
};
export type Mails = typeof mails;
