import { memo, useEffect, useMemo, useState } from '../../lib/teact/teact';

import type { ApiChat } from '../../api/types';
import type { XydriveCategory, XydriveFile, XydriveMount, XydriveState } from '../../lib/xydrive/types';
import type { IconName } from '../../types/icons';
import type { RegularLangKey } from '../../types/language';

import { isXydriveChannelEligible } from '../../lib/xydrive/folders';
import { formatFileSize } from '../../util/text/textFormat';

import useLang from '../../hooks/useLang';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import Loading from '../ui/Loading';
import Modal from '../ui/Modal';

import styles from './Xydrive.module.scss';

type OwnProps = {
  isOpen: boolean;
  drive?: XydriveState;
  sourceId?: string;
  folders?: XydriveMount[];
  chats?: Record<string, ApiChat>;
  mountingId?: string;
  mountError?: 'wait' | 'generic' | 'unavailable';
  onClose: NoneToVoidFunction;
  onOpenSaved: NoneToVoidFunction;
  onLoadMore: NoneToVoidFunction;
  onSelectSource: (channelId?: string) => void;
  onMount: (channelId: string) => void;
  onUnmount: (channelId: string) => void;
};

const CATEGORY_LABELS: Record<XydriveCategory, RegularLangKey> = {
  images: 'XydriveImages',
  videos: 'XydriveVideos',
  audio: 'XydriveAudio',
  documents: 'XydriveDocuments',
  archives: 'XydriveArchives',
  other: 'XydriveOther',
};

const CATEGORY_ICONS: Record<XydriveCategory, IconName> = {
  images: 'sd-photo',
  videos: 'video',
  audio: 'music',
  documents: 'document',
  archives: 'archive',
  other: 'file-badge',
};

const XydriveFileRow = memo(({ file }: { file: XydriveFile }) => {
  const lang = useLang();
  const size = file.size === undefined ? lang('XydriveUnknownSize') : formatFileSize(lang, file.size);

  return (
    <li className={styles.fileRow}>
      <Icon name={CATEGORY_ICONS[file.category]} className={styles.fileIcon} />
      <div className={styles.fileInfo}>
        <span className={styles.fileName} dir="auto">{file.name}</span>
        <span className={styles.fileMeta}>{lang(CATEGORY_LABELS[file.category])} · {size}</span>
      </div>
    </li>
  );
});

