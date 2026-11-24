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

const processedHashes = new Set<string>();
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
    if (!Object.keys(activeDownloads).length) {
      processedHashes.clear();
      return;
    }

    processedHashes.forEach((hash) => {
      if (!activeDownloads[hash]) processedHashes.delete(hash);
    });

    Object.entries(activeDownloads).forEach(([mediaHash, metadata]) => {
      if (processedHashes.has(mediaHash)) {
        return;
      }
      processedHashes.add(mediaHash);

      const observer = getXydriveDownloadObserver(mediaHash);
      const isStillActive = () => selectTabState(getGlobal()).activeDownloads[mediaHash] === metadata;
      const { size, filename, format: mediaFormat } = metadata;

      const mediaData = mediaLoader.getFromMemory(mediaHash);

      if (mediaData) {
        download(mediaData, filename);
        observer?.('handedOff');
        handleMediaDownloaded(mediaHash);
        return;
      }

      if (size > MAX_BUFFER_SIZE && !IS_OPFS_SUPPORTED && !IS_SERVICE_WORKER_SUPPORTED) {
        showNotification({
          message: { key: 'DownloadSizeUnsupported' },
        });
        observer?.('failed');
        handleMediaDownloaded(mediaHash);
        return;
      }

      const handleProgress = (progress: number) => {
        const currentDownloads = selectTabState(getGlobal()).activeDownloads;
        if (!currentDownloads[mediaHash]) {
          mediaLoader.cancelProgress(handleProgress);
          observer?.('canceled');
        } else {
          observer?.('progress', progress);
        }
      };

      mediaLoader.fetch(mediaHash, mediaFormat, handleProgress, generateUniqueId()).then(async (result) => {
        if (observer && !isStillActive()) return;
        if (!result) {
          observer?.('failed');
          handleMediaDownloaded(mediaHash);
          return;
        }
        if (mediaFormat === ApiMediaFormat.DownloadUrl) {
          const url = new URL(result, window.document.baseURI);
          url.searchParams.set('filename', encodeURIComponent(filename));
          const signedUrl = await mediaLoader.signDownloadUrl(url.toString());
          if (observer && !isStillActive()) return;
          const downloadWindow = signedUrl ? window.open(signedUrl) : undefined;
          observer?.(downloadWindow ? 'handedOff' : 'failed');

          downloadWindow?.addEventListener('beforeunload', () => {
            showNotification({
              message: { key: 'DownloadKeepAppOpen' },
            });
          }, { once: true });
        } else if (result) {
          download(result, filename);
          observer?.('handedOff');
        }

        handleMediaDownloaded(mediaHash);
      }).catch(() => {
        if (observer && !isStillActive()) return;
        observer?.('failed');
        handleMediaDownloaded(mediaHash);
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
