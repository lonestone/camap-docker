/**
 * What a test may know about the app under test. Specs depend on this
 * interface only, never on hx URLs or selectors, so the same spec can run
 * against camap-hx today and camap-ts later (ROADBLOCKS F3).
 *
 * - urls:  logical routes.
 * - api:   typed clients for behaviour exposed over HTTP (hx `/api/*`).
 * - pages: page objects; they own every selector.
 * - auth:  how a browser/API session gets logged in.
 *
 * A target that has not ported a member yet leaves it out; the test is then
 * skipped as "not-ported" (see targets/ts/index.ts).
 */
import type { APIRequestContext, Page } from '@playwright/test';
import type { TargetName } from '../env.js';
import type { CronJob } from '../cron.js';
import type { RegOptionName } from '../encodings/flags.js';
import type { LoginPage } from './pages/login.js';
import type { HomePage } from './pages/home.js';
import type { LayoutPage } from './pages/layout.js';
import type { DateFormPage } from './pages/date-form.js';
import type { GroupPublicPage } from './pages/group-public.js';
import type { AttendanceSheetPage } from './pages/attendance-sheet.js';

export type Credentials = { email: string; password: string };

export type ApiResult<T = unknown> = { status: number; body: T };

/** What the catalog's absence rules show to anyone, with no subscription involved. */
export type CatalogAbsences = {
  startDate: string | null;
  endDate: string | null;
  absentDistribsMaxNb: number;
  possibleAbsentDistribs: { id: number }[];
};

export type SubscriptionAbsences = {
  startDate: string | null;
  endDate: string | null;
  absentDistribsNb: number;
  absentDistribIds: number[];
  closedDistribIds: number[];
  possibleAbsentDistribs: { id: number }[];
};

/** Order line as the hx subscription API returns it. */
export type SubscriptionDistribOrders = { id: number; orders: { id: number | null; productId: number; qty: number }[] };

export type SubscriptionDto = {
  id: number;
  startDate: string;
  endDate: string;
  user: { id: number; [k: string]: unknown };
  user2: { id: number; [k: string]: unknown } | null;
  catalogId: number;
  constraints: string | null;
  totalOrdered: number;
  balance: number;
  distributions: SubscriptionDistribOrders[];
  absentDistribIds: number[];
  defaultOrder: { productId: number; productPrice: number; quantity: number; userId2?: number; invertSharedOrder?: boolean }[];
  minSubscriptionOrder: number | null;
};

export type DefaultOrderLine = { productId: number; productPrice: number; quantity: number; userId2?: number; invertSharedOrder?: boolean };
export type OrdersByDistrib = { id: number; orders: { productId: number; qty: number }[] }[];

export type NewSubscriptionBody = {
  userId: number;
  catalogId: number;
  defaultOrder: DefaultOrderLine[];
  absentDistribIds: number[];
  initialOrders: OrdersByDistrib;
};

export type OrderLineBody = { id?: number | null; productId: number; qt: number; paid?: boolean; invertSharedOrder?: boolean; userId2?: number | null };

/** Result of a non-JSON action (a link or form post): status and where it redirects. */
export type Flash = { kind: 'ok' | 'error'; text: string };
/** A rendered page, reduced to what a test may assert on. */
export type PageView = { status: number; location: string | null; text: string; flash: Flash | null };

/** What the shared page layout carries: language, title, the theme given to the browser, footer, widget bundles. */
export type PageLayout = {
  language: string | null;
  title: string | null;
  theme: { id: string; name: string; supportEmail: string } | null;
  /** The footer: the images it shows (logos) and its text. null when the page has no footer. */
  footer: { images: string[]; text: string } | null;
  /** The scripts of the interactive widgets, loaded at the end of the page. */
  widgetBundles: string[];
  /** The language the page hands to the interactive widgets (null when it hands none). */
  interfaceLanguage: string | null;
};

/** A CSV download: header names from the first row, then one object per row. */
export type CsvResult = { status: number; contentType: string | null; header: string[]; rows: Record<string, string>[]; raw: string };

export type ActionResult = {
  status: number;
  location: string | null;
  body: string;
  /** The message shown on the page the action redirects to, if any. */
  flash: Flash | null;
  /** Every message shown on that page, in order (hx can stack several: warnings, then the confirmation). */
  alerts?: Flash[];
};

/** Fields of the coordinator's subscription form. Dates are 'YYYY-MM-DD'. */
export type SubscriptionForm = {
  userId?: number;
  startDate: string;
  endDate: string;
  /** Default order: productId -> quantity. */
  quantities?: Record<number, number>;
  /** Second person per product (constant catalogs): productId -> userId. */
  user2?: Record<number, number>;
  invert?: Record<number, boolean>;
  absences?: number[];
};

/** Where a group-admin document lives: a catalog, or (left out) the session's current group. */
export type FileScope = { catalogId?: number };
/** The admin page of documents or images: the rows it lists, in order. */
export type FileListing = ActionResult & {
  ids: number[];
  names: string[];
  /** Visibility label shown on each row, mapped back to its value (null = none shown). */
  visibilities: (string | null)[];
  /** The "add" link is offered. */
  offersAdd: boolean;
};
/** A file to upload in a multipart form. */
export type UploadFile = { name: string; content: Buffer };
/** A stored file fetched through its public link. */
export type FileDownload = { status: number; contentType: string | null; body: Buffer };

export type ProductUnit = 'piece' | 'kilogram' | 'gram' | 'litre' | 'centilitre' | 'millilitre';

/** What the coordinator fills in on the product form. Anything left out keeps what the form pre-fills. */
export type ProductFormInput = Partial<{
  name: string;
  reference: string;
  price: number | string;
  description: string;
  /** null = empty field. */
  quantity: number | string | null;
  /** null = no unit chosen. */
  unit: ProductUnit | null;
  /** VAT rate in percent; null = no rate chosen. */
  vat: number | null;
  organic: boolean;
  variablePrice: boolean;
  multiWeight: boolean;
  bulk: boolean;
  active: boolean;
  /** Stock settings (only offered when the catalog has stock management). */
  stock: ProductStockInput;
}>;

/** One stock mode of a product (CAT-STK-002..005). `stock` null = empty field. */
export type ProductStockInput =
  | { mode: 'none' }
  | { mode: 'global'; stock: number | string | null }
  | { mode: 'perDistribution'; rule: 'always'; stock: number | string | null }
  /** Stock every `every`-th distribution, from `startDistributionId`; null = left empty. */
  | { mode: 'perDistribution'; rule: 'every'; every: 2 | 3 | 4 | null; startDistributionId: number | null; stock: number | string | null }
  | { mode: 'perDistribution'; rule: 'periods'; periods: { fromDistributionId: number; toDistributionId: number; stock: number | string }[] };

/** What the product form shows. */
export type ProductFormView = {
  status: number;
  location: string | null;
  /** Which inputs the form offers (an ordered product no longer offers price, quantity and unit). */
  offers: { price: boolean; quantity: boolean; unit: boolean; organic: boolean; variablePrice: boolean; multiWeight: boolean; bulk: boolean; stock: boolean };
  /** Pre-filled values. */
  values: { name: string; price: string; quantity: string; unit: ProductUnit | null; vat: number | null; active: boolean; organic: boolean };
  /** VAT rates on offer. */
  vatChoices: number[];
  /** The same, with the label the group gave each rate. */
  vatRates: { label: string; value: number }[];
  /** Units on offer, in order. */
  unitChoices: ProductUnit[];
  /** The page explains that price/quantity/unit cannot change and offers a "copy and deactivate" link. */
  offersCopy: boolean;
};

/** The product import page (coordinator's CSV import, three steps: choose a file, check the table, imported). */
export type ProductImportPage = ActionResult & {
  /** 1 = file chooser, 2 = preview of the rows read, 3 = result; null when the page is none of these (refusal, error). */
  step: 1 | 2 | 3 | null;
  /** Header and cells of the preview table (step 2). */
  previewHeader: string[];
  previewRows: string[][];
  /** The page offers to confirm the import (step 2, at least one row). */
  offersConfirm: boolean;
  /** "You imported N products" (step 3), null when the page says nothing was imported or is not step 3. */
  importedCount: number | null;
};

/** A product as the public product JSON describes it. */
export type ProductInfo = {
  id: number;
  name: string;
  ref: string | null;
  image: string;
  price: number;
  vat: number;
  qt: number | null;
  unitType: number | string | null;
  organic: boolean;
  active: boolean;
  catalogId: number;
  [k: string]: unknown;
};

export type CatalogPageDto = {
  id: number;
  name: string;
  description: string | null;
  type: number;
  vendor: { id: number; name: string; [k: string]: unknown };
  products: ProductInfo[];
  distributions: { id: number; orderStartDate: string; orderEndDate: string; [k: string]: unknown }[];
  documents: { name: string; url: string }[];
  constraints: string | null;
  absences: string | null;
  [k: string]: unknown;
};

export type CatalogKind = 'constant' | 'variable';
export type CatalogFlagName = 'usersCanOrder' | 'stockManagement' | 'percentage' | 'displayPrices' | 'notifyVendor' | 'notifyContact';

