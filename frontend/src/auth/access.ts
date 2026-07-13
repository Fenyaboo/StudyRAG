import type { User } from '@supabase/supabase-js';

export type AppTab = 'dashboard' | 'library' | 'chat' | 'settings';

const intendedTabStorageKey = 'studyrag:intended-tab';
const privateTabs = new Set<AppTab>(['library', 'chat']);
const appTabs = new Set<AppTab>(['dashboard', 'library', 'chat', 'settings']);

const canUseStorage = () => typeof window !== 'undefined' && Boolean(window.localStorage);

export const tabFromHash = (hash = window.location.hash): AppTab | null => {
  const tab = hash.replace(/^#/, '').trim().toLowerCase();
  return appTabs.has(tab as AppTab) ? tab as AppTab : null;
};

export const rememberIntendedDestination = () => {
  const tab = tabFromHash();
  if (tab && privateTabs.has(tab) && canUseStorage()) {
    window.localStorage.setItem(intendedTabStorageKey, tab);
  }
};

export const consumeIntendedDestination = (): AppTab | null => {
  if (!canUseStorage()) return null;

  const requestedTab = tabFromHash();
  const storedTab = window.localStorage.getItem(intendedTabStorageKey);
  const tab = privateTabs.has(requestedTab as AppTab)
    ? requestedTab
    : privateTabs.has(storedTab as AppTab) ? storedTab as AppTab : null;

  window.localStorage.removeItem(intendedTabStorageKey);
  return tab;
};

export const setRouteTab = (tab: AppTab) => {
  if (typeof window !== 'undefined' && window.location.hash !== `#${tab}`) {
    window.location.hash = tab;
  }
};

const providersFor = (user: User) => {
  const appMetadata = user.app_metadata ?? {};
  const providers = Array.isArray(appMetadata.providers) ? appMetadata.providers : [];
  return new Set([
    appMetadata.provider,
    ...providers,
    ...(user.identities ?? []).map((identity) => identity.provider),
  ]);
};

export const hasVerifiedIdentity = (user: User | null) => {
  if (!user) return false;
  if (providersFor(user).has('google')) return true;
  return Boolean(user.email_confirmed_at ?? user.confirmed_at);
};