const Xydrive = ({
  isOpen, drive, sourceId, folders, chats, mountingId, mountError,
  onClose, onOpenSaved, onLoadMore, onSelectSource, onMount, onUnmount,
}: OwnProps) => {
  const lang = useLang();
  const [isMountPickerOpen, setIsMountPickerOpen] = useState(false);
  const folder = folders?.find(({ id }) => id === sourceId);
  const candidates = useMemo(() => {
    if (!isMountPickerOpen || !chats) return [];
    const mounted = new Set(folders?.map(({ id }) => id));
    return Object.values(chats).filter((chat) => isXydriveChannelEligible(chat) && !mounted.has(chat.id))
      .sort((left, right) => left.title.localeCompare(right.title));
  }, [isMountPickerOpen, chats, folders]);

  useEffect(() => {
    if (!isOpen || sourceId) setIsMountPickerOpen(false);
  }, [isOpen, sourceId]);

  const files = drive?.files;
  const isLoading = !drive || drive.status === 'loading';
  const hasError = drive?.status === 'error';
  const hasMore = drive?.nextOffsetId !== undefined;

  return (
    <Modal
      isOpen={isOpen}
      title={lang('XydriveTitle')}
      dialogClassName={styles.dialog}
      hasCloseButton
      isBackButton
      onClose={onClose}
    >
      <div className={styles.workspace} dir={lang.isRtl ? 'rtl' : 'ltr'}>
        <div className={styles.header}>
          <div className={styles.headerText}>
            <span className={styles.badge}>{lang('XydriveBeta')}</span>
            <h2 className={styles.heading}>{lang('XydriveMyDrive')}</h2>
            <p className={styles.description}>{lang('XydriveDriveDesc')}</p>
          </div>
          {!sourceId && (
            <Button size="smaller" color="translucent" onClick={() => setIsMountPickerOpen(!isMountPickerOpen)}>
              {lang(isMountPickerOpen ? 'Close' : 'XydriveMountFolder')}
            </Button>
          )}
        </div>
        <nav className={styles.breadcrumb} aria-label={lang('XydriveFolderPath')}>
          <Button
            size="smaller"
            color="translucent"
            onClick={() => onSelectSource()}
            disabled={!sourceId}
          >
            {lang('XydriveRoot')}
          </Button>
          {folder && <span className={styles.folderPath} dir="auto">/ {folder.title}</span>}
        </nav>
        {!sourceId && (
          <>
            {isMountPickerOpen && (
              <section className={styles.mountPanel}>
                <h3 className={styles.sectionTitle}>{lang('XydriveMountFolder')}</h3>
                <p className={styles.description}>{lang('XydriveMountDesc')}</p>
                {candidates.length === 0 && <p className={styles.description}>{lang('XydriveNoChannels')}</p>}
                {candidates.map((chat) => (
                  <div key={chat.id} className={styles.mountRow}>
                    <Icon name="folder" className={styles.fileIcon} />
                    <span className={styles.fileName} dir="auto">{chat.title}</span>
                    <Button
                      size="smaller"
                      color="translucent"
                      disabled={Boolean(mountingId)}
                      onClick={() => onMount(chat.id)}
                    >
                      {lang(mountingId === chat.id ? 'XydriveMounting' : 'XydriveMount')}
                    </Button>
                  </div>
                ))}
                {mountError && (
                  <p className={styles.description} role="alert">
                    {lang(mountError === 'wait' ? 'XydriveWait'
                      : mountError === 'unavailable' ? 'XydriveUnavailable' : 'XydriveMountError')}
                  </p>
                )}
              </section>
            )}
            <h3 className={styles.sectionTitle}>{lang('XydriveFolders')}</h3>
            {folders?.length ? (
              <div className={styles.folderGrid}>
                {folders.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={styles.folderCard}
                    onClick={() => onSelectSource(item.id)}
                  >
                    <Icon name="folder-filled" className={styles.folderIcon} />
                    <span className={styles.fileName} dir="auto">{item.title}</span>
                    <span className={styles.fileMeta}>{lang('XydrivePrivateChannel')}</span>
                  </button>
                ))}
              </div>
            ) : <p className={styles.description}>{lang('XydriveNoFolders')}</p>}
          </>
        )}
        <div className={styles.fileHeader}>
          <h3 className={styles.sectionTitle}>{lang(sourceId ? 'XydriveFolderFiles' : 'XydriveRootFiles')}</h3>
          {folder ? (
            <Button size="smaller" color="translucent" onClick={() => onUnmount(folder.id)}>
              {lang('XydriveUnmount')}
            </Button>
          ) : (
            <Button size="smaller" color="translucent" onClick={onOpenSaved}>
              {lang('XydriveOpenSaved')}
            </Button>
          )}
        </div>
        {Boolean(files?.length) && (
          <ul className={styles.fileList}>
            {files!.map((file) => <XydriveFileRow key={file.id} file={file} />)}
          </ul>
        )}
        <div className={styles.status} aria-live="polite">
          {isLoading && <Loading />}
          {hasError && (
            <p className={styles.description}>
              {lang(drive?.error === 'wait' ? 'XydriveWait'
                : drive?.error === 'unavailable' ? 'XydriveUnavailable' : 'XydriveLoadError')}
            </p>
          )}
          {!isLoading && !hasError && !files?.length && (
            <p className={styles.description}>
              {lang(hasMore ? 'XydriveNoFilesYet' : sourceId ? 'XydriveEmptyFolder' : 'XydriveEmpty')}
            </p>
          )}
          {!isLoading && !hasError && Boolean(files?.length) && !hasMore && (
            <p className={styles.description}>{lang(sourceId ? 'XydriveFolderEnd' : 'XydriveEnd')}</p>
          )}
          {!isLoading && (hasError || hasMore) && (
            <Button color="translucent" onClick={onLoadMore}>
              {lang(hasError ? 'XydriveRetry' : 'XydriveLoadMore')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default memo(Xydrive);