/** What the catalog creation / edit form shows. Dates are 'YYYY-MM-DD'. */
export type CatalogFormView = {
  status: number;
  location: string | null;
  title: string;
  name: string;
  startDate: string;
  endDate: string;
  contactRequired: boolean;
  /** User ids the contact can be picked from. */
  contactChoices: number[];
  /** Volunteers per distribution (creation only). */
  volunteers: number | null;
  flags: { offered: CatalogFlagName[]; checked: CatalogFlagName[] };
  offersPercentageFee: boolean;
  /** Which settings the form shows (they depend on the catalog type). */
  offers: { openingDelay: boolean; closingDelay: boolean; distribMinimum: boolean; catalogMinimum: boolean };
  /** Pre-filled delays; null when empty. */
  openingDelayDays: number | null;
  closingDelayHours: number | null;
};

/** Fields a coordinator fills in. Anything left out keeps the value the form pre-fills. Dates 'YYYY-MM-DD' or 'YYYY-MM-DD HH:MM'. */
export type CatalogFormInput = Partial<{
  name: string;
  startDate: string;
  endDate: string;
  contactId: number | null;
  volunteers: number;
  flags: CatalogFlagName[];
  description: string;
  /** Variable catalogs: days before a distribution when ordering opens (null = empty field). */
  openingDelayDays: number | null;
  /** Hours before a distribution when orders close, or the subscription deadline of a constant catalog (null = empty field). */
  closingDelayHours: number | null;
  /** Variable catalogs: minimum order total per distribution / for the whole catalog. */
  distribMinimum: number;
  catalogMinimum: number;
}>;

/** The vendor form. In `actions.vendors.edit` a field left out keeps what the form pre-fills; `null` sends it empty. */
/** The place form; every field optional (a blank form gets valid defaults). `null` posts the field empty. */
export type PlaceForm = Partial<{
  name: string;
  address1: string | null;
  address2: string | null;
  zipCode: string;
  city: string;
  country: string;
  lat: number | string | null;
  lng: number | string | null;
}>;

/** The superadmin's group creation form: the group name, then the first place. */
export type GroupCreationForm = PlaceForm & { groupName?: string };

/** The group admin's settings form: name, texts, website, joining mode, options, contact and legal representative. */
export type GroupSettingsForm = Partial<{
  name: string;
  /** Public page text. */
  txtIntro: string;
  /** Home page text for members. */
  txtHome: string;
  /** Text printed on the attendance lists. */
  txtDistrib: string;
  extUrl: string;
  regOption: RegOptionName;
  hidePhone: boolean;
  phoneRequired: boolean;
  addressRequired: boolean;
  contactId: number | null;
  legalRepresentativeId: number | null;
}>;

export type GroupSettingsView = {
  status: number;
  location: string | null;
  flash: Flash | null;
  /** What the form shows now. */
  values: { name: string; txtIntro: string; txtHome: string; txtDistrib: string; extUrl: string; regOption: RegOptionName | null; hidePhone: boolean; phoneRequired: boolean; addressRequired: boolean; contactId: number | null; legalRepresentativeId: number | null };
  /** The joining modes, the on/off options and the users the form offers for the two user fields. */
  offered: { regOptions: RegOptionName[]; options: string[]; userIds: number[] };
};

/** What a group admin ticks in the rights editor: the group rights, all catalogs, or chosen catalogs. */
export type RightsChoice = { groupAdmin?: boolean; membership?: boolean; messages?: boolean; allCatalogs?: boolean; catalogs?: number[] };

/** The rights editor: what it offers and what is ticked now. `members` = who can be picked (only when giving rights to a new person). */
export type RightsEditor = {
  status: number;
  location: string | null;
  members: number[] | null;
  /** group rights offered / ticked */
  groupRights: { offered: ('GroupAdmin' | 'Membership' | 'Messages')[]; checked: ('GroupAdmin' | 'Membership' | 'Messages')[] };
  /** catalog rights offered / ticked: 'all' or a catalog id */
  catalogRights: { offered: ('all' | number)[]; checked: ('all' | number)[] };
  /** the read-only list of rights a vendor gets automatically (labels) */
  automatic: string[];
};

/** One row of the list of members holding rights. */
export type RightsHolder = { userId: number; name: string; rights: string[] };

/** The settings pages the group admin dashboard links to. */
export type GroupAdminSection = 'settings' | 'rights' | 'vatRates' | 'volunteers' | 'membership' | 'places' | 'currency' | 'documents' | 'media' | 'payments';

export type GroupDto = { id: number; name: string; flags: number; hasMembership: boolean; membershipFee: number | null; currencyCode: string; extUrl: string | null; txtDistrib: string | null; iban: string | null; image: string | null };

export type PlaceFormView = {
  status: number;
  location: string | null;
  values: Record<string, string>;
  /** The countries the form offers (codes). */
  countries: string[];
  /** The country pre-selected. */
  country: string;
  /** Fields marked as required. */
  required: string[];
};

export type PlaceDto = { name: string; address1: string | null; address2: string | null; city: string; zipCode: string; lat: number | null; lng: number | null };

export type GroupOnMap = { id: number; name: string; placeId: number; place: { id: number; name: string; lat: number | null; lng: number | null } };

export type VendorForm = Partial<{
  name: string;
  email: string | null;
  zipCode: string;
  city: string;
  companyNumber: string | null;
  profession: number | null;
  address1: string;
  desc: string;
  linkUrl: string;
  linkText: string;
  phone: string;
  peopleName: string;
}> & {
  /** Tick the "I informed the vendor of their rights" box (default false). */
  gdpr?: boolean;
};

export type PaymentForm = { name?: string; amount: number; date?: string; type?: string; relatedOperationId?: number };

/** A distribution session (MultiDistrib). Dates 'YYYY-MM-DD', times 'HH:MM', order dates 'YYYY-MM-DD HH:MM'. */
export type SessionForm = { date: string; start: string; end: string; orderStart: string; orderEnd: string; placeId?: number; override?: boolean };
export type CycleForm = {
  type: 'Weekly' | 'Monthly' | 'BiWeekly' | 'TriWeekly';
  startDate: string;
  endDate: string;
  start: string;
  end: string;
  daysBeforeOrderStart: number;
  daysBeforeOrderEnd: number;
  opening: string;
  closing: string;
  placeId?: number;
};

export type VolunteerSettings = {
  daysAfterClosingBeforeHidingDutyPeriods: number;
  dutyperiodsopen: number;
  allowInformationNotifs: boolean;
  maildays: number;
  volunteersMailContent: string;
  allowAlertNotifs: boolean;
  alertmaildays: number;
  alertMailContent: string;
};

/** A session (MultiDistrib) as the GraphQL API returns it; dates are ISO instants. */
export type SessionDto = { id: number; groupId: number; placeId: number; distribStartDate: string; distribEndDate: string; orderStartDate: string; orderEndDate: string };

/** What the group's distributions page shows: its state label per session, in display order, and its cycles. */
export type SessionsOverview = {
  status: number;
  /** 'none' = "no variable orders" block; otherwise the order window state of the session ('unknown' = a label that is none of these). */
  states: ('none' | 'notYetOpen' | 'open' | 'closed' | 'distributed' | 'validated' | 'unknown')[];
  cycleCount: number;
};

export type VolunteerCalendar = {
  multiDistribs: {
    id: number;
    hasVacantVolunteerRoles: boolean;
    canVolunteersJoin: boolean;
    volunteersRequired: number;
    volunteersRegistered: number;
    hasVolunteerRole: Record<string, boolean>;
    volunteerForRole: Record<string, { id: number; coupleName: string } | null>;
  }[];
  roles: { id: number; name: string }[];
};

export type MembershipDto = { id: string; userId: number; groupId: number; year: number; name: string; amount: number; date: string; operationId: number | null; distributionId: number | null };
export type NewMembership = { groupId: number; /** membership year; left out = the current one */ year?: number; /** 'YYYY-MM-DD' */ date: string; /** chosen payment type (hx/ts ignore it, GRP-COT-008) */ paymentType?: string; membershipFee?: number | null; distributionId?: number | null };
export type MembershipFormData = { membershipFee: number | null; availableYears: { id: number; name: string }[]; distributions: { id: number; groupId: number; placeId: number; distribStartDate: string }[] };
export type WaitingListEntry = { amapId: number; userId: number; date: string; message: string; user: { id: number; firstName: string; lastName: string } };
export type MemberList = { type: string; count: number | null; data: string | null };
/** A person to import: the fields of the CSV import. */
export type ImportedPerson = { firstName: string; lastName: string; email: string; phone?: string; address1?: string; address2?: string; zipCode?: string; city?: string; email2?: string; firstName2?: string; lastName2?: string; phone2?: string };
export type ImportMembersInput = { groupId: number; /** ids of people who already have an account */ withAccounts: number[]; /** people to create */ withoutAccounts: ImportedPerson[] };
export type GraphqlResult<T = any> = { status: number; data: T | null; errors: { message: string }[] | null; setCookies: string[] };
export type MessageDto = { id: number; title: string; body: string; amapId: number | null; senderId: number; recipientListId: string | null; recipients?: string[] };
export type NewMessage = {
  title: string;
  htmlBody: string;
  senderName: string;
  senderEmail: string;
  recipients: { email: string; id?: number; firstName?: string; lastName?: string }[];
  group: { id: number; name: string };
  list?: { type: string; name?: string };
};

