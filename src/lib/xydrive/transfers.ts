import type { ApiAttachment, ApiOnProgress } from '../../api/types';
import type { XydriveFile } from './types';
import { MAIN_THREAD_ID } from '../../api/types';

import { callApi, cancelApiProgress } from '../../api/gramjs';
import { getActions, getGlobal, setGlobal } from '../../global';
import { getMediaHash } from '../../global/helpers/messageMedia';
import { updateChat } from '../../global/reducers/chats';
import { replaceMessages } from '../../global/reducers/messages';
import { updateTabState } from '../../global/reducers/tabs';
import { selectChat, selectTabState } from '../../global/selectors';
import { selectCurrentLimit } from '../../global/selectors/limits';
import { selectMessageDownloadableMedia } from '../../global/selectors/media';
import { selectAllowedMessageActionsSlow } from '../../global/selectors/messages';
import { selectSharedSettings } from '../../global/selectors/sharedState';
import { getCurrentTabId } from '../../util/establishMultitabRole';
import generateUniqueId from '../../util/generateUniqueId';
import { getUploadPartSize } from '../gramjs/Utils';
import { observeXydriveDownload } from './downloadEvents';
import { mergeXydriveFiles } from './fileMetadata';
import { buildXydriveChannel, getXydriveMounts } from './folders';
import { getXydriveMediaFile, matchesXydriveMedia } from './media';

export type TransferStatus = 'queued' | 'active' | 'committing' | 'complete' | 'handedOff'
  | 'failed' | 'canceled' | 'wait' | 'unavailable' | 'unknown' | 'tooLarge' | 'empty' | 'busy';

export type XydriveTransfer = {
  id: string;
  ownerId: string;
  sourceId: string;
  destinationName?: string;
  tabId: number;
  name: string;
  size?: number;
  direction: 'upload' | 'download';
  status: TransferStatus;
  progress?: number;
  speed?: number;
  canRetry: boolean;
};

type Job = {
  row: XydriveTransfer;
  file?: File;
  remote?: XydriveFile;
  cancel?: () => void;
  startedAt?: number;
  retryAt?: number;
  isCancelRequested?: boolean;
};

const jobs = new Map<string, Job>();
const listeners = new Set<() => void>();
const MAX_HISTORY = 50;
const MAX_CONCURRENT = 2;
const MAX_PENDING = 100;
const RETRY_DELAY = 30_000;
let running = 0;

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeXydriveTransfers(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function isActiveTransfer(status: TransferStatus) {
  return status === 'queued' || status === 'active' || status === 'committing';
}

export function getXydriveTransfers(ownerId?: string) {
  return Array.from(jobs.values()).filter(({ row }) => row.ownerId === ownerId)
    .map(({ row }) => row).reverse();
}

function patch(job: Job, changes: Partial<XydriveTransfer>) {
  job.row = { ...job.row, ...changes };
  notify();
}

function getContext(job: Job) {
  const global = getGlobal();
  const { ownerId, sourceId, tabId } = job.row;
  if (global.currentUserId !== ownerId || global.passcode.isScreenLocked
    || !selectSharedSettings(global).isXydriveEnabled || !global.byTabId[tabId]) return undefined;
  const folder = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId)
    .find(({ id }) => id === sourceId);
  if (sourceId !== ownerId && !folder) return undefined;
  return { global, folder };
}

function progress(job: Job, value: number) {
  if (job.row.status !== 'active' || job.isCancelRequested || !Number.isFinite(value)) return;
  if (!getContext(job)) {
    job.isCancelRequested = true;
    job.cancel?.();
    return;
  }
  const ratio = Math.max(0, Math.min(1, value));
  const elapsed = (Date.now() - (job.startedAt || Date.now())) / 1000;
  patch(job, {
    progress: ratio,
    speed: job.row.size && elapsed > 0.5 ? job.row.size * ratio / elapsed : undefined,
  });
}

function finish(job: Job, status: TransferStatus) {
  const canRetry = status === 'failed' || status === 'wait' || status === 'canceled' || status === 'busy';
  if (status === 'wait') job.retryAt = Date.now() + RETRY_DELAY;
  if (!canRetry) job.file = undefined;
  job.cancel = undefined;
  patch(job, { status, canRetry, speed: undefined });
  const completed = Array.from(jobs.values()).filter(({ row }) => !isActiveTransfer(row.status));
  completed.slice(0, Math.max(0, completed.length - MAX_HISTORY)).forEach(({ row }) => jobs.delete(row.id));
  notify();
}

