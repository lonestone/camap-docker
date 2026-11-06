/**
 * Clients for the hx JSON API (camap-hx/src/controller/Api.hx -> controller/api/*).
 * Service errors (tink Error) come back as {error:{code,message}} with the
 * code as HTTP status (controller/Main.hx doApi).
 */
import type { APIRequestContext, APIResponse } from '@playwright/test';
import { queryOne } from '../../db/client.js';
import type { RegOptionName } from '../../encodings/flags.js';
import { sha1 } from '../../encodings/passwords.js';
import { hxUrls } from './urls.js';
import type { GroupSettingsForm, GroupSettingsView, RightsChoice, GroupAdminSection, CatalogAbsences, ProductStockInput, ProductFormInput, ProductFormView, ProductUnit, Flash, CatalogFlagName, CatalogFormInput, CatalogFormView, CatalogKind, VendorForm, PlaceForm, PlaceFormView, ActionResult, ProductImportPage, CsvResult, CycleForm, GraphqlResult, SessionForm, SessionsOverview, VolunteerSettings, PageView, PaymentForm, ApiResult, CamapApp, SubscriptionAbsences, SubscriptionForm, FileScope, FileListing, UploadFile, AdminLink } from '../types.js';

/** The quit page (views/account/quit.mtt) hands the ids to the quit widget: `groupId: 3, userId: 5, controlKey`. */
async function quitPage(request: APIRequestContext, res: APIResponse) {
  const r = await action(request, res);
  const m = /userId:\s*(\d+|null),\s*groupId:\s*(\d+),\s*controlKey:/.exec(r.body);
  return { ...r, offered: m ? { groupId: Number(m[2]), userId: m[1] === 'null' ? null : Number(m[1]) } : null };
}

async function result<T>(res: APIResponse): Promise<ApiResult<T>> {
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep raw text */
  }
  return { status: res.status(), body: body as T };
}

function scopeQuery(scope: { catalogId?: number; multiDistribId?: number }): string {
  const q: string[] = [];
  if (scope.catalogId != null) q.push(`catalog=${scope.catalogId}`);
  if (scope.multiDistribId != null) q.push(`multiDistrib=${scope.multiDistribId}`);
  return q.length ? `?${q.join('&')}` : '';
}

async function gql<T>(request: APIRequestContext, query: string, variables: Record<string, unknown> = {}): Promise<GraphqlResult<T>> {
  const res = await request.post('/graphql', { data: { query, variables } });
  const json = (await res.json().catch(() => ({}))) as { data?: T | null; errors?: { message: string }[] };
  const setCookies = res.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie').map((h) => h.value);
  return { status: res.status(), data: json.data ?? null, errors: json.errors ?? null, setCookies };
}

// `recipients` is a JSON string in the entity: only message(id) and getLatestMessages parse it,
// the other queries fail on it ("Expected Iterable"), so they do not ask for it.
export const hxGraphql: CamapApp['graphql'] = (request, query, variables) => gql(request, query, variables);

const SESSION_FIELDS = 'id groupId placeId distribStartDate distribEndDate orderStartDate orderEndDate';
const MESSAGE_FIELDS = 'id title body amapId senderId recipientListId';
const MESSAGE_FIELDS_WITH_RECIPIENTS = `${MESSAGE_FIELDS} recipients`;

// camap-hx/src/db/Group.hx RegOption, by ordinal
const REG_OPTIONS: RegOptionName[] = ['Closed', 'WaitingList', 'Open', 'Full'];

async function settingsView(request: APIRequestContext, res: APIResponse): Promise<GroupSettingsView> {
  const html = await res.text();
  const location = res.headers()['location'] ?? null;
  const f = readForm(html);
  const str = (k: string) => (typeof f.values[k] === 'string' ? (f.values[k] as string) : '');
  const num = (k: string) => (str(k) === '' ? null : Number(str(k)));
  const checked = (f.values['flags[]'] as string[] | undefined) ?? [];
  const reg = str('regOption');
  const FLAG_NAMES: Record<string, string> = { '6': 'hidePhone', '7': 'phoneRequired', '8': 'addressRequired' };
  return {
    status: res.status(),
    location,
    flash: await flashOf(request, location),
    values: {
      name: str('name'),
      txtIntro: str('txtIntro'),
      txtHome: str('txtHome'),
      txtDistrib: str('txtDistrib'),
      extUrl: str('extUrl'),
      regOption: reg === '' ? null : REG_OPTIONS[Number(reg)],
      hidePhone: checked.includes('6'),
      phoneRequired: checked.includes('7'),
      addressRequired: checked.includes('8'),
      contactId: num('userId'),
      legalRepresentativeId: num('legalReprId'),
    },
    offered: {
      regOptions: [...html.matchAll(new RegExp(`type="radio"[^>]*name="${f.prefix}_regOption"[^>]*value="(\\d+)"`, 'g'))].map((m) => REG_OPTIONS[Number(m[1])]),
      options: (f.offered['flags[]'] ?? []).map((v) => FLAG_NAMES[v] ?? `flag${v}`),
      userIds: (f.options.userId ?? []).filter((v) => v !== '').map(Number),
    },
  };
}

export const hxApi: CamapApp['api'] = {
  users: {
    // controller/api/User.hx doMe (GET; POST = multipart form with the contact fields)
    me: async (request) => result(await request.get('/api/user/me')),
    updateContact: async (request, fields) => {
      const { data, contentType } = multipartBody(fields as Record<string, string>);
      return result(await request.post('/api/user/me', { data, headers: { 'content-type': contentType } }));
    },
    // controller/api/User.hx doGetFromGroup (the order dialog's member list)
    fromGroup: async (request) => result(await request.get('/api/user/getFromGroup/')),
  },
  messages: {
    // camap-ts messages.resolver.ts, reached through the hx origin (Apache proxies /graphql)
    create: (r, m) =>
      gql(r, `mutation($input: CreateMessageInput!) { createMessage(input: $input) { ${MESSAGE_FIELDS} } }`, {
        input: { slateContent: '[]', list: { type: 'all', name: 'Tous' }, attachments: [], ...m },
      }),
    forGroup: (r, groupId) => gql(r, `query($groupId: Int!) { getMessagesForGroup(groupId: $groupId) { ${MESSAGE_FIELDS} } }`, { groupId }),
    mineInGroup: (r, groupId) => gql(r, `query($groupId: Int!) { getUserMessagesForGroup(groupId: $groupId) { ${MESSAGE_FIELDS} } }`, { groupId }),
    byId: (r, id) => gql(r, `query($id: Int!) { message(id: $id) { ${MESSAGE_FIELDS_WITH_RECIPIENTS} } }`, { id }),
    latest: (r) => gql(r, `query { getLatestMessages { ${MESSAGE_FIELDS_WITH_RECIPIENTS} } }`),
  },
  distributions: {
    // controller/api/Distributions.hx
    volunteerRolesCalendar: async (request, from, to) => result(await request.get(`/api/distributions/volunteerRolesCalendar/${from}/${to}`)),
    unsubscribeFromRole: async (request, sessionId, roleId) => result(await request.get(`/api/distributions/unsubscribeFromRole/${sessionId}/${roleId}`)),
    sessionDates: async (request, from, to) => result(await request.get(`/api/distributions/volunteerRolesCalendar/${from}/${to}`)),
    // camap-ts multi-distribs.resolver.ts, distributions.resolver.ts, distribution-cycles.resolver.ts, attendance-list.resolver.ts, through the hx origin
    multiDistribs: (r, groupId, from, to, opts) =>
      gql(r, `query($groupId: Int!, $from: DateTime!, $to: DateTime!, $next: Boolean) { multiDistribs(groupId: $groupId, fromDate: $from, toDate: $to, nextMultiDistribIfEmpty: $next) { ${SESSION_FIELDS} } }`, {
        groupId,
        from,
        to,
        next: opts?.nextIfEmpty ?? null,
      }),
    distributedMultiDistribs: (r, groupId) => gql(r, `query($groupId: Int!) { distributedMultiDistribs(groupId: $groupId) { ${SESSION_FIELDS} } }`, { groupId }),
    multiDistrib: (r, id) =>
      gql(r, `query($id: Int!) { multiDistribution(id: $id) { ${SESSION_FIELDS} volunteers { userId volunteerRoleId } volunteerRoles { id name } } }`, { id }),
    distribution: (r, id) => gql(r, 'query($id: Int!) { distribution(id: $id) { id catalogId multiDistrib { id } userOrders { id userId } } }', { id }),
    cycles: (r, groupId) => gql(r, 'query($groupId: Int!) { distributionCycles(groupId: $groupId) { id groupId endDate } }', { groupId }),
    attendanceClassic: (r, catalogId, period) =>
      gql(
        r,
        `query($catalogId: Int!) { attendanceClassicContract(catalogId: $catalogId${period ? `, startDate: "${period.startDate}", endDate: "${period.endDate}"` : ''}) { catalog { id } subscriptions { id absentDistribIds } distributions { id } } }`,
        { catalogId },
      ),
    attendanceVariable: (r, catalogId, distributionId) =>
      gql(r, 'query($catalogId: Int!, $distributionId: Int!) { attendanceVariableContract(catalogId: $catalogId, distributionId: $distributionId) { catalog { id } distribution { id } subscriptions { id } } }', { catalogId, distributionId }),
    // the header part of attendanceSheetCsa.gql (front-core), for the classic and the variable contract
    attendanceSheetHeader: (r, catalogId, distributionId) => {
      const header = 'catalog { id name group { id name txtDistrib } user { id firstName lastName phone email } vendor { id name phone email } }';
      return distributionId == null
        ? gql(r, `query($catalogId: Int!) { sheet: attendanceClassicContract(catalogId: $catalogId) { ${header} } }`, { catalogId })
        : gql(r, `query($catalogId: Int!, $distributionId: Int!) { sheet: attendanceVariableContract(catalogId: $catalogId, distributionId: $distributionId) { ${header} distribution { multiDistrib { id volunteers { volunteerRole { id name catalogId } user { id firstName lastName } } } } } }`, { catalogId, distributionId });
    },
  },
  platform: {
    // controller/Main.hx doApi: a path the dispatcher cannot turn into a call (a non-numeric id) fails outside tink
    unexpectedFailure: async (request) => result(await request.get('/api/places/abc')),
  },
  places: {
    // controller/api/Places.hx (GET only)
    get: async (request, placeId) => result(await request.get(`/api/places/${placeId}`)),
    write: async (request, placeId) => result(await request.post(`/api/places/${placeId}`, { data: {} })),
    // camap-ts places.resolver.ts, group-previews.resolver.ts, reached through the hx origin
    byId: (r, id) => gql(r, 'query($id: Int!) { place(id: $id) { id name city zipCode address1 address2 country lat lng } }', { id }),
    onMap: (r, area) => {
      const a = area as Record<string, number>;
      const keys = Object.keys(a);
      const decl = keys.map((k) => `$${k}: Float`).join(', ');
      const use = keys.map((k) => `${k}: $${k}`).join(', ');
      return gql(r, `query${decl ? `(${decl})` : ''} { getGroupsOnMap${use ? `(${use})` : ''} { id name placeId place { id name lat lng } } }`, a);
    },
  },
  groups: {
    // camap-ts groups.resolver.ts, reached through the hx origin
    get: (r, groupId) =>
      gql(r, 'query($id: Int!) { group(id: $id) { id name flags hasMembership membershipFee currencyCode extUrl txtDistrib iban image } }', { id: groupId }),
    setImage: (r, p) =>
      gql(r, 'mutation($groupId: Int!, $base64: String!, $mimeType: String!, $fileName: String!, $maxWidth: Int!) { setGroupImage(groupId: $groupId, base64EncodedImage: $base64, mimeType: $mimeType, fileName: $fileName, maxWidth: $maxWidth) { id image } }', {
        groupId: p.groupId,
        mimeType: p.mimeType,
        fileName: p.fileName,
        maxWidth: p.maxWidth,
        // the resolver strips the "data:<mime>;base64," prefix by length
        base64: `data:${p.mimeType};base64,${p.base64}`,
      }),
    quit: (r, groupId) => gql(r, 'mutation($groupId: Int!) { quitGroup(groupId: $groupId) { userId groupId } }', { groupId }),
    quitByControlKey: (r, p) =>
      gql(r, 'mutation($groupId: Int!, $userId: Int!, $controlKey: String!) { quitGroupByControlKey(groupId: $groupId, userId: $userId, controlKey: $controlKey) { userId groupId } }', p),
  },
  members: {
    // camap-ts group-previews-members.resolver.ts, userGroups.resolver.ts, userLists.resolver.ts, reached through the hx origin
    preview: (r, groupId) => gql(r, 'query($id: Int!) { groupPreviewMembers(id: $id) { id name hasMembership membershipFee } }', { id: groupId }),
    lists: (r, groupId) => gql(r, 'query($groupId: Int!) { getUserLists(groupId: $groupId) { type count data } }', { groupId }),
    listsByCatalog: (r, groupId) => gql(r, 'query($groupId: Int!) { getContractsUserLists(groupId: $groupId) { type count data } }', { groupId }),
    listsByDistribution: (r, groupId) => gql(r, 'query($groupId: Int!) { getDistributionsUserLists(groupId: $groupId) { type count data } }', { groupId }),
    listUsers: (r, p) =>
      gql(r, 'query($listType: String!, $groupId: Int!, $data: String) { getUserListInGroupByListType(listType: $listType, groupId: $groupId, data: $data) { id firstName lastName email } }', { data: null, ...p }),
    get: (r, groupId, userId) =>
      gql(r, 'query($groupId: Int!, $userId: Int!) { userGroup(groupId: $groupId, userId: $userId) { groupId userId balance hasValidMembership } }', { groupId, userId }),
    remove: (r, groupId, userIds) =>
      gql(r, 'mutation($groupId: Int!, $userIds: [Int!]!) { removeUsersFromGroup(groupId: $groupId, userIds: $userIds) { success { groupId userId } errors { userId message } } }', { groupId, userIds }),
    importAndCreate: (r, p) =>
      gql(r, 'mutation($groupId: Int!, $withAccounts: [Int!]!, $withoutAccounts: [SendInvitesToNewMembersInput!]!) { importAndCreateMembers(groupId: $groupId, withAccounts: $withAccounts, withoutAccounts: $withoutAccounts) { withoutAccounts withAccounts } }', p),
    invite: (r, p) =>
      gql(r, 'mutation($groupId: Int!, $withAccounts: [Int!]!, $withoutAccounts: [SendInvitesToNewMembersInput!]!) { sendInvitesToNewMembers(groupId: $groupId, withAccounts: $withAccounts, withoutAccounts: $withoutAccounts) { withoutAccounts withAccounts } }', p),
  },
  waitingList: {
    // camap-ts waitingLists.resolver.ts, reached through the hx origin
    of: (r, groupId) => gql(r, 'query($groupId: Int!) { getWaitingListsOfGroup(groupId: $groupId) { amapId userId date message user { id firstName lastName } } }', { groupId }),
    approve: (r, groupId, userId) => gql(r, 'mutation($groupId: Int!, $userId: Int!) { approveRequest(groupId: $groupId, userId: $userId) { groupId userId } }', { groupId, userId }),
    refuse: (r, groupId, userId) => gql(r, 'mutation($groupId: Int!, $userId: Int!) { cancelRequest(groupId: $groupId, userId: $userId) { amapId userId } }', { groupId, userId }),
    moveBack: (r, groupId, userIds, message) =>
      gql(r, 'mutation($groupId: Int!, $userIds: [Int!]!, $message: String!) { moveBackToWaitingList(groupId: $groupId, userIds: $userIds, message: $message) { success { amapId userId message } errors { userId message } } }', { groupId, userIds, message }),
  },
  memberships: {
    // camap-ts memberships.resolver.ts, reached through the hx origin
    of: (r, groupId, userId, opts) =>
      gql(r, 'query($groupId: Int!, $userId: Int!, $ignore: Boolean!) { getUserMemberships(groupId: $groupId, userId: $userId, ignoreIfNotAllowed: $ignore) { id userId groupId year name amount date operationId distributionId } }', { groupId, userId, ignore: opts?.ignoreIfNotAllowed ?? false }),
    formData: (r, groupId, userId) =>
      gql(r, 'query($groupId: Int!, $userId: Int!) { getMembershipFormData(groupId: $groupId, userId: $userId) { membershipFee availableYears { id name } distributions { id groupId placeId distribStartDate } } }', { groupId, userId }),
    create: (r, userId, m) =>
      gql(r, 'mutation($input: CreateMembershipInput!) { createMembership(input: $input) { id userId groupId year amount date operationId distributionId } }', { input: { userId, ...m } }),
    createMany: (r, userIds, m) =>
      gql(r, 'mutation($input: CreateMembershipsInput!) { createMemberships(input: $input) { success { id userId groupId year amount date operationId distributionId } errors { userId message } } }', { input: { userIds, ...m } }),
    delete: (r, groupId, userId, year) =>
      gql(r, 'mutation($groupId: Int!, $userId: Int!, $year: Int!) { deleteMembership(groupId: $groupId, userId: $userId, year: $year) }', { groupId, userId, year }),
  },
  operations: {
    // camap-ts operation.resolver.ts, reached through the hx origin
    validate: (r, operationId, type) =>
      gql(r, 'mutation($id: Int!, $type: PaymentTypeId) { validateOperation(id: $id, type: $type) { id pending amount type data { ... on PaymentOperationTypeData { type } } } }', { id: operationId, type: type ?? null }),
    delete: (r, operationId) => gql(r, 'mutation($id: Int!) { deleteOperation(id: $id) }', { id: operationId }),
  },
  catalogStock: {
    // controller/api/Catalog.hx doStocksPerProductDistribution
    perProductDistribution: async (request, catalogId) => result(await request.get(`/api/catalog/stocksPerProductDistribution/${catalogId}`)),
  },
  subscription: {
    // controller/api/Subscription.hx doDefault(?sub)
    get: async (request, id) => result(await request.get(`/api/subscription/${id}`)),
    create: async (request, body) => result(await request.post('/api/subscription', { data: body })),
    updateOrders: async (request, id, distributions) =>
      result(await request.post(`/api/subscription/updateOrders/${id}`, { data: { distributions } })),
    updateDefaultOrder: async (request, id, defaultOrder) =>
      result(await request.post(`/api/subscription/updateDefaultOrder/${id}`, { data: defaultOrder })),
    checkDefaultOrder: async (request, catalogId, defaultOrder) =>
      result(await request.post(`/api/subscription/checkDefaultOrder/${catalogId}`, { data: defaultOrder })),
  },
  order: {
    // controller/api/Order.hx
    catalogs: async (request, multiDistribId, catalogType) =>
      result(await request.get(`/api/order/catalogs/${multiDistribId}${catalogType != null ? `?catalogType=${catalogType}` : ''}`)),
    get: async (request, userId, scope) => result(await request.get(`/api/order/get/${userId}${scopeQuery(scope)}`)),
    update: async (request, userId, scope, orders) =>
      result(await request.post(`/api/order/update/${userId}${scopeQuery(scope)}`, { data: { orders } })),
    updateQuantity: async (request, userId, scope, order) =>
      result(await request.post(`/api/order/updateOrderQuantity/${userId}${scopeQuery(scope)}`, { data: order })),
  },
  products: {
    // controller/api/Product.hx
    get: async (request, id) => result(await request.get(`/api/product/${id}`)),
    ofCatalog: async (request, catalogId) => result(await request.get(`/api/product/get?catalogId=${catalogId}`)),
    // camap-ts products.resolver.ts, reached through the hx origin
    vendorStockTracking: (r, vendorId) => gql(r, 'query($vendorId: Int!) { vendorProductsSample(vendorId: $vendorId) { id stockTracking } }', { vendorId }),
    vendorSample: (r, vendorId) => gql(r, 'query($vendorId: Int!) { vendorProductsSample(vendorId: $vendorId) { id name } }', { vendorId }),
    setImage: (r, p) =>
      gql(r, 'mutation($productId: Int!, $base64: String!, $mimeType: String!, $fileName: String!, $maxWidth: Int!) { setProductImage(productId: $productId, base64EncodedImage: $base64, mimeType: $mimeType, fileName: $fileName, maxWidth: $maxWidth) { id image } }', {
        productId: p.productId,
        mimeType: p.mimeType,
        fileName: p.fileName,
        maxWidth: p.maxWidth,
        // the resolver strips the "data:<mime>;base64," prefix by length
        base64: `data:${p.mimeType};base64,${p.base64}`,
      }),
  },
  catalog: {
    // controller/api/Catalog.hx doDefault
    get: async (request, catalogId) => result(await request.get(`/api/catalog/${catalogId}`)),
    // camap-ts catalogs.resolver.ts, reached through the hx origin
    activeInGroup: (r, groupId) => gql(r, 'query($groupId: Int!) { getActiveCatalogs(groupId: $groupId) { id name } }', { groupId }),
    managed: (r, catalogId) => gql(r, 'query($id: Int!) { catalog(id: $id) { id name groupId } }', { id: catalogId }),
    // the query of the batch ordering page (BatchOrder.module.tsx getCatalogSubscriptions)
    subscriptionsOf: (r, catalogId) =>
      gql(r, 'query($id: Int!) { catalog(id: $id) { id subscriptions { id startDate endDate user { id } } } }', { id: catalogId }),
    fieldsOfActive: (r, groupId) =>
      gql(r, 'query($groupId: Int!) { getActiveCatalogs(groupId: $groupId) { id subscriptionsCount subscriptions { id } products { id } } }', { groupId }),
    // controller/api/Catalog.hx doCatalogAbsences
    absences: async (request, catalogId) => result<CatalogAbsences>(await request.get(`/api/catalog/catalogAbsences/${catalogId}`)),
    subscriptionAbsences: {
      // controller/api/Catalog.hx doSubscriptionAbsences(sub)
      get: async (request: APIRequestContext, subscriptionId: number) =>
        result<SubscriptionAbsences>(await request.get(`/api/catalog/subscriptionAbsences/${subscriptionId}`)),
      // POST payload is raw JSON {"absentDistribIds":[...]}
      post: async (request: APIRequestContext, subscriptionId: number, body) =>
        result<SubscriptionAbsences>(
          await request.post(`/api/catalog/subscriptionAbsences/${subscriptionId}`, { data: body }),
        ),
    },
  },
};

