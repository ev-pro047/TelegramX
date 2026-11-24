import { memo, useEffect, useMemo, useRef, useState } from '../../lib/teact/teact';

import type { ApiChat } from '../../api/types';
import type { XydriveFile, XydriveMount, XydriveState } from '../../lib/xydrive/types';

import { isXydriveChannelEligible } from '../../lib/xydrive/folders';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import Loading from '../ui/Loading';
import AudioPlayer from '../middle/panes/AudioPlayer';
import XydriveExplorer from './XydriveExplorer';
import XydriveTransfers from './XydriveTransfers';

import styles from './Xydrive.module.scss';

type OwnProps = {
  isOpen: boolean;
  ownerId?: string;
  drive?: XydriveState;
  sourceId?: string;
  folders?: XydriveMount[];
  chats?: Record<string, ApiChat>;
  mountingId?: string;
  mountError?: 'wait' | 'generic' | 'unavailable';
  onClose: NoneToVoidFunction;
  onOpenSaved: NoneToVoidFunction;
  onLoadMore: NoneToVoidFunction;
  onRefresh: NoneToVoidFunction;
  onCreate: (title: string) => void;
  createStatus?: 'creating' | 'created' | 'error' | 'limit' | 'unverified';
  onOpenMessage: (file: XydriveFile) => void;
  onPreview: (file: XydriveFile) => void;
  previewingId?: string;
  mediaError?: 'wait' | 'unavailable';
  onSelectSource: (channelId?: string) => void;
  onMount: (channelId: string) => void;
  onUnmount: (channelId: string) => void;
};

const EMPTY_FILES: XydriveFile[] = [];

