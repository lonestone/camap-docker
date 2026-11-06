/**
 * Multi-step arrangements that go through the app (so hx computes orders,
 * baskets and operations), shared by several specs.
 */
import type { APIRequestContext } from '@playwright/test';
import type { CamapApp, DefaultOrderLine, OrdersByDistrib, SubscriptionDto } from './targets/types.js';
import type { AmapScenario } from './factories/scenarios.js';

/** The member subscribes to the constant catalog through the API (one default line: 1 x vegetable basket). */
export async function subscribeConst(
  app: CamapApp,
  request: APIRequestContext,
  s: AmapScenario,
  userId: number,
  opts: { quantity?: number; absentDistribIds?: number[] } = {},
): Promise<SubscriptionDto> {
  const p = s.products.const[0];
  const res = await app.api.subscription.create(request, {
    userId,
    catalogId: s.constCatalog.id,
    defaultOrder: [{ productId: p.id, productPrice: p.price, quantity: opts.quantity ?? 1 }],
    absentDistribIds: opts.absentDistribIds ?? [],
    initialOrders: [],
  });
  if (res.status !== 200) throw new Error(`subscribeConst failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

/** The member subscribes to the variable catalog (no default order, no initial orders) unless given. */
export async function subscribeVar(
  app: CamapApp,
  request: APIRequestContext,
  s: AmapScenario,
  userId: number,
  opts: { defaultOrder?: DefaultOrderLine[]; initialOrders?: OrdersByDistrib } = {},
): Promise<SubscriptionDto> {
  const res = await app.api.subscription.create(request, {
    userId,
    catalogId: s.varCatalog.id,
    defaultOrder: opts.defaultOrder ?? [],
    absentDistribIds: [],
    initialOrders: opts.initialOrders ?? [],
  });
  if (res.status !== 200) throw new Error(`subscribeVar failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}
