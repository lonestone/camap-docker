/**
 * Known deviations: decided behaviour (UND-NNN DECISION) or fixed defects
 * (CODE-NNN) that a target does not implement yet (ROADBLOCKS D1).
 *
 * A test asserts the *decided* behaviour and calls `deviation('UND-097')`
 * first. On a listed target the test is marked expected-to-fail
 * (test.fail); if it starts passing there, Playwright reports it as an
 * unexpected pass, which means the entry must be removed from this table.
 */
import { test } from '@playwright/test';
import { env, type TargetName } from './env.js';

export type Deviation = {
  /** Why the target deviates today, with the code pointer. */
  reason: string;
  /** Targets where the decided behaviour does not hold yet. */
  targets: TargetName[];
};

export const DEVIATIONS: Record<string, Deviation> = {
  'UND-062': {
    reason: 'the variable-orders attendance query only needs a login: any logged-in user reads any distribution\'s attendance (attendance-list.resolver.ts:90-138, CODE-009)',
    targets: ['hx', 'ts'],
  },
  'UND-061': {
    reason: 'distribution(id) and its user orders need no login, and multiDistribution(id) needs only a login: no group membership check, orders visible to anybody (distributions.resolver.ts:19-33,96-104, multi-distribs.resolver.ts:62-74, CODE-010, CODE-018)',
    targets: ['hx', 'ts'],
  },
  'UND-056': {
    reason: 'the Haxe JSON API appends +01:00 or +02:00 from fixed dates ("29 March 02:00", "25 October 03:00") instead of the real Europe/Paris DST calendar (Formatting.hx:226-255, CODE-081)',
    targets: ['hx'],
  },
  'UND-058': {
    reason: 'after a price change or a missing-product removal the user is redirected to /distribution/validate/<id>, which has no handler (Distribution.hx:1096,1144, CODE-083)',
    targets: ['hx'],
  },
  'UND-097': {
    reason: 'cron endpoints run without the shared key: Cron.hx canRun() returns true, key check commented out (CODE-015)',
    targets: ['hx'],
  },
  'UND-068': {
    reason: 'GET /api/subscription/:id needs no login and checks no ownership (api/Subscription.hx:27-58, CODE-013)',
    targets: ['hx'],
  },
  'UND-085': {
    reason: 'the legacy shop-mode order edit page still exists: GET /contract/editVarOrders/<session> answers a page (Contract.hx:188-251, CODE-076)',
    targets: ['hx'],
  },
  'UND-077': {
    reason: 'the coordinator page of temporary baskets still exists: GET /contractAdmin/tmpBaskets/<session> answers a page (ContractAdmin.hx:1112-1115, CODE-077)',
    targets: ['hx'],
  },
  'UND-067': {
    reason: 'a member creating their own subscription runs in admin mode: the past-distribution-without-order check is skipped (api/Subscription.hx:35-50, SubscriptionService.hx:475, CODE-078, CODE-047)',
    targets: ['hx'],
  },
  'UND-070': {
    reason: 'a member deletes their subscription with a plain GET link, no confirmation, no CSRF token (Subscriptions.hx:35-44, CODE-020)',
    targets: ['hx'],
  },
  'UND-082': {
    reason: 'the default-order job does not catch errors per subscription: one failure aborts the whole task (Cron.hx:227-278)',
    targets: ['hx'],
  },
  'UND-075': {
    reason: 'the inline quantity edit returns a sub-total computed with the current product price (OrderService.hx:863, CODE-041)',
    targets: ['hx'],
  },
  'UND-080': {
    reason: 'balance transfer checks only "same member": a target of another vendor, or the source itself, is accepted (SubscriptionService.hx:1099-1131, CODE-036)',
    targets: ['hx'],
  },
  'UND-071': {
    reason: 'recording a payment only checks isContractManager() with no catalog: a coordinator of any catalog passes (SubscriptionAdmin.hx:420-423, CODE-014)',
    targets: ['hx'],
  },
  'UND-069': {
    reason: 'any member of the group can open another member\'s basket, orders and payments pages by id, and viewing the payments page rewrites the total operation (History.hx:64-121, CODE-012)',
    targets: ['hx'],
  },
  'UND-076': {
    reason: 'ordering again while the member\'s basket is OPEN creates a second CONFIRMED basket instead of reusing it (Basket.hx:48-66, CODE-042)',
    targets: ['hx'],
  },
  'UND-090': {
    reason: 'editing or deleting an operation with no subscription crashes building the return URL (Transaction.hx:89-96,128-132, CODE-031)',
    targets: ['hx'],
  },
  'UND-065': {
    reason: 'switching a role off or deleting it silently removes the registered volunteers, and editing/deleting a role does not check the rights on the role\'s catalog or group (amapadmin/Volunteers.hx, ContractAdmin.hx:221-249)',
    targets: ['hx'],
  },
  'UND-095': {
    reason: 'the daily attendance format form offers no CSV choice (Distribution.hx:154-159); the csv type exists only by URL',
    targets: ['hx'],
  },
  'UND-109': {
    reason: 'the back-office group search pastes the name between quotes into the SQL string (admin/Group.hx:38-44, CODE-025): a quote breaks or alters the query',
    targets: ['hx'],
  },
  'UND-108': {
    reason: 'a plain GET link `/admin/errors?empty=1` truncates the Error table: no POST, no CSRF token, no confirmation server-side (admin/Admin.hx:111-113, CODE-030)',
    targets: ['hx'],
  },
  'UND-116': {
    reason: 'the JSON API returns the stack trace in the response body, for tink errors and unexpected errors (Main.hx:193-206)',
    targets: ['hx'],
  },
  'UND-107': {
    reason: 'the installation diagnostics (Install.hx doDiagnostics) and the /cssdemo style guide (Main.hx doCssdemo) are public: no admin check, the CSS demo is not removed (CODE-026)',
    targets: ['hx'],
  },
  'FINDING-MSG-RIGHT': {
    reason: 'createMessage does not check the messages right: any logged-in user can send a message in any group (messages.resolver.ts createMessage; only the read queries call userIsAllowedToAccessMessages)',
    targets: ['hx', 'ts'],
  },
  'FINDING-MSG-RECIPIENTS': {
    reason: 'getEmailRecipientsByUserIds tests canManageMessages() without awaiting it (a promise is always truthy): any logged-in user gets the name and emails of members of any group (users.resolver.ts:105)',
    targets: ['hx', 'ts'],
  },
  'UND-098': {
    reason: 'message(id) reads message.amapId before the existence check, and getLatestMessages lists messages of groups where the sender lost the right (messages.resolver.ts:58-81, 83-103)',
    targets: ['hx', 'ts'],
  },
  'UND-101': {
    reason: 'Nest VariableService.getTheme() always returns the default theme, cached forever: the saved white-label theme is ignored in emails (variable.service.ts:61-72, CODE-104)',
    targets: ['hx', 'ts'],
  },
  'UND-118': {
    reason: 'the account page still takes a ?lang= parameter and stores it as the user\'s language, whatever the value; the language selection is to be removed (Account.hx:46-51)',
    targets: ['hx'],
  },
  'UND-110': {
    reason: 'account deletion silently does nothing when the deleted@camap.tld placeholder is missing: UsersService.delete returns null, the hx admin action prints the error and redirects as if nothing happened (users.service.ts:333-340, admin/User.hx:44-55)',
    targets: ['hx', 'ts'],
  },
  'CODE-056': {
    reason: 'deleteAccount logs the user out and mails the group admins even when UsersService.delete returned null (missing deleted@camap.tld): users.resolver.ts:224-246',
    targets: ['hx', 'ts'],
  },
  'UND-088': {
    reason: 'the TS GraphQL field CsaSubscription.balance (attendance sheet) sums every operation of the subscription, unrounded, instead of payments minus the order total rounded to cents (csa-subscriptions.resolver.ts:17-35, CODE-102)',
    targets: ['hx', 'ts'],
  },
};

export function deviation(id: keyof typeof DEVIATIONS | string): void {
  const d = DEVIATIONS[id];
  if (!d) throw new Error(`Unknown deviation ${id}: add it to src/deviations.ts`);
  const applies = d.targets.includes(env.target);
  test.info().annotations.push({ type: 'deviation', description: `${id}${applies ? '' : ' (fixed on this target)'}: ${d.reason}` });
  test.fail(applies, `${id}: ${d.reason}`);
}