/** Where the back-office sidebar and its dashboard shortcuts lead, by purpose. */
export type AdminLink = 'database' | 'errors' | 'emails' | 'homeMessage' | 'groupMessage' | 'groupAdminMessage' | 'groups' | 'users' | 'theme' | 'reloadTheme' | 'superadmins';
/** The three platform messages a superadmin edits: for every member, for the members holding rights, on the group chooser page. */
export type PlatformMessage = 'groupMessage' | 'groupAdminMessage' | 'homeMessage';
/** The sheet of a user in the back-office. */
export type AdminUserView = PageView & {
  phone: string | null;
  email: string | null;
  orderCount: number | null;
  memberships: { groupId: number; rights: string }[];
  offers: { loginAs: boolean; delete: boolean };
};
/** A recorded application error, as the error log lists it. */
export type ErrorLogEntry = { id: number; date: string; message: string; ip: string | null; userAgent: string | null; userId: number | null; url: string };
/** An unsent email, as the back-office email queue lists it. */
export type UnsentMailEntry = { id: number; tries: number; title: string; canRetry: boolean };
/** A row of the superadmin back-office group list. */
export type AdminGroupRow = { id: number; name: string; zipPrefix: string | null; country: string | null };
/** A group as the back-office shows it: its members, vendors and catalogs, and what it offers the superadmin. */
export type AdminGroupView = PageView & {
  memberIds: number[];
  vendorIds: number[];
  catalogIds: number[];
  offers: { addMe: boolean; delete: boolean };
};

export interface CamapApp {
  readonly name: TargetName;

  urls: {
    home(): string;
    login(): string;
    groupPage(groupId: number): string;
    /** The notice shown for a disabled group (the session's current group when no id is given). */
    groupDisabled(groupId?: number): string;
    /** The dashboard of a catalog (where creating one lands). */
    catalogDashboard(catalogId: number): string;
    cron(job: CronJob): string;
  };

  auth: {
    /** Open the anonymous session the app needs before a login (hx: GET the login page); returns its `sid`. */
    sid(request: APIRequestContext): Promise<string>;
    /** Log `request` in as `user`; its cookie jar then holds a full session. */
    login(request: APIRequestContext, user: Credentials): Promise<void>;
    /** Close the user's session on the platform side only (the GraphQL login cookies stay): what a session expiry leaves behind. */
    endPlatformSession(request: APIRequestContext): Promise<void>;
    /**
     * A copy of `request`'s cookie jar after something went wrong with the login cookies, as a new context (the
     * caller disposes it): `dropAccessToken` = the short-lived token is gone (expired), `invalidateTokens` = both
     * the access and the renewal token are unusable, `desyncSession` = the cookie shared by the platform and the
     * API holds another session id than the platform's own.
     */
    tamper(request: APIRequestContext, kind: 'dropAccessToken' | 'invalidateTokens' | 'desyncSession'): Promise<APIRequestContext>;
  };

  /**
   * The GraphQL API of camap-ts (Apache proxies /graphql to Nest on the hx origin). Specs of the
   * domains served by Nest use it directly: the schema is the contract both targets share.
   */
  graphql<T = any>(request: APIRequestContext, query: string, variables?: Record<string, unknown>): Promise<GraphqlResult<T>>;

