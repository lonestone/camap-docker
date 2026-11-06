/**
 * Typed row builders over the shared DB. Each returns the inserted row (with
 * its id) and fills the columns hx expects with hx's own defaults. Dates are
 * Paris wall-clock and default relative to `clock.now()`.
 *
 *   import * as make from '../../src/factories/index.js';
 *   const g = await make.group({ regOption: 'WaitingList' });
 */
export * from './users.js';
export * from './groups.js';
export * from './catalogs.js';
export * from './distributions.js';
export * from './orders.js';
export * from './scenarios.js';
export { parisDate } from './util.js';
export * from './files.js';
export * from './mails.js';