const day = (d: string) => d;

/** Follow the first redirect and read the messages hx shows once (flash). */
function alertsFromHtml(html: string): Flash[] {
  return [...html.matchAll(/class="alert\s+alert-(success|danger|error|warning)[^"]*"[^>]*>([\s\S]*?)<\/div>/g)].map((m) => ({
    kind: m[1] === 'success' ? ('ok' as const) : ('error' as const),
    text: m[2].replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim(),
  }));
}

async function alertsOf(request: APIRequestContext, location: string | null): Promise<Flash[]> {
  if (!location) return [];
  const html = await (await request.get(location, { maxRedirects: 0 })).text();
  return [...html.matchAll(/class="alert\s+alert-(success|danger|error|warning)[^"]*"[^>]*>([\s\S]*?)<\/div>/g)].map((m) => ({
    kind: m[1] === 'success' ? ('ok' as const) : ('error' as const),
    text: m[2].replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim(),
  }));
}

async function flashOf(request: APIRequestContext, location: string | null): Promise<ActionResult['flash']> {
  return (await alertsOf(request, location))[0] ?? null;
}

async function action(request: APIRequestContext, res: APIResponse): Promise<ActionResult> {
  const location = res.headers()['location'] ?? null;
  const body = await res.text();
  const alerts = await alertsOf(request, location);
  return { status: res.status(), location, body, flash: alerts[0] ?? null, alerts };
}

/**
 * A refusal redirects to "/", which itself redirects (/home, /user/choose): the message is shown on the last page.
 * Follow the chain (a few hops) until a page shows alerts; `location` stays the first redirect.
 */
async function followAlerts(request: APIRequestContext, res: ActionResult): Promise<ActionResult> {
  if (res.alerts?.length || !res.location) return res;
  let next: string | null = res.location;
  for (let i = 0; i < 4 && next; i++) {
    const r: APIResponse = await request.get(next, { maxRedirects: 0 });
    const alerts = alertsFromHtml(await r.text());
    if (alerts.length) return { ...res, flash: alerts[0], alerts };
    next = r.headers()['location'] ?? null;
  }
  return res;
}

/** A CSRF token as hx prints it: a hidden `token` input, or a `?token=` in a link. */
async function tokenFrom(request: APIRequestContext, url: string): Promise<string> {
  const html = await (await request.get(url, { maxRedirects: 0 })).text();
  const m = /name="token" value="([0-9a-f]+)"/.exec(html) ?? /[?&]token=([0-9a-f]+)/.exec(html);
  if (!m) throw new Error(`no token on ${url}`);
  return m[1];
}

function subscriptionFields(f: SubscriptionForm): Record<string, string> {
  const out: Record<string, string> = { _startDate: day(f.startDate), _endDate: day(f.endDate), submit: 'OK' };
  if (f.userId != null) out.user = String(f.userId);
  for (const [pid, q] of Object.entries(f.quantities ?? {})) out[`quantity${pid}`] = String(q);
  for (const [pid, u] of Object.entries(f.user2 ?? {})) out[`user2${pid}`] = String(u);
  for (const [pid, inv] of Object.entries(f.invert ?? {})) if (inv) out[`invert${pid}`] = 'true';
  (f.absences ?? []).forEach((id, i) => (out[`absence${i + 1}`] = String(id)));
  return out;
}

/** A sugoi form: GET the page for its token, POST fields prefixed with the form name. */
async function sugoiForm(request: APIRequestContext, url: string, formNameOrAuto: string | null, fields: Record<string, string>): Promise<ActionResult> {
  const html = await (await request.get(url, { maxRedirects: 0 })).text();
  // spod forms (CamapForm.fromSpod) carry a generated name: read it from the hidden marker
  const formName = formNameOrAuto ?? /name="(\w+)_formSubmitted"/.exec(html)?.[1] ?? '';
  const token = new RegExp(`value="([0-9a-f]+)"\\s+name="${formName}_token"`).exec(html)?.[1];
  const form: Record<string, string> = { [`${formName}_formSubmitted`]: 'true', [`${formName}_submit`]: 'OK' };
  for (const [k, v] of Object.entries(fields)) form[`${formName}_${k}`] = v;
  if (token) form[`${formName}_token`] = token;
  return action(request, await request.post(url, { form, maxRedirects: 0 }));
}

function paymentFields(f: PaymentForm): Record<string, string> {
  const out: Record<string, string> = { name: f.name ?? 'Paiement', amount: String(f.amount), date: f.date ?? '', Mtype: f.type ?? 'check' };
  if (f.relatedOperationId != null) out.unpaid = String(f.relatedOperationId);
  return out;
}


// ---- generic sugoi form reading (spod forms carry a generated name prefix) ----

const decodeEntities = (v: string) => v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function attrsOf(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w-]+)(?:=("[^"]*"|'[^']*'|[^\s>/]+))?/g)) out[m[1]] = m[2] == null ? '' : decodeEntities(m[2].replace(/^["']|["']$/g, ''));
  return out;
}

type FormState = {
  prefix: string;
  /** Posted value of every field, name without the prefix (`flags[]` keeps its brackets). */
  values: Record<string, string | string[]>;
  required: Set<string>;
  options: Record<string, string[]>;
  /** Checkbox values on offer, per field. */
  offered: Record<string, string[]>;
};

function readForm(html: string): FormState {
  const prefix = /name="(\w+)_formSubmitted"/.exec(html)?.[1] ?? '';
  const p = `${prefix}_`;
  const values: FormState['values'] = {};
  const options: FormState['options'] = {};
  const offered: FormState['offered'] = {};
  const required = new Set<string>();
  const key = (n: string) => n.slice(p.length);
  for (const m of html.matchAll(/<input\b[^>]*>/g)) {
    const a = attrsOf(m[0]);
    if (!a.name?.startsWith(p) || a.type === 'submit') continue;
    const k = key(a.name);
    if (a.type === 'checkbox' || a.type === 'radio') {
      if (k.endsWith('[]')) {
        (offered[k] ??= []).push(a.value);
        const cur = (values[k] ??= []) as string[];
        if ('checked' in a) cur.push(a.value);
      } else values[k] = 'checked' in a ? (a.value || 'true') : (values[k] ?? '');
    } else values[k] = a.value ?? '';
  }
  for (const m of html.matchAll(/<select\b[^>]*>([\s\S]*?)<\/select>/g)) {
    const name = attrsOf(m[0].slice(0, m[0].indexOf('>') + 1)).name;
    if (!name?.startsWith(p)) continue;
    const opts = [...m[1].matchAll(/<option\b([^>]*)>/g)].map((o) => attrsOf(o[1]));
    options[key(name)] = opts.map((o) => o.value);
    values[key(name)] = (opts.find((o) => 'selected' in o) ?? opts[0])?.value ?? '';
  }
  for (const m of html.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/g)) {
    const a = attrsOf(m[1]);
    if (a.name?.startsWith(p)) values[key(a.name)] = decodeEntities(m[2]);
  }
  // CamapDatePicker widgets are not inputs: the initial value is in the init script
  for (const m of html.matchAll(/name:\s*"(\w+)",\s*type:\s*"\w+",\s*value:\s*"([^"]*)"/g)) if (m[1].startsWith(p)) values[key(m[1])] = m[2];
  for (const m of html.matchAll(/<label for="(\w+)" class="[^"]*formRequired/g)) required.add(key(m[1]));
  return { prefix, values, required, options, offered };
}