  api: {
    /** The JSON API of the logged-in user (hx /api/user/me), used by the ordering widgets. */
    users: {
      me(request: APIRequestContext): Promise<ApiResult<{ id?: number; address1?: string | null; address2?: string | null; city?: string | null; zipCode?: string | null; phone?: string | null }>>;
      updateContact(request: APIRequestContext, fields: { address1?: string; address2?: string; city?: string; zipCode?: string; phone?: string }): Promise<ApiResult<{ id?: number; address1?: string | null; city?: string | null; zipCode?: string | null; phone?: string | null }>>;
      /** The members of the session's current group, as the coordinator's order dialog lists them (needs a login; members are refused). */
      fromGroup(request: APIRequestContext): Promise<ApiResult<{ users: { id: number; firstName?: string; lastName?: string }[] }>>;
    };
    messages: {
      create(request: APIRequestContext, m: NewMessage): Promise<GraphqlResult<{ createMessage: MessageDto }>>;
      forGroup(request: APIRequestContext, groupId: number): Promise<GraphqlResult<{ getMessagesForGroup: MessageDto[] }>>;
      mineInGroup(request: APIRequestContext, groupId: number): Promise<GraphqlResult<{ getUserMessagesForGroup: MessageDto[] }>>;
      byId(request: APIRequestContext, id: number): Promise<GraphqlResult<{ message: MessageDto }>>;
      latest(request: APIRequestContext): Promise<GraphqlResult<{ getLatestMessages: MessageDto[] }>>;
    };
    distributions: {
      volunteerRolesCalendar(request: APIRequestContext, from: string, to: string): Promise<ApiResult<VolunteerCalendar>>;
      unsubscribeFromRole(request: APIRequestContext, sessionId: number, roleId: number): Promise<ApiResult<{ success?: boolean }>>;
      /** The calendar API (JSON): the raw `distribStartDate` of every session of a period (hx writes it with a UTC offset). */
      sessionDates(request: APIRequestContext, from: string, to: string): Promise<ApiResult<{ multiDistribs: { id: number; distribStartDate: string }[] }>>;
      /** GraphQL: the sessions of a group in a period (coordinator of all catalogs); `nextIfEmpty` returns the next session when none is found. */
      multiDistribs(request: APIRequestContext, groupId: number, from: string, to: string, opts?: { nextIfEmpty?: boolean }): Promise<GraphqlResult<{ multiDistribs: SessionDto[] }>>;
      /** GraphQL: the sessions of a group that already took place, listed apart. */
      distributedMultiDistribs(request: APIRequestContext, groupId: number): Promise<GraphqlResult<{ distributedMultiDistribs: SessionDto[] }>>;
      /** GraphQL: one session with its volunteers and the roles it needs. */
      multiDistrib(request: APIRequestContext, sessionId: number): Promise<GraphqlResult<{ multiDistribution: SessionDto & { volunteers: { userId: number; volunteerRoleId: number }[]; volunteerRoles: { id: number; name: string }[] } }>>;
      /** GraphQL: one catalog distribution with the orders placed on it. */
      distribution(request: APIRequestContext, distributionId: number): Promise<GraphqlResult<{ distribution: { id: number; catalogId: number; multiDistrib: { id: number }; userOrders: { id: number; userId: number }[] } }>>;
      /** GraphQL: the distribution cycles of a group that have not ended (coordinator of all catalogs). */
      cycles(request: APIRequestContext, groupId: number): Promise<GraphqlResult<{ distributionCycles: { id: number; groupId: number; endDate: string }[] }>>;
      /** GraphQL: the attendance of a constant-orders catalog over a period (the catalog dates when left out). */
      attendanceClassic(request: APIRequestContext, catalogId: number, period?: { startDate: string; endDate: string }): Promise<GraphqlResult<{ attendanceClassicContract: { catalog: { id: number }; subscriptions: { id: number; absentDistribIds: string | null }[]; distributions: { id: number }[] } }>>;
      /** GraphQL: the attendance of a variable-orders catalog for one distribution. */
      attendanceVariable(request: APIRequestContext, catalogId: number, distributionId: number): Promise<GraphqlResult<{ attendanceVariableContract: { catalog: { id: number }; distribution: { id: number }; subscriptions: { id: number }[] } }>>;
      /**
       * GraphQL: the data the attendance sheet export (CSV / XLSX, built in the browser) is made of for its header:
       * the group, the catalog, its coordinator, its vendor, and (variable catalog, one distribution) the session's volunteers.
       */
      attendanceSheetHeader(request: APIRequestContext, catalogId: number, distributionId?: number): Promise<GraphqlResult<{ sheet: AttendanceSheetHeader }>>;
    };
    /** Failures of the JSON API (what a client receives when a request goes wrong). */
    platform: {
      /** A request the API cannot even route (a malformed id): an unexpected error. */
      unexpectedFailure(request: APIRequestContext): Promise<ApiResult<{ error?: { code?: number; message?: string; stack?: string } }>>;
    };
    places: {
      /** The public JSON of one place (hx /api/places/:id). */
      get(request: APIRequestContext, placeId: number): Promise<ApiResult<PlaceDto>>;
      /** A write attempt on the place endpoint (it is read-only). */
      write(request: APIRequestContext, placeId: number): Promise<ApiResult<unknown>>;
      /** GraphQL: one place by id. */
      byId(request: APIRequestContext, placeId: number): Promise<GraphqlResult<{ place: { id: number; name: string; city: string; zipCode: string; address1: string | null; address2: string | null; country: string | null; lat: number | null; lng: number | null } }>>;
      /** GraphQL: the groups and places of the map, in a zone or near a position. */
      onMap(
        request: APIRequestContext,
        area: { minLat: number; maxLat: number; minLng: number; maxLng: number } | { lat: number; lng: number } | Record<string, never>,
      ): Promise<GraphqlResult<{ getGroupsOnMap: GroupOnMap[] }>>;
    };
    groups: {
      /** GraphQL: the data of a group, for its admin. */
      get(request: APIRequestContext, groupId: number): Promise<GraphqlResult<{ group: GroupDto }>>;
      /** GraphQL: set the image of a group. `base64` is the raw base64 of the file. */
      setImage(
        request: APIRequestContext,
        p: { groupId: number; base64: string; mimeType: string; fileName: string; maxWidth: number },
      ): Promise<GraphqlResult<{ setGroupImage: { id: number; image: string | null } }>>;
      /** GraphQL: the logged-in user quits a group. */
      quit(request: APIRequestContext, groupId: number): Promise<GraphqlResult<{ quitGroup: { userId: number; groupId: number } }>>;
      /** GraphQL: quit a group with the personal key of an email footer (no login needed). */
      quitByControlKey(request: APIRequestContext, p: { groupId: number; userId: number; controlKey: string }): Promise<GraphqlResult<{ quitGroupByControlKey: { userId: number; groupId: number } }>>;
    };
    members: {
      /** GraphQL: the preview of the group a membership manager gets (id, name, membership fee). */
      preview(request: APIRequestContext, groupId: number): Promise<GraphqlResult<{ groupPreviewMembers: { id: number; name: string; hasMembership: boolean; membershipFee: number | null } }>>;
      /** GraphQL: the member lists of a group with their counts (whole group, by status). */
      lists(request: APIRequestContext, groupId: number): Promise<GraphqlResult<{ getUserLists: MemberList[] }>>;
      /** GraphQL: one list per active catalog (`data` = the catalog as JSON). */
      listsByCatalog(request: APIRequestContext, groupId: number): Promise<GraphqlResult<{ getContractsUserLists: MemberList[] }>>;
      /** GraphQL: one list per distribution of the next two weeks (`data` = the distribution as JSON). */
      listsByDistribution(request: APIRequestContext, groupId: number): Promise<GraphqlResult<{ getDistributionsUserLists: MemberList[] }>>;
      /** GraphQL: the people of one list; `data` is the catalog or distribution id for those lists. */
      listUsers(request: APIRequestContext, p: { listType: string; groupId: number; data?: string }): Promise<GraphqlResult<{ getUserListInGroupByListType: { id: number; firstName: string; lastName: string; email: string }[] }>>;
      /** GraphQL: the data of one member in a group (null when not a member). */
      get(request: APIRequestContext, groupId: number, userId: number): Promise<GraphqlResult<{ userGroup: { groupId: number; userId: number; balance: number; hasValidMembership: boolean } | null }>>;
      /** GraphQL: remove people from a group. */
      remove(request: APIRequestContext, groupId: number, userIds: number[]): Promise<GraphqlResult<{ removeUsersFromGroup: { success: { groupId: number; userId: number }[]; errors: { userId: number; message: string }[] } }>>;
      /** GraphQL: create the accounts of people who have none and add everybody to the group, then mail them. */
      importAndCreate(request: APIRequestContext, p: ImportMembersInput): Promise<GraphqlResult<{ importAndCreateMembers: { withoutAccounts: string[]; withAccounts: number[] } }>>;
      /** GraphQL: mail an invitation to people instead of creating their accounts. */
      invite(request: APIRequestContext, p: ImportMembersInput): Promise<GraphqlResult<{ sendInvitesToNewMembers: { withoutAccounts: string[]; withAccounts: number[] } }>>;
    };
    waitingList: {
      /** GraphQL: the people waiting to join a group, with their message. */
      of(request: APIRequestContext, groupId: number): Promise<GraphqlResult<{ getWaitingListsOfGroup: WaitingListEntry[] }>>;
      /** GraphQL: accept a request: the person becomes a member, the request disappears, mails go out. */
      approve(request: APIRequestContext, groupId: number, userId: number): Promise<GraphqlResult<{ approveRequest: { groupId: number; userId: number } }>>;
      /** GraphQL: refuse a request: it disappears and the person is mailed. */
      refuse(request: APIRequestContext, groupId: number, userId: number): Promise<GraphqlResult<{ cancelRequest: { amapId: number; userId: number } }>>;
      /** GraphQL: put members back on the waiting list. Refusals (self, admin, not a member) come back in `errors`. */
      moveBack(request: APIRequestContext, groupId: number, userIds: number[], message: string): Promise<GraphqlResult<{ moveBackToWaitingList: { success: { amapId: number; userId: number; message: string }[]; errors: { userId: number; message: string }[] } }>>;
    };
    memberships: {
      /** GraphQL: the memberships of a member in a group, newest first. `ignoreIfNotAllowed` gives an empty list instead of an error. */
      of(request: APIRequestContext, groupId: number, userId: number, opts?: { ignoreIfNotAllowed?: boolean }): Promise<GraphqlResult<{ getUserMemberships: MembershipDto[] }>>;
      /** GraphQL: what the membership dialog offers (proposed fee, years, recent distributions). */
      formData(request: APIRequestContext, groupId: number, userId: number): Promise<GraphqlResult<{ getMembershipFormData: MembershipFormData }>>;
      /** GraphQL: record the membership of one member. `name` cannot be selected: the mutation does not set it (the field is non-null, so selecting it fails the whole response). */
      create(request: APIRequestContext, userId: number, m: NewMembership): Promise<GraphqlResult<{ createMembership: Omit<MembershipDto, 'name'> }>>;
      /** GraphQL: record memberships for several members; the ones who already have it are reported in `errors`. */
      createMany(request: APIRequestContext, userIds: number[], m: NewMembership): Promise<GraphqlResult<{ createMemberships: { success: Omit<MembershipDto, 'name'>[]; errors: { userId: number; message: string }[] } }>>;
      /** GraphQL: delete a membership (and its payment and debt). Returns the membership id. */
      delete(request: APIRequestContext, groupId: number, userId: number, year: number): Promise<GraphqlResult<{ deleteMembership: string }>>;
    };
    operations: {
      /** GraphQL: validate a pending payment (optionally setting its concrete on-the-spot type). Needs the all-catalogs right. */
      validate(request: APIRequestContext, operationId: number, type?: string): Promise<GraphqlResult<{ validateOperation: { id: number; pending: boolean; amount: number; type: string; data: { type?: string } | null } }>>;
      /** GraphQL: delete an operation; returns its id. Needs the all-catalogs right. */
      delete(request: APIRequestContext, operationId: number): Promise<GraphqlResult<{ deleteOperation: number | null }>>;
    };
    catalogStock: {
      /** Available stock of every product at every future distribution of a catalog: null without stock management, else productId -> distributionId -> available stock (a product with no stock tracking has no entry). */
      perProductDistribution(request: APIRequestContext, catalogId: number): Promise<ApiResult<Record<string, Record<string, number | null>> | null>>;
    };
    subscription: {
      /** Anonymous or logged-in GET /api/subscription/:id */
      get(request: APIRequestContext, subscriptionId: number): Promise<ApiResult<SubscriptionDto>>;
      create(request: APIRequestContext, body: NewSubscriptionBody): Promise<ApiResult<SubscriptionDto>>;
      updateOrders(request: APIRequestContext, subscriptionId: number, distributions: OrdersByDistrib): Promise<ApiResult<SubscriptionDto>>;
      updateDefaultOrder(request: APIRequestContext, subscriptionId: number, defaultOrder: DefaultOrderLine[]): Promise<ApiResult<SubscriptionDto>>;
      checkDefaultOrder(request: APIRequestContext, catalogId: number, defaultOrder: DefaultOrderLine[]): Promise<ApiResult<{ defaultOrderCheck?: boolean }>>;
    };
    order: {
      catalogs(request: APIRequestContext, multiDistribId: number, catalogType?: number): Promise<ApiResult<{ success: boolean; catalogs: { id: number; name: string }[] }>>;
      get(request: APIRequestContext, userId: number, scope: { catalogId?: number; multiDistribId?: number }): Promise<ApiResult<{ success: boolean; orders: any[] }>>;
      update(request: APIRequestContext, userId: number, scope: { catalogId?: number; multiDistribId?: number }, orders: OrderLineBody[]): Promise<ApiResult<any>>;
      updateQuantity(request: APIRequestContext, userId: number, scope: { catalogId?: number; multiDistribId?: number }, order: { id: number; qt: number }): Promise<ApiResult<any>>;
    };
    products: {
      /** The public JSON of one product (hx /api/product/:id). */
      get(request: APIRequestContext, productId: number): Promise<ApiResult<ProductInfo>>;
      /** The public JSON listing a catalog's products. */
      ofCatalog(request: APIRequestContext, catalogId: number): Promise<ApiResult<{ products: ProductInfo[] }>>;
      /** GraphQL: stock tracking of a vendor's products, as the product type reports it. */
      vendorStockTracking(request: APIRequestContext, vendorId: number): Promise<GraphqlResult<{ vendorProductsSample: { id: number; stockTracking: 'Disabled' | 'Global' | 'PerDistribution' }[] }>>;
      /** GraphQL: a sample of a vendor's products, similar names merged. */
      vendorSample(request: APIRequestContext, vendorId: number): Promise<GraphqlResult<{ vendorProductsSample: { id: number; name: string }[] }>>;
      /** GraphQL: replace a product's image. `base64` is the raw base64 of the file. */
      setImage(
        request: APIRequestContext,
        p: { productId: number; base64: string; mimeType: string; fileName: string; maxWidth: number },
      ): Promise<GraphqlResult<{ setProductImage: { id: number; image: string } }>>;
    };
    catalog: {
      /** The public JSON of a catalog page: products, distributions, vendor, documents, constraints, absences. */
      get(request: APIRequestContext, catalogId: number): Promise<ApiResult<CatalogPageDto>>;
      /** GraphQL: the active catalogs of a group, those of a disabled vendor left out. */
      activeInGroup(request: APIRequestContext, groupId: number): Promise<GraphqlResult<{ getActiveCatalogs: { id: number; name: string }[] }>>;
      /** GraphQL: one catalog, for its coordinator. */
      managed(request: APIRequestContext, catalogId: number): Promise<GraphqlResult<{ catalog: { id: number; name: string; groupId: number } }>>;
      /** GraphQL: the subscriptions and products an active catalog exposes through its fields (UND-043). */
      fieldsOfActive(
        request: APIRequestContext,
        groupId: number,
      ): Promise<GraphqlResult<{ getActiveCatalogs: { id: number; subscriptionsCount: number; subscriptions: { id: number }[]; products: { id: number }[] }[] }>>;
      /** GraphQL: the subscriptions of a catalog (with their dates and member) as the batch ordering page reads them; for its coordinator. */
      subscriptionsOf(
        request: APIRequestContext,
        catalogId: number,
      ): Promise<GraphqlResult<{ catalog: { id: number; subscriptions: { id: number; startDate: string; endDate: string; user: { id: number } }[] } }>>;
      /** The absence rules of a catalog (period, maximum, distributions that can be chosen as absences). */
      absences(request: APIRequestContext, catalogId: number): Promise<ApiResult<CatalogAbsences>>;
      subscriptionAbsences: {
        get(request: APIRequestContext, subscriptionId: number): Promise<ApiResult<SubscriptionAbsences>>;
        post(
          request: APIRequestContext,
          subscriptionId: number,
          body: { absentDistribIds: number[] | null },
        ): Promise<ApiResult<SubscriptionAbsences>>;
      };
    };
  };

