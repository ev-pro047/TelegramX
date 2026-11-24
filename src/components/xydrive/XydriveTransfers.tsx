import type { ElementRef, TeactNode } from '../../lib/teact/teact';
import { memo, useEffect, useRef, useState } from '../../lib/teact/teact';

import type { TransferStatus } from '../../lib/xydrive/transfers';
import type { XydriveFile } from '../../lib/xydrive/types';
import type { RegularLangKey } from '../../types/language';

import {
  cancelAllXydriveTransfers, cancelXydriveTransfer, clearXydriveTransferHistory,
  enqueueXydriveUploads, getXydriveTransfers,
  isActiveTransfer, retryXydriveTransfer, subscribeXydriveTransfers,
} from '../../lib/xydrive/transfers';
import { formatFileSize } from '../../util/text/textFormat';

import useLang from '../../hooks/useLang';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';

import styles from './XydriveTransfers.module.scss';

const STATUS: Record<TransferStatus, RegularLangKey> = {
  queued: 'XydriveTransferQueued',
  active: 'XydriveTransferActive',
  committing: 'XydriveTransferCommitting',
  complete: 'XydriveTransferComplete',
  handedOff: 'XydriveTransferHandedOff',
  failed: 'XydriveTransferFailed',
  canceled: 'XydriveTransferCanceled',
  wait: 'XydriveTransferWait',
  unavailable: 'XydriveTransferUnavailable',
  unknown: 'XydriveTransferUnknown',
  tooLarge: 'XydriveTransferTooLarge',
  empty: 'XydriveTransferEmptyFile',
  busy: 'XydriveTransferBusy',
};

type Filter = 'all' | 'upload' | 'download' | 'history';
const FILTERS: { id: Filter; label: RegularLangKey }[] = [
  { id: 'all', label: 'XydriveTransferAll' },
  { id: 'upload', label: 'XydriveTransferUploads' },
  { id: 'download', label: 'XydriveTransferDownloads' },
  { id: 'history', label: 'XydriveTransferHistory' },
];

type OwnProps = {
  ownerId?: string;
  sourceId?: string;
  files: readonly XydriveFile[];
  pickerRef: ElementRef<HTMLInputElement>;
  canUpload: boolean;
  children: TeactNode[];
};

