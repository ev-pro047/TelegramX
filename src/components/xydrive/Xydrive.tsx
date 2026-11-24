import { memo, useEffect, useMemo, useRef, useState } from '../../lib/teact/teact';

import type { ApiChat } from '../../api/types';
import type { XydriveFile, XydriveIndex, XydriveMount, XydriveMutationStatus, XydriveOrganization, XydriveState } from '../../lib/xydrive/types';

import { getFileLabel, getFolderChain, getFolderChildren, getOrganization } from '../../lib/xydrive/organization';
import { isXydriveChannelEligible } from '../../lib/xydrive/folders';

import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import Loading from '../ui/Loading';
import AudioPlayer from '../middle/panes/AudioPlayer';
import XydriveExplorer from './XydriveExplorer';
import XydriveTransfers from './XydriveTransfers';
import XydriveOverview from './XydriveOverview';

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
  onCreate: (title: string, parentId?: string) => void;
  organization?: XydriveOrganization;
  index?: XydriveIndex;
  mutationStatus?: XydriveMutationStatus;
  onLabel: (fileId: string, patch: { alias?: string; favorite?: boolean; pinned?: boolean; opened?: boolean }) => void;
  onMutate: (fileId: string, operation: 'delete' | 'move', destinationId?: string) => void;
  onReparent: (channelId: string, parentId?: string) => void;
  onSync: NoneToVoidFunction;
  onCancelSync: NoneToVoidFunction;
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
  organization, index, mutationStatus, onLabel, onMutate, onReparent, onSync, onCancelSync,
}: OwnProps) => {
  const lang = useLang();
  const [isMountPickerOpen, setIsMountPickerOpen] = useState(false);
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [folderName, setFolderName] = useState('');
  const [mountQuery, setMountQuery] = useState('');
  const [isFoldersOpen, setIsFoldersOpen] = useState(false);
  const [section, setSection] = useState<'drive' | 'overview' | 'favorites' | 'pinned' | 'recent'>('drive');
  const [parentPickerOpen, setParentPickerOpen] = useState(false);
  const [parentChoice, setParentChoice] = useState('');
  const org = getOrganization(organization, ownerId || '');
  const allFolders = folders || [];
  const chain = getFolderChain(org, allFolders, sourceId);
  const children = getFolderChildren(org, allFolders, sourceId);
  const isSyncing = index?.status === 'syncing';
  const sectionLabels = { drive: 'XydriveMyDrive', overview: 'XydriveOverview', favorites: 'XydriveFavorites', pinned: 'XydrivePinned', recent: 'XydriveRecent' } as const;
  const indexedFiles = useMemo(() => {
    const found = new Map<string, XydriveFile>();
    const allowed = new Set([ownerId, ...(folders || []).map(({ id }) => id)]);
    if (index && index.ownerId === ownerId) Object.entries(index.sources).forEach(([id, snapshot]) => {
      if (allowed.has(id)) snapshot.files.forEach((file) => found.set(file.id, file));
    });
    if (drive?.ownerId === ownerId && drive) {
      // A fully loaded current source supersedes its older indexed snapshot.
      if (drive.status === 'ready' && drive.nextOffsetId === undefined) {
        for (const [id, file] of found) if (file.chatId === drive.sourceId) found.delete(id);
      }
      drive.files.forEach((file) => found.set(file.id, file));
    }
    return [...found.values()];
  }, [index, ownerId, folders, drive]);
  const libraryFiles = indexedFiles.filter((file) => {
    const label = getFileLabel(org, file);
    return section === 'favorites' ? label?.favorite : section === 'pinned' ? label?.pinned : section === 'recent' ? label?.lastOpened : true;
  }).sort((a, b) => (getFileLabel(org, b)?.lastOpened || 0) - (getFileLabel(org, a)?.lastOpened || 0));
  function navigateFolder(id?: string) {
    setSection('drive');
    setIsFoldersOpen(false);
    onSelectSource(id);
  }
  function openSection(next: typeof section) {
    setSection(next);
    setIsFoldersOpen(false);
  }
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
    setParentPickerOpen(false);
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
        <nav className={styles.sectionTabs} aria-label={lang('XydriveExplorer')}>
          {(['overview', 'drive', 'favorites', 'pinned', 'recent'] as const).map((item) => (
            <button key={item} type="button" className={buildClassName(styles.tab, section === item && styles.navActive)}
              aria-current={section === item ? 'page' : undefined} onClick={() => openSection(item)}>{lang(sectionLabels[item])}</button>
          ))}
        </nav>
        <Button size="smaller" color="translucent" onClick={onClose}>{lang('XydriveBackToChats')}</Button>
      </header>
      <div className={styles.layout}>
        <aside className={styles.dock} aria-label={lang('XydriveFolderPath')}>
          <button type="button" title={lang('XydriveRoot')} aria-label={lang('XydriveRoot')}
            className={buildClassName(styles.dockButton, section === 'drive' && !sourceId && styles.navActive)}
            onClick={() => navigateFolder()}>
            <Icon name="folder-filled" />
          </button>
          <button type="button" className={buildClassName(styles.dockButton, section === 'overview' && styles.navActive)}
            aria-label={lang('XydriveOverview')} title={lang('XydriveOverview')} onClick={() => openSection('overview')}>
            <Icon name="piechart-filled" />
          </button>
          <button type="button" className={buildClassName(styles.dockButton, section === 'favorites' && styles.navActive)}
            aria-label={lang('XydriveFavorites')} title={lang('XydriveFavorites')} onClick={() => openSection('favorites')}>
            <Icon name="star-outline" />
          </button>
          <button type="button" className={styles.dockButton} title={lang('XydriveFolders')}
            aria-label={lang('XydriveFolders')} aria-expanded={isFoldersOpen}
            onClick={() => setIsFoldersOpen(!isFoldersOpen)}>
            <Icon name="folder" />
          </button>
          <button type="button" className={styles.dockButton} title={lang('XydriveNewFolder')}
            aria-label={lang('XydriveNewFolder')} onClick={() => { setSection('drive'); setIsNewFolderOpen(true); }}>
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
            <button type="button" className={buildClassName(styles.navItem, section === 'drive' && !sourceId && styles.navActive)}
              aria-current={!sourceId ? 'page' : undefined}
              onClick={() => navigateFolder()}>
              <Icon name="folder" /><span>{lang('XydriveRoot')}</span>
            </button>
            {allFolders.slice().sort((a, b) => getFolderChain(org, allFolders, a.id).map(({ title }) => title).join('/').localeCompare(
              getFolderChain(org, allFolders, b.id).map(({ title }) => title).join('/'))).map((item) => (
              <button key={item.id} type="button"
                className={buildClassName(styles.navItem, section === 'drive' && sourceId === item.id && styles.navActive)}
                aria-current={sourceId === item.id && section === 'drive' ? 'page' : undefined}
                onClick={() => navigateFolder(item.id)}>
                <Icon name="folder-filled" /><span dir="auto">{'\u00a0'.repeat(Math.min(12, (getFolderChain(org, allFolders, item.id).length - 1) * 3))}{item.title}</span>
              </button>
            ))}
          </nav>
          <Button size="smaller" color="translucent" onClick={() => { setSection('drive'); setIsMountPickerOpen(true); setIsFoldersOpen(false); }}>
            {lang('XydriveMountFolder')}
          </Button>
        </aside>
        <main className={styles.workspace} aria-label={lang('XydriveExplorer')}>
          {section !== 'drive' ? (
            <>
              <header className={styles.toolbar}>
                <strong>{lang(sectionLabels[section])}</strong>
                <div className={styles.actions}>
                  <Button size="smaller" color="translucent" onClick={() => openSection('pinned')}>{lang('XydrivePinned')}</Button>
                  <Button size="smaller" color="translucent" onClick={() => openSection('recent')}>{lang('XydriveRecent')}</Button>
                  <Button size="smaller" onClick={isSyncing ? onCancelSync : onSync}>{lang(isSyncing ? 'XydriveStopSync' : 'XydriveSyncAll')}</Button>
                </div>
              </header>
              <div className={styles.browser}>
                <p className={styles.description}>{lang(index?.status === 'ready' ? 'XydriveIndexReady' : index?.status === 'syncing' ? 'XydriveIndexSyncing' : 'XydriveIndexPartial')}</p>
                {section === 'overview' ? <XydriveOverview files={indexedFiles} folders={allFolders} index={index} ownerId={ownerId} /> : (
                  <XydriveExplorer key={section} files={libraryFiles} organization={org} folders={allFolders} ownerId={ownerId}
                    isComplete={index?.status === 'ready'} isLoading={Boolean(isSyncing)}
                    onOpenMessage={onOpenMessage} onPreview={onPreview} previewingId={previewingId}
                    onLabel={onLabel} onMutate={onMutate} mutationStatus={mutationStatus} />
                )}
              </div>
            </>
          ) : <>
          <header className={styles.toolbar}>
            <nav className={styles.breadcrumb} aria-label={lang('XydriveFolderPath')}>
              <button type="button" className={styles.crumb} onClick={() => onSelectSource()} disabled={!sourceId}>
                {lang('XydriveRoot')}
              </button>
              {chain.map((item) => <button key={item.id} type="button" className={styles.crumb}
                disabled={sourceId === item.id} onClick={() => navigateFolder(item.id)}> / {item.title}</button>)}
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
                <div className={styles.actions}>
                  <Button size="smaller" color="translucent" onClick={() => { setParentChoice(org.parents[folder.id] || ''); setParentPickerOpen(!parentPickerOpen); }}>{lang('XydriveMoveFolder')}</Button>
                  <Button size="smaller" color="translucent" onClick={() => onUnmount(folder.id)}>{lang('XydriveUnmount')}</Button>
                </div>
              ) : (
                <Button size="smaller" color="translucent" onClick={onOpenSaved}>{lang('XydriveOpenSaved')}</Button>
              )}
            </div>
            {parentPickerOpen && folder && (
              <section className={styles.mountPanel}>
                <strong>{lang('XydriveMoveFolder')}</strong>
                <select className={styles.input} aria-label={lang('XydriveDestination')} value={parentChoice}
                  onChange={(event) => setParentChoice(event.currentTarget.value)}>
                  <option value="">{lang('XydriveRoot')}</option>
                  {allFolders.filter((item) => !getFolderChain(org, allFolders, item.id).some(({ id }) => id === folder.id))
                    .map((item) => <option key={item.id} value={item.id}>{getFolderChain(org, allFolders, item.id).map(({ title }) => title).join(' / ')}</option>)}
                </select>
                <Button size="smaller" onClick={() => { onReparent(folder.id, parentChoice || undefined); setParentPickerOpen(false); }}>{lang('XydriveMove')}</Button>
              </section>
            )}
            {isNewFolderOpen && (
              <section className={styles.mountPanel}>
                <h3 className={styles.sectionTitle}>{lang('XydriveNewFolder')}</h3>
                <p className={styles.description}>{lang('XydriveCreateDesc')}</p>
                <form className={styles.createForm} onSubmit={(event) => {
                  event.preventDefault();
                  if (!isCreating && folderName.trim()) onCreate(folderName, sourceId);
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
            <section>
                <h3 className={styles.sectionTitle}>{lang('XydriveFolders')}</h3>
                <div className={styles.folderGrid}>
                  <button type="button" className={styles.newCard} onClick={() => setIsNewFolderOpen(true)}>
                    <span className={styles.folderIcon}>+</span><span>{lang('XydriveNewFolder')}</span>
                  </button>
                  {children.map((item) => (
                    <button key={item.id} type="button" className={styles.folderCard} onClick={() => navigateFolder(item.id)}>
                      <Icon name="folder-filled" className={styles.folderIcon} />
                      <span className={styles.fileName} dir="auto">{item.title}</span>
                      <span className={styles.fileMeta}>{lang('XydrivePrivateChannel')}</span>
                    </button>
                  ))}
                </div>
              </section>
            <h3 className={styles.sectionTitle}>{lang(sourceId ? 'XydriveFolderFiles' : 'XydriveRootFiles')}</h3>
            <XydriveExplorer key={sourceId || 'root'} files={files} organization={org} folders={allFolders} ownerId={ownerId}
              onLabel={onLabel} onMutate={onMutate} mutationStatus={mutationStatus}
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
          </>}
          <footer className={styles.footer}>
            <XydriveTransfers key={`${ownerId}:${sourceId || 'root'}`} ownerId={ownerId} files={files} pickerRef={uploadRef} />
          </footer>
        </main>
      </div>
    </section>
  );
};

export default memo(Xydrive);
