/**
 * Mail actually delivered over SMTP, read from the test mailpit (the sink of
 * the stack, see docker-compose.test.yml). Use it for what only Nest's
 * per-minute flush of BufferedJsonMail can show: sender, hidden recipients,
 * rendering as received. Mailpit is never reset between tests, so take a
 * `mark()` first and only look at what came after it.
 *
 * The flush runs on real time (Nest does not see the fake clock): a delivery
 * takes up to a minute plus the sending. Wait with `waitFor` and mark the
 * test `test.slow()`.
 */
import { env } from './env.js';

type Addr = { Name: string; Address: string };

export type DeliveredMail = {
  id: string;
  from: Addr | null;
  to: Addr[];
  cc: Addr[];
  /** Envelope recipients not in To/Cc: where blind copies end up. */
  bcc: Addr[];
  replyTo: Addr[];
  subject: string;
  html: string;
  text: string;
  /** Raw header names (lower-cased) to values, as received. */
  headers: Record<string, string[]>;
  /** Every address named in the headers (From, To, Cc, Reply-To). */
  headerText: string;
};

async function json<T>(path: string): Promise<T> {
  const res = await fetch(`${env.mailpitUrl}${path}`);
  if (!res.ok) throw new Error(`mailpit ${path}: ${res.status}`);
  return (await res.json()) as T;
}

async function ids(): Promise<string[]> {
  const out: string[] = [];
  for (let start = 0; ; start += 500) {
    const page = await json<{ messages: { ID: string }[] }>(`/api/v1/messages?start=${start}&limit=500`);
    out.push(...page.messages.map((m) => m.ID));
    if (page.messages.length < 500) return out;
  }
}

async function read(id: string): Promise<DeliveredMail> {
  const m = await json<any>(`/api/v1/message/${id}`);
  const headers = await json<Record<string, string[]>>(`/api/v1/message/${id}/headers`);
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    id,
    from: m.From ?? null,
    to: m.To ?? [],
    cc: m.Cc ?? [],
    bcc: m.Bcc ?? [],
    replyTo: m.ReplyTo ?? [],
    subject: m.Subject,
    html: m.HTML ?? '',
    text: m.Text ?? '',
    headers: lower,
    headerText: ['from', 'to', 'cc', 'reply-to'].flatMap((h) => lower[h] ?? []).join(' '),
  };
}

export const mailpit = {
  /** What mailpit holds now: pass it to `since()` / `waitFor()`. */
  async mark(): Promise<Set<string>> {
    return new Set(await ids());
  },

  /** Mails delivered after `mark`. */
  async since(mark: Set<string>): Promise<DeliveredMail[]> {
    const fresh = (await ids()).filter((id) => !mark.has(id));
    return Promise.all(fresh.map(read));
  },

  /**
   * Poll until `done(delivered)` is true (default: at least one mail), then return what was
   * delivered. Throws on timeout (default 90 s: one flush per minute plus the sending).
   */
  async waitFor(mark: Set<string>, opts: { timeoutMs?: number; done?: (delivered: DeliveredMail[]) => boolean } = {}): Promise<DeliveredMail[]> {
    const deadline = Date.now() + (opts.timeoutMs ?? 90_000);
    const done = opts.done ?? ((d) => d.length > 0);
    for (;;) {
      const delivered = await mailpit.since(mark);
      if (done(delivered)) return delivered;
      if (Date.now() > deadline) throw new Error(`mailpit: nothing matching after the timeout (${delivered.length} mail(s) delivered)`);
      await new Promise((r) => setTimeout(r, 2_000));
    }
  },
};
