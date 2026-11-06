import type { CamapApp } from '../types.js';

/** camap-hx routes (haxe.web.Dispatch: /group/<id> -> controller.Group.doDefault...). */
export const hxUrls: CamapApp['urls'] & { graphql: string } = {
  home: () => '/home',
  login: () => '/user/login',
  groupPage: (groupId) => `/group/${groupId}`,
  groupDisabled: (groupId) => (groupId == null ? '/group/disabled' : `/group/disabled/${groupId}`),
  catalogDashboard: (catalogId) => `/contractAdmin/view/${catalogId}`,
  cron: (job) => `/cron/${job}`,
  /** Proxied to Nest by Apache (camap-hx/apache/camap-static.conf). */
  graphql: '/graphql',
};