  /** CSV downloads (coordinator reports). */
  exports: {
    subscriptions(request: APIRequestContext): Promise<CsvResult>;
    ordersByMember(request: APIRequestContext, catalogId: number, distributionId: number): Promise<CsvResult>;
    vendorTotals(request: APIRequestContext, from: string, to: string): Promise<CsvResult>;
    productStats(request: APIRequestContext, catalogId: number): Promise<CsvResult>;
    /** Attendance of a whole distribution day at a place, as CSV. */
    dayAttendance(request: APIRequestContext, date: string, placeId: number): Promise<CsvResult>;
    /** The product list of a catalog, as the coordinator's "export" gives it. */
    catalogProducts(request: APIRequestContext, catalogId: number): Promise<CsvResult>;
  };

  /** Server-rendered pages read over HTTP (no browser): status, redirect, visible text. */
  views: {
    messages: {
      /** The group messages page (a neo shell): status and redirect only. */
      page(request: APIRequestContext): Promise<PageView>;
    };
    sessions: {
      /** The distributions page of the group: order window state per session, and cycles listed. */
      overview(request: APIRequestContext): Promise<SessionsOverview>;
      /** Editing a cycle and inviting vendors to a whole cycle: what the two links lead to today. */
      cycleStubs(request: APIRequestContext, cycleId: number): Promise<{ edit: PageView; inviteVendors: PageView }>;
      /** The page of a catalog's participation in sessions: session ids where it can join, and its distribution ids. `period` = the page's own period picker. */
      catalogSessions(request: APIRequestContext, catalogId: number, period?: { from: string; to: string }): Promise<{ status: number; joinable: number[]; participating: number[] }>;
      /** The page of the shift form of one catalog distribution: its text (warnings) and the sessions it offers as targets. */
      shiftForm(request: APIRequestContext, distributionId: number): Promise<PageView & { targets: number[] }>;
    };
    attendance: {
      /** The attendance sheet of one catalog distribution. */
      catalogSheet(request: APIRequestContext, distributionId: number): Promise<PageView>;
      /** Table of products by member for one distribution. */
      productsByMember(request: APIRequestContext, distributionId: number): Promise<PageView>;
      /** Sheet for a whole day and place: 'one' | 'contract' | 'all' | 'allshort'. */
      day(request: APIRequestContext, date: string, placeId: number, type: 'one' | 'contract' | 'all' | 'allshort'): Promise<PageView>;
      /** The display choices the day-sheet form offers. */
      dayFormChoices(request: APIRequestContext, date: string, placeId: number): Promise<string[]>;
    };
    /** The invoice page of a member for one distribution day (orders by VAT rate: excl. VAT, VAT, incl. VAT). */
    invoices: {
      ofMember(request: APIRequestContext, userId: number, multiDistribId: number): Promise<PageView>;
    };
    reports: {
      ordersByProduct(request: APIRequestContext, catalogId: number, distributionId: number): Promise<PageView>;
      purchaseOrder(request: APIRequestContext, catalogId: number, distributionId: number): Promise<PageView>;
      ordersByTimeFrame(request: APIRequestContext, from: string, to: string): Promise<PageView>;
    };
    member: {
      /** A member's operations, newest first, 10 per page (membership manager). */
      payments(request: APIRequestContext, userId: number, page?: number): Promise<PageView>;
      /** The group's members by balance: zero, credit, debt. */
      balances(request: APIRequestContext, opts?: { refresh?: boolean }): Promise<PageView>;
      /** The members page of the session's current group (membership manager). */
      list(request: APIRequestContext): Promise<PageView>;
      /** The sheet of one member: its page text, and what it offers (links by purpose) and the notification settings it shows. */
      sheet(request: APIRequestContext, userId: number): Promise<PageView & { offers: { payments: boolean; moveToWaitingList: boolean; loginAs: boolean; remove: boolean; membershipDialog: boolean }; notifications: { name: string; active: boolean }[]; subscriptionCount: number }>;
    };
    stocks: {
      /** The coordinator's stocks page of a catalog. */
      page(request: APIRequestContext, catalogId: number): Promise<PageView>;
    };
    shop: {
      /** The group home page, which lists the catalogs members can order from. */
      home(request: APIRequestContext): Promise<PageView>;
      /** The product information popup (price, VAT, unit, vendor); `distributionId` adds the distribution's own data. */
      productInfo(request: APIRequestContext, productId: number, distributionId?: number): Promise<PageView>;
    };
    orders: {
      /** The page of a catalog's orders for one distribution, as the coordinator sees it (the baskets and their lines). */
      distributionOrders(request: APIRequestContext, catalogId: number, distributionId: number): Promise<PageView>;
      /** The legacy "edit my variable orders" page of a session (GET, no change). */
      legacyVarOrdersPage(request: APIRequestContext, sessionId: number): Promise<PageView>;
      /** The coordinator page listing the temporary (open) baskets of a session. */
      temporaryBaskets(request: APIRequestContext, sessionId: number): Promise<PageView>;
      /** The batch ordering page of a catalog (a coordinator's page): the catalog and group ids it hands to its widget. */
      batchOrder(request: APIRequestContext, catalogId: number): Promise<PageView & { catalogId: number | null; groupId: number | null }>;
    };
    subscriptions: {
      /** The member's subscription page of a catalog: the ids it hands to the ordering screen (`subscriptionId` null = none). */
      subscriptionPage(request: APIRequestContext, catalogId: number): Promise<PageView & { catalogId: number | null; userId: number | null; subscriptionId: number | null }>;
      /** The member's orders page of the group (home), for the constant-catalog baskets shared with a second person: whose turn it is at each distribution that has such an order, in date order ('mine' = the logged-in user's turn). */
      sharedBasketTurns(request: APIRequestContext): Promise<('mine' | 'theirs')[]>;
    };
    vendors: {
      /** The public page of a vendor: what it shows of the vendor's contact details (null = not shown). */
      publicPage(request: APIRequestContext, vendorId: number): Promise<PageView & { email: string | null; phone: string | null }>;
      /** The vendor dashboard shell (a vendor user's own page); the tabs are drawn by the browser. */
      dashboard(request: APIRequestContext): Promise<PageView>;
    };
    catalogs: {
      /** The coordinator's list of catalogs of the current group; `old` = the ended ones. */
      list(request: APIRequestContext, opts?: { old?: boolean }): Promise<PageView>;
      /** The dashboard of one catalog. */
      dashboard(request: APIRequestContext, catalogId: number): Promise<PageView>;
    };
    groups: {
      /** The group page, with the documents and images it links (name and href). */
      page(request: APIRequestContext, groupId: number): Promise<PageView & { documents: { name: string; href: string }[]; images: { name: string; href: string }[] }>;
      /** The member's home page (the orders page of the session's current group). */
      home(request: APIRequestContext): Promise<PageView>;
      /** The messages that home page shows once (platform announcements included), in order. */
      homeAlerts(request: APIRequestContext): Promise<PageView & { alerts: Flash[] }>;
      /** The group chooser page: the platform message it shows (raw HTML, null when none), and whether it offers the vendor widget. */
      chooser(request: APIRequestContext): Promise<PageView & { messageHtml: string | null; offersVendorWidget: boolean }>;
      /** The open orders the home page lists: the catalogs it links to (their subscription pages), in order, and the ones it marks as already subscribed. */
      homeOpenOrders(request: APIRequestContext): Promise<PageView & { catalogs: { id: number; name: string }[]; subscribedIds: number[] }>;
      /** The public map page of groups. */
      map(request: APIRequestContext): Promise<PageView>;
      /** The public landing page about CSA (`name` = the group name it greets). */
      csa(request: APIRequestContext, name?: string): Promise<PageView>;
      /** The member's group page: the catalogs it lists. */
      catalogList(request: APIRequestContext): Promise<PageView & { catalogs: { id: number; name: string }[] }>;
      /** What the registration and login buttons of a group's public page ask for. `buttons` = how many of them the page shows. */
      groupPageRequirements(request: APIRequestContext, groupId: number): Promise<PageView & { buttons: number; phoneRequired: boolean; addressRequired: boolean }>;
      /** What the login page asks for, for the group remembered by the session. */
      loginPageRequirements(request: APIRequestContext): Promise<PageView & { buttons: number; phoneRequired: boolean; addressRequired: boolean }>;
      /** The notice page of a disabled group (the session's current group when no id is given); `groupId` = the group the page asks the notice for (null when it is not a notice). */
      disabledNotice(request: APIRequestContext, groupId?: number): Promise<PageView & { groupId: number | null }>;
    };
    groupAdmin: {
      /** The group administration dashboard: the member and active catalog counts, and the settings it links to. */
      dashboard(request: APIRequestContext): Promise<PageView & { memberCount: number | null; catalogCount: number | null; sections: GroupAdminSection[] }>;
      /** One settings page of the group. */
      section(request: APIRequestContext, section: GroupAdminSection): Promise<PageView>;
      /** The group settings form: the rich-text editor it offers for long texts (its language), null when none. */
      settingsEditor(request: APIRequestContext): Promise<PageView & { editor: { language: string } | null }>;
      /** The list of members holding rights. */
      rights(request: APIRequestContext): Promise<PageView & { holders: RightsHolder[] }>;
    };
    /** The superadmin back-office (reserved to superadmins: anyone else is sent to the home page). */
    admin: {
      /** The back-office home: what the sidebar links to, and the shortcuts shown on the page itself. */
      dashboard(request: APIRequestContext): Promise<PageView & { sidebar: AdminLink[]; shortcuts: AdminLink[] }>;
      /** The theme editing page. */
      theme(request: APIRequestContext): Promise<PageView>;
      /** The superadmins: one entry per row of the list. */
      superadmins(request: APIRequestContext): Promise<PageView & { users: { id: number; lastName: string; firstName: string; email: string }[] }>;
      /** The raw database administration tool. */
      database(request: APIRequestContext): Promise<PageView>;
      /** The theme editing page: the settings block it offers for editing. */
      themeSettings(request: APIRequestContext): Promise<PageView & { settings: string | null }>;
      /** The page editing one of the three platform messages: the text it offers, and (admin message only) whether the alert box is ticked. */
      messageSettings(request: APIRequestContext, which: PlatformMessage): Promise<PageView & { value: string | null; alert: boolean | null }>;
      /** The user administration home: does it offer a user search? */
      usersHome(request: APIRequestContext): Promise<PageView & { offersSearch: boolean }>;
      /** The user search result: one entry per user found, in order. */
      userSearch(request: APIRequestContext, text: string): Promise<PageView & { users: { id: number; name: string; email: string }[] }>;
      /** The sheet of a user. */
      user(request: APIRequestContext, userId: number): Promise<AdminUserView>;
      /** A user's membership of a group: operations and the orders (baskets) around the distributions of the last and next three months. */
      userGroup(request: APIRequestContext, userId: number, groupId: number): Promise<PageView & { memberName: string | null; groupName: string | null; operationCount: number; distributionIds: number[]; basketIds: (number | null)[] }>;
      /** The error log: one page (20 entries, newest first), the daily counts of the last month, optionally filtered by user. */
      errors(request: APIRequestContext, opts?: { userId?: number; page?: number }): Promise<PageView & { entries: ErrorLogEntry[]; daily: { day: string; count: number }[] }>;
      /** The queue of unsent emails: the count the page announces and the rows of the page (10 per page). */
      emails(request: APIRequestContext, opts?: { page?: number }): Promise<PageView & { announcedCount: number | null; mails: UnsentMailEntry[] }>;
      /** The group list; with a search (name, department numbers) it is the search result. */
      groups(request: APIRequestContext, search?: { name?: string; zipCodes?: string }): Promise<PageView & { groups: AdminGroupRow[] }>;
      /** One group, as the back-office shows it. */
      group(request: APIRequestContext, groupId: number): Promise<AdminGroupView>;
    };
    /** Public platform pages: maintenance, version, terms, installation, diagnostics. */
    platform: {
      /** The platform home address ("/"). */
      home(request: APIRequestContext): Promise<PageView>;
      /** A path (one segment) that is no page of the platform. */
      unknownPath(request: APIRequestContext, path: string): Promise<PageView>;
      /** The version the platform gives about itself. */
      ping(request: APIRequestContext): Promise<PageView & { version: string | null }>;
      /** The terms of service link (a redirect). */
      termsOfService(request: APIRequestContext): Promise<PageView>;
      /** The internal style-guide page. */
      styleGuide(request: APIRequestContext): Promise<PageView>;
      /** The installation diagnostics. */
      diagnostics(request: APIRequestContext): Promise<PageView>;
      /** The analytics (tag manager) id the shared page layout loads, null when the page loads none. Read on the login page. */
      analyticsId(request: APIRequestContext): Promise<PageView & { analyticsId: string | null }>;
      /** The installation page. */
      install(request: APIRequestContext): Promise<PageView>;
      /** What the shared page layout carries (the login page for a visitor, the group chooser for a logged-in user). */
      layout(request: APIRequestContext, page: 'login' | 'chooser', opts?: { ask?: string }): Promise<PageView & PageLayout>;
      /** The list of widget bundles the widget service publishes, in the order the pages must load them. */
      widgetManifest(request: APIRequestContext): Promise<{ status: number; bundles: string[] }>;
      /** What a visitor gets at the address of a folder of the widget service (`widgets`) or of the translation files (`translations`): the status and whether it is a web page. */
      assetFolder(request: APIRequestContext, folder: 'widgets' | 'translations' | 'frenchTranslations'): Promise<{ status: number; isWebPage: boolean }>;
      /** A translation file the platform serves for a language (`body` = its content, null when none). */
      translations(request: APIRequestContext, language: string): Promise<{ status: number; body: Record<string, unknown> | null }>;
      /** The account page of the logged-in user, with an optional `?lang` choice: what it offers to change the language. */
      accountLanguage(request: APIRequestContext, ask?: string): Promise<PageView & { language: string | null; offersLanguageChoice: boolean }>;
    };
    history: {
      home(request: APIRequestContext): Promise<PageView>;
      basket(request: APIRequestContext, basketId: number): Promise<PageView>;
      catalogOrders(request: APIRequestContext, catalogId: number): Promise<PageView>;
      subscriptionOrders(request: APIRequestContext, subscriptionId: number): Promise<PageView>;
      subscriptionPayments(request: APIRequestContext, subscriptionId: number): Promise<PageView>;
    };
  };

