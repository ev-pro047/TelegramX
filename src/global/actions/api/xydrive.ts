import type { GlobalState } from '../../types';

import { callApi } from '../../../api/gramjs';
import { getXydriveFile, mergeXydriveFiles } from '../../../lib/xydrive/fileMetadata';
import { getCurrentTabId } from '../../../util/establishMultitabRole';
import { addActionHandler, getGlobal, setGlobal } from '../../index';
import { updateTabState } from '../../reducers/tabs';
import { selectSharedSettings } from '../../selectors/sharedState';

let nextRequestId = 0;

function isXydriveOpen(global: GlobalState, tabId: number, ownerId: string) {
  return global.currentUserId === ownerId && !global.passcode.isScreenLocked
    && selectSharedSettings(global).isXydriveEnabled
    && global.byTabId[tabId]?.xydriveOwnerId === ownerId;
}

addActionHandler('loadXydrivePage', async (global, actions, payload): Promise<void> => {
  const { tabId = getCurrentTabId() } = payload || {};
  const ownerId = global.currentUserId;
  if (!ownerId || !isXydriveOpen(global, tabId, ownerId)) return;

  const previous = global.byTabId[tabId].xydrive;
  if (previous?.status === 'loading' || (previous?.status === 'ready' && previous.nextOffsetId === undefined)) return;

  const requestId = ++nextRequestId;
  const offsetId = previous?.nextOffsetId;
  setGlobal(updateTabState(global, {
    xydrive: {
      ownerId,
      files: previous?.files || [],
      scannedCount: previous?.scannedCount || 0,
      nextOffsetId: offsetId,
      status: 'loading',
      requestId,
    },
  }, tabId));

  let result;
  try {
    result = await callApi('fetchXydriveHistory', { offsetId });
  } catch {
    result = undefined;
  }

  global = getGlobal();
  if (!isXydriveOpen(global, tabId, ownerId)) return;
  const current = global.byTabId[tabId]?.xydrive;
  // Closing, reopening or switching account invalidates the previous request.
  if (current?.ownerId !== ownerId || current.requestId !== requestId) return;

  if (!result || result.type === 'wait') {
    setGlobal(updateTabState(global, {
      xydrive: {
        ...current,
        requestId: undefined,
        status: 'error',
        error: result?.type === 'wait' ? 'wait' : 'generic',
      },
    }, tabId));
    return;
  }

  const files = result.messages.map((message) => getXydriveFile(message, ownerId)).filter(Boolean);
  setGlobal(updateTabState(global, {
    xydrive: {
      ownerId,
      files: mergeXydriveFiles(current.files, files),
      scannedCount: current.scannedCount + result.scannedCount,
      nextOffsetId: result.nextOffsetId,
      status: 'ready',
    },
  }, tabId));
});
