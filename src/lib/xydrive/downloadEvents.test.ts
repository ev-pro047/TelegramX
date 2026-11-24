import { describe, expect, it, vi } from 'vitest';

import { getXydriveDownloadObserver, observeXydriveDownload } from './downloadEvents';

describe('Xydrive native download observers', () => {
  it('routes native progress to the registered observer and unregisters it', () => {
    const observer = vi.fn();
    const stop = observeXydriveDownload('test-one', observer);
    getXydriveDownloadObserver('test-one')?.('progress', 0.5);
    expect(observer).toHaveBeenCalledWith('progress', 0.5);
    stop();
    expect(getXydriveDownloadObserver('test-one')).toBeUndefined();
  });

  it('does not let an old cleanup unregister a replacement request', () => {
    const first = vi.fn();
    const second = vi.fn();
    const stopFirst = observeXydriveDownload('test-two', first);
    const stopSecond = observeXydriveDownload('test-two', second);
    stopFirst();
    getXydriveDownloadObserver('test-two')?.('handedOff');
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('handedOff');
    stopSecond();
    expect(getXydriveDownloadObserver('test-two')).toBeUndefined();
  });
});