const Xydrive = ({
  isOpen, ownerId, drive, sourceId, folders, chats, mountingId, mountError,
  onClose, onOpenSaved, onLoadMore, onOpenMessage, onSelectSource, onMount, onUnmount,
  onPreview, previewingId, mediaError, onCreate, onRefresh, createStatus,
}: OwnProps) => {
  const lang = useLang();
  const [isMountPickerOpen, setIsMountPickerOpen] = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [mountQuery, setMountQuery] = useState('');
  const [isFoldersOpen, setIsFoldersOpen] = useState(false);
  const uploadRef = useRef<HTMLInputElement>();
  const isCreating = createStatus === 'creating';

  useEffect(() => {
    if (createStatus === 'created') {
      setIsNewFolderOpen(false);
      setFolderName('');
    }
  }, [createStatus]);
  const folder = folders?.find(({ id }) => id === sourceId);
  const candidates = useMemo(() => {
    if (!isMountPickerOpen || !chats) return [];
    const mounted = new Set(folders?.map(({ id }) => id));
    return Object.values(chats).filter((chat) => isXydriveChannelEligible(chat) && !mounted.has(chat.id))
      .filter((chat) => chat.title.toLocaleLowerCase().includes(mountQuery.trim().toLocaleLowerCase()))
      .sort((left, right) => left.title.localeCompare(right.title));
  }, [isMountPickerOpen, chats, folders, mountQuery]);

  useEffect(() => {
    if (!isOpen) setIsMountPickerOpen(false);
    setIsFoldersOpen(false);
  }, [isOpen, sourceId]);

  const files = drive?.files || EMPTY_FILES;
  const isLoading = !drive || drive.status === 'loading';
  const hasError = drive?.status === 'error';
  const hasMore = drive?.nextOffsetId !== undefined;

  if (!isOpen) return undefined;

  return (
    <section id="XydrivePage" className={styles.page} dir={lang.isRtl ? 'rtl' : 'ltr'} aria-label={lang('XydriveTitle')}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}><Icon name="folder-filled" /></span>
          <strong>{lang('XydriveTitle')}</strong>
        </div>
        <span className={styles.topLabel}>{lang('XydriveMyDrive')}</span>
        <Button size="smaller" color="translucent" onClick={onClose}>{lang('XydriveBackToChats')}</Button>
      </header>
      <div className={styles.layout}>
        <aside className={styles.dock} aria-label={lang('XydriveFolderPath')}>
          <button type="button" title={lang('XydriveRoot')} aria-label={lang('XydriveRoot')}
            className={buildClassName(styles.dockButton, !sourceId && styles.navActive)}
            onClick={() => onSelectSource()}>
            <Icon name="folder-filled" />
          </button>
          <button type="button" className={styles.dockButton} title={lang('XydriveFolders')}
            aria-label={lang('XydriveFolders')} aria-expanded={isFoldersOpen}
            onClick={() => setIsFoldersOpen(!isFoldersOpen)}>
            <Icon name="folder" />
          </button>
          <button type="button" className={styles.dockButton} title={lang('XydriveNewFolder')}
            aria-label={lang('XydriveNewFolder')} onClick={() => setIsNewFolderOpen(true)}>
            <span aria-hidden="true">+</span>
          </button>
          <button type="button" className={styles.dockButton} title={lang('XydriveRefresh')}
            aria-label={lang('XydriveRefresh')} disabled={isLoading} onClick={onRefresh}>
            <Icon name="reload-arrows" />
          </button>
        </aside>
        <aside className={buildClassName(styles.sidebar, isFoldersOpen && styles.sidebarOpen)}
          aria-label={lang('XydriveFolders')}>
          <div className={styles.sidebarTitle}>{lang('XydriveMyDrive')}</div>
          <Button size="smaller" onClick={() => setIsNewFolderOpen(true)}>{lang('XydriveNewFolder')}</Button>
          <nav className={styles.sidebarNav} aria-label={lang('XydriveFolderPath')}>
            <button type="button" className={buildClassName(styles.navItem, !sourceId && styles.navActive)}
              aria-current={!sourceId ? 'page' : undefined}
              onClick={() => { onSelectSource(); setIsFoldersOpen(false); }}>
              <Icon name="folder" /><span>{lang('XydriveRoot')}</span>
            </button>
            {folders?.map((item) => (
              <button key={item.id} type="button"
                className={buildClassName(styles.navItem, sourceId === item.id && styles.navActive)}
                aria-current={sourceId === item.id ? 'page' : undefined}
                onClick={() => { onSelectSource(item.id); setIsFoldersOpen(false); }}>
                <Icon name="folder-filled" /><span dir="auto">{item.title}</span>
              </button>
            ))}
          </nav>
          <Button size="smaller" color="translucent" onClick={() => { setIsMountPickerOpen(true); setIsFoldersOpen(false); }}>
            {lang('XydriveMountFolder')}
          </Button>
        </aside>
        <main className={styles.workspace} aria-label={lang('XydriveExplorer')}>
          <header className={styles.toolbar}>
            <nav className={styles.breadcrumb} aria-label={lang('XydriveFolderPath')}>
              <button type="button" className={styles.crumb} onClick={() => onSelectSource()} disabled={!sourceId}>
                {lang('XydriveRoot')}
              </button>
              {folder && <span className={styles.folderPath} dir="auto">/ {folder.title}</span>}
            </nav>
            <div className={styles.actions}>
              <Button size="smaller" color="translucent-bordered" onClick={() => setIsNewFolderOpen(true)}>
                {lang('XydriveNewFolder')}
              </Button>
              <Button size="smaller" color="translucent" onClick={() => setIsMountPickerOpen(!isMountPickerOpen)}>
                {lang('XydriveMountFolder')}
              </Button>
              <Button size="smaller" color="translucent" disabled={isLoading} onClick={onRefresh}>
                {lang('XydriveRefresh')}
              </Button>
              <Button size="smaller" onClick={() => uploadRef.current?.click()}>{lang('XydriveUpload')}</Button>
            </div>
          </header>
          <AudioPlayer isCompact />
          <div className={styles.browser} key={sourceId || 'root'}>
            <div className={styles.header}>
              <div className={styles.headerText}>
                <h1 className={styles.heading} dir="auto">{folder?.title || lang('XydriveMyDrive')}</h1>
                <p className={styles.description}>{lang('XydriveTelegramBacked')} · {lang.number(files.length)} {lang('XydriveLoadedFiles')}</p>
              </div>
              {folder ? (
                <Button size="smaller" color="translucent" onClick={() => onUnmount(folder.id)}>{lang('XydriveUnmount')}</Button>
              ) : (
                <Button size="smaller" color="translucent" onClick={onOpenSaved}>{lang('XydriveOpenSaved')}</Button>
              )}
            </div>
            {isNewFolderOpen && (
              <section className={styles.mountPanel}>
                <h3 className={styles.sectionTitle}>{lang('XydriveNewFolder')}</h3>
                <p className={styles.description}>{lang('XydriveCreateDesc')}</p>
                <form className={styles.createForm} onSubmit={(event) => {
                  event.preventDefault();
                  if (!isCreating && folderName.trim()) onCreate(folderName);
                }}>
                  <input className={styles.input} value={folderName} maxLength={128}
                    aria-label={lang('XydriveFolderName')} placeholder={lang('XydriveFolderName')}
                    disabled={isCreating} onInput={(event) => setFolderName(event.currentTarget.value)} />
                  <Button size="smaller" type="submit" noPreventDefault
                    disabled={isCreating || !folderName.trim()} isLoading={isCreating}>
                    {lang('XydriveCreateFolder')}
                  </Button>
                  <Button size="smaller" color="translucent" disabled={isCreating}
                    onClick={() => setIsNewFolderOpen(false)}>{lang('Close')}</Button>
                </form>
                {createStatus && createStatus !== 'creating' && createStatus !== 'created' && (
                  <p role="alert" className={styles.description}>
                    {lang(createStatus === 'limit' ? 'XydriveCreateLimit'
                      : createStatus === 'unverified' ? 'XydriveCreateUnverified' : 'XydriveCreateError')}
                  </p>
                )}
              </section>
            )}
            {isMountPickerOpen && (
              <section className={styles.mountPanel}>
                <div className={styles.fileHeader}>
                  <h3 className={styles.sectionTitle}>{lang('XydriveMountFolder')}</h3>
                  <Button size="tiny" color="translucent" onClick={() => setIsMountPickerOpen(false)}>{lang('Close')}</Button>
                </div>
                <p className={styles.description}>{lang('XydriveMountDesc')}</p>
                <input className={styles.input} type="search" value={mountQuery}
                  aria-label={lang('XydriveSearch')} placeholder={lang('XydriveSearch')}
                  onInput={(event) => setMountQuery(event.currentTarget.value)} />
                <div className={styles.mountList}>
                  {candidates.length === 0 && <p className={styles.description}>{lang('XydriveNoChannels')}</p>}
                  {candidates.map((chat) => (
                    <div key={chat.id} className={styles.mountRow}>
                      <Icon name="folder" className={styles.fileIcon} />
                      <span className={styles.fileName} dir="auto">{chat.title}</span>
                      <Button size="smaller" color="translucent" disabled={Boolean(mountingId)}
                        onClick={() => onMount(chat.id)}>
                        {lang(mountingId === chat.id ? 'XydriveMounting' : 'XydriveMount')}
                      </Button>
                    </div>
                  ))}
                </div>
                {mountError && <p className={styles.description} role="alert">
                  {lang(mountError === 'wait' ? 'XydriveWait'
                    : mountError === 'unavailable' ? 'XydriveUnavailable' : 'XydriveMountError')}
                </p>}
              </section>
            )}
            {!sourceId && (
              <section>
                <h3 className={styles.sectionTitle}>{lang('XydriveFolders')}</h3>
                <div className={styles.folderGrid}>
                  <button type="button" className={styles.newCard} onClick={() => setIsNewFolderOpen(true)}>
                    <span className={styles.folderIcon}>+</span><span>{lang('XydriveNewFolder')}</span>
                  </button>
                  {folders?.map((item) => (
                    <button key={item.id} type="button" className={styles.folderCard} onClick={() => onSelectSource(item.id)}>
                      <Icon name="folder-filled" className={styles.folderIcon} />
                      <span className={styles.fileName} dir="auto">{item.title}</span>
                      <span className={styles.fileMeta}>{lang('XydrivePrivateChannel')}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}
            <h3 className={styles.sectionTitle}>{lang(sourceId ? 'XydriveFolderFiles' : 'XydriveRootFiles')}</h3>
            <XydriveExplorer key={sourceId || 'root'} files={files}
              isComplete={drive?.status === 'ready' && !hasMore} isLoading={isLoading}
              onOpenMessage={onOpenMessage} onPreview={onPreview} previewingId={previewingId} />
            {mediaError && <p role="alert" className={styles.description}>
              {lang(mediaError === 'wait' ? 'XydriveWait' : 'XydriveMediaUnavailable')}
            </p>}
            <div className={styles.status} aria-live="polite">
              {isLoading && <Loading />}
              {hasError && <p className={styles.description}>
                {lang(drive?.error === 'wait' ? 'XydriveWait'
                  : drive?.error === 'unavailable' ? 'XydriveUnavailable' : 'XydriveLoadError')}
              </p>}
              {!isLoading && !hasError && !files.length && <p className={styles.description}>
                {lang(hasMore ? 'XydriveNoFilesYet' : sourceId ? 'XydriveEmptyFolder' : 'XydriveEmpty')}
              </p>}
              {!isLoading && (hasError || hasMore) && (
                <Button color="translucent" onClick={onLoadMore}>{lang(hasError ? 'XydriveRetry' : 'XydriveLoadMore')}</Button>
              )}
            </div>
          </div>
          <footer className={styles.footer}>
            <XydriveTransfers key={`${ownerId}:${sourceId || 'root'}`} ownerId={ownerId} files={files} pickerRef={uploadRef} />
          </footer>
        </main>
      </div>
    </section>
  );
};

export default memo(Xydrive);