function getDestination(remote?: XydriveFile) {
  const global = getGlobal();
  const ownerId = global.currentUserId;
  const tabId = getCurrentTabId();
  const tab = selectTabState(global, tabId);
  if (!ownerId || tab?.xydriveOwnerId !== ownerId || global.passcode.isScreenLocked
    || !selectSharedSettings(global).isXydriveEnabled) return undefined;
  const sourceId = remote?.chatId || tab.xydriveSourceId || ownerId;
  if (remote) {
    const known = (tab.xydrive?.ownerId === ownerId && tab.xydrive.files.some(({ id, mediaId }) => id === remote.id && mediaId === remote.mediaId))
      || (tab.xydriveIndex?.ownerId === ownerId && tab.xydriveIndex.sources[sourceId]?.files.some(({ id, mediaId }) => id === remote.id && mediaId === remote.mediaId));
    if (!known || (sourceId !== ownerId && !getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId).some(({ id }) => id === sourceId))) return undefined;
  }
  const destinationName = getXydriveMounts(global.settings.byKey.xydriveMounts, ownerId)
    .find(({ id }) => id === sourceId)?.title;
  return { ownerId, sourceId, destinationName, tabId };
}

function enqueue(direction: 'upload' | 'download', name: string, size: number | undefined, file?: File, remote?: XydriveFile) {
  const destination = getDestination(remote);
  if (!destination) return;
  if (Array.from(jobs.values()).filter(({ row }) => isActiveTransfer(row.status)).length >= MAX_PENDING) {
    getActions().showNotification({ message: { key: 'XydriveTransferQueueFull' } });
    return;
  }
  if (remote && remote.chatId !== destination.sourceId) return;
  const id = generateUniqueId();
  const job: Job = { row: { ...destination, id, name, size, direction, status: 'queued', canRetry: false }, file, remote };
  jobs.set(id, job);
  notify();
  pump();
}

export function enqueueXydriveUploads(files: File[]) {
  files.forEach((file) => enqueue('upload', file.name, file.size, file));
}

export function enqueueXydriveDownload(file: XydriveFile) {
  enqueue('download', file.name, file.size, undefined, file);
}

export function cancelXydriveTransfer(id: string) {
  const job = jobs.get(id);
  if (!job || !getContext(job)) return;
  if (job.row.status === 'queued') finish(job, 'canceled');
  else if (job.row.status === 'active' && !job.isCancelRequested) {
    job.isCancelRequested = true;
    job.cancel?.();
  }
}

export function cancelAllXydriveTransfers(ownerId?: string) {
  jobs.forEach(({ row }) => {
    if (row.ownerId === ownerId) cancelXydriveTransfer(row.id);
  });
}

export function retryXydriveTransfer(id: string) {
  const job = jobs.get(id);
  if (!job || !job.row.canRetry || !getContext(job)) return;
  if ((job.retryAt || 0) > Date.now()) {
    getActions().showNotification({ message: { key: 'XydriveTransferWait' } });
    return;
  }
  if (Array.from(jobs.values()).filter(({ row }) => isActiveTransfer(row.status)).length >= MAX_PENDING) {
    getActions().showNotification({ message: { key: 'XydriveTransferQueueFull' } });
    return;
  }
  job.isCancelRequested = false;
  patch(job, { status: 'queued', canRetry: false, progress: undefined, speed: undefined });
  pump();
}

export function clearXydriveTransferHistory(ownerId?: string) {
  jobs.forEach((job, id) => {
    if (job.row.ownerId === ownerId && !isActiveTransfer(job.row.status)) jobs.delete(id);
  });
  notify();
}

function validateSize(file: File) {
  if (!file.size) return 'empty' as const;
  try {
    const parts = Math.ceil(file.size / (getUploadPartSize(file.size) * 1024));
    if (parts > selectCurrentLimit(getGlobal(), 'uploadMaxFileparts')) return 'tooLarge' as const;
  } catch {
    return 'tooLarge' as const;
  }
  return undefined;
}

async function refreshFolder(job: Job) {
  const context = getContext(job);
  if (!context) return;
  const { ownerId, sourceId, tabId } = job.row;
  const tab = selectTabState(context.global, tabId);
  const previous = tab.xydrive;
  if (tab.xydriveOwnerId !== ownerId || previous?.sourceId !== sourceId || previous.status !== 'ready') return;
  const result = await callApi('fetchXydriveHistory', { channel: context.folder && buildXydriveChannel(context.folder) });
  const currentContext = getContext(job);
  if (!currentContext || result?.type !== 'page') return;
  const current = selectTabState(currentContext.global, tabId);
  if (current.xydriveOwnerId !== ownerId || current.xydrive?.sourceId !== sourceId
    || current.xydrive.status !== 'ready') return;
  const files = result.messages.map((message) => getXydriveMediaFile(message, sourceId)).filter(Boolean);
  setGlobal(updateTabState(currentContext.global, {
    xydrive: { ...current.xydrive, files: mergeXydriveFiles(current.xydrive.files, files) },
  }, tabId));
}

