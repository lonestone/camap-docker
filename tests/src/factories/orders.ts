/**
 * Subscriptions (CSA contracts), baskets, orders, operations.
 */
import { insert } from '../db/client.js';
import { absentDistribIds, defaultOrders, type CSAOrder } from '../encodings/columns.js';
import { bool, nowSql, sqlDateTime } from './util.js';

export type SubscriptionRow = { id: number; userId: number; catalogId: number };

export async function subscription(
  input: { user: { id: number }; catalog: { id: number }; startDate: Date | string; endDate: Date | string } & Partial<{
    user2: { id: number } | null;
    defaultOrders: CSAOrder[];
    absentDistribIds: number[];
  }>,
): Promise<SubscriptionRow> {
  const id = await insert('Subscription', {
    userId: input.user.id,
    userId2: input.user2?.id ?? null,
    catalogId: input.catalog.id,
    startDate: sqlDateTime(input.startDate),
    endDate: sqlDateTime(input.endDate),
    defaultOrders: defaultOrders.encode(input.defaultOrders ?? []),
    absentDistribIds: absentDistribIds.encode(input.absentDistribIds ?? []),
  });
  return { id, userId: input.user.id, catalogId: input.catalog.id };
}

/** camap-hx/src/db/Basket.hx BasketStatus */
export type BasketStatus = 'OPEN' | 'PAYMENT_PROCESSING' | 'CONFIRMED' | 'VALIDATED';

export async function basket(
  input: { user: { id: number }; multiDistrib: { id: number } } & Partial<{ num: number; total: number; status: BasketStatus }>,
): Promise<{ id: number }> {
  const id = await insert('Basket', {
    userId: input.user.id,
    multiDistribId: input.multiDistrib.id,
    cdate: nowSql(),
    num: input.num ?? 1,
    total: input.total ?? 0,
    status: input.status ?? 'CONFIRMED',
    data: '{}',
  });
  return { id };
}

export async function userOrder(
  input: {
    user: { id: number };
    product: { id: number; price: number };
    distribution: { id: number };
    basket: { id: number };
  } & Partial<{ quantity: number; paid: boolean; subscription: { id: number } | null; user2: { id: number } | null; feesRate: number }>,
): Promise<{ id: number }> {
  const id = await insert('UserOrder', {
    userId: input.user.id,
    userId2: input.user2?.id ?? null,
    productId: input.product.id,
    productPrice: input.product.price,
    distributionId: input.distribution.id,
    basketId: input.basket.id,
    subscriptionId: input.subscription?.id ?? null,
    quantity: input.quantity ?? 1,
    paid: bool(input.paid ?? false),
    date: nowSql(),
    feesRate: input.feesRate ?? 0,
    flags: 0,
  });
  return { id };
}

/** camap-hx/src/db/Operation.hx OperationType */
export const OperationType = { VOrder: 0, SubscriptionTotal: 1, Payment: 2, Membership: 3 } as const;

export async function operation(
  input: { user: { id: number }; group: { id: number }; type: keyof typeof OperationType; amount: number } & Partial<{
    name: string;
    date: Date | string;
    pending: boolean;
    relation: { id: number } | null;
    subscription: { id: number } | null;
    basket: { id: number } | null;
    /** JSON payload, e.g. payment infos {type:"check"}. */
    data: unknown;
  }>,
): Promise<{ id: number }> {
  const id = await insert('Operation', {
    userId: input.user.id,
    groupId: input.group.id,
    type: OperationType[input.type],
    amount: input.amount,
    name: input.name ?? input.type,
    date: sqlDateTime(input.date) ?? nowSql(),
    pending: bool(input.pending ?? false),
    relationId: input.relation?.id ?? null,
    subscriptionId: input.subscription?.id ?? null,
    basketId: input.basket?.id ?? null,
    // hx reads `data` of every payment (Operation.getPaymentType)
    data: input.data === undefined ? (input.type === 'Payment' ? JSON.stringify({ type: 'cash' }) : null) : JSON.stringify(input.data),
  });
  return { id };
}