/** GET a form, then POST what it pre-fills with `overrides` on top (null drops a field). */
async function fillAndPost(
  request: APIRequestContext,
  url: string,
  overrides: Record<string, string | string[] | null>,
  extra: Record<string, string> = {},
): Promise<ActionResult> {
  const state = readForm(await (await request.get(url, { maxRedirects: 0 })).text());
  const values = { ...state.values };
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null) delete values[k];
    else values[k] = v;
  }
  const body = new URLSearchParams();
  body.set(`${state.prefix}_submit`, 'OK');
  for (const [k, v] of Object.entries(values)) for (const x of Array.isArray(v) ? v : [v]) body.append(`${state.prefix}_${k}`, x);
  for (const [k, v] of Object.entries(extra)) body.set(k, v);
  return action(request, await request.post(url, { data: body.toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' }, maxRedirects: 0 }));
}

// camap-hx/src/db/Catalog.hx CatalogFlags, by ordinal
const CATALOG_FLAG_NAMES: CatalogFlagName[] = ['usersCanOrder', 'stockManagement', 'percentage', 'displayPrices', 'notifyVendor', 'notifyContact'];
const flagNames = (ordinals: string[] = []): CatalogFlagName[] => ordinals.map((o) => CATALOG_FLAG_NAMES[Number(o)]);
const datePicker = (v: string) => (v.length === 10 ? `${v} 00:00:00` : v.length === 16 ? `${v}:00` : v);

async function catalogFormView(res: APIResponse): Promise<CatalogFormView> {
  const html = await res.text();
  const f = readForm(html);
  const str = (k: string) => (typeof f.values[k] === 'string' ? (f.values[k] as string) : '');
  return {
    status: res.status(),
    location: res.headers()['location'] ?? null,
    title: textOf(/<h3>([\s\S]*?)<\/h3>/.exec(html)?.[1] ?? ''),
    name: str('name'),
    startDate: str('startDate').slice(0, 10),
    endDate: str('endDate').slice(0, 10),
    contactRequired: f.required.has('userId'),
    contactChoices: (f.options.userId ?? []).filter((v) => v !== '').map(Number),
    volunteers: str('distributorNum') === '' ? null : Number(str('distributorNum')),
    flags: { offered: flagNames(f.offered['flags[]']), checked: flagNames(f.values['flags[]'] as string[] | undefined) },
    offersPercentageFee: 'percentageValue' in f.values || (f.offered['flags[]'] ?? []).includes('2'),
    offers: {
      openingDelay: 'orderStartDaysBeforeDistrib' in f.values,
      closingDelay: 'orderEndHoursBeforeDistrib' in f.values,
      distribMinimum: 'distribMinOrdersTotal' in f.values,
      catalogMinimum: 'catalogMinOrdersTotal' in f.values,
    },
    openingDelayDays: str('orderStartDaysBeforeDistrib') === '' ? null : Number(str('orderStartDaysBeforeDistrib')),
    closingDelayHours: str('orderEndHoursBeforeDistrib') === '' ? null : Number(str('orderEndHoursBeforeDistrib')),
  };
}

function catalogOverrides(f: CatalogFormInput): Record<string, string | string[] | null> {
  const o: Record<string, string | string[] | null> = {};
  if (f.name != null) o.name = f.name;
  if (f.startDate != null) o.startDate = datePicker(f.startDate);
  if (f.endDate != null) o.endDate = datePicker(f.endDate);
  if (f.contactId !== undefined) o.userId = f.contactId == null ? '' : String(f.contactId);
  if (f.volunteers != null) o.distributorNum = String(f.volunteers);
  if (f.flags != null) o['flags[]'] = f.flags.map((n) => String(CATALOG_FLAG_NAMES.indexOf(n)));
  if (f.description != null) o.description = f.description;
  if (f.openingDelayDays !== undefined) o.orderStartDaysBeforeDistrib = f.openingDelayDays == null ? '' : String(f.openingDelayDays);
  if (f.closingDelayHours !== undefined) o.orderEndHoursBeforeDistrib = f.closingDelayHours == null ? '' : String(f.closingDelayHours);
  if (f.distribMinimum != null) o.distribMinOrdersTotal = String(f.distribMinimum);
  if (f.catalogMinimum != null) o.catalogMinOrdersTotal = String(f.catalogMinimum);
  return o;
}

/** Variable catalogs make the two minimums compulsory: a blank form gets 0 so a test can ignore them. */
async function postCatalog(request: APIRequestContext, url: string, f: CatalogFormInput): Promise<ActionResult> {
  const state = readForm(await (await request.get(url, { maxRedirects: 0 })).text());
  const o = catalogOverrides(f);
  for (const k of ['distribMinOrdersTotal', 'catalogMinOrdersTotal']) if (state.values[k] === '' && o[k] === undefined) o[k] = '0';
  return fillAndPost(request, url, o);
}

/** Optional vendor fields; `null` posts the field empty. Name of the form fields = column names. */
function vendorFieldOverrides(f: VendorForm): Record<string, string> {
  const o: Record<string, string> = {};
  for (const k of ['address1', 'desc', 'linkUrl', 'linkText', 'phone', 'peopleName'] as const) if (f[k] !== undefined) o[k] = f[k]!;
  return o;
}

function placeOverrides(f: PlaceForm): Record<string, string | null> {
  const o: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(f)) o[k] = v == null ? '' : String(v);
  return o;
}

const kindPath = (type?: CatalogKind) => (type == null ? '' : `/${type === 'constant' ? 0 : 1}`);

const optionValues = (html: string, selectName: string): string[] => {
  const m = new RegExp(`<select[^>]*name="${selectName}"[\\s\\S]*?</select>`).exec(html);
  return [...(m?.[0] ?? '').matchAll(/<option value="([^"]+)"/g)].map((x) => x[1]);
};

/** hx date pickers post "YYYY-MM-DD HH:MM:SS" for every type, time-only ones included (HaxeDatePicker.tsx). */
const stamp = (date: string, hhmm: string) => `${date} ${hhmm.length === 5 ? `${hhmm}:00` : hhmm}`;

/** The timeframe the hx distribution pages keep in the URL (Neko dates overflow past 2038, so stay close to now). */
const timeframe = (): string => {
  const d = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
  return `_from=${d(-30)}&_to=${d(300)}`;
};

const CYCLE_TYPES = { Weekly: 0, Monthly: 1, BiWeekly: 2, TriWeekly: 3 } as const;

/** The values the hx rights editor posts for what a group admin ticked. */
const rightsValues = (r: RightsChoice): string[] => [
  ...(r.groupAdmin ? ['GroupAdmin'] : []),
  ...(r.membership ? ['Membership'] : []),
  ...(r.messages ? ['Messages'] : []),
  ...(r.allCatalogs ? ['contractAll'] : []),
  ...(r.catalogs ?? []).map((id) => `contract${id}`),
];

const urlForm = async (request: APIRequestContext, url: string, formName: string, fields: Record<string, string | string[] | boolean>): Promise<ActionResult> => {
  const html = await (await request.get(url, { maxRedirects: 0 })).text();
  const body = new URLSearchParams();
  body.set(`${formName}_formSubmitted`, 'true');
  body.set(`${formName}_submit`, 'OK');
  const token = new RegExp(`value="([0-9a-f]+)"\\s+name="${formName}_token"`).exec(html)?.[1];
  if (token) body.set(`${formName}_token`, token);
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) v.forEach((x) => body.append(`${formName}_${k}[]`, x));
    else if (typeof v === 'boolean') v && body.set(`${formName}_${k}`, 'true');
    else body.set(`${formName}_${k}`, v);
  }
  return action(request, await request.post(url, { data: body.toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' }, maxRedirects: 0 }));
};

// camap-hx/common/Common.hx Unit, by ordinal
const PRODUCT_UNITS: ProductUnit[] = ['piece', 'kilogram', 'gram', 'litre', 'centilitre', 'millilitre'];
const PRODUCT_CHECKBOXES = ['organic', 'variablePrice', 'multiWeight', 'bulk', 'active'] as const;

async function productFormView(res: APIResponse): Promise<ProductFormView> {
  const html = await res.text();
  const f = readForm(html);
  const str = (k: string) => (typeof f.values[k] === 'string' ? (f.values[k] as string) : '');
  const unit = str('unitType');
  const vat = str('vat');
  return {
    status: res.status(),
    location: res.headers()['location'] ?? null,
    offers: {
      price: 'price' in f.values,
      quantity: 'qt' in f.values,
      unit: 'unitType' in f.values,
      organic: 'organic' in f.values,
      variablePrice: 'variablePrice' in f.values,
      multiWeight: 'multiWeight' in f.values,
      bulk: 'bulk' in f.values,
      stock: 'stockTracking' in f.values,
    },
    values: {
      name: str('name'),
      price: str('price'),
      quantity: str('qt'),
      unit: unit === '' ? null : PRODUCT_UNITS[Number(unit)],
      vat: vat === '' ? null : Number(vat),
      active: str('active') !== '',
      organic: str('organic') !== '',
    },
    vatChoices: (f.options.vat ?? []).filter((v) => v !== '').map(Number),
    vatRates: [...(/<select\b[^>]*name="\w+_vat"[^>]*>([\s\S]*?)<\/select>/.exec(html)?.[1] ?? '').matchAll(/<option\b[^>]*value="([^"]*)"[^>]*>([^<]*)<\/option>/g)]
      .filter((m) => m[1] !== '')
      .map((m) => ({ label: decodeEntities(m[2]).trim(), value: Number(m[1]) })),
    unitChoices: [...html.matchAll(/<input type="radio"[^>]*name="\w+_unitType"[^>]*value="(\d+)"/g)].map((m) => PRODUCT_UNITS[Number(m[1])]),
    offersCopy: /\/product\/copyAndDiscard\//.test(html),
  };
}

/** Stock modes as the product form posts them (StockTrackingPerDistribForm): radios by ordinal, one stock input per rule. A null choice is not posted. */
const num = (v: number | string | null) => (v == null ? '' : String(v));
function stockFields(st: ProductStockInput): Record<string, string | string[] | null> {
  if (st.mode === 'none') return { stockTracking: '0' };
  if (st.mode === 'global') return { stockTracking: '1', stock: num(st.stock) };
  const base = { stockTracking: '2' };
  if (st.rule === 'always') return { ...base, stockTrackingPerDistrib: '0', stock_AlwaysTheSame: num(st.stock) };
  if (st.rule === 'every')
    return {
      ...base,
      stockTrackingPerDistrib: '1',
      stock_FrequencyBased: num(st.stock),
      firstDistrib: st.startDistributionId == null ? null : String(st.startDistributionId),
      frequencyRatio: st.every == null ? null : String(st.every),
    };
  return {
    ...base,
    stockTrackingPerDistrib: '2',
    'startDistributionId[]': st.periods.map((p) => String(p.fromDistributionId)),
    'endDistributionId[]': st.periods.map((p) => String(p.toDistributionId)),
    'stockPerDistribution[]': st.periods.map((p) => String(p.stock)),
  };
}

/** What a browser posts: unticked boxes and an unchosen unit are absent, not empty. */
async function postProduct(request: APIRequestContext, url: string, f: ProductFormInput): Promise<ActionResult> {
  const state = readForm(await (await request.get(url, { maxRedirects: 0 })).text());
  const o: Record<string, string | string[] | null> = {};
  for (const k of [...PRODUCT_CHECKBOXES, 'unitType']) if (state.values[k] === '') o[k] = null;
  const set = (k: string, v: string | null | undefined) => v !== undefined && (o[k] = v);
  set('name', f.name);
  set('ref', f.reference);
  set('price', f.price == null ? undefined : String(f.price));
  set('desc', f.description);
  set('qt', f.quantity === undefined ? undefined : f.quantity == null ? '' : String(f.quantity));
  if (f.unit !== undefined) o.unitType = f.unit == null ? null : String(PRODUCT_UNITS.indexOf(f.unit));
  if (f.vat !== undefined) o.vat = f.vat == null ? '' : String(f.vat);
  for (const k of PRODUCT_CHECKBOXES) if (f[k] !== undefined) o[k] = f[k] ? 'true' : null;
  if (f.stock) Object.assign(o, stockFields(f.stock));
  return fillAndPost(request, url, o);
}

/** The delete and copy links, with their token, are on the catalog's products page. */
async function productsPageToken(request: APIRequestContext, productId: number): Promise<string> {
  const row = await queryOne<{ catalogId: number }>('SELECT catalogId FROM Product WHERE id = ?', [productId]);
  return tokenFrom(request, `/contractAdmin/products/${row!.catalogId}`);
}


// ---- documents (controller/Documents.hx) and group images (controller/Media.hx) ----

const VISIBILITY_LABELS: [string, string][] = [['Souscripteurs du contrat', 'subscribers'], ['Membres du groupe', 'members'], ['Public', 'public']];

/** Admin page of documents/images: one `<tr>` per file, edit/delete links carry the EntityFile id. */
async function fileListing(request: APIRequestContext, url: string, kind: 'documents' | 'media'): Promise<FileListing> {
  const res = await request.get(url, { maxRedirects: 0 });
  const html = await res.text();
  const location = res.headers()['location'] ?? null;
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((m) => m[1]).filter((r) => /\/delete\/\d+/.test(r));
  const label = (r: string) => {
    const text = textOf(r);
    return VISIBILITY_LABELS.find(([l]) => text.includes(l))?.[1] ?? null;
  };
  return {
    status: res.status(),
    location,
    body: html,
    flash: await flashOf(request, location),
    ids: rows.map((r) => Number(/\/delete\/(\d+)/.exec(r)![1])),
    names: rows.map((r) => (kind === 'documents' ? textOf(/<a href="\/file\/[^"]*"[^>]*>([\s\S]*?)<\/a>/.exec(r)?.[1] ?? '') : decodeEntities(/<img[^>]*alt="([^"]*)"/.exec(r)?.[1] ?? ''))),
    visibilities: rows.map(label),
    offersAdd: new RegExp(`/${kind === 'documents' ? 'documents' : 'media'}/insert`).test(html),
  };
}

const documentsUrl = (scope: FileScope, verb: string, id?: number): string =>
  scope.catalogId == null
    ? `/amapadmin/documents${verb ? `/${verb}` : ''}${id != null ? `/${id}` : ''}`
    : `/contractAdmin/documents${verb ? `/${verb}` : ''}${id != null ? `/${id}` : ''}/${scope.catalogId}`.replace(/\/\/+/g, '/');

/** The delete links carry a token that is printed on the listing page. */
async function listingToken(request: APIRequestContext, url: string): Promise<string> {
  return tokenFrom(request, url).catch(() => '');
}

/**
 * A multipart body built by hand: Neko's multipart parser (Web.parseMultipart) does not read the
 * bodies Playwright's `multipart` option writes, but reads this browser-like one.
 */
function multipartBody(fields: Record<string, string>, file?: { field: string; file: UploadFile }): { data: Buffer; contentType: string } {
  const boundary = '----WebKitFormBoundaryCamapTests7MA4YWxk';
  const chunks: Buffer[] = [];
  if (file) {
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.file.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`));
    chunks.push(file.file.content, Buffer.from('\r\n'));
  }
  for (const [k, v] of Object.entries(fields)) chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { data: Buffer.concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

async function uploadForm(request: APIRequestContext, url: string, fileField: 'document' | 'media', f: { file: UploadFile | null; name?: string; visibility?: string | null }): Promise<ActionResult> {
  const fields: Record<string, string> = { name: f.name ?? '' };
  if (f.visibility !== null) fields.visibility = f.visibility ?? (fileField === 'media' ? 'public' : 'members');
  const { data, contentType } = multipartBody(fields, f.file ? { field: fileField, file: f.file } : undefined);
  return action(request, await request.post(url, { data, headers: { 'content-type': contentType }, maxRedirects: 0, timeout: 120_000 }));
}

/** controller/Product.hx doImport, template product/import.mtt */
async function importPage(request: APIRequestContext, res: APIResponse): Promise<ProductImportPage> {
  const a = await action(request, res);
  const html = a.body;
  const step = /type="file"/.test(html) ? 1 : /Produits à importer/.test(html) ? 2 : /Revenir à la gestion des produits/.test(html) ? 3 : null;
  const cells = (row: string, tag: string) => [...row.matchAll(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'g'))].map((c) => decodeEntities(c[1].replace(/<[^>]*>/g, '')).trim());
  const table = /<table[\s\S]*?<\/table>/.exec(html)?.[0] ?? '';
  const rows = [...table.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((r) => r[1]);
  const count = /Vous avez importé (\d+) produits/.exec(html)?.[1];
  return {
    ...a,
    step,
    previewHeader: rows[0] ? cells(rows[0], 'th') : [],
    previewRows: rows.slice(1).map((r) => cells(r, 'td')),
    offersConfirm: /import\/\d+\?confirm=1/.test(html),
    importedCount: count == null ? null : Number(count),
  };
}

const mediaUrl = (verb: string, id?: number) => `/amapadmin/media${verb ? `/${verb}` : ''}${id != null ? `/${id}` : ''}`;

export const hxActions: CamapApp['actions'] = {
  members: {
    // controller/Member.hx doMovetowl: no token
    moveToWaitingList: async (request, memberId) => action(request, await request.get(`/member/movetowl/${memberId}`, { maxRedirects: 0 })),
    loginAs: async (request, memberId) => {
      const res = await action(request, await request.get(`/member/loginas/${memberId}`, { maxRedirects: 0 }));
      const sid = (await request.storageState()).cookies.find((c) => c.name === 'sid')?.value;
      const row = sid ? await queryOne<{ uid: number | null }>('SELECT uid FROM Session WHERE sid = ?', [sid]) : undefined;
      return { ...res, sessionUserId: row?.uid ?? null };
    },
    // controller/Member.hx doDelete: GET /member/delete/:id?token=..[&confirm=1]; the token is printed on the member sheet
    remove: async (request, memberId, opts) => {
      const token = opts?.token === false ? '' : typeof opts?.token === 'string' ? opts.token : await tokenFrom(request, `/member/view/${memberId}`).catch(async () => {
            // no sheet for someone outside the group: the members page prints the same session token
            const html = await (await request.get('/member', { maxRedirects: 0 })).text();
            return /token: "([0-9a-f]+)"/.exec(html)?.[1] ?? '';
          });
      return action(request, await request.get(`/member/delete/${memberId}?token=${token}${opts?.confirm ? '&confirm=1' : ''}`, { maxRedirects: 0 }));
    },
  },
  invitations: {
    // controller/Main.hx doInvite: hash = sha1(KEY + email)
    open: async (request, p) => action(request, await request.get(`/invite/${p.hash}/${encodeURIComponent(p.email)}/${p.groupId}${p.userId ? `/${p.userId}` : ''}`, { maxRedirects: 0 })),
    hashFor: (email) => sha1(email),
  },
  account: {
    // controller/User.hx doLogout: one redirect per cookie to clear (Refresh, Authentication, Auth_sid), then the login page
    logout: async (request) => {
      const setCookies: string[] = [];
      let next: string | null = '/user/logout';
      let hops = 0;
      let finalLocation: string | null = null;
      while (next && hops < 8) {
        const res: APIResponse = await request.get(next, { maxRedirects: 0 });
        setCookies.push(...res.headersArray().filter((h) => h.name.toLowerCase() === 'set-cookie').map((h) => h.value));
        hops++;
        finalLocation = res.headers()['location'] ?? null;
        next = finalLocation;
        if (next && /\/user\/login/.test(next)) break;
      }
      return { hops, setCookies, finalLocation };
    },
    // controller/User.hx doForgottenPassword (sugoi forms "askemail" and "chpass")
    forgotPassword: (request, email) => sugoiForm(request, '/user/forgottenPassword', 'askemail', { email }),
    openResetLink: (request, link) => view(request, link),
    setNewPassword: async (request, link, p) => {
      const html = await (await request.get(link, { maxRedirects: 0 })).text();
      const token = /value="([0-9a-f]+)"\s+name="chpass_token"/.exec(html)?.[1];
      const uid = p.userId ?? Number(/name="chpass_uid"[^>]*value="(\d*)"/.exec(html)?.[1] ?? '');
      const form: Record<string, string> = { chpass_formSubmitted: 'true', chpass_submit: 'OK', chpass_pass1: p.pass1, chpass_pass2: p.pass2, chpass_uid: String(uid) };
      if (token) form.chpass_token = token;
      return action(request, await request.post(link, { form, maxRedirects: 0 }));
    },
  },
  volunteers: {
    register: async (request, sessionId, roleId) => action(request, await request.get(`/distribution/volunteersCalendar?distrib=${sessionId}&role=${roleId}`, { maxRedirects: 0 })),
    assign: (request, sessionId, assignments) =>
      urlForm(request, `/distribution/volunteers/${sessionId}`, 'volunteers', Object.fromEntries(Object.entries(assignments).map(([r, u]) => [r, u == null ? '' : String(u)]))),
    setSessionRoles: (request, sessionId, roleIds) => urlForm(request, `/distribution/volunteerRoles/${sessionId}`, 'volunteerroles', { roles: roleIds.map(String) }),
    settings: async (request) => {
      const res = await request.get('/amapadmin/volunteers', { maxRedirects: 0 });
      const html = await res.text();
      const values: Record<string, string> = {};
      for (const m of html.matchAll(/<input[^>]*name="msg_(\w+)"[^>]*value="([^"]*)"/g)) values[m[1]] = m[2];
      for (const m of html.matchAll(/<textarea[^>]*name="msg_(\w+)"[^>]*>([\s\S]*?)<\/textarea>/g)) values[m[1]] = m[2];
      for (const m of html.matchAll(/<input type="checkbox"[^>]*name="msg_(\w+)"([^>]*)>/g)) values[m[1]] = /\bchecked\b/.test(m[2]) ? 'true' : 'false';
      return { status: res.status(), values };
    },
    saveSettings: async (request, s) => {
      const current = await hxActions.volunteers.settings(request);
      const v = { ...current.values } as Record<string, string | boolean>;
      for (const k of ['allowInformationNotifs', 'allowAlertNotifs']) v[k] = v[k] === 'true';
      Object.assign(v, Object.fromEntries(Object.entries(s).map(([k, x]) => [k, typeof x === 'number' ? String(x) : x])));
      delete (v as any).token;
      return urlForm(request, '/amapadmin/volunteers', 'msg', v as Record<string, string | boolean>);
    },
    createRole: (request, role) => urlForm(request, '/amapadmin/volunteers/insertRole', 'volunteerrole', { name: role.name, enabledByDefault: role.enabledByDefault ?? false }),
    editRole: (request, id, role) => urlForm(request, `/amapadmin/volunteers/editRole/${id}`, 'volunteerrole', { name: role.name, enabledByDefault: role.enabledByDefault }),
    deleteRole: async (request, id, opts) => {
      const token = opts?.token === false ? '' : await tokenFrom(request, '/amapadmin/volunteers');
      return action(request, await request.get(`/amapadmin/volunteers/deleteRole/${id}?token=${token}${opts?.force ? '&force=1' : ''}`, { maxRedirects: 0 }));
    },
    createCatalogRole: (request, catalogId, name) => urlForm(request, `/contractAdmin/insertRole/${catalogId}`, 'volunteerrole', { name }),
    deleteCatalogRole: async (request, roleId, catalogId, opts) => {
      const token = await tokenFrom(request, `/contractAdmin/roles/${catalogId}`).catch(() => '');
      return action(request, await request.get(`/contractAdmin/deleteRole/${roleId}?token=${token}&catalogId=${catalogId}${opts?.force ? '&force=1' : ''}`, { maxRedirects: 0 }));
    },
    participation: (request) => view(request, '/distribution/volunteersParticipation'),
  },
  sessions: {
    // controller/Distribution.hx (spod forms with a generated name)
    list: async (request) => view(request, '/distribution'),
    create: (request, f) =>
      sugoiForm(request, '/distribution/insertMd', null, {
        placeId: String(f.placeId ?? ''),
        date: stamp(f.date, '00:00'),
        startHour: stamp(f.date, f.start),
        endHour: stamp(f.date, f.end),
        orderStartDate: f.orderStart.length === 16 ? `${f.orderStart}:00` : f.orderStart,
        orderEndDate: f.orderEnd.length === 16 ? `${f.orderEnd}:00` : f.orderEnd,
        id: '',
      }),
    edit: (request, id, f) =>
      sugoiForm(request, `/distribution/editMd/${id}`, null, {
        placeId: String(f.placeId ?? ''),
        date: stamp(f.date, '00:00'),
        startHour: stamp(f.date, f.start),
        endHour: stamp(f.date, f.end),
        orderStartDate: f.orderStart.length === 16 ? `${f.orderStart}:00` : f.orderStart,
        orderEndDate: f.orderEnd.length === 16 ? `${f.orderEnd}:00` : f.orderEnd,
        id: String(id),
        ...(f.override ? { override: 'true' } : {}),
      }),
    delete: async (request, id, opts) => {
      const token = opts?.token === false ? '' : await tokenFrom(request, '/distribution').catch(() => '');
      return action(request, await request.get(`/distribution/deleteMd/${id}?token=${token}`, { maxRedirects: 0 }));
    },
    createCycle: (request, f) =>
      sugoiForm(request, '/distribution/insertMdCycle', null, {
        id: '',
        cycleType: String(CYCLE_TYPES[f.type]),
        startDate: stamp(f.startDate, '00:00'),
        endDate: stamp(f.endDate, '23:59'),
        startHour: stamp(f.startDate, f.start),
        endHour: stamp(f.startDate, f.end),
        daysBeforeOrderStart: String(f.daysBeforeOrderStart),
        daysBeforeOrderEnd: String(f.daysBeforeOrderEnd),
        openingHour: stamp(f.startDate, f.opening),
        closingHour: stamp(f.startDate, f.closing),
        placeId: String(f.placeId ?? ''),
      }),
    deleteCycle: async (request, id) => action(request, await request.get(`/distribution/deleteCycle/${id}`, { maxRedirects: 0 })),
    participate: async (request, sessionId, catalogId) =>
      action(request, await request.get(`/contractAdmin/participate/${sessionId}/${catalogId}?${timeframe()}`, { maxRedirects: 0 })),
    participateAll: async (request, catalogId) =>
      action(request, await request.get(`/contractAdmin/distributions/${catalogId}?participateToAllDistributions=1`, { maxRedirects: 0 })),
    cancelParticipation: async (request, distributionId) => action(request, await request.get(`/distribution/delete/${distributionId}?${timeframe()}`, { maxRedirects: 0 })),
    // controller/Distribution.hx doInviteFarmers (sugoi form "invite", a checkbox group of catalog ids)
    setCatalogs: (request, sessionId, catalogIds) => urlForm(request, `/distribution/inviteFarmers/${sessionId}`, 'invite', { invitedVendors: catalogIds.map(String) }),
    // controller/Distribution.hx doShift (sugoi form "distribShifting", the target session is `md`)
    shift: (request, distributionId, targetSessionId) => urlForm(request, `/distribution/shift/${distributionId}`, 'distribShifting', { md: String(targetSessionId) }),
    // controller/Distribution.hx doEdit (spod form with a generated name; the two order dates are date-time pickers)
    setOrderDates: (request, distributionId, d) =>
      sugoiForm(request, `/distribution/edit/${distributionId}`, null, {
        orderStartDate: d.orderStart.length === 16 ? `${d.orderStart}:00` : d.orderStart,
        orderEndDate: d.orderEnd.length === 16 ? `${d.orderEnd}:00` : d.orderEnd,
      }),
    // controller/Distribution.hx doChangePrice, doMissingProduct (sugoi forms "changePrice" and "missingProduct")
    changePrice: (request, sessionId, productId, price) => urlForm(request, `/distribution/changePrice/${sessionId}`, 'changePrice', { product: String(productId), price: String(price) }),
    removeProduct: (request, sessionId, productId) => urlForm(request, `/distribution/missingProduct/${sessionId}`, 'missingProduct', { product: String(productId) }),
  },
  orders: {
    // controller/Contract.hx doEditVarOrders: GET with the security token and one `product<id>` parameter per line
    editVarOrders: async (request, sessionId, quantities) => {
      const url = `/contract/editVarOrders/${sessionId}`;
      const token = await tokenFrom(request, url);
      const q = new URLSearchParams({ token });
      for (const [pid, qty] of Object.entries(quantities)) q.set(`product${pid}`, String(qty));
      return action(request, await request.get(`${url}?${q}`, { maxRedirects: 0 }));
    },
    // controller/ContractAdmin.hx doOrders (?delete=<orderId>&token=...): the token is printed on the orders page
    deleteLine: async (request, catalogId, distributionId, orderId) => {
      const page = `/contractAdmin/orders/${catalogId}?d=${distributionId}`;
      const token = await tokenFrom(request, page);
      return action(request, await request.get(`${page}&delete=${orderId}&token=${token}`, { maxRedirects: 0 }));
    },
  },
  groupAdmin: {
    // controller/AmapAdmin.hx doEditRight (sugoi form "editRight": one `rights[]` field for the group rights and the catalogs)
    rightsEditor: async (request, userId) => {
      const res = await request.get(`/amapadmin/editRight${userId == null ? '' : `/${userId}`}`, { maxRedirects: 0 });
      const html = await res.text();
      const f = readForm(html);
      const offered = f.offered['rights[]'] ?? [];
      const checked = (f.values['rights[]'] as string[] | undefined) ?? [];
      const group = (v: string) => !v.startsWith('contract');
      const catalog = (v: string): 'all' | number => (v === 'contractAll' ? 'all' : Number(v.slice('contract'.length)));
      return {
        status: res.status(),
        location: res.headers()['location'] ?? null,
        members: f.options.user ? f.options.user.filter((v) => v !== '').map(Number) : null,
        groupRights: { offered: offered.filter(group) as never, checked: checked.filter(group) as never },
        catalogRights: { offered: offered.filter((v) => !group(v)).map(catalog), checked: checked.filter((v) => !group(v)).map(catalog) },
        automatic: [...(/editRight_fixed-rights__Label[\s\S]*?<ul>([\s\S]*?)<\/ul>/.exec(html)?.[1] ?? '').matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => textOf(m[1])),
      };
    },
    giveRights: (request, userId, rights) => urlForm(request, '/amapadmin/editRight', 'editRight', { user: String(userId), 'rights': rightsValues(rights) }),
    editRights: (request, userId, rights) => urlForm(request, `/amapadmin/editRight/${userId}`, 'editRight', { rights: rightsValues(rights) }),
    // controller/AmapAdmin.hx doPayments (sugoi form "paymentTypes")
    paymentSettings: async (request) => {
      const res = await request.get('/amapadmin/payments', { maxRedirects: 0 });
      const html = await res.text();
      const boxes = [...html.matchAll(/<input type="checkbox"[^>]*name="paymentTypes_paymentTypes\[\]"[^>]*value="([^"]+)"([^>]*)>/g)];
      return {
        status: res.status(),
        offered: boxes.map((b) => b[1]),
        enabled: boxes.filter((b) => /\bchecked\b/.test(b[2])).map((b) => b[1]),
        iban: /name="paymentTypes_IBAN"[^>]*value="([^"]*)"/.exec(html)?.[1] ?? '',
        links: [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]),
      };
    },
    savePaymentSettings: async (request, settings) => {
      const url = '/amapadmin/payments';
      const html = await (await request.get(url, { maxRedirects: 0 })).text();
      const body = new URLSearchParams();
      body.set('paymentTypes_formSubmitted', 'true');
      body.set('paymentTypes_submit', 'OK');
      const token = /value="([0-9a-f]+)"\s+name="paymentTypes_token"/.exec(html)?.[1];
      if (token) body.set('paymentTypes_token', token);
      const groupId = /name="paymentTypes_groupId"[^>]*value="(\d+)"/.exec(html)?.[1];
      if (groupId) body.set('paymentTypes_groupId', groupId);
      body.set('paymentTypes_IBAN', settings.iban ?? '');
      for (const t of settings.types) body.append('paymentTypes_paymentTypes[]', t);
      return action(request, await request.post(url, { data: body.toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' }, maxRedirects: 0 }));
    },
    // controller/Amap.hx doEdit (spod form of the Group, generated name; flags 6, 7, 8 are the three options)
    settings: async (request) => {
      const res = await request.get('/amap/edit', { maxRedirects: 0 });
      return settingsView(request, res);
    },
    saveSettings: async (request, f, opts) => {
      const url = '/amap/edit';
      const state = readForm(await (await request.get(url, { maxRedirects: 0 })).text());
      const o: Record<string, string | string[] | null> = {};
      for (const k of ['name', 'txtIntro', 'txtHome', 'txtDistrib', 'extUrl'] as const) if (f[k] !== undefined) o[k] = f[k]!;
      if (f.regOption !== undefined) o.regOption = String(REG_OPTIONS.indexOf(f.regOption));
      if (f.contactId !== undefined) o.userId = f.contactId == null ? '' : String(f.contactId);
      if (f.legalRepresentativeId !== undefined) o.legalReprId = f.legalRepresentativeId == null ? '' : String(f.legalRepresentativeId);
      const checked = new Set((state.values['flags[]'] as string[] | undefined) ?? []);
      for (const [key, bit] of [['hidePhone', '6'], ['phoneRequired', '7'], ['addressRequired', '8']] as const) {
        if (f[key] === undefined) continue;
        if (f[key]) checked.add(bit);
        else checked.delete(bit);
      }
      o['flags[]'] = [...checked];
      if (opts?.formGroupId != null) o.id = String(opts.formGroupId);
      return fillAndPost(request, url, o);
    },
    // controller/AmapAdmin.hx doMembership (sugoi form "membership"; the date is a CamapDatePicker)
    membershipSettings: async (request) => {
      const res = await request.get('/amapadmin/membership', { maxRedirects: 0 });
      const f = readForm(await res.text());
      return {
        status: res.status(),
        location: res.headers()['location'] ?? null,
        values: { enabled: !!f.values.membership, fee: String(f.values.membershipFee ?? ''), renewalDate: String(f.values.membershipRenewalDate ?? '').slice(0, 10) },
      };
    },
    saveMembershipSettings: (request, f) =>
      fillAndPost(request, '/amapadmin/membership', {
        membership: f.enabled ? 'true' : null,
        membershipFee: f.fee,
        membershipRenewalDate: f.renewalDate === '' ? '' : datePicker(f.renewalDate),
      }),
  },
  payments: {
    manualEntryTypes: async (request, userId) => optionValues(await (await request.get(`/transaction/insertPayment/${userId}`, { maxRedirects: 0 })).text(), 'payement_Mtype'),
    insert: (request, userId, f) => sugoiForm(request, `/transaction/insertPayment/${userId}`, 'payement', paymentFields(f)),
    insertOnSubscription: (request, subId, f) => {
      const { unpaid: _u, ...fields } = paymentFields(f);
      return sugoiForm(request, `/contractAdmin/subscriptions/insertPayment/${subId}`, 'payement', fields);
    },
    massInsert: async (request, catalogId, rows, opts) => {
      const url = `/contractAdmin/subscriptions/massPayments/${catalogId}`;
      const fields: Record<string, string> = { submit: 'OK' };
      if (opts?.token !== false) fields.token = await tokenFrom(request, url);
      for (const r of rows) {
        fields[`sub${r.subscriptionId}_amount`] = r.amount == null ? '' : String(r.amount);
        fields[`sub${r.subscriptionId}_paymentType`] = r.type ?? 'check';
        fields[`sub${r.subscriptionId}_label`] = r.label ?? 'Paiement';
      }
      return action(request, await request.post(url, { form: fields, maxRedirects: 0 }));
    },
    edit: (request, id, f) => sugoiForm(request, `/transaction/edit/${id}`, 'payement', { name: f.name, amount: String(f.amount), date: f.date }),
    delete: async (request, id, opts) => {
      // the delete link and its token are on the subscription's payments page
      const row = await queryOne<{ subscriptionId: number | null; userId: number }>('SELECT subscriptionId, userId FROM Operation WHERE id = ?', [id]);
      const page = row!.subscriptionId != null ? `/contractAdmin/subscriptions/payments/${row!.subscriptionId}` : `/member/payments/${row!.userId}`;
      const token = opts?.token === false ? '' : await tokenFrom(request, page).catch(() => '');
      return action(request, await request.get(`/transaction/delete/${id}?token=${token}`, { maxRedirects: 0 }));
    },
  },
  group: {
    // controller/User.hx doChoose
    select: async (request, groupId, opts) =>
      action(request, await request.get(`/user/choose?group=${groupId}${opts?.redirect != null ? `&redirect=${encodeURIComponent(opts.redirect)}` : ''}`, { maxRedirects: 0 })),
    // controller/Account.hx doQuitGroup (called by the quit widget once the GraphQL quitGroup is done)
    forgetAfterQuit: async (request, groupId) => action(request, await request.get(`/account/quitGroup/${groupId}`, { maxRedirects: 0 })),
    // controller/Group.hx doCreate (spod form of a Place with a generated name, plus `groupName`)
    createForm: async (request) => {
      const res = await followAlerts(request, await action(request, await request.get('/group/create', { maxRedirects: 0 })));
      const f = readForm(res.body);
      const values: Record<string, string> = {};
      for (const [k, v] of Object.entries(f.values)) if (typeof v === 'string' && k !== 'token' && k !== 'formSubmitted') values[k] = v;
      return { ...res, values, required: [...f.required], countries: f.options.country ?? [] };
    },
    create: async (request, f) => {
      const o: Record<string, string | null> = { name: 'Lieu de distribution', zipCode: '44000', city: 'Nantes', groupName: 'Nouveau groupe', ...placeOverrides(f) };
      return followAlerts(request, await fillAndPost(request, '/group/create', o));
    },
    // controller/User.hx doJoingroup
    join: async (request) => action(request, await request.get('/user/joingroup', { maxRedirects: 0 })),
    // controller/Group.hx doList (sugoi form "reg")
    requestWaitingList: (request, groupId, message) => sugoiForm(request, `/group/list/${groupId}`, 'reg', { msg: message ?? '' }),
    // controller/Group.hx doListCancel
    leaveWaitingList: async (request, groupId) => action(request, await request.get(`/group/listCancel/${groupId}`, { maxRedirects: 0 })),
    // controller/User.hx doQuitGroup: key = sha1(KEY + groupId + userId); doQuitGroupFromMessage: key = sha1(KEY + groupId)
    quitKey: (groupId, userId) => sha1(`${groupId}${userId}`),
    quitKeyFromMessage: (groupId) => sha1(String(groupId)),
    openQuitLink: async (request, p) => quitPage(request, await request.get(`/user/quitGroup/${p.groupId}/${p.userId}/${p.key}`, { maxRedirects: 0 })),
    openQuitLinkFromMessage: async (request, p) => quitPage(request, await request.get(`/user/quitGroupFromMessage/${p.groupId}/${p.key}`, { maxRedirects: 0 })),
  },
  subscriptionAdmin: {
    // controller/SubscriptionAdmin.hx
    list: async (request, catalogId) => action(request, await request.get(`/contractAdmin/subscriptions/${catalogId}`, { maxRedirects: 0 })),
    create: async (request, catalogId, form, opts) => {
      const url = `/contractAdmin/subscriptions/insert/${catalogId}`;
      const fields = subscriptionFields(form);
      if (opts?.token !== false) fields.token = await tokenFrom(request, url);
      return action(request, await request.post(url, { form: fields, maxRedirects: 0 }));
    },
    edit: async (request, subscriptionId, form, opts) => {
      const url = `/contractAdmin/subscriptions/edit/${subscriptionId}`;
      const fields = subscriptionFields(form);
      if (opts?.token !== false) fields.token = await tokenFrom(request, url);
      return action(request, await request.post(url, { form: fields, maxRedirects: 0 }));
    },
    delete: async (request, subscriptionId, opts) => {
      // the delete links, with their token, are on the catalog's subscription list
      const token = opts?.token === false ? '' : await tokenFrom(request, `/contractAdmin/subscriptions/payments/${subscriptionId}`).catch(async () => {
        const row = await queryOne<{ catalogId: number }>('SELECT catalogId FROM Subscription WHERE id = ?', [subscriptionId]);
        return tokenFrom(request, `/contractAdmin/subscriptions/${row!.catalogId}`);
      });
      return action(request, await request.get(`/contractAdmin/subscriptions/delete/${subscriptionId}?token=${token}`, { maxRedirects: 0 }));
    },
    balanceTransfer: async (request, from, to, opts) => {
      const url = `/contractAdmin/subscriptions/balanceTransfer/${from}`;
      const fields: Record<string, string> = { subscription: String(to), submit: 'OK' };
      if (opts?.token !== false) fields.token = await tokenFrom(request, url).catch(() => '');
      return action(request, await request.post(url, { form: fields, maxRedirects: 0 }));
    },
    // controller/Subscriptions.hx doReattribute (sugoi form "reattribute": every field is prefixed)
    reattribute: async (request, subscriptionId, userId) => {
      const url = `/subscriptions/reattribute/${subscriptionId}`;
      const html = await (await request.get(url, { maxRedirects: 0 })).text();
      const token = /name="reattribute_token"/.test(html) ? /value="([0-9a-f]+)"\s+name="reattribute_token"/.exec(html)?.[1] : undefined;
      const form: Record<string, string> = { reattribute_user: String(userId), reattribute_submit: 'OK', reattribute_formSubmitted: 'true' };
      if (token) form.reattribute_token = token;
      return action(request, await request.post(url, { form, maxRedirects: 0 }));
    },
  },
  catalogs: {
    // controller/Contract.hx (doDefineVendor, doInsertVendor, doInsertChoose, doInsert), ContractAdmin.doEdit
    findVendors: async (request, search) => {
      const url = '/contract/defineVendor';
      const res = await urlForm(request, url, 'defVendor', {
        ...(search.name != null ? { name: search.name } : {}),
        ...(search.geoloc ? { geoloc: true } : {}),
        ...(search.profession != null ? { profession: String(search.profession) } : {}),
      });
      // the result page is the POST response itself (no redirect): re-read it
      const html = res.body;
      const vendorIds = [...html.matchAll(/href="\/contract\/insertChoose\/(\d+)"/g)].map((m) => Number(m[1]));
      return { ...res, vendorIds };
    },
    vendorForm: async (request) => {
      const res = await request.get('/contract/insertVendor', { maxRedirects: 0 });
      const html = await res.text();
      return { status: res.status(), location: res.headers()['location'] ?? null, offersGdprConsent: /name="gdprConsent"[^>]*required/.test(html) };
    },
    createVendor: (request, f) =>
      fillAndPost(
        request,
        '/contract/insertVendor',
        {
          name: f.name ?? 'Nouveau producteur',
          email: f.email === undefined ? 'nouveau@camap.test' : f.email,
          zipCode: f.zipCode ?? '44000',
          city: f.city ?? 'Nantes',
          companyNumber: f.companyNumber === undefined ? '12345678900012' : f.companyNumber,
          profession: String(f.profession ?? 1),
          ...vendorFieldOverrides(f),
        },
        f.gdpr ? { gdprConsent: 'on' } : {},
      ),
    typeChoices: async (request, vendorId) => {
      const res = await action(request, await request.get(`/contract/insertChoose/${vendorId}`, { maxRedirects: 0 }));
      const types = [...res.body.matchAll(/href="\/contract\/insert\/\d+\/([01])"/g)].map((m) => (m[1] === '0' ? 'constant' : 'variable') as CatalogKind);
      return { ...res, types };
    },
    creationForm: async (request, vendorId, type) => catalogFormView(await request.get(`/contract/insert/${vendorId}${kindPath(type)}`, { maxRedirects: 0 })),
    create: (request, vendorId, type, f = {}) => postCatalog(request, `/contract/insert/${vendorId}${kindPath(type)}`, f),
    editForm: async (request, catalogId) => catalogFormView(await request.get(`/contractAdmin/edit/${catalogId}`, { maxRedirects: 0 })),
    edit: (request, catalogId, f) => postCatalog(request, `/contractAdmin/edit/${catalogId}`, f),
    // controller/ContractAdmin.hx doDuplicate (sugoi form "duplicate")
    duplicate: async (request, catalogId, opts = {}) => {
      const url = `/contractAdmin/duplicate/${catalogId}`;
      const html = await (await request.get(url, { maxRedirects: 0 })).text();
      const type = opts.type != null ? (opts.type === 'variable' ? '1' : '0') : (/<option value="(\d)" selected/.exec(html)?.[1] ?? '0');
      return sugoiForm(request, url, 'duplicate', {
        name: opts.name ?? 'Copie',
        catalogtype: type,
        copyProducts: { all: 'all', active: 'onlyActiveProducts', none: 'none' }[opts.copyProducts ?? 'all'],
        // posted even when the form does not offer it: the app must ignore it then
        ...(opts.copyDistributions ? { copyDeliveries: '1' } : {}),
      });
    },
    duplicateForm: async (request, catalogId) => {
      const res = await request.get(`/contractAdmin/duplicate/${catalogId}`, { maxRedirects: 0 });
      const f = readForm(await res.text());
      const type = f.values.catalogtype;
      return {
        status: res.status(),
        location: res.headers()['location'] ?? null,
        name: typeof f.values.name === 'string' ? f.values.name : '',
        type: type === '1' ? 'variable' : type === '0' ? 'constant' : null,
        offersCopyDistributions: 'copyDeliveries' in f.values,
      };
    },
    // controller/ContractAdmin.hx doDelete: a plain GET link with the session token (printed on the catalog page)
    delete: async (request, catalogId, opts) => {
      const token = opts?.token === false ? '' : await tokenFrom(request, `/contractAdmin/view/${catalogId}`).catch(() => tokenFrom(request, '/contractAdmin').catch(() => ''));
      return action(request, await request.get(`/contractAdmin/delete/${catalogId}?token=${token}`, { maxRedirects: 0 }));
    },
    // controller/ContractAdmin.hx doCopyProducts (sugoi form "copy")
    copyProducts: (request, targetCatalogId, sourceCatalogId, opts) =>
      urlForm(request, `/contractAdmin/copyProducts/${targetCatalogId}`, 'copy', { source: String(sourceCatalogId), ...(opts?.deleteExisting ? { delete: true } : {}) }),
    // controller/ContractAdmin.hx doAbsences (sugoi form "absences")
    absencesForm: async (request, catalogId) => {
      const res = await request.get(`/contractAdmin/absences/${catalogId}`, { maxRedirects: 0 });
      const f = readForm(await res.text());
      const str = (k: string) => (typeof f.values[k] === 'string' ? (f.values[k] as string) : '');
      return {
        status: res.status(),
        location: res.headers()['location'] ?? null,
        maxNb: str('absentDistribsMaxNb') === '' ? null : Number(str('absentDistribsMaxNb')),
        startDate: str('absencesStartDate').slice(0, 10),
        endDate: str('absencesEndDate').slice(0, 10),
      };
    },
    setAbsences: async (request, catalogId, f) => {
      const url = `/contractAdmin/absences/${catalogId}`;
      const current = readForm(await (await request.get(url, { maxRedirects: 0 })).text());
      const pick = (k: string, v: string | null | undefined, asDate: boolean) => (v === undefined ? String(current.values[k] ?? '') : v === null ? '' : asDate ? datePicker(v) : v);
      return urlForm(request, url, 'absences', {
        absentDistribsMaxNb: pick('absentDistribsMaxNb', f.maxNb == null ? f.maxNb : String(f.maxNb), false),
        absencesStartDate: pick('absencesStartDate', f.startDate, true),
        absencesEndDate: pick('absencesEndDate', f.endDate, true),
      });
    },
    // controller/ContractAdmin.hx doUpdatePrices: a plain GET, no token
    updatePrices: async (request, catalogId, distributionId) =>
      action(request, await request.get(`/contractAdmin/updatePrices/${catalogId}${distributionId != null ? `?d=${distributionId}` : ''}`, { maxRedirects: 0 })),
  },
  places: {
    // controller/Place.hx (spod form with a generated name; country is an extra select)
    list: async (request) => {
      const res = await action(request, await request.get('/place', { maxRedirects: 0 }));
      return {
        ...res,
        placeIds: [...res.body.matchAll(/href="\/place\/edit\/(\d+)"/g)].map((m) => Number(m[1])),
        offersDelete: /\/place\/delete\/\d+/.test(res.body),
      };
    },
    form: async (request, placeId) => {
      const res = await request.get(placeId == null ? '/place/insert' : `/place/edit/${placeId}`, { maxRedirects: 0 });
      const f = readForm(await res.text());
      const values: Record<string, string> = {};
      for (const [k, v] of Object.entries(f.values)) if (typeof v === 'string' && k !== 'token' && k !== 'formSubmitted') values[k] = v;
      return { status: res.status(), location: res.headers()['location'] ?? null, values, countries: f.options.country ?? [], country: values.country ?? '', required: [...f.required] };
    },
    create: (request, f) => fillAndPost(request, '/place/insert', { name: 'Nouveau lieu', zipCode: '44000', city: 'Nantes', ...placeOverrides(f) }),
    edit: (request, placeId, f) => fillAndPost(request, `/place/edit/${placeId}`, placeOverrides(f)),
    // controller/Place.hx doDelete: a plain GET link with the session token (printed on the places page)
    delete: async (request, placeId, opts) => {
      const token = opts?.token === false ? '' : await tokenFrom(request, '/place').catch(() => '');
      return action(request, await request.get(`/place/delete/${placeId}?token=${token}`, { maxRedirects: 0 }));
    },
    view: (request, placeId) => view(request, `/place/view/${placeId}`),
  },
  vendors: {
    // controller/Vendor.hx doEdit (spod form with a generated name; geocodes on save)
    editForm: async (request, vendorId) => action(request, await request.get(`/vendor/edit/${vendorId}`, { maxRedirects: 0 })),
    edit: (request, vendorId, f) => {
      const o: Record<string, string | null> = { ...vendorFieldOverrides(f) };
      for (const k of ['name', 'zipCode', 'city'] as const) if (f[k] !== undefined) o[k] = f[k]!;
      for (const k of ['email', 'companyNumber'] as const) if (f[k] !== undefined) o[k] = f[k];
      if (f.profession !== undefined) o.profession = f.profession == null ? null : String(f.profession);
      return fillAndPost(request, `/vendor/edit/${vendorId}`, o);
    },
  },
  products: {
    // controller/Product.hx doInsert/doEdit/doDelete/doCopyAndDiscard, ContractAdmin.doProducts
    form: async (request, target) =>
      productFormView(await request.get('catalogId' in target ? `/product/insert/${target.catalogId}` : `/product/edit/${target.productId}`, { maxRedirects: 0 })),
    create: (request, catalogId, f) => postProduct(request, `/product/insert/${catalogId}`, f),
    edit: (request, productId, f) => postProduct(request, `/product/edit/${productId}`, f),
    copyAndDeactivate: async (request, productId, opts) => {
      const token = opts?.token === false ? '' : await productsPageToken(request, productId).catch(() => '');
      return action(request, await request.get(`/product/copyAndDiscard/${productId}?token=${token}`, { maxRedirects: 0 }));
    },
    delete: async (request, productId, opts) => {
      const token = opts?.token === false ? '' : await productsPageToken(request, productId).catch(() => '');
      return action(request, await request.get(`/product/delete/${productId}?token=${token}`, { maxRedirects: 0 }));
    },
    setActive: async (request, catalogId, productIds, active) =>
      action(request, await request.get(`/contractAdmin/products/${catalogId}?${active ? 'enable' : 'disable'}=${productIds.join('|')}`, { maxRedirects: 0 })),
    // controller/Product.hx doImport: the file field is `file`, the rows wait in the session until `?confirm=1`
    csvImport: {
      open: async (request, catalogId) => importPage(request, await request.get(`/product/import/${catalogId}`, { maxRedirects: 0 })),
      upload: async (request, catalogId, file) => {
        const { data, contentType } = multipartBody({}, file ? { field: 'file', file } : undefined);
        return importPage(request, await request.post(`/product/import/${catalogId}`, { data, headers: { 'content-type': contentType }, maxRedirects: 0, timeout: 120_000 }));
      },
      confirm: async (request, catalogId) => importPage(request, await request.get(`/product/import/${catalogId}?confirm=1`, { maxRedirects: 0 })),
    },
  },
  subscription: {
    // controller/Subscriptions.hx doDelete (a plain GET link, CODE-020)
    deleteOwn: async (request, id) => action(request, await request.get(`/subscriptions/delete/${id}`, { maxRedirects: 0 })),
  },
  documents: {
    list: (request, scope) => fileListing(request, documentsUrl(scope, ''), 'documents'),
    upload: (request, scope, f) => uploadForm(request, documentsUrl(scope, 'insert'), 'document', f),
    edit: (request, scope, id, f) => {
      const o: Record<string, string | null> = {};
      if (f.name !== undefined) o.name = f.name;
      if (f.visibility !== undefined) o.visibility = f.visibility;
      return fillAndPost(request, documentsUrl(scope, 'edit', id), o);
    },
    delete: async (request, scope, id, opts) => {
      const token = opts?.token === false ? '' : await listingToken(request, documentsUrl(scope, ''));
      return action(request, await request.get(`${documentsUrl(scope, 'delete', id)}?token=${token}`, { maxRedirects: 0 }));
    },
  },
  media: {
    list: (request) => fileListing(request, mediaUrl(''), 'media'),
    upload: (request, f) => uploadForm(request, mediaUrl('insert'), 'media', f),
    edit: (request, id, f) => {
      const o: Record<string, string | null> = {};
      if (f.name !== undefined) o.name = f.name;
      if (f.visibility !== undefined) o.visibility = f.visibility;
      return fillAndPost(request, mediaUrl('edit', id), o);
    },
    delete: async (request, id, opts) => {
      const token = opts?.token === false ? '' : await listingToken(request, mediaUrl(''));
      return action(request, await request.get(`${mediaUrl('delete', id)}?token=${token}`, { maxRedirects: 0 }));
    },
  },
  admin: {
    // controller/admin/Admin.hx, controller/admin/Group.hx; every route is @admin (a refusal redirects to "/")
    reloadTheme: async (request) => action(request, await request.get('/admin/?reloadSettings=1', { maxRedirects: 0 })),
    addMeToGroup: async (request, groupId) => action(request, await request.get(`/admin/group/addMe/${groupId}`, { maxRedirects: 0 })),
    deleteGroup: async (request, groupId, opts) => {
      // the token is printed on the group page (a superadmin only gets it there)
      const token = opts?.token === false ? '' : await tokenFrom(request, `/admin/group/view/${groupId}`).catch(() => '');
      return action(request, await request.get(`/admin/group/deleteGroup/${groupId}?token=${token}`, { maxRedirects: 0 }));
    },
    setTheme: (request, settings) => urlForm(request, '/admin/theme', 'theme', { theme: settings }),
    setMessage: (request, which, text, alert) => {
      const [path, field] = { homeMessage: ['messages', 'homeMessage'], groupMessage: ['attention', 'attMessage'], groupAdminMessage: ['attentionAdmins', 'attMessageAdmins'] }[which];
      return urlForm(request, `/admin/${path}`, 'msg', { [field]: text, ...(alert ? { msgAlert: true } : {}) });
    },
    // controller/admin/Admin.hx doErrors: `?empty=1` truncates the table (a plain GET link, no token: UND-108)
    purgeErrors: async (request) => action(request, await request.get('/admin/errors?empty=1', { maxRedirects: 0 })),
    // controller/admin/Admin.hx doEmails: `?reset=<id>` sets tries back to 0 and shows the queue
    resetMailTries: async (request, mailId) => action(request, await request.get(`/admin/emails?reset=${mailId}`, { maxRedirects: 0 })),
    // controller/admin/User.hx doDelete: a plain link
    deleteUser: async (request, userId) => action(request, await request.get(`/admin/user/delete/${userId}`, { maxRedirects: 0 })),
    // sugoi Main.hx doDb -> sys.db.admin.Admin: /db/<Table>/edit/<id> shows the row, /db/<Table>/doEdit/<id> saves it.
    // A nullable column has a "__data" checkbox that says "has a value"; the flags have one checkbox per flag.
    editGroupColumnInDatabaseTool: async (request, groupId, column, value) => {
      const html = await (await request.get(`/db/Group/edit/${groupId}`, { maxRedirects: 0 })).text();
      const body = new URLSearchParams();
      const form = html.slice(html.indexOf('<form id="Group"'), html.indexOf('</form>'));
      for (const m of form.matchAll(/<input\b[^>]*>/g)) {
        const a = attrsOf(m[0]);
        if (!a.name || a.type === 'submit') continue;
        if (a.type === 'checkbox') {
          if ('checked' in a) body.append(a.name, a.value || 'on');
        } else body.append(a.name, a.value ?? '');
      }
      for (const m of form.matchAll(/<textarea\b([^>]*)>([\s\S]*?)<\/textarea>/g)) body.append(attrsOf(m[1]).name, decodeEntities(m[2]));
      for (const m of form.matchAll(/<select\b[^>]*>([\s\S]*?)<\/select>/g)) {
        const name = attrsOf(m[0].slice(0, m[0].indexOf('>') + 1)).name;
        const opts = [...m[1].matchAll(/<option\b([^>]*)>/g)].map((o) => attrsOf(o[1]));
        body.append(name, (opts.find((o) => 'selected' in o) ?? opts[0])?.value ?? '');
      }
      body.delete(column);
      body.delete(`${column}__data`);
      if (value !== null) {
        body.append(column, value);
        body.append(`${column}__data`, 'on');
      }
      return action(request, await request.post(`/db/Group/doEdit/${groupId}`, { data: body.toString(), headers: { 'content-type': 'application/x-www-form-urlencoded' }, maxRedirects: 0 }));
    },
    // controller/Scripts.hx: "CLI only"
    runScript: async (request, script, params) => {
      const name = script === 'recomputeBasketTotal' ? 'recomputeBasketTotal' : 'cleannonamapdata';
      return action(request, await request.get(`/scripts/${name}?${new URLSearchParams(params).toString()}`, { maxRedirects: 0 }));
    },
  },
  install: {
    // controller/Install.hx doDefault (sugoi form "c")
    run: (request, f) => sugoiForm(request, '/install', 'c', { amapName: f.amapName, userFirstName: f.firstName, userLastName: f.lastName }),
  },
  files: {
    // sugoi BaseController.doFile: /file/<id>_<md5(id + key)>. The first hit writes the file to disk and
    // redirects to itself (?reload=1), which is why redirects are followed here.
    open: async (request, href) => {
      const res = await request.get(href);
      return { status: res.status(), contentType: res.headers()['content-type'] ?? null, body: await res.body() };
    },
  },
};

const textOf = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

async function view(request: APIRequestContext, url: string): Promise<PageView> {
  const res = await request.get(url, { maxRedirects: 0 });
  const location = res.headers()['location'] ?? null;
  return { status: res.status(), location, text: textOf(await res.text()), flash: await flashOf(request, location) };
}

// the settings the group admin dashboard links to (views/amapadmin/design.mtt)
const ADMIN_SECTIONS = new Map<GroupAdminSection, string>([
  ['settings', '/amap/edit'],
  ['rights', '/amapadmin/rights'],
  ['vatRates', '/amapadmin/vatRates'],
  ['volunteers', '/amapadmin/volunteers'],
  ['membership', '/amapadmin/membership'],
  ['places', '/place'],
  ['currency', '/amapadmin/currency'],
  ['documents', '/amapadmin/documents'],
  ['media', '/amapadmin/media'],
  ['payments', '/amapadmin/payments'],
]);

/** The register/login buttons of a page: `_Camap.registerBox(url, sid, msg, phoneRequired, addressRequired)` and `_Camap.loginBox(...)`. */
async function boxRequirements(r: APIRequestContext, url: string) {
  const res = await r.get(url, { maxRedirects: 0 });
  const html = await res.text();
  const location = res.headers()['location'] ?? null;
  const boxes = [...html.matchAll(/_Camap\.(?:registerBox|loginBox)\('[^']*',\s*'[^']*',\s*null,\s*(\w+),\s*(\w+)/g)];
  return {
    status: res.status(),
    location,
    text: textOf(html),
    flash: await flashOf(r, location),
    buttons: boxes.length,
    phoneRequired: boxes.length > 0 && boxes.every((b) => b[1] === 'true'),
    addressRequired: boxes.length > 0 && boxes.every((b) => b[2] === 'true'),
  };
}


// the links of the back-office sidebar and dashboard (templates admin/basedesign.mtt, admin/default.mtt)
const ADMIN_LINKS: [AdminLink, string][] = [
  ['database', '/db'],
  ['errors', '/admin/errors'],
  ['emails', '/admin/emails'],
  ['homeMessage', '/admin/messages'],
  ['groupMessage', '/admin/attention'],
  ['groupAdminMessage', '/admin/attentionAdmins'],
  ['groups', '/admin/group'],
  ['users', '/admin/user'],
  ['theme', '/admin/theme'],
  ['reloadTheme', '/admin/?reloadSettings=1'],
  ['superadmins', '/admin/superadmins'],
];
const adminLinksIn = (html: string): AdminLink[] => {
  const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
  return ADMIN_LINKS.filter(([, path]) => hrefs.includes(path)).map(([k]) => k);
};
/** Templates print HTML comments as they are: a commented-out link is not a link. */
const withoutComments = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '');
const cellText = (v: string) => decodeEntities(textOf(v));

export const hxViews: CamapApp['views'] = {
  messages: { page: (r) => view(r, '/messages') },
  sessions: {
    // controller/Distribution.hx doDefault (views distribution/default.mtt)
    overview: async (request) => {
      const res = await request.get('/distribution', { maxRedirects: 0 });
      const html = withoutComments(await res.text());
      const STATES: [RegExp, SessionsOverview['states'][number]][] = [
        [/Aucune commande variable/, 'none'],
        [/Commande pas encore ouverte/, 'notYetOpen'],
        [/Commande en cours/, 'open'],
        [/Commande close/, 'closed'],
        [/Distribution faite/, 'distributed'],
        [/Distribution validée/, 'validated'],
      ];
      // each session is a `.distrib` block whose first dashboard block is its order window state
      const blocks = html.split('<div class="distrib">').slice(1).map((b) => textOf(/<div class="dashBoardBlock">([\s\S]*?)<div class="col-md-3">/.exec(b)?.[1] ?? ''));
      const states = blocks.map((b) => STATES.find(([re]) => re.test(b))?.[1] ?? ('unknown' as const));
      return { status: res.status(), states, cycleCount: [...html.matchAll(/: Du [^<]* au /g)].length };
    },
    // controller/Distribution.hx doEditCycle, doInviteFarmersCycle: both are stubs
    cycleStubs: async (request, cycleId) => ({
      edit: await view(request, `/distribution/editCycle/${cycleId}`),
      inviteVendors: await view(request, `/distribution/inviteFarmersCycle/${cycleId}`),
    }),
    // controller/ContractAdmin.hx doDistributions (views contractadmin/distributions.mtt)
    catalogSessions: async (request, catalogId, period) => {
      const res = await request.get(`/contractAdmin/distributions/${catalogId}${period ? `?_from=${period.from}&_to=${period.to}` : ''}`, { maxRedirects: 0 });
      const html = await res.text();
      return {
        status: res.status(),
        joinable: [...html.matchAll(/\/contractAdmin\/participate\/(\d+)\/\d+/g)].map((m) => Number(m[1])),
        participating: [...html.matchAll(/\/distribution\/delete\/(\d+)/g)].map((m) => Number(m[1])),
      };
    },
    // controller/Distribution.hx doShift
    shiftForm: async (request, distributionId) => {
      const res = await request.get(`/distribution/shift/${distributionId}`, { maxRedirects: 0 });
      const html = await res.text();
      const select = /<select[^>]*name="distribShifting_md"[\s\S]*?<\/select>/.exec(html)?.[0] ?? '';
      return {
        status: res.status(),
        location: res.headers()['location'] ?? null,
        text: textOf(html),
        flash: null,
        targets: [...select.matchAll(/<option[^>]*value="(\d+)"/g)].map((m) => Number(m[1])),
      };
    },
  },
  attendance: {
    // controller/Distribution.hx
    catalogSheet: (r, id) => view(r, `/distribution/csaList/${id}`),
    productsByMember: (r, id) => view(r, `/distribution/listByProductUser/${id}`),
    day: (r, date, placeId, type) => view(r, `/distribution/listByDate/${date}/${placeId}/${type}/S`),
    dayFormChoices: async (r, date, placeId) => {
      const html = await (await r.get(`/distribution/listByDate/${date}/${placeId}`, { maxRedirects: 0 })).text();
      return [...html.matchAll(/<input type="radio"[^>]*name="listBydate_type"[^>]*value="([^"]+)"/g)].map((m) => m[1]);
    },
  },
  invoices: {
    // controller/Member.hx doInvoice
    ofMember: (r, userId, multiDistribId) => view(r, `/member/invoice/${userId}/${multiDistribId}`),
  },
  reports: {
    ordersByProduct: (r, catalogId, d) => view(r, `/contractAdmin/ordersByProduct/${catalogId}?d=${d}`),
    purchaseOrder: (r, catalogId, d) => view(r, `/contractAdmin/ordersByProductList/${catalogId}?d=${d}`),
    ordersByTimeFrame: (r, from, to) => view(r, `/contractAdmin/ordersByTimeFrame/${from}/${to}`),
  },
  member: {
    // controller/Member.hx doPayments, doBalance
    payments: (r, userId, page) => view(r, `/member/payments/${userId}${page ? `?page=${page}` : ''}`),
    balances: (r, opts) => view(r, `/member/balance${opts?.refresh ? '?refresh=1' : ''}`),
    list: (r) => view(r, '/member'),
    // controller/Member.hx doView (views member/view.mtt)
    sheet: async (r, userId) => {
      const res = await r.get(`/member/view/${userId}`, { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      const notifications = [...html.matchAll(/<td>\s*<i class="icon icon-(check|delete)"[^>]*><\/i>\s*<\/td>\s*<td>([^<]*)<\/td>/g)].map((m) => ({ name: m[2].trim(), active: m[1] === 'check' }));
      return {
        status: res.status(),
        location,
        text: textOf(html),
        flash: await flashOf(r, location),
        notifications,
        subscriptionCount: [...html.matchAll(/csa-catalog-subscription-neo-container-\d+"><\/div>/g)].length,
        offers: {
          payments: html.includes(`href="/member/payments/${userId}"`),
          moveToWaitingList: html.includes(`href="/member/movetowl/${userId}"`),
          loginAs: html.includes(`href="/member/loginas/${userId}"`),
          remove: html.includes(`/member/delete/${userId}?token=`),
          membershipDialog: html.includes(`_Camap.membershipBox(${userId},`),
        },
      };
    },
  },
  stocks: {
    // controller/ContractAdmin.hx doStocks
    page: (r, catalogId) => view(r, `/contractAdmin/stocks/${catalogId}`),
  },
  shop: {
    // controller/Main.hx doDefault: the open catalogs of the group
    home: (r) => view(r, '/home'),
    // controller/Shop.hx doProductInfo
    productInfo: (r, productId, distributionId) => view(r, `/shop/productInfo/${productId}${distributionId != null ? `?distribution=${distributionId}` : ''}`),
  },
  orders: {
    // controller/ContractAdmin.hx doOrders
    distributionOrders: (r, catalogId, distributionId) => view(r, `/contractAdmin/orders/${catalogId}?d=${distributionId}`),
    // controller/Contract.hx doEditVarOrders
    legacyVarOrdersPage: (r, sessionId) => view(r, `/contract/editVarOrders/${sessionId}`),
    // controller/ContractAdmin.hx doTmpBaskets
    temporaryBaskets: (r, sessionId) => view(r, `/contractAdmin/tmpBaskets/${sessionId}`),
    // controller/ContractAdmin.hx doBatchOrder (views/contractadmin/batchOrder.mtt hands ids to the batch-order widget)
    batchOrder: async (r, catalogId) => {
      const res = await r.get(`/contractAdmin/batchOrder/${catalogId}`, { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      const n = (re: RegExp) => (re.exec(html) ? Number(re.exec(html)![1]) : null);
      return { status: res.status(), location, text: textOf(html), flash: await flashOf(r, location), catalogId: n(/catalogId:\s*(\d+)/), groupId: n(/groupId:\s*(\d+)/) };
    },
  },
  subscriptions: {
    // controller/Subscriptions.hx doContract (views/contract/order.mtt hands ids to the csaCatalog widget)
    subscriptionPage: async (r, catalogId) => {
      const res = await r.get(`/subscriptions/contract/${catalogId}`, { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      const id = (name: string) => {
        const m = new RegExp(`${name}:\\s*(\\d+|null)`).exec(html);
        return m == null || m[1] === 'null' ? null : Number(m[1]);
      };
      return { status: res.status(), location, text: textOf(html), flash: await flashOf(r, location), catalogId: id('catalogId'), userId: id('userId'), subscriptionId: id('subscriptionId') };
    },
    // views/home.mtt: "alternated with <mate>, It's your turn / It's his/her turn"
    sharedBasketTurns: async (r) => {
      const text = textOf(await (await r.get('/home', { maxRedirects: 0 })).text());
      return [...text.matchAll(/C'est (votre|son) tour/g)].map((m) => (m[1] === 'votre' ? ('mine' as const) : ('theirs' as const)));
    },
  },
  vendors: {
    // controller/Vendor.hx doView: the vendor is handed to the page as JSON (Vendor.getInfos)
    publicPage: async (r, vendorId) => {
      const res = await r.get(`/vendor/view/${vendorId}`, { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      const email = /vendor: \{[\s\S]*?\bemail: "([^"]*)"/.exec(html)?.[1] ?? null;
      const phoneField = /vendor: \{[\s\S]*?\bphone: (null|"[^"]*")/.exec(html)?.[1];
      const phone = phoneField == null || phoneField === 'null' ? null : phoneField.slice(1, -1);
      return { status: res.status(), location, text: textOf(html), flash: await flashOf(r, location), email, phone };
    },
    // controller/Vendor.hx doDashboard
    dashboard: (r) => view(r, '/vendor/dashboard'),
  },
  catalogs: {
    // controller/ContractAdmin.hx doDefault, doView
    list: (r, opts) => view(r, `/contractAdmin${opts?.old ? '?old=1' : ''}`),
    dashboard: (r, catalogId) => view(r, `/contractAdmin/view/${catalogId}`),
  },
  groups: {
    // controller/Group.hx doDefault
    page: async (r, groupId) => {
      const res = await r.get(`/group/${groupId}`, { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      const documents = [...html.matchAll(/icon-file-pdf"><\/i>\s*<a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ href: m[1], name: textOf(m[2]) }));
      const images = [...html.matchAll(/<img class="imageList-thumb" src="([^"]*)" alt="([^"]*)"/g)].map((m) => ({ href: m[1], name: decodeEntities(m[2]) }));
      return { status: res.status(), location, text: textOf(html), flash: await flashOf(r, location), documents, images };
    },
    // controller/Main.hx doHome
    home: (r) => view(r, '/home'),
    homeAlerts: async (r) => {
      const res = await r.get('/home', { maxRedirects: 0 });
      const html = await res.text();
      return { status: res.status(), location: res.headers()['location'] ?? null, text: textOf(html), flash: null, alerts: alertsFromHtml(html) };
    },
    // controller/User.hx doChoose, user/choose.mtt: the message is a box of its own, in raw HTML
    chooser: async (r) => {
      const res = await r.get('/user/choose', { maxRedirects: 0 });
      const html = await res.text();
      const box = /<div class="alert alert-warning" style="background-color: #fff;color: #6faf1d;">([\s\S]*?)<\/div>/.exec(html);
      return { status: res.status(), location: res.headers()['location'] ?? null, text: textOf(html), flash: null, messageHtml: box ? box[1].trim() : null, offersVendorWidget: html.includes('vendorHomeWidget') };
    },
    // controller/Main.hx doHome, home.mtt "Open orders" block
    homeOpenOrders: async (r) => {
      const res = await r.get('/home', { maxRedirects: 0 });
      const html = await res.text();
      const block = /<!-- AMAP style order forms -->([\s\S]*?)<!-- Empty planning -->/.exec(html)?.[1] ?? '';
      const items = [...block.matchAll(/<a href="\/subscriptions\/contract\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g)];
      return {
        status: res.status(),
        location: res.headers()['location'] ?? null,
        text: textOf(html),
        flash: null,
        catalogs: items.map((m) => ({ id: Number(m[1]), name: textOf(m[2].split('<br')[0]).replace(/\s+/g, ' ').trim() })),
        subscribedIds: items.filter((m) => m[2].includes('icon-book')).map((m) => Number(m[1])),
      };
    },
    // controller/Group.hx doMap, doCsa
    map: (r) => view(r, '/group/map'),
    csa: (r, name) => view(r, `/group/csa${name != null ? `?name=${encodeURIComponent(name)}` : ''}`),
    // controller/Amap.hx doDefault
    catalogList: async (r) => {
      const res = await r.get('/amap', { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      const catalogs = [...html.matchAll(/href="\/subscriptions\/contract\/(\d+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ id: Number(m[1]), name: textOf(m[2]) }));
      return { status: res.status(), location, text: textOf(html), flash: await flashOf(r, location), catalogs };
    },
    // controller/Group.hx doDefault, User.hx doLogin: the neo register/login boxes get `phoneRequired, addressRequired` from service/UserService.hx
    groupPageRequirements: async (r, groupId) => boxRequirements(r, `/group/${groupId}`),
    loginPageRequirements: async (r) => boxRequirements(r, hxUrls.login()),
    // controller/Group.hx doDisabled (a neo shell: the reason is drawn by the browser from GraphQL groupPreview)
    disabledNotice: async (r, groupId) => {
      const url = hxUrls.groupDisabled(groupId);
      const res = await r.get(url, { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      const m = /groupId:\s*(\d+)/.exec(html);
      return { status: res.status(), location, text: textOf(html), flash: await flashOf(r, location), groupId: m ? Number(m[1]) : null };
    },
  },
  groupAdmin: {
    // controller/AmapAdmin.hx doDefault
    dashboard: async (r) => {
      const res = await r.get('/amapadmin', { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      const text = textOf(html);
      const nav = /<ul id="subnav"[\s\S]*?<\/ul>/.exec(html)?.[0] ?? '';
      const hrefs = [...nav.matchAll(/href="([^"]*)"/g)].map((m) => m[1].replace(/\/$/, ''));
      const sections = [...ADMIN_SECTIONS.entries()].filter(([, path]) => hrefs.includes(path) || (path === '/amap/edit' && html.includes('href="/amap/edit"'))).map(([k]) => k);
      return {
        status: res.status(),
        location,
        text,
        flash: await flashOf(r, location),
        memberCount: /(\d+) membres?\./.exec(text)?.[1] != null ? Number(/(\d+) membres?\./.exec(text)![1]) : null,
        catalogCount: /(\d+) catalogues? actifs?\./.exec(text)?.[1] != null ? Number(/(\d+) catalogues? actifs?\./.exec(text)![1]) : null,
        sections,
      };
    },
    section: (r, section) => view(r, ADMIN_SECTIONS.get(section)!),
    // controller/Amap.hx doEdit, form/CamapForm.hx addRichText (tinymce)
    settingsEditor: async (r) => {
      const res = await r.get('/amap/edit', { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      const editor = /tinymce\.init\(\{[\s\S]*?language: "([^"]*)"/.exec(html);
      return { status: res.status(), location, text: textOf(html), flash: await flashOf(r, location), editor: editor ? { language: editor[1] } : null };
    },
    // controller/AmapAdmin.hx doRights, views/amapadmin/rights.mtt
    rights: async (r) => {
      const res = await r.get('/amapadmin/rights', { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      const holders = [...html.matchAll(/<tr>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>[\s\S]*?href="\/amapadmin\/editRight\/(\d+)"/g)].map((m) => ({
        userId: Number(m[3]),
        name: textOf(m[1]),
        rights: [...m[2].matchAll(/<li>([\s\S]*?)<\/li>/g)].map((li) => textOf(li[1])),
      }));
      return { status: res.status(), location, text: textOf(html), flash: await flashOf(r, location), holders };
    },
  },
  admin: {
    // controller/admin/Admin.hx, controller/admin/Group.hx
    dashboard: async (r) => {
      const res = await r.get('/admin', { maxRedirects: 0 });
      const html = withoutComments(await res.text());
      const location = res.headers()['location'] ?? null;
      const sidebar = /<ul class="nav nav-tabs nav-stacked"[\s\S]*?<\/ul>/.exec(html)?.[0] ?? '';
      const shortcuts = [...html.matchAll(/<a href="([^"]*)" class="btn btn-default btn-sm"/g)].map((m) => `href="${m[1]}"`).join(' ');
      return { status: res.status(), location, text: textOf(html), flash: await flashOf(r, location), sidebar: adminLinksIn(sidebar), shortcuts: adminLinksIn(shortcuts) };
    },
    theme: (r) => view(r, '/admin/theme'),
    superadmins: async (r) => {
      const res = await r.get('/admin/superadmins', { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      const users = [...html.matchAll(/<tr>\s*<td>(\d+)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>/g)].map((m) => ({
        id: Number(m[1]),
        lastName: cellText(m[2]),
        firstName: cellText(m[3]),
        email: cellText(m[4]),
      }));
      return { status: res.status(), location, text: textOf(html), flash: await flashOf(r, location), users };
    },
    // sugoi Main.hx doDb
    database: (r) => view(r, '/db'),
    // controller/admin/Admin.hx doErrors, views admin/errors.mtt
    errors: async (r, opts) => {
      const q = new URLSearchParams();
      if (opts?.userId != null) q.set('user', String(opts.userId));
      if (opts?.page != null) q.set('page', String(opts.page));
      const res = await r.get(`/admin/errors${q.size ? `?${q}` : ''}`, { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      const entries = [...html.matchAll(/<tr>\s*<td>(\d+)<\/td>\s*<td>([^<]*)<\/td>([\s\S]*?)<\/tr>/g)].map((m) => {
        const cells = [...m[3].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((c) => c[1]);
        return {
          id: Number(m[1]),
          date: m[2].trim(),
          message: cellText(cells[0].split('<a href="#r-stack')[0]),
          ip: /IP: <\/b>([^<]*)<br/.exec(cells[1])?.[1].trim() || null,
          userAgent: /User-Agent: <\/b>([^<]*)</.exec(cells[1])?.[1].trim() || null,
          userId: /\/admin\/user\/view\/(\d+)/.exec(cells[2])?.[1] ? Number(/\/admin\/user\/view\/(\d+)/.exec(cells[2])![1]) : null,
          url: cellText(cells[3]),
        };
      });
      const counts = [...html.matchAll(/datas\.push\((\d+)\)/g)].map((m) => Number(m[1]));
      const days = [...html.matchAll(/labels\.push\(\s*'([^']*)'\s*\)/g)].map((m) => m[1]);
      return { status: res.status(), location, text: textOf(html), flash: await flashOf(r, location), entries, daily: days.map((day, i) => ({ day, count: counts[i] })) };
    },
    // controller/admin/Admin.hx doEmails, views admin/emails.mtt
    emails: async (r, opts) => {
      const res = await r.get(`/admin/emails${opts?.page != null ? `?page=${opts.page}` : ''}`, { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      const mails = [...html.matchAll(/<tr>\s*<td>(\d+)<\/td>\s*<td>[^<]*<\/td>\s*<td class="(?:warning|danger)">([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>/g)].map((m) => ({
        id: Number(m[1]),
        tries: Number(/\d+/.exec(m[2])![0]),
        canRetry: m[2].includes('?reset='),
        title: cellText(m[3]),
      }));
      const count = /<h3>\s*(\d+) unsent emails/.exec(html)?.[1];
      return { status: res.status(), location, text: textOf(html), flash: await flashOf(r, location), announcedCount: count == null ? null : Number(count), mails };
    },
    // controller/admin/Admin.hx doTheme, doMessages, doAttention, doAttentionAdmins
    themeSettings: async (r) => {
      const res = await r.get('/admin/theme', { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      return { status: res.status(), location, text: textOf(html), flash: await flashOf(r, location), settings: readForm(html).values['theme'] as string | undefined ?? null };
    },
    messageSettings: async (r, which) => {
      const [path, field] = { homeMessage: ['messages', 'homeMessage'], groupMessage: ['attention', 'attMessage'], groupAdminMessage: ['attentionAdmins', 'attMessageAdmins'] }[which];
      const res = await r.get(`/admin/${path}`, { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      const f = readForm(html);
      const hasForm = f.prefix !== '';
      return {
        status: res.status(),
        location,
        text: textOf(html),
        flash: await flashOf(r, location),
        value: hasForm ? ((f.values[field] as string | undefined) ?? '') : null,
        alert: which === 'groupAdminMessage' && hasForm ? f.values['msgAlert'] === 'true' : null,
      };
    },
    usersHome: async (r) => {
      const res = await r.get('/admin/user', { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      return { status: res.status(), location, text: textOf(html), flash: await flashOf(r, location), offersSearch: html.includes('action="/admin/user/search"') };
    },
    userSearch: async (r, q) => {
      const res = await r.get(`/admin/user/search?search=${encodeURIComponent(q)}`, { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      const users = [...html.matchAll(/<tr>\s*<td>\s*#(\d+)\s*<\/td>\s*<td>\s*<a href="\/admin\/user\/view\/\d+">([\s\S]*?)<\/a>\s*<\/td>\s*<td>([\s\S]*?)<\/td>/g)].map((m) => ({ id: Number(m[1]), name: cellText(m[2]), email: cellText(m[3]) }));
      return { status: res.status(), location, text: textOf(html), flash: await flashOf(r, location), users };
    },
    user: async (r, userId) => {
      const res = await r.get(`/admin/user/view/${userId}`, { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      const bold = (label: string) => new RegExp(`${label}\\s*<b>([\\s\\S]*?)</b>`).exec(html)?.[1];
      const memberships = [...html.matchAll(/<a href="\/admin\/user\/userGroup\/\d+\/(\d+)">[\s\S]*?<\/a>\s*<\/td>\s*<td>([\s\S]*?)<\/td>/g)].map((m) => ({
        groupId: Number(m[1]),
        rights: cellText(m[2]).replace(/\s*-\s*$/, ''),
      }));
      const orders = /Nbre de commandes : <a [^>]*>(\d+)<\/a>/.exec(html)?.[1];
      return {
        status: res.status(),
        location,
        text: textOf(html),
        flash: await flashOf(r, location),
        phone: bold('Tel\\.') != null ? cellText(bold('Tel\\.')!) : null,
        email: bold('Email') != null ? cellText(bold('Email')!) : null,
        orderCount: orders == null ? null : Number(orders),
        memberships,
        offers: { loginAs: html.includes(`href="/member/loginas/${userId}"`), delete: html.includes(`/admin/user/delete/${userId}`) },
      };
    },
    userGroup: async (r, userId, groupId) => {
      const res = await r.get(`/admin/user/userGroup/${userId}/${groupId}`, { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      const operations = /<h3>Operations<\/h3>([\s\S]*)/.exec(html)?.[1] ?? '';
      const orders = /<h3>Dernières commandes<\/h3>([\s\S]*?)<h3>Operations/.exec(html)?.[1] ?? '';
      const rows = [...orders.matchAll(/<tr>\s*<td[^>]*>\s*MultiDistrib #(\d+)[\s\S]*?<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/g)];
      return {
        status: res.status(),
        location,
        text: textOf(html),
        flash: await flashOf(r, location),
        memberName: /<h2>\s*<a [^>]*>([\s\S]*?)<\/a>/.exec(html)?.[1] != null ? cellText(/<h2>\s*<a [^>]*>([\s\S]*?)<\/a>/.exec(html)![1]) : null,
        groupName: /dans le groupe <a [^>]*>([\s\S]*?)<\/a>/.exec(html)?.[1] != null ? cellText(/dans le groupe <a [^>]*>([\s\S]*?)<\/a>/.exec(html)![1]) : null,
        // every operation row has a state icon (done / pending)
        operationCount: (operations.match(/fa-check|fa-circle-thin/g) ?? []).length,
        distributionIds: rows.map((m) => Number(m[1])),
        basketIds: rows.map((m) => {
          const b = /Panier #(\d+)/.exec(m[2]);
          return b ? Number(b[1]) : null;
        }),
      };
    },
    groups: async (r, search) => {
      const q = new URLSearchParams();
      if (search) {
        // a GET form like any sugoi form: it carries a security token
        const token = new RegExp('value="([0-9a-f]+)"\\s+name="groups_token"').exec(await (await r.get('/admin/group', { maxRedirects: 0 })).text())?.[1];
        if (token) q.set('groups_token', token);
        q.set('groups_formSubmitted', 'true');
        q.set('groups_groupName', search.name ?? '');
        if (search.zipCodes != null) q.set('groups_zipCodes', search.zipCodes);
      }
      const res = await r.get(`/admin/group${search ? `?${q.toString()}` : ''}`, { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      const groups = [...html.matchAll(/<tr>\s*<td>(\d+)<\/td>\s*<td>\s*<a href="\/admin\/group\/view\/\d+"[^>]*>([\s\S]*?)<\/a>\s*<\/td>\s*<td>([\s\S]*?)<\/td>\s*<td>([\s\S]*?)<\/td>/g)].map((m) => ({
        id: Number(m[1]),
        name: cellText(m[2]),
        zipPrefix: cellText(m[3]) || null,
        // a group without a place prints "null"
        country: cellText(m[4]) === 'null' ? null : cellText(m[4]) || null,
      }));
      return { status: res.status(), location, text: textOf(html), flash: await flashOf(r, location), groups };
    },
    group: async (r, groupId) => {
      const res = await r.get(`/admin/group/view/${groupId}`, { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      const section = (title: string) => new RegExp(`<h3>${title}</h3>([\\s\\S]*?)(?:<hr/>|$)`).exec(html)?.[1] ?? '';
      const ids = (block: string) => [...block.matchAll(/<tr>\s*<td>(\d+)<\/td>/g)].map((m) => Number(m[1]));
      return {
        status: res.status(),
        location,
        text: textOf(html),
        flash: await flashOf(r, location),
        memberIds: ids(section('Membres')),
        vendorIds: ids(section('Producteurs')),
        catalogIds: ids(section('Catalogues')),
        offers: { addMe: html.includes(`/admin/group/addMe/${groupId}`), delete: html.includes(`/admin/group/deleteGroup/${groupId}`) },
      };
    },
  },
  platform: {
    // controller/Main.hx doDefault, doPing, doTos, doCssdemo; controller/Install.hx
    home: (r) => view(r, '/'),
    // controller/Main.hx doDefault(permalink): no such permalink -> Error("/home", ...)
    unknownPath: (r, path) => view(r, `/${encodeURIComponent(path)}`),
    ping: async (r) => {
      const res = await r.get('/ping', { maxRedirects: 0 });
      const text = await res.text();
      let version: string | null = null;
      try {
        version = (JSON.parse(text) as { version?: string }).version ?? null;
      } catch {
        /* not JSON */
      }
      return { status: res.status(), location: res.headers()['location'] ?? null, text, flash: null, version };
    },
    // the redirect leaves the platform: do not follow it to read a flash message
    termsOfService: async (r) => {
      const res = await r.get('/tos', { maxRedirects: 0 });
      return { status: res.status(), location: res.headers()['location'] ?? null, text: textOf(await res.text()), flash: null };
    },
    styleGuide: (r) => view(r, '/cssdemo'),
    diagnostics: (r) => view(r, '/install/diagnostics'),
    // lang/master/tpl/macros.mtt googleTagManager: the id comes from the Variable "googleTagManagerId"
    analyticsId: async (r) => {
      const res = await r.get('/user/login', { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      return { status: res.status(), location, text: textOf(html), flash: await flashOf(r, location), analyticsId: /'dataLayer',\s*'([^']+)'/.exec(html)?.[1] ?? null };
    },
    install: (r) => view(r, '/install'),
    // lang/master/tpl/base.mtt (html lang, title, _Camap.theme, bundles), macros.mtt footer()
    layout: async (r, page, opts) => {
      const res = await r.get(`${page === 'login' ? '/user/login' : '/user/choose'}${opts?.ask != null ? `?lang=${encodeURIComponent(opts.ask)}` : ''}`, { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      const theme = /_Camap\.theme = \{\s*id: "([^"]*)",\s*name: "([^"]*)",\s*supportEmail: "([^"]*)"/.exec(html);
      const footer = /id="footer"([\s\S]*?)id="subfooter"/.exec(html)?.[1];
      return {
        status: res.status(),
        location,
        text: textOf(html),
        flash: await flashOf(r, location),
        language: /<html lang="([^"]*)"/.exec(html)?.[1] ?? null,
        title: /<title>([\s\S]*?)<\/title>/.exec(html)?.[1].trim() ?? null,
        theme: theme ? { id: theme[1], name: theme[2], supportEmail: theme[3] } : null,
        footer: footer == null ? null : { images: [...footer.matchAll(/<img[^>]*\ssrc="([^"]*)"/g)].map((m) => m[1]), text: textOf(footer) },
        widgetBundles: [...html.matchAll(/<script src="(\/neostatic\/[^"]*)"/g)].map((m) => m[1]),
        interfaceLanguage: /_Camap\.lang = "([^"]*)"/.exec(html)?.[1] ?? null,
      };
    },
    // service/BridgeService.hx getNeoModuleScripts: /neostatic/manifest.json, keys read in this order
    widgetManifest: async (r) => {
      const res = await r.get('/neostatic/manifest.json', { maxRedirects: 0 });
      const manifest = (res.ok() ? await res.json() : {}) as Record<string, unknown>;
      const bundles = ['runtime.js', 'vendors.js', 'reactlibs.js', 'neo.js', 'app.js']
        .map((key) => manifest[key])
        .filter((v): v is string => v != null)
        .map((v) => String(v).replace(/^https?:\/\/[^/]+/, ''));
      return { status: res.status(), bundles: bundles.map((b) => (b.startsWith('/neostatic/') ? b : `/neostatic/${b.replace(/^\//, '')}`)) };
    },
    // camap-ts main.ts: only the bundles and translation files are served as static folders (proxied by the hx web server)
    assetFolder: async (r, folder) => {
      const res = await r.get({ widgets: '/neostatic/', translations: '/locales/', frenchTranslations: '/locales/fr/' }[folder], { maxRedirects: 0, headers: { accept: 'text/html' } });
      return { status: res.status(), isWebPage: /text\/html/.test(res.headers()['content-type'] ?? '') };
    },
    // Nest serves /locales/<language>/<namespace>.json (proxied by the hx web server)
    translations: async (r, language) => {
      const res = await r.get(`/locales/${encodeURIComponent(language)}/translation.json`, { maxRedirects: 0 });
      let body: Record<string, unknown> | null = null;
      try {
        body = JSON.parse(await res.text());
      } catch {
        /* not JSON */
      }
      return { status: res.status(), body };
    },
    // controller/Account.hx doDefault (?lang=): the page offers no language links
    accountLanguage: async (r, ask) => {
      const res = await r.get(`/account${ask != null ? `?lang=${encodeURIComponent(ask)}` : ''}`, { maxRedirects: 0 });
      const html = await res.text();
      const location = res.headers()['location'] ?? null;
      return {
        status: res.status(),
        location,
        text: textOf(html),
        flash: await flashOf(r, location),
        language: /<html lang="([^"]*)"/.exec(html)?.[1] ?? null,
        offersLanguageChoice: /href="\?lang=/.test(html),
      };
    },
  },
  history: {
    // controller/History.hx
    home: (r) => view(r, '/history'),
    basket: (r, id) => view(r, `/history/basket/${id}`),
    catalogOrders: (r, id) => view(r, `/history/orders/${id}`),
    subscriptionOrders: (r, id) => view(r, `/history/subscriptionOrders/${id}`),
    subscriptionPayments: (r, id) => view(r, `/history/subscriptionPayments/${id}`),
  },
};

/** Minimal CSV reader for sugoi's printCsvDataFromObjects (";"-separated, quoted when needed). */
function parseCsv(raw: string): { header: string[]; rows: Record<string, string>[] } {
  const text = raw.replace(/^\uFEFF/, '');
  const sep = (text.split('\n', 1)[0].match(/;/g) ?? []).length >= (text.split('\n', 1)[0].match(/,/g) ?? []).length ? ';' : ',';
  const lines: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) (row.push(cell), (cell = ''));
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      lines.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length) (row.push(cell), lines.push(row));
  const [header = [], ...body] = lines.filter((l) => l.some((x) => x !== ''));
  return { header, rows: body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? '']))) };
}

