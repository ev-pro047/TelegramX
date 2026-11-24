import type { ActionReturnType } from '../../types';

import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addActionHandler } from '../../index';
import { updateTabState } from '../../reducers/tabs';
import { selectSharedSettings } from '../../selectors/sharedState';

addActionHandler('openXydrive', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  if (!selectSharedSettings(global).isXydriveEnabled || !global.currentUserId) {
    return undefined;
  }

  return updateTabState(global, { xydriveOwnerId: global.currentUserId }, tabId);
});

addActionHandler('closeXydrive', (global, actions, payload): ActionReturnType => {
  const { tabId = getCurrentTabId() } = payload || {};
  return updateTabState(global, { xydriveOwnerId: undefined }, tabId);
});