const XydriveTransfers = ({ ownerId, sourceId, files, pickerRef, canUpload, children }: OwnProps) => {
  const lang = useLang();
  const dragDepthRef = useRef(0);
  const lastActiveRef = useRef(0);
  const [rows, setRows] = useState(() => getXydriveTransfers(ownerId));
  const [filter, setFilter] = useState<Filter>('all');
  const [expanded, setExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pending, setPending] = useState<{ ownerId?: string; sourceId?: string; files: File[] }>();

  useEffect(() => {
    const update = () => setRows(getXydriveTransfers(ownerId));
    update();
    return subscribeXydriveTransfers(update);
  }, [ownerId]);

  function addFiles(selected: File[]) {
    if (!canUpload || !selected.length) return;
    const names = new Set(files.map(({ name }) => name));
    if (selected.some(({ name }) => {
      if (names.has(name)) return true;
      names.add(name);
      return false;
    })) {
      setPending({ ownerId, sourceId, files: selected });
      return;
    }
    enqueueXydriveUploads(selected);
    setExpanded(true);
  }

  const ownedRows = rows.filter((row) => row.ownerId === ownerId);
  const active = ownedRows.filter(({ status }) => isActiveTransfer(status)).length;
  const visible = ownedRows.filter(({ status, direction }) => filter === 'all'
    || (filter === 'history' ? !isActiveTransfer(status) : direction === filter));

  useEffect(() => {
    if (active && !lastActiveRef.current) setExpanded(true);
    lastActiveRef.current = active;
  }, [active]);

  useEffect(() => {
    dragDepthRef.current = 0;
    setIsDragging(false);
    setPending(undefined);
  }, [ownerId, sourceId, canUpload]);

  const pendingFiles = canUpload && pending?.ownerId === ownerId && pending?.sourceId === sourceId
    ? pending?.files : undefined;

  return (
    <div className={styles.workspace}>
      <div
        className={styles.dropTarget}
        onDragEnter={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          if (!canUpload) return;
          dragDepthRef.current += 1;
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = canUpload ? 'copy' : 'none';
        }}
        onDragLeave={() => {
          if (dragDepthRef.current <= 0) return;
          dragDepthRef.current -= 1;
          if (!dragDepthRef.current) setIsDragging(false);
        }}
        onDrop={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          dragDepthRef.current = 0;
          setIsDragging(false);
          addFiles(Array.from(event.dataTransfer.files));
        }}
      >
        {children}
        {canUpload && isDragging && (
          <div className={styles.dropOverlay}>
            <Icon name="arrow-up-circle-filled" />
            <strong>{lang('XydriveDropFiles')}</strong>
          </div>
        )}
      </div>
      <input
        key={sourceId || 'root'}
        ref={pickerRef}
        type="file"
        multiple
        hidden
        disabled={!canUpload}
        onChange={(event) => {
          addFiles(Array.from(event.currentTarget.files || []));
          event.currentTarget.value = '';
        }}
      />
      <section className={styles.panel} aria-label={lang('XydriveTransfers')}>
        {pendingFiles && (
          <div className={styles.toolbar} role="alert">
            <span>{lang('XydriveTransferDuplicate')}</span>
            <Button
              size="tiny"
              onClick={() => {
                enqueueXydriveUploads(pendingFiles);
                setPending(undefined);
                setExpanded(true);
              }}
            >
              {lang('XydriveUpload')}
            </Button>
            <Button size="tiny" color="translucent" onClick={() => setPending(undefined)}>
              {lang('XydriveTransferCancel')}
            </Button>
          </div>
        )}
        <button
          type="button"
          className={styles.heading}
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <span className={styles.headingLabel}>
            <Icon name="download" />
            {lang('XydriveTransfers')}
          </span>
          <span className={styles.headingLabel}>
            {active > 0 && lang.number(active)}
            <span aria-hidden="true">{expanded ? '▴' : '▾'}</span>
          </span>
        </button>
        {expanded && (
          <>
            <div className={styles.toolbar}>
              {FILTERS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  className={filter === id ? styles.selected : styles.filter}
                  aria-pressed={filter === id}
                  onClick={() => setFilter(id)}
                >
                  {lang(label)}
                </button>
              ))}
              {active > 0 && (
                <Button size="tiny" color="translucent" onClick={() => cancelAllXydriveTransfers(ownerId)}>
                  {lang('XydriveTransferCancelAll')}
                </Button>
              )}
              <Button size="tiny" color="translucent" onClick={() => clearXydriveTransferHistory(ownerId)}>
                {lang('XydriveTransferClear')}
              </Button>
            </div>
            <div className={styles.list}>
              {!visible.length && <span className={styles.meta}>{lang('XydriveTransferEmpty')}</span>}
              {visible.map((row) => (
                <div key={row.id} className={styles.transfer}>
                  <div className={styles.info}>
                    <strong className={styles.name} dir="auto">{row.name}</strong>
                    <span className={styles.meta}>
                      {row.direction === 'upload' ? '↑' : '↓'}
                      {' '}
                      {lang(STATUS[row.status])}
                      {row.size !== undefined ? ` · ${formatFileSize(lang, row.size)}` : ''}
                    </span>
                    <span className={styles.meta} dir="auto">{row.destinationName || lang('XydriveRoot')}</span>
                    {row.progress !== undefined && isActiveTransfer(row.status) && (
                      <progress className={styles.progress} max={1} value={row.progress} />
                    )}
                    {row.speed ? (
                      <span className={styles.meta}>
                        {formatFileSize(lang, Math.round(row.speed))}
                        /s
                        {row.size && row.progress !== undefined
                          ? ` · ~${Math.ceil(row.size * (1 - row.progress) / row.speed)}s` : ''}
                      </span>
                    ) : undefined}
                  </div>
                  {(row.status === 'queued' || row.status === 'active') && (
                    <Button size="tiny" color="translucent" onClick={() => cancelXydriveTransfer(row.id)}>
                      {lang('XydriveTransferCancel')}
                    </Button>
                  )}
                  {row.canRetry && (
                    <Button size="tiny" color="translucent" onClick={() => retryXydriveTransfer(row.id)}>
                      {lang('XydriveTransferRetry')}
                    </Button>
                  )}
                </div>
              ))}
            </div>
            <span className={styles.meta}>{lang('XydriveTransferLimit')}</span>
          </>
        )}
      </section>
    </div>
  );
};

export default memo(XydriveTransfers);
