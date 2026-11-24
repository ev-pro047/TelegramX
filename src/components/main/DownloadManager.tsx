import { memo, useEffect } from '../../lib/teact/teact';
import { getActions, getGlobal, withGlobal } from '../../global';

import type { TabState } from '../../global/types';
import { ApiMediaFormat } from '../../api/types';

import { selectTabState } from '../../global/selectors';
import { getXydriveDownloadObserver } from '../../lib/xydrive/downloadEvents';
import { IS_OPFS_SUPPORTED, IS_SERVICE_WORKER_SUPPORTED, MAX_BUFFER_SIZE } from '../../util/browser/windowEnvironment';
import download from '../../util/download';
import generateUniqueId from '../../util/generateUniqueId';
import * as mediaLoader from '../../util/mediaLoader';

import useLastCallback from '../../hooks/useLastCallback';
import useRunDebounced from '../../hooks/useRunDebounced';

type StateProps = {
  activeDownloads: TabState['activeDownloads'];
};

const GLOBAL_UPDATE_DEBOUNCE = 1000;

const processedHashes = new Map<string, TabState['activeDownloads'][string]>();
const trackedCancellations = new Map<string, () => void>();
const downloadedHashes = new Set<string>();

const DownloadManager = ({
  activeDownloads,
}: StateProps) => {
  const { cancelMediaHashDownloads, showNotification } = getActions();

  const runDebounced = useRunDebounced(GLOBAL_UPDATE_DEBOUNCE, true);

  const handleMediaDownloaded = useLastCallback((hash: string) => {
    downloadedHashes.add(hash);
    runDebounced(() => {
      if (downloadedHashes.size) {
        cancelMediaHashDownloads({ mediaHashes: Array.from(downloadedHashes) });
        downloadedHashes.clear();
      }
    });
  });

  useEffect(() => {
    processedHashes.forEach((metadata, hash) => {
      if (activeDownloads[hash] === metadata) return;
      processedHashes.delete(hash);
      trackedCancellations.get(hash)?.();
      trackedCancellations.delete(hash);
    });

    Object.entries(activeDownloads).forEach(([mediaHash, metadata]) => {
      if (processedHashes.get(mediaHash) === metadata) return;
      processedHashes.set(mediaHash, metadata);

      const observer = getXydriveDownloadObserver(mediaHash);
      const isStillActive = () => selectTabState(getGlobal()).activeDownloads[mediaHash] === metadata;
      const finish = (event: 'handedOff' | 'failed') => {
        if (!observer) {
          handleMediaDownloaded(mediaHash);
          return;
        }
        if (!isStillActive() || getXydriveDownloadObserver(mediaHash) !== observer) return;
        trackedCancellations.delete(mediaHash);
        // Remove this specific native download before exposing the retry control.
        cancelMediaHashDownloads({ mediaHashes: [mediaHash] });
        observer(event);
      };
      const { size, filename, format: mediaFormat } = metadata;

      const mediaData = mediaLoader.getFromMemory(mediaHash);

      if (mediaData) {
        download(mediaData, filename);
        finish('handedOff');
        return;
      }

      if (size > MAX_BUFFER_SIZE && !IS_OPFS_SUPPORTED && !IS_SERVICE_WORKER_SUPPORTED) {
        showNotification({
          message: { key: 'DownloadSizeUnsupported' },
        });
        finish('failed');
        return;
      }

      const handleProgress = (progress: number) => {
        const currentDownloads = selectTabState(getGlobal()).activeDownloads;
        if (!currentDownloads[mediaHash] || (observer && !isStillActive())) {
          mediaLoader.cancelProgress(handleProgress);
          if (observer && getXydriveDownloadObserver(mediaHash) === observer) observer('canceled');
        } else {
          observer?.('progress', progress);
        }
      };

      if (observer) {
        trackedCancellations.set(mediaHash, () => {
          mediaLoader.cancelProgress(handleProgress);
          if (getXydriveDownloadObserver(mediaHash) === observer) observer('canceled');
        });
      }

      mediaLoader.fetch(mediaHash, mediaFormat, handleProgress, generateUniqueId()).then(async (result) => {
        if (observer && (!isStillActive() || getXydriveDownloadObserver(mediaHash) !== observer)) return;
        if (!result) {
          finish('failed');
          return;
        }
        if (mediaFormat === ApiMediaFormat.DownloadUrl) {
          const url = new URL(result, window.document.baseURI);
          url.searchParams.set('filename', encodeURIComponent(filename));
          const signedUrl = await mediaLoader.signDownloadUrl(url.toString());
          if (observer && (!isStillActive() || getXydriveDownloadObserver(mediaHash) !== observer)) return;
          const downloadWindow = signedUrl ? window.open(signedUrl) : undefined;

          downloadWindow?.addEventListener('beforeunload', () => {
            showNotification({
              message: { key: 'DownloadKeepAppOpen' },
            });
          }, { once: true });
          finish(downloadWindow ? 'handedOff' : 'failed');
        } else {
          download(result, filename);
          finish('handedOff');
        }
      }).catch(() => {
        finish('failed');
      });
    });
  }, [activeDownloads]);

  return undefined;
};

export default memo(withGlobal(
  (global): Complete<StateProps> => {
    const activeDownloads = selectTabState(global).activeDownloads;

    return {
      activeDownloads,
    };
  },
)(DownloadManager));
