import type { ElementRef, TeactNode } from '../../lib/teact/teact';
import { memo, useEffect, useRef, useState } from '../../lib/teact/teact';

import type { TransferStatus } from '../../lib/xydrive/transfers';
import type { XydriveFile } from '../../lib/xydrive/types';
import type { RegularLangKey } from '../../types/language';

import { getFileIcon } from '../../lib/xydrive/collection';
import { classifyXydriveFile } from '../../lib/xydrive/fileMetadata';
import {
  cancelAllXydriveTransfers, cancelXydriveTransfer, clearXydriveTransferHistory, dismissXydriveTransfer,
  enqueueXydriveUploads, getXydriveTransfers, isActiveTransfer, retryXydriveTransfer, subscribeXydriveTransfers,
} from '../../lib/xydrive/transfers';
import { formatTimeDuration } from '../../util/dates/duration';
import { formatFileSize } from '../../util/text/textFormat';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

import workspaceStyles from './Xydrive.module.scss';
import styles from './XydriveTransfers.module.scss';

const STATUS: Record<TransferStatus, RegularLangKey> = {
  queued: 'XydriveTransferQueued', active: 'XydriveTransferActive', committing: 'XydriveTransferCommitting',
  complete: 'XydriveTransferComplete', handedOff: 'XydriveTransferHandedOff', failed: 'XydriveTransferFailed',
  canceled: 'XydriveTransferCanceled', wait: 'XydriveTransferWait', unavailable: 'XydriveTransferUnavailable',
  unknown: 'XydriveTransferUnknown', tooLarge: 'XydriveTransferTooLarge', empty: 'XydriveTransferEmptyFile',
  busy: 'XydriveTransferBusy',
};

const FILTERS = [
  ['all', 'XydriveTransferAll'], ['upload', 'XydriveTransferUploads'], ['download', 'XydriveTransferDownloads'],
  ['history', 'XydriveTransferHistory'], ['errors', 'XydriveTransferErrors'],
] as const;
const MAX_DISPLAY_FILES = 100;

type Filter = (typeof FILTERS)[number][0];

type Pending = {
  ownerId?: string;
  sourceId?: string;
  files: File[];
  duplicateIds: Set<number>;
  skipped: Set<number>;
};

type OwnProps = {
  ownerId?: string;
  sourceId?: string;
  destinationName?: string;
  files: readonly XydriveFile[];
  pickerRef: ElementRef<HTMLInputElement>;
  canUpload: boolean;
  children: TeactNode[];
};

