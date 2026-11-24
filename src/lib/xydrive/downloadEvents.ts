export type XydriveDownloadEvent = 'progress' | 'handedOff' | 'failed' | 'canceled';
export type XydriveDownloadObserver = (event: XydriveDownloadEvent, progress?: number) => void;
const observers = new Map<string, XydriveDownloadObserver>();

export function observeXydriveDownload(hash: string, observer: XydriveDownloadObserver) {
  observers.set(hash, observer);
  return () => {
    if (observers.get(hash) === observer) observers.delete(hash);
  };
}

export function getXydriveDownloadObserver(hash: string) {
  return observers.get(hash);
}