  /** Web actions that are not JSON APIs (links, form posts). Redirects are not followed. */
  actions: {
    group: {
      /** Make `groupId` the session's current group (many admin pages need it). */
      select(request: APIRequestContext, groupId: number, opts?: { redirect?: string }): Promise<ActionResult>;
      /** What the app does once the user has quit `groupId`: forget it as the session's current group if it was that one. */
      forgetAfterQuit(request: APIRequestContext, groupId: number): Promise<ActionResult>;
      /** The group creation page: status and redirect (a refusal redirects with a message), and the form it offers. */
      createForm(request: APIRequestContext): Promise<ActionResult & { values: Record<string, string>; required: string[]; countries: string[] }>;
      /** Post the group creation form: the group name and the address of its first place (`name` = the place name). */
      create(request: APIRequestContext, form: GroupCreationForm): Promise<ActionResult>;
      /** The join step: the logged-in user becomes a member of the session's current group (it must be an open group). */
      join(request: APIRequestContext): Promise<ActionResult>;
      /** A logged-in user asks to join the group on its waiting list (the group must have a waiting list). */
      requestWaitingList(request: APIRequestContext, groupId: number, message?: string): Promise<ActionResult>;
      /** A logged-in user withdraws their request from the waiting list of `groupId`. */
      leaveWaitingList(request: APIRequestContext, groupId: number): Promise<ActionResult>;
      /** The personal key printed in the footer of an email sent to `userId` about `groupId`. */
      quitKey(groupId: number, userId: number): string;
      /** The key printed in the footer of a group message (the same for every recipient). */
      quitKeyFromMessage(groupId: number): string;
      /** Open the quit link of an email footer (no login needed). A refusal redirects with a message; the confirmation page returns the ids it hands to the quit widget. */
      openQuitLink(request: APIRequestContext, p: { groupId: number; userId: number; key: string }): Promise<ActionResult & { offered: { groupId: number; userId: number | null } | null }>;
      /** Open the quit link of a group message footer (the visitor has to log in first). */
      openQuitLinkFromMessage(request: APIRequestContext, p: { groupId: number; key: string }): Promise<ActionResult & { offered: { groupId: number; userId: number | null } | null }>;
    };
    members: {
      /** hx link "put back on the waiting list" of the member sheet (controller/Member.hx doMovetowl, a plain GET, acts on the session's current group). */
      moveToWaitingList(request: APIRequestContext, memberId: number): Promise<ActionResult>;
      /** hx "log in as" (controller/Member.hx doLoginas): returns the response and the user the hx session ends up as. */
      loginAs(request: APIRequestContext, memberId: number): Promise<ActionResult & { sessionUserId: number | null }>;
      /** hx "remove from group" link of the member sheet (controller/Member.hx doDelete). `token: false` sends no security token, a string sends that one; `confirm` follows the "remove anyway" link. */
      remove(request: APIRequestContext, memberId: number, opts?: { token?: boolean | string; confirm?: boolean }): Promise<ActionResult>;
    };
    invitations: {
      /** Open the link of an invitation email. `hash` is the key printed in it; pass `userId` for an existing user. */
      open(request: APIRequestContext, p: { hash: string; email: string; groupId: number; userId?: number }): Promise<ActionResult>;
      /** The valid hash of an invitation to `email`. */
      hashFor(email: string): string;
    };
    account: {
      /** Log out through the platform page (not the API): the messages it sends back to clear the login cookies, and where it ends. */
      logout(request: APIRequestContext): Promise<{ hops: number; setCookies: string[]; finalLocation: string | null }>;
      /** Ask for a password reset email (visitor, or a user who wants to change theirs). */
      forgotPassword(request: APIRequestContext, email: string): Promise<ActionResult>;
      /** Open the link of a reset email (the path part, e.g. /user/forgottenPassword/<key>/<id>). */
      openResetLink(request: APIRequestContext, link: string): Promise<PageView>;
      /** Submit the new password form of a reset link; `userId` is the hidden field of the form. */
      setNewPassword(request: APIRequestContext, link: string, p: { pass1: string; pass2: string; userId?: number }): Promise<ActionResult>;
    };
    volunteers: {
      /** A member registers for a role of a session (a link that acts when opened, UND-064). */
      register(request: APIRequestContext, sessionId: number, roleId: number): Promise<ActionResult>;
      /** Group admin assigns members to the roles of a session (roleId -> userId, null = nobody). */
      assign(request: APIRequestContext, sessionId: number, assignments: Record<number, number | null>): Promise<ActionResult>;
      /** Group admin chooses the roles a session needs. */
      setSessionRoles(request: APIRequestContext, sessionId: number, roleIds: number[]): Promise<ActionResult>;
      settings(request: APIRequestContext): Promise<{ status: number; values: Record<string, string> }>;
      saveSettings(request: APIRequestContext, s: Partial<VolunteerSettings>): Promise<ActionResult>;
      createRole(request: APIRequestContext, role: { name: string; enabledByDefault?: boolean }): Promise<ActionResult>;
      editRole(request: APIRequestContext, roleId: number, role: { name: string; enabledByDefault: boolean }): Promise<ActionResult>;
      deleteRole(request: APIRequestContext, roleId: number, opts?: { force?: boolean; token?: boolean }): Promise<ActionResult>;
      /** A catalog coordinator manages the roles of their catalog. */
      createCatalogRole(request: APIRequestContext, catalogId: number, name: string): Promise<ActionResult>;
      deleteCatalogRole(request: APIRequestContext, roleId: number, catalogId: number, opts?: { force?: boolean }): Promise<ActionResult>;
      participation(request: APIRequestContext): Promise<PageView>;
    };
    orders: {
      /** A member edits their existing variable-catalog orders of one session on the legacy page ("quantity by product id"); lines of a closed distribution are ignored. */
      editVarOrders(request: APIRequestContext, sessionId: number, quantities: Record<number, number>): Promise<ActionResult>;
      /** A coordinator deletes an order line from the orders page of a catalog distribution (a line of quantity 0 only). */
      deleteLine(request: APIRequestContext, catalogId: number, distributionId: number, orderId: number): Promise<ActionResult>;
    };
    sessions: {
      /** The distributions page of the group (coordinator of all catalogs). */
      list(request: APIRequestContext): Promise<PageView>;
      create(request: APIRequestContext, form: SessionForm): Promise<ActionResult>;
      edit(request: APIRequestContext, sessionId: number, form: SessionForm): Promise<ActionResult>;
      delete(request: APIRequestContext, sessionId: number, opts?: { token?: boolean }): Promise<ActionResult>;
      createCycle(request: APIRequestContext, form: CycleForm): Promise<ActionResult>;
      deleteCycle(request: APIRequestContext, cycleId: number): Promise<ActionResult>;
      /** A catalog takes part in a session. */
      participate(request: APIRequestContext, sessionId: number, catalogId: number): Promise<ActionResult>;
      /** A catalog takes part in all its sessions at once. */
      participateAll(request: APIRequestContext, catalogId: number): Promise<ActionResult>;
      /** Cancel a catalog's participation (a Distribution). */
      cancelParticipation(request: APIRequestContext, distributionId: number): Promise<ActionResult>;
      /** The "vendors of this session" form: the catalogs left ticked are the ones taking part. */
      setCatalogs(request: APIRequestContext, sessionId: number, catalogIds: number[]): Promise<ActionResult>;
      /** Move a catalog's participation to another session. */
      shift(request: APIRequestContext, distributionId: number, targetSessionId: number): Promise<ActionResult>;
      /** Give one catalog distribution its own order opening and closing dates ('YYYY-MM-DD HH:MM'). */
      setOrderDates(request: APIRequestContext, distributionId: number, dates: { orderStart: string; orderEnd: string }): Promise<ActionResult>;
      /** Change the price of a product in the orders of a session. `location` of the result = where the app sends the user. */
      changePrice(request: APIRequestContext, sessionId: number, productId: number, price: number): Promise<ActionResult>;
      /** Set a product to quantity 0 in the orders of a session (the undelivered product). */
      removeProduct(request: APIRequestContext, sessionId: number, productId: number): Promise<ActionResult>;
    };
    groupAdmin: {
      /** The group admin's payment settings: types on offer, types enabled, IBAN. */
      paymentSettings(request: APIRequestContext): Promise<{ status: number; offered: string[]; enabled: string[]; iban: string; /** every link (href) printed on the page */ links: string[] }>;
      savePaymentSettings(request: APIRequestContext, settings: { types: string[]; iban?: string }): Promise<ActionResult>;
      /** The rights editor of a member (`userId`), or the one that gives rights to a new person (left out). */
      rightsEditor(request: APIRequestContext, userId?: number): Promise<RightsEditor>;
      /** Give rights to a person picked in the editor (the full list of what is ticked). */
      giveRights(request: APIRequestContext, userId: number, rights: RightsChoice): Promise<ActionResult>;
      /** Save the rights editor of a member: the ticked rights replace the whole list. */
      editRights(request: APIRequestContext, userId: number, rights: RightsChoice): Promise<ActionResult>;
      /** The group settings form, as it is now. */
      settings(request: APIRequestContext): Promise<GroupSettingsView>;
      /** Save the group settings form: what is not given keeps its current value. `formGroupId` = the group the form says it edits. */
      saveSettings(request: APIRequestContext, form: GroupSettingsForm, opts?: { formGroupId?: number }): Promise<ActionResult>;
      /** The membership settings form (amapadmin/membership), as it is now. `renewalDate` is 'YYYY-MM-DD' or ''. */
      membershipSettings(request: APIRequestContext): Promise<{ status: number; location: string | null; values: { enabled: boolean; fee: string; renewalDate: string } }>;
      /** Save the membership settings form (`fee` and `renewalDate` as typed; '' = left empty). */
      saveMembershipSettings(request: APIRequestContext, form: { enabled: boolean; fee: string; renewalDate: string }): Promise<ActionResult>;
    };
    payments: {
      /** The payment types a coordinator can pick when entering a payment by hand. */
      manualEntryTypes(request: APIRequestContext, userId: number): Promise<string[]>;
      /** Coordinator records a payment for a member (controller/Transaction.hx). */
      insert(request: APIRequestContext, userId: number, form: PaymentForm): Promise<ActionResult>;
      /** Coordinator records a payment on a subscription (SubscriptionAdmin.insertPayment). */
      insertOnSubscription(request: APIRequestContext, subscriptionId: number, form: PaymentForm): Promise<ActionResult>;
      /** One payment per subscription of a catalog; rows without amount are skipped. */
      massInsert(
        request: APIRequestContext,
        catalogId: number,
        rows: { subscriptionId: number; amount?: number | null; type?: string; label?: string }[],
        opts?: { token?: boolean },
      ): Promise<ActionResult>;
      edit(request: APIRequestContext, operationId: number, form: { name: string; amount: number; date: string }): Promise<ActionResult>;
      delete(request: APIRequestContext, operationId: number, opts?: { token?: boolean }): Promise<ActionResult>;
    };
    subscriptionAdmin: {
      list(request: APIRequestContext, catalogId: number): Promise<ActionResult>;
      create(request: APIRequestContext, catalogId: number, form: SubscriptionForm, opts?: { token?: boolean }): Promise<ActionResult>;
      edit(request: APIRequestContext, subscriptionId: number, form: SubscriptionForm, opts?: { token?: boolean }): Promise<ActionResult>;
      delete(request: APIRequestContext, subscriptionId: number, opts?: { token?: boolean }): Promise<ActionResult>;
      balanceTransfer(request: APIRequestContext, fromSubscriptionId: number, toSubscriptionId: number, opts?: { token?: boolean }): Promise<ActionResult>;
      /** Superadmin: move a subscription of the deleted user to another user. */
      reattribute(request: APIRequestContext, subscriptionId: number, userId: number): Promise<ActionResult>;
    };
    catalogs: {
      /** Search the vendor directory (name words, profession, distance to the group's main place). Returns the ids found, in order. */
      findVendors(request: APIRequestContext, search: { name?: string; geoloc?: boolean; profession?: number }): Promise<ActionResult & { vendorIds: number[] }>;
      /** The new-vendor form: is the personal-data consent box on it? */
      vendorForm(request: APIRequestContext): Promise<{ status: number; location: string | null; offersGdprConsent: boolean }>;
      createVendor(request: APIRequestContext, form: VendorForm): Promise<ActionResult>;
      /** The page where a vendor is picked for a new catalog and its type chosen. */
      typeChoices(request: APIRequestContext, vendorId: number): Promise<ActionResult & { types: CatalogKind[] }>;
      /** The pre-filled creation form; `type` left out = what the app defaults to. */
      creationForm(request: APIRequestContext, vendorId: number, type?: CatalogKind): Promise<CatalogFormView>;
      create(request: APIRequestContext, vendorId: number, type: CatalogKind | undefined, form?: CatalogFormInput): Promise<ActionResult>;
      editForm(request: APIRequestContext, catalogId: number): Promise<CatalogFormView>;
      edit(request: APIRequestContext, catalogId: number, form: CatalogFormInput): Promise<ActionResult>;
      /** The coordinator's absence-rules form of a catalog: dates are 'YYYY-MM-DD'. */
      absencesForm(
        request: APIRequestContext,
        catalogId: number,
      ): Promise<{ status: number; location: string | null; maxNb: number | null; startDate: string; endDate: string }>;
      /** Save the absence rules; `null` posts the field empty, a field left out keeps what the form pre-fills. */
      setAbsences(
        request: APIRequestContext,
        catalogId: number,
        form: { maxNb?: number | null; startDate?: string | null; endDate?: string | null },
      ): Promise<ActionResult>;
      /** The "refresh the prices of the existing orders" link; `distributionId` is needed by variable catalogs. */
      updatePrices(request: APIRequestContext, catalogId: number, distributionId?: number): Promise<ActionResult>;
      /** "Duplicate" a catalog, copying all its products, or only the active ones, or none. */
      duplicate(
        request: APIRequestContext,
        catalogId: number,
        opts?: { name?: string; copyProducts?: 'all' | 'active' | 'none'; /** type of the copy; default = the source's */ type?: CatalogKind; copyDistributions?: boolean },
      ): Promise<ActionResult>;
      /** The duplication form: what it offers and pre-fills. */
      duplicateForm(request: APIRequestContext, catalogId: number): Promise<{ status: number; location: string | null; name: string; type: CatalogKind | null; offersCopyDistributions: boolean }>;
      /** Delete a catalog; `token: false` sends no security token. */
      delete(request: APIRequestContext, catalogId: number, opts?: { token?: boolean }): Promise<ActionResult>;
      /** The superadmin's hidden "copy the products of another catalog" form (name and price only). */
      copyProducts(request: APIRequestContext, targetCatalogId: number, sourceCatalogId: number, opts?: { deleteExisting?: boolean }): Promise<ActionResult>;
    };
    places: {
      /** The places page of the current group: place ids listed and whether a delete link is offered. */
      list(request: APIRequestContext): Promise<ActionResult & { placeIds: number[]; offersDelete: boolean }>;
      /** The creation form (no `placeId`) or the edit form of a place. */
      form(request: APIRequestContext, placeId?: number): Promise<PlaceFormView>;
      create(request: APIRequestContext, form: PlaceForm): Promise<ActionResult>;
      edit(request: APIRequestContext, placeId: number, form: PlaceForm): Promise<ActionResult>;
      delete(request: APIRequestContext, placeId: number, opts?: { token?: boolean }): Promise<ActionResult>;
      /** The page of a place, as a member sees it. */
      view(request: APIRequestContext, placeId: number): Promise<PageView>;
    };
    vendors: {
      /** Open the vendor edit form: status and redirect (a refusal redirects with a message). */
      editForm(request: APIRequestContext, vendorId: number): Promise<ActionResult>;
      /** Save the vendor edit form. */
      edit(request: APIRequestContext, vendorId: number, form: VendorForm): Promise<ActionResult>;
    };
    products: {
      /** The product form, to create one in `catalogId` or to edit `productId`. */
      form(request: APIRequestContext, target: { catalogId: number } | { productId: number }): Promise<ProductFormView>;
      create(request: APIRequestContext, catalogId: number, form: ProductFormInput): Promise<ActionResult>;
      edit(request: APIRequestContext, productId: number, form: ProductFormInput): Promise<ActionResult>;
      /** "Deactivate and create a copy". */
      copyAndDeactivate(request: APIRequestContext, productId: number, opts?: { token?: boolean }): Promise<ActionResult>;
      delete(request: APIRequestContext, productId: number, opts?: { token?: boolean }): Promise<ActionResult>;
      /** Enable or disable several products at once, from the products page of `catalogId`. */
      setActive(request: APIRequestContext, catalogId: number, productIds: number[], active: boolean): Promise<ActionResult>;
      /** The CSV import of `catalogId`. The rows read in step 2 are kept in the session until step 3 confirms. */
      csvImport: {
        /** Step 1: open the page. */
        open(request: APIRequestContext, catalogId: number): Promise<ProductImportPage>;
        /** Step 2: send the file (`null` = no file); the page shows what was read, nothing is saved yet. */
        upload(request: APIRequestContext, catalogId: number, file: UploadFile | null): Promise<ProductImportPage>;
        /** Step 3: confirm, which saves the rows read in step 2. */
        confirm(request: APIRequestContext, catalogId: number): Promise<ProductImportPage>;
      };
    };
    subscription: {
      /** A member deletes their own subscription. */
      deleteOwn(request: APIRequestContext, subscriptionId: number): Promise<ActionResult>;
    };
    /** PDF documents of the current group (no `catalogId`) or of a catalog. */
    documents: {
      list(request: APIRequestContext, scope: FileScope): Promise<FileListing>;
      /** Post the upload form; `file: null` posts no file. `visibility: null` posts no choice. */
      upload(request: APIRequestContext, scope: FileScope, f: { file: UploadFile | null; name?: string; visibility?: string | null }): Promise<ActionResult>;
      edit(request: APIRequestContext, scope: FileScope, documentId: number, f: { name?: string; visibility?: string }): Promise<ActionResult>;
      delete(request: APIRequestContext, scope: FileScope, documentId: number, opts?: { token?: boolean }): Promise<ActionResult>;
    };
    /** The image gallery of the current group. */
    media: {
      list(request: APIRequestContext): Promise<FileListing>;
      upload(request: APIRequestContext, f: { file: UploadFile | null; name?: string; visibility?: string | null }): Promise<ActionResult>;
      edit(request: APIRequestContext, mediaId: number, f: { name?: string; visibility?: string }): Promise<ActionResult>;
      delete(request: APIRequestContext, mediaId: number, opts?: { token?: boolean }): Promise<ActionResult>;
    };
    /** The superadmin back-office (reserved to superadmins). */
    admin: {
      /** "Reload the theme" link of the back-office home. */
      reloadTheme(request: APIRequestContext): Promise<ActionResult>;
      /** Make the superadmin a member of a group. */
      addMeToGroup(request: APIRequestContext, groupId: number): Promise<ActionResult>;
      /** Delete a group; `token: false` sends no security token. */
      deleteGroup(request: APIRequestContext, groupId: number, opts?: { token?: boolean }): Promise<ActionResult>;
      /** Save the platform theme from the edit form (`settings` = the text of the block). */
      setTheme(request: APIRequestContext, settings: string): Promise<ActionResult>;
      /** Save one of the platform messages; `alert` (admin message only) ticks the red alert box. */
      setMessage(request: APIRequestContext, which: PlatformMessage, text: string, alert?: boolean): Promise<ActionResult>;
      /** Empty the error log; `token: false` sends no security token. */
      purgeErrors(request: APIRequestContext, opts?: { token?: boolean }): Promise<ActionResult>;
      /** Reset the retry counter of an unsent email. */
      resetMailTries(request: APIRequestContext, mailId: number): Promise<ActionResult>;
      /** Delete a user account from the back-office (a plain link: no security token). */
      deleteUser(request: APIRequestContext, userId: number): Promise<ActionResult>;
      /**
       * Edit one column of a group in the raw database tool (the only way to disable a group today, UND-025):
       * the row is opened, every field is posted back as it was, with `column` set to `value` (null = no value).
       */
      editGroupColumnInDatabaseTool(request: APIRequestContext, groupId: number, column: string, value: string | null): Promise<ActionResult>;
      /** Open a maintenance script through the web (they are meant for the command line only). */
      runScript(request: APIRequestContext, script: 'recomputeBasketTotal' | 'cleanNonAmapData', params: Record<string, string>): Promise<ActionResult>;
    };
    /** First installation of the platform. */
    install: {
      /** Submit the installation form (group name, first name and last name of the first user). */
      run(request: APIRequestContext, form: { amapName: string; firstName: string; lastName: string }): Promise<ActionResult>;
    };
    files: {
      /** Open a stored file through the link a page gives (`href`, as found in the page). */
      open(request: APIRequestContext, href: string): Promise<FileDownload>;
    };
  };

  pages: {
    login(page: Page): LoginPage;
    home(page: Page): HomePage;
    groupPublic(page: Page): GroupPublicPage;
    layout(page: Page): LayoutPage;
    dateForm(page: Page): DateFormPage;
    attendanceSheet(page: Page): AttendanceSheetPage;
  };
}

/** Header of an attendance sheet export (DIS-ATT-008). */
export type AttendanceSheetHeader = {
  catalog: {
    id: number;
    name: string;
    group: { id: number; name: string; txtDistrib: string | null };
    user: { id: number; firstName: string; lastName: string; phone: string | null; email: string } | null;
    vendor: { id: number; name: string; phone: string | null; email: string | null };
  };
  /** Variable catalogs only. */
  distribution?: { multiDistrib: { id: number; volunteers: { volunteerRole: { id: number; name: string; catalogId: number | null }; user: { id: number; firstName: string; lastName: string } }[] } };
};