const XydriveTransfers = ({ ownerId, sourceId, destinationName, files, pickerRef, canUpload, children }: OwnProps) => {
  const lang = useLang();
  const dragDepthRef = useRef(0);
  const [rows, setRows] = useState(() => getXydriveTransfers(ownerId));
  const [filter, setFilter] = useState<Filter>('all');
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [pending, setPending] = useState<Pending>();

  useEffect(() => {
    const update = () => setRows(getXydriveTransfers(ownerId));
    update();
    return subscribeXydriveTransfers(update);
  }, [ownerId]);

  useEffect(() => {
    dragDepthRef.current = 0;
    setIsDragging(false);
    setPending(undefined);
  }, [ownerId, sourceId, canUpload]);

  function addFiles(selected: File[]) {
    if (!canUpload || !selected.length) return;
    const names = new Set(files.map(({ name }) => name));
    const duplicateIds = new Set<number>();
    selected.forEach((file, position) => {
      if (names.has(file.name)) duplicateIds.add(position);
      names.add(file.name);
    });
    if (duplicateIds.size) {
      setPending({ ownerId, sourceId, files: selected, duplicateIds, skipped: new Set(duplicateIds) });
    } else {
      enqueueXydriveUploads(selected);
    }
  }

  const ownedRows = rows.filter((row) => row.ownerId === ownerId);
  const active = ownedRows.filter(({ status }) => isActiveTransfer(status));
  const totalBytes = active.reduce((sum, { size }) => sum + (size || 0), 0);
  const canShowTotals = totalBytes > 0 && active.every(({ size }) => size !== undefined);
  const transferred = active.reduce((sum, { size, progress }) => sum + (size || 0) * (progress || 0), 0);
  const visible = ownedRows.filter(({ status, direction }) => {
    if (filter === 'all') return true;
    if (filter === 'history') return !isActiveTransfer(status);
    if (filter === 'errors') return isTransferError(status);
    return direction === filter;
  });
  const currentPending = canUpload && pending?.ownerId === ownerId && pending?.sourceId === sourceId
    ? pending : undefined;
  const destination = destinationName || lang('XydriveRoot');
  const aggregate = canShowTotals ? `${lang.number(Math.floor(transferred / totalBytes * 100))}%` : undefined;

  return (
    <div className={styles.workspace}>
      <div
        className={styles.dropTarget}
        onDragEnter={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          if (!canUpload) return;
          dragDepthRef.current++;
          setIsDragging(true);
        }}
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes('Files')) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = canUpload ? 'copy' : 'none';
        }}
        onDragLeave={() => {
          dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
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
          <div className={styles.dropOverlay} role="status">
            <Icon name="arrow-up-circle-filled" />
            <strong dir="auto">{lang('XydriveDropDestination', { folder: destination })}</strong>
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
      <div className={styles.panel}>
        <button
          type="button"
          className={styles.heading}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          onClick={() => setIsOpen(true)}
        >
          <Icon name="download" />
          {lang('XydriveTransfers')}
          {active.length > 0 && (
            <span className={styles.badge}>
              {lang.number(active.length)}
              {aggregate && ` · ${aggregate}`}
            </span>
          )}
          {ownedRows.some(({ status }) => isTransferError(status)) && <Icon name="info" />}
        </button>
      </div>
      {isOpen && (
        <Modal
          isOpen
          hasCloseButton
          title={lang('XydriveTransfers')}
          isCondensedHeader
          dialogClassName={buildClassName(workspaceStyles.sheetFrame, styles.transferSheet)}
          onClose={() => setIsOpen(false)}
        >
          <div className={styles.transferContent}>
            <div className={styles.filters}>
              {FILTERS.map(([id, label]) => (
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
            </div>
            {canShowTotals && (
              <label className={styles.queueProgress}>
                {lang('XydriveQueueProgress')}
                {' '}
                ·
                {aggregate}
                <progress className={styles.progress} value={transferred} max={totalBytes} />
              </label>
            )}
            <div className={styles.list}>
              {!visible.length && <p className={styles.meta}>{lang('XydriveTransferEmpty')}</p>}
              {visible.map((row) => {
                const percent = row.progress === undefined ? undefined
                  : `${lang.number(Math.round(row.progress * 100))}%`;
                const isUpload = row.direction === 'upload';
                const direction = lang(isUpload ? 'XydriveTransferUploads' : 'XydriveTransferDownloads');
                const terminalIcon = isTransferError(row.status) ? 'info' : row.status === 'canceled' ? 'close'
                  : row.status === 'complete' || row.status === 'handedOff' ? 'check' : undefined;
                return (
                  <div key={row.id} className={styles.transfer} data-status={row.status}>
                    <span className={styles.transferIcon}>
                      <Icon name={getFileIcon(classifyXydriveFile(row.name))} />
                    </span>
                    <div className={styles.info}>
                      <strong className={styles.name} dir="auto" title={row.name}>{row.name}</strong>
                      <span className={styles.meta}>
                        <Icon name={isUpload ? 'arrow-up-circle-filled' : 'download'} ariaLabel={direction} />
                        {lang(STATUS[row.status])}
                        {terminalIcon && <Icon name={terminalIcon} />}
                        {percent && ` · ${percent}`}
                        {row.size !== undefined && ` · ${formatFileSize(lang, row.size)}`}
                      </span>
                      <span className={styles.destination} dir="auto">{row.destinationName || lang('XydriveRoot')}</span>
                      {isActiveTransfer(row.status) && (
                        <progress
                          className={styles.progress}
                          max={1}
                          value={row.progress}
                          aria-label={lang('XydriveTransferProgressNamed', { direction, name: row.name })}
                        />
                      )}
                      {row.size && row.speed && row.progress !== undefined ? (
                        <span className={styles.meta}>
                          {formatTimeDuration(lang, Math.ceil(row.size * (1 - row.progress) / row.speed))}
                          {' · '}
                          {formatFileSize(lang, Math.round(row.speed))}
                          /s
                        </span>
                      ) : undefined}
                    </div>
                    <div className={styles.rowActions}>
                      {(row.status === 'queued' || row.status === 'active') && (
                        <Button
                          size="tiny"
                          color="translucent"
                          noFastClick
                          noForcedUpperCase
                          onClick={() => cancelXydriveTransfer(row.id)}
                        >
                          {lang('XydriveTransferCancel')}
                        </Button>
                      )}
                      {row.canRetry && (
                        <Button
                          size="tiny"
                          color="translucent"
                          noFastClick
                          noForcedUpperCase
                          onClick={() => retryXydriveTransfer(row.id)}
                        >
                          {lang('XydriveTransferRetry')}
                        </Button>
                      )}
                      {!isActiveTransfer(row.status) && (
                        <button
                          type="button"
                          className={styles.dismiss}
                          aria-label={lang('XydriveDismissTransfer', { name: row.name })}
                          title={lang('XydriveDismissTransfer', { name: row.name })}
                          onClick={() => dismissXydriveTransfer(row.id, ownerId)}
                        >
                          <Icon name="close" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className={styles.footer}>
              {active.length > 0 && (
                <Button
                  size="tiny"
                  color="translucent"
                  noFastClick
                  noForcedUpperCase
                  onClick={() => cancelAllXydriveTransfers(ownerId)}
                >
                  {lang('XydriveTransferCancelAll')}
                </Button>
              )}
              <Button
                size="tiny"
                color="translucent"
                noFastClick
                noForcedUpperCase
                onClick={() => clearXydriveTransferHistory(ownerId)}
              >
                {lang('XydriveTransferClear')}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {currentPending && (
        <Modal
          isOpen
          isSlim
          hasCloseButton
          title={lang('XydriveDuplicateTitle')}
          dialogClassName={workspaceStyles.sheetFrame}
          onClose={() => setPending(undefined)}
        >
          <div className={styles.transferContent}>
            <p className={styles.meta} dir="auto">{lang('XydriveDropDestination', { folder: destination })}</p>
            <p className={styles.meta}>{lang('XydriveDuplicateChoices')}</p>
            <div className={styles.list}>
              {[...currentPending.duplicateIds].slice(0, MAX_DISPLAY_FILES).map((position) => (
                <label className={styles.duplicate} key={position}>
                  <input
                    type="checkbox"
                    checked={!currentPending.skipped.has(position)}
                    onChange={(event) => {
                      const skip = new Set(currentPending.skipped);
                      if (event.currentTarget.checked) skip.delete(position);
                      else skip.add(position);
                      setPending({ ...currentPending, skipped: skip });
                    }}
                  />
                  <span dir="auto">{currentPending.files[position].name}</span>
                </label>
              ))}
            </div>
            <Button
              size="smaller"
              noFastClick
              disabled={currentPending.files.length === currentPending.skipped.size}
              onClick={() => {
                const selected = currentPending.files.filter((_, position) => !currentPending.skipped.has(position));
                enqueueXydriveUploads(selected);
                setPending(undefined);
              }}
            >
              {lang('XydriveUpload')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

function isTransferError(status: TransferStatus) {
  return !isActiveTransfer(status) && status !== 'complete' && status !== 'handedOff' && status !== 'canceled';
}

export default memo(XydriveTransfers);