async function csv(request: APIRequestContext, url: string): Promise<CsvResult> {
  const res = await request.get(url, { maxRedirects: 0 });
  const raw = await res.text();
  const contentType = res.headers()['content-type'] ?? null;
  if (res.status() !== 200 || !/csv|octet|excel/i.test(contentType ?? '')) return { status: res.status(), contentType, header: [], rows: [], raw };
  return { status: res.status(), contentType, ...parseCsv(raw), raw };
}

export const hxExports: CamapApp['exports'] = {
  // controller/ContractAdmin.hx
  subscriptions: (r) => csv(r, '/contractAdmin/exportSubscriptions'),
  ordersByMember: (r, catalogId, distributionId) => csv(r, `/contractAdmin/orders/${catalogId}?d=${distributionId}&csv=1`),
  vendorTotals: (r, from, to) => csv(r, `/contractAdmin/vendorsByTimeFrame/${from}/${to}?csv=1`),
  productStats: (r, catalogId) => csv(r, `/contractAdmin/stats/${catalogId}?stat=1&csv=1`),
  dayAttendance: (r, date, placeId) => csv(r, `/distribution/listByDate/${date}/${placeId}/csv`),
  // controller/Product.hx doExport
  catalogProducts: (r, catalogId) => csv(r, `/product/export/${catalogId}`),
};
