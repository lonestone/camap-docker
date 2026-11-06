/**
 * Text columns holding lists or JSON, in the exact format hx writes them.
 */

/** Subscription.absentDistribIds: "12,15,18" sorted ascending, null when empty (AbsencesService.setAbsences). */
export const absentDistribIds = {
  encode: (ids: number[]): string | null => (ids.length === 0 ? null : [...ids].sort((a, b) => a - b).join(',')),
  decode: (v: string | null): number[] => (v == null || v === '' ? [] : v.split(',').map(Number)),
};

/** MultiDistrib.volunteerRolesIds: "1,2,3", null when none (MultiDistrib.getVolunteerRoles). */
export const volunteerRolesIds = {
  encode: (ids: number[]): string | null => (ids.length === 0 ? null : ids.join(',')),
  decode: (v: string | null): number[] => (v == null || v === '' ? [] : v.split(',').map(Number)),
};

/** Subscription.defaultOrders: JSON Array<CSAOrder> (camap-hx/src/service/SubscriptionService.hx). */
export type CSAOrder = {
  productId: number;
  productPrice: number;
  quantity: number;
  userId2?: number;
  invertSharedOrder?: boolean;
};
export const defaultOrders = {
  encode: (orders: CSAOrder[]): string | null => (orders.length === 0 ? null : JSON.stringify(orders)),
  decode: (v: string | null): CSAOrder[] => (v == null ? [] : (JSON.parse(v) as CSAOrder[])),
};

/** Group.allowedPaymentsType: JSON Array<String> of payment type ids (Group.setAllowedPaymentTypes). */
export const allowedPaymentsType = {
  encode: (types: string[]): string => JSON.stringify(types),
  decode: (v: string | null): string[] => (v == null ? [] : (JSON.parse(v) as string[])),
};

/** BufferedJsonMail.recipients / sender: JSON written by db/BufferedJsonMail.hx. */
export type MailAddress = { name?: string | null; email: string; userId?: number | null };
export const mailAddresses = {
  decode: (v: string | null): MailAddress[] => (v == null ? [] : (JSON.parse(v) as MailAddress[])),
};
