import { request as pwRequest } from '@playwright/test';
import type { CamapApp } from '../types.js';
import { env } from '../../env.js';
import { execute } from '../../db/client.js';
import { hxLogin } from '../../session/login.js';
import { hxActions, hxApi, hxExports, hxGraphql, hxViews } from './api.js';
import { hxUrls } from './urls.js';
import { hxGroupPublicPage } from './pages/group-public.js';
import { hxDateFormPage } from './pages/date-form.js';
import { hxLayoutPage } from './pages/layout.js';
import { hxHomePage } from './pages/home.js';
import { hxLoginPage } from './pages/login.js';
import { hxAttendanceSheetPage } from './pages/attendance-sheet.js';

export function createHxApp(): CamapApp {
  return {
    name: 'hx',
    urls: hxUrls,
    auth: {
      sid: async (request) => {
        const page = await request.get(hxUrls.login());
        const sid = (await request.storageState()).cookies.find((c) => c.name === 'sid')?.value;
        if (!page.ok() || !sid) throw new Error('hx did not open a session');
        return sid;
      },
      login: (request, user) => hxLogin(request, user, hxUrls),
      // sugoi Session.uid is what makes a session "logged in" for Neko; Nest's cookies are separate
      endPlatformSession: async (request) => {
        const sid = (await request.storageState()).cookies.find((c) => c.name === 'sid')?.value;
        if (!sid) throw new Error('no platform session to end');
        await execute('UPDATE `Session` SET uid = NULL WHERE sid = ?', [sid]);
      },
      // cookies: sid (platform), Auth_sid / Authentication / Refresh (Nest, camap-ts auth.service.ts)
      tamper: async (request, kind) => {
        const state = await request.storageState();
        let cookies = state.cookies;
        const domain = cookies[0]?.domain ?? 'localhost';
        if (kind === 'dropAccessToken') cookies = cookies.filter((c) => c.name !== 'Authentication');
        else if (kind === 'invalidateTokens') cookies = cookies.map((c) => (c.name === 'Authentication' || c.name === 'Refresh' ? { ...c, value: 'not.a.token' } : c));
        else cookies = [...cookies.filter((c) => c.name !== 'Auth_sid'), { name: 'Auth_sid', value: 'someothersession00000000000000', domain, path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' as const }];
        return pwRequest.newContext({ baseURL: env.baseUrl, storageState: { cookies, origins: [] } });
      },
    },
    api: hxApi,
    graphql: hxGraphql,
    actions: hxActions,
    views: hxViews,
    exports: hxExports,
    pages: {
      login: hxLoginPage,
      home: hxHomePage,
      groupPublic: hxGroupPublicPage,
      layout: hxLayoutPage,
      dateForm: hxDateFormPage,
      attendanceSheet: hxAttendanceSheetPage,
    },
  };
}
