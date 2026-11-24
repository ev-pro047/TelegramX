import type { ActionReturnType } from '../../types';

import { getXydriveMounts } from '../../../lib/xydrive/folders';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addActionHandler } from '../../index';
import { replaceSettings } from '../../reducers/settings';
import { updateTabState } from '../../reducers/tabs';
import { selectSharedSettings } from '../../selectors/sharedState';

addActionHandler('openXydrive', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  if (!selectSharedSettings(global).isXydriveEnabled || !global.currentUserId || global.passcode.isScreenLocked) {
    return undefined;
  }

  return updateTabState(global, {
    xydriveOwnerId: global.currentUserId,
    xydriveSourceId: undefined,
    xydrive: undefined,
    xydriveMountRequest: undefined,
    xydriveMountError: undefined,
  }, tabId);
});

addActionHandler('closeXydrive', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, {
    xydriveOwnerId: undefined,
    xydriveSourceId: undefined,
    xydrive: undefined,
    xydriveMountRequest: undefined,
    xydriveMountError: undefined,
  }, tabId);
});

addActionHandler('selectXydriveSource', (global, actions, payload): ActionReturnType => {
  const { channelId, tabId = getCurrentTabId() } = payload;
  const ownerId = global.currentUserId;
  const tab = global.byTabId[tabId];
  if (!ownerId || tab?.xydriveOwnerId !== ownerId || global.passcode.isScreenLocked
    || !selectSharedSettings(global).isXydriveEnabled || tab.xydriveSourceId === channelId) return undefined;
  if (channelId && !getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId)
    .some(({ id }) => id === channelId)) return undefined;

  return updateTabState(global, { xydriveSourceId: channelId, xydrive: undefined }, tabId);
});

addActionHandler('unmountXydriveChannel', (global, actions, payload): ActionReturnType => {
  const { channelId, tabId = getCurrentTabId() } = payload;
  const ownerId = global.currentUserId;
  if (!ownerId || global.byTabId[tabId]?.xydriveOwnerId !== ownerId || global.passcode.isScreenLocked
    || !selectSharedSettings(global).isXydriveEnabled) return undefined;

  const folders = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId);
  if (!folders.some(({ id }) => id === channelId)) return undefined;
  global = replaceSettings(global, { xydriveMounts: { ownerId, folders: folders.filter(({ id }) => id !== channelId) } });
  for (const tab of Object.values(global.byTabId)) {
    if (tab.xydriveSourceId === channelId && tab.xydriveOwnerId === ownerId) {
      global = updateTabState(global, { xydriveSourceId: undefined, xydrive: undefined }, tab.id);
    }
  }
  return global;
});