async function upload(job: Job) {
  const context = getContext(job);
  const file = job.file;
  if (!context || !file) return finish(job, 'unavailable');
  const error = validateSize(file);
  if (error) return finish(job, error);
  const chat = selectChat(context.global, job.row.sourceId)
    || (context.folder && buildXydriveChannel(context.folder));
  if (!chat) return finish(job, 'unavailable');
  const blobUrl = URL.createObjectURL(file);
  const attachment: ApiAttachment = {
    blobUrl, filename: file.name, mimeType: file.type || 'application/octet-stream',
    size: file.size, uniqueId: job.row.id, shouldSendAsFile: true,
  };
  const callback: ApiOnProgress = (value, state) => {
    if (state === 'committing') {
      patch(job, { status: 'committing', progress: 1, speed: undefined });
    } else {
      progress(job, value);
    }
  };
  job.cancel = () => {
    cancelApiProgress(callback);
    patch(job, { canRetry: false });
  };
  try {
    const status = await callApi('uploadXydriveDocument', {
      ownerId: job.row.ownerId, chat, channel: context.folder && buildXydriveChannel(context.folder), attachment,
    }, callback);
    finish(job, status || 'unknown');
    if (status === 'complete') void refreshFolder(job).catch(() => undefined);
  } catch {
    finish(job, 'unknown');
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

async function download(job: Job) {
  const context = getContext(job);
  const file = job.remote;
  if (!context || !file) return finish(job, 'unavailable');
  let canceled = false;
  job.cancel = () => { canceled = true; };
  const result = await callApi('fetchXydriveMediaMessage', {
    messageId: file.messageId, channel: context.folder && buildXydriveChannel(context.folder),
  });
  if (canceled) return finish(job, 'canceled');
  const current = getContext(job);
  if (!current) return finish(job, 'unavailable');
  if (result?.type === 'wait') return finish(job, 'wait');
  if (result?.type !== 'message') return finish(job, 'unavailable');
  const refreshed = getXydriveMediaFile(result.message, job.row.sourceId);
  if (!refreshed || !matchesXydriveMedia(file, refreshed)) return finish(job, 'unavailable');

  let global = current.global;
  if (result.chat) global = updateChat(global, result.chat.id, result.chat);
  if (!selectAllowedMessageActionsSlow(global, result.message, MAIN_THREAD_ID).canDownload) {
    return finish(job, 'unavailable');
  }
  const media = selectMessageDownloadableMedia(global, result.message);
  const hash = media && getMediaHash(media, 'download');
  if (!media || !hash || ('id' in media && media.id !== refreshed.mediaId)) return finish(job, 'unavailable');
  if (selectTabState(global, job.row.tabId).activeDownloads[hash]) return finish(job, 'busy');
  global = replaceMessages(global, [result.message]);
  setGlobal(global);

  await new Promise<void>((resolve) => {
    const actions = getActions();
    let settled = false;
    const stop = observeXydriveDownload(hash, (event, value) => {
      if (settled || !isActiveTransfer(job.row.status)) return;
      if (event === 'progress') {
        if (value !== undefined) progress(job, value);
        return;
      }
      settled = true;
      stop();
      finish(job, event);
      resolve();
    });
    job.cancel = () => {
      if (settled) return;
      settled = true;
      stop();
      actions.cancelMediaHashDownloads({ mediaHashes: [hash], tabId: job.row.tabId });
      finish(job, 'canceled');
      resolve();
    };
    actions.downloadMedia({ media, originMessage: result.message, tabId: job.row.tabId });
  });
}

function pump() {
  while (running < MAX_CONCURRENT) {
    const job = Array.from(jobs.values()).find(({ row }) => row.status === 'queued');
    if (!job) return;
    running += 1;
    job.startedAt = Date.now();
    patch(job, { status: 'active' });
    const run = job.row.direction === 'upload' ? upload : download;
    const timer = window.setInterval(() => {
      if (getContext(job) || job.row.status !== 'active' || job.isCancelRequested) return;
      job.isCancelRequested = true;
      job.cancel?.();
    }, 500);
    void run(job).catch(() => finish(job, 'failed')).finally(() => {
      window.clearInterval(timer);
      running -= 1;
      pump();
    });
  }
}
