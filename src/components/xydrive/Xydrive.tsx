import { memo, useEffect, useMemo, useRef, useState } from '../../lib/teact/teact';

import type { ApiChat } from '../../api/types';
import type {
  XydriveFile, XydriveFolderLabel, XydriveIndex, XydriveMount, XydriveMutationStatus, XydriveOrganization, XydriveState,
} from '../../lib/xydrive/types';
import type { IconName } from '../../types/icons';
import type { RegularLangKey } from '../../types/language';
import type { FolderDialog } from './XydriveFolders';

import { getFileLabel, getFolderChain, getFolderChildren, getOrganization } from '../../lib/xydrive/organization';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';

import Icon from '../common/icons/Icon';
import AudioPlayer from '../middle/panes/AudioPlayer';
import Button from '../ui/Button';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import Modal from '../ui/Modal';
import XydriveExplorer from './XydriveExplorer';
import XydriveFolders from './XydriveFolders';
import XydriveOverview from './XydriveOverview';
import XydriveTransfers from './XydriveTransfers';

import styles from './Xydrive.module.scss';

type Section = 'drive' | 'favorites' | 'pinned' | 'recent' | 'overview';

const SECTIONS: { id: Section; icon: IconName; label: RegularLangKey }[] = [
  { id: 'drive', icon: 'folder-filled', label: 'XydriveMyDrive' },
  { id: 'favorites', icon: 'star-outline', label: 'XydriveFavorites' },
  { id: 'pinned', icon: 'pin', label: 'XydrivePinned' },
  { id: 'recent', icon: 'clock', label: 'XydriveRecent' },
  { id: 'overview', icon: 'piechart-filled', label: 'XydriveOverview' },
];
const EMPTY_FILES: XydriveFile[] = [];
const EMPTY_FOLDERS: XydriveMount[] = [];

type OwnProps = {
  ownerId?: string;
  drive?: XydriveState;
  sourceId?: string;
  folders?: XydriveMount[];
  chats?: Record<string, ApiChat>;
  mountingId?: string;
  mountError?: 'wait' | 'generic' | 'unavailable';
  organization?: XydriveOrganization;
  index?: XydriveIndex;
  mutationStatus?: XydriveMutationStatus;
  createStatus?: 'creating' | 'created' | 'error' | 'limit' | 'unverified';
  previewingId?: string;
  mediaError?: 'wait' | 'unavailable';
  onClose: NoneToVoidFunction;
  onOpenSaved: NoneToVoidFunction;
  onLoadMore: NoneToVoidFunction;
  onRefresh: NoneToVoidFunction;
  onCreate: (title: string, parentId?: string) => void;
  onLabelFolder: (id: string, patch: XydriveFolderLabel) => void;
  onLabel: (fileId: string, patch: { alias?: string; favorite?: boolean; pinned?: boolean }) => void;
  onMutate: (fileId: string, operation: 'delete' | 'move', destinationId?: string) => void;
  onReparent: (channelId: string, parentId?: string) => void;
  onSync: NoneToVoidFunction;
  onCancelSync: NoneToVoidFunction;
  onOpenMessage: (file: XydriveFile) => void;
  onPreview: (file: XydriveFile) => void;
  onSelectSource: (channelId?: string) => void;
  onMount: (channelId: string) => void;
  onUnmount: (channelId: string) => void;
};

const Xydrive = ({
  ownerId, drive, sourceId, folders = EMPTY_FOLDERS, chats, mountingId, mountError,
  onClose, onOpenSaved, onLoadMore, onOpenMessage, onSelectSource, onMount, onUnmount,
  onPreview, previewingId, mediaError, onCreate, onRefresh, createStatus,
  organization, index, mutationStatus, onLabel, onLabelFolder, onMutate, onReparent, onSync, onCancelSync,
}: OwnProps) => {
  const lang = useLang();
  const [section, setSection] = useState<Section>('drive');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<FolderDialog>();
  const uploadRef = useRef<HTMLInputElement>();

  const org = useMemo(() => getOrganization(organization, ownerId || ''), [organization, ownerId]);
  const folder = folders.find(({ id }) => id === sourceId);
  const chain = useMemo(() => getFolderChain(org, folders, sourceId), [org, folders, sourceId]);
  const children = useMemo(() => getFolderChildren(org, folders, sourceId), [org, folders, sourceId]);
  const tree = useMemo(() => {
    const paths = folders.map((item) => {
      const path = getFolderChain(org, folders, item.id);
      return { item, depth: Math.max(0, path.length - 1), path: path.map(({ title }) => title).join(' / ') };
    });
    return paths.sort((a, b) => a.path.localeCompare(b.path));
  }, [org, folders]);

  const isDrive = section === 'drive';
  const shownFolders = useMemo(() => {
    if (section === 'drive') return children;
    if (section === 'favorites') return folders.filter(({ id }) => org.folderLabels?.[id]?.favorite);
    if (section === 'pinned') return folders.filter(({ id }) => org.folderLabels?.[id]?.pinned);
    return EMPTY_FOLDERS;
  }, [children, folders, org.folderLabels, section]);
  const isSyncing = index?.status === 'syncing';
  const isIndexComplete = Boolean(index?.status === 'ready' && ownerId && index.sources[ownerId]?.complete
    && folders.every(({ id }) => index.sources[id]?.complete));
  const files = drive?.files || EMPTY_FILES;
  const isLoading = !drive || drive.status === 'loading';
  const hasError = drive?.status === 'error';
  const hasMore = drive?.nextOffsetId !== undefined;
  const indexedFiles = useMemo(() => {
    const found = new Map<string, XydriveFile>();
    if (index?.ownerId === ownerId && index) {
      for (const id of [ownerId, ...folders.map((item) => item.id)]) {
        if (!id || (id === drive?.sourceId && (drive.error === 'unavailable'
          || (drive.status === 'ready' && drive.nextOffsetId === undefined)))) continue;
        index.sources[id]?.files.forEach((file) => found.set(file.id, file));
      }
    }
    if (drive?.ownerId === ownerId) files.forEach((file) => found.set(file.id, file));
    return [...found.values()];
  }, [index, ownerId, folders, drive, files]);
  const libraryFiles = useMemo(() => {
    if (section === 'drive' || section === 'overview') return EMPTY_FILES;
    return indexedFiles.filter((file) => {
      const label = getFileLabel(org, file);
      if (section === 'favorites') return label?.favorite;
      if (section === 'pinned') return label?.pinned;
      return label?.lastOpened;
    });
  }, [indexedFiles, org, section]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [section, sourceId]);

  function openSection(next: Section, channelId?: string) {
    setSection(next);
    setIsNavigationOpen(false);
    if (next === 'drive') onSelectSource(channelId);
  }

  function renderNavigation() {
    return (
      <nav className={styles.navigation} aria-label={lang('XydriveExplorer')}>
        {SECTIONS.map(({ id, icon, label }) => {
          const isActive = section === id && (id !== 'drive' || !sourceId);
          return (
            <button
              key={id}
              type="button"
              className={buildClassName(styles.navItem, isActive && styles.navActive)}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => openSection(id)}
            >
              <Icon name={icon} />
              <span>{lang(label)}</span>
            </button>
          );
        })}
        {tree.length > 0 && <div className={styles.navHeading}>{lang('XydriveFolders')}</div>}
        {tree.map(({ item, depth, path }) => (
          <button
            key={item.id}
            type="button"
            className={buildClassName(styles.navItem, isDrive && sourceId === item.id && styles.navActive)}
            style={depth > 0 ? `padding-inline-start: ${0.625 + Math.min(depth, 4) * 0.625}rem` : undefined}
            title={path}
            aria-current={isDrive && sourceId === item.id ? 'page' : undefined}
            onClick={() => openSection('drive', item.id)}
          >
            <Icon name="folder" />
            <span dir="auto">{item.title}</span>
          </button>
        ))}
      </nav>
    );
  }

  const folderLabel = folder && org.folderLabels?.[folder.id];
  const title = isDrive ? folder?.title || lang('XydriveMyDrive')
    : lang(SECTIONS.find(({ id }) => id === section)!.label);
  const indexStatus = isSyncing ? 'XydriveIndexSyncing'
    : isIndexComplete ? 'XydriveIndexReady'
      : index?.status === 'limited' ? 'XydriveIndexLimit'
        : index?.status === 'error' ? 'XydriveIndexError' : 'XydriveIndexPartial';
  const driveError = drive?.error === 'wait' ? 'XydriveWait'
    : drive?.error === 'unavailable' ? 'XydriveUnavailable' : 'XydriveLoadError';

  return (
    <section
      id="XydrivePage"
      className={styles.page}
      dir={lang.isRtl ? 'rtl' : 'ltr'}
      aria-label={lang('XydriveTitle')}
    >
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <Button
            className={styles.mobileNav}
            round
            color="translucent"
            iconName="hamburger"
            ariaLabel={lang('XydriveNavigation')}
            onClick={() => setIsNavigationOpen(true)}
          />
          <span className={styles.brandMark}><Icon name="folder-filled" /></span>
          <strong>{lang('XydriveTitle')}</strong>
          <span className={styles.beta}>{lang('XydriveBeta')}</span>
        </div>
        <Button
          size="smaller"
          color="translucent"
          iconName={lang.isRtl ? 'arrow-right' : 'arrow-left'}
          onClick={onClose}
        >
          {lang('XydriveBackToChats')}
        </Button>
      </header>
      <div className={styles.layout}>
        <aside className={styles.sidebar}>{renderNavigation()}</aside>
        <main className={styles.workspace} aria-label={lang('XydriveExplorer')}>
          <header className={styles.toolbar}>
            <div className={styles.location}>
              {isDrive && (
                <nav className={styles.breadcrumb} aria-label={lang('XydriveFolderPath')}>
                  <button
                    type="button"
                    className={styles.crumb}
                    disabled={!sourceId}
                    onClick={() => openSection('drive')}
                  >
                    {lang('XydriveRoot')}
                  </button>
                  {chain.map((item) => (
                    <span className={styles.crumbStep} key={item.id}>
                      <span aria-hidden="true">/</span>
                      <button
                        type="button"
                        dir="auto"
                        title={item.title}
                        className={styles.crumb}
                        disabled={sourceId === item.id}
                        aria-current={sourceId === item.id ? 'page' : undefined}
                        onClick={() => openSection('drive', item.id)}
                      >
                        {item.title}
                      </button>
                    </span>
                  ))}
                </nav>
              )}
              <h1 className={styles.heading} dir="auto" title={title}>{title}</h1>
            </div>
            <div className={styles.actions}>
              {isDrive ? (
                <>
                  <Button
                    size="smaller"
                    color="translucent-bordered"
                    iconName="add"
                    disabled={createStatus === 'creating'}
                    onClick={() => setDialog('create')}
                  >
                    {lang('XydriveNewFolder')}
                  </Button>
                  <Button
                    size="smaller"
                    iconName="arrow-up-circle-filled"
                    disabled={drive?.error === 'unavailable'}
                    onClick={() => uploadRef.current?.click()}
                  >
                    {lang('XydriveUpload')}
                  </Button>
                  <div className={styles.menuAnchor}>
                    <button
                      className={styles.more}
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={isMenuOpen}
                      aria-label={lang('XydriveFolderActions')}
                      title={lang('XydriveFolderActions')}
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                      <Icon name="more" />
                    </button>
                    <Menu
                      isOpen={isMenuOpen}
                      autoClose
                      positionX={lang.isRtl ? 'left' : 'right'}
                      positionY="bottom"
                      ariaLabel={lang('XydriveFolderActions')}
                      onClose={() => setIsMenuOpen(false)}
                    >
                      <MenuItem icon="reload-arrows" disabled={isLoading} onClick={onRefresh}>
                        {lang('XydriveRefresh')}
                      </MenuItem>
                      <MenuItem icon="folder" onClick={() => setDialog('mount')}>{lang('XydriveMountFolder')}</MenuItem>
                      {folder ? (
                        <>
                          <MenuItem
                            icon="star-outline"
                            onClick={() => onLabelFolder(folder.id, { favorite: !folderLabel?.favorite })}
                          >
                            {lang(folderLabel?.favorite ? 'XydriveUnfavorite' : 'XydriveFavorite')}
                          </MenuItem>
                          <MenuItem
                            icon="pin"
                            onClick={() => onLabelFolder(folder.id, { pinned: !folderLabel?.pinned })}
                          >
                            {lang(folderLabel?.pinned ? 'XydriveUnpin' : 'XydrivePin')}
                          </MenuItem>
                          <MenuItem icon="folder" onClick={() => setDialog('move')}>
                            {lang('XydriveMoveFolder')}
                          </MenuItem>
                          <MenuItem destructive onClick={() => setDialog('unmount')}>{lang('XydriveUnmount')}</MenuItem>
                        </>
                      ) : <MenuItem icon="arrow-right" onClick={onOpenSaved}>{lang('XydriveOpenSaved')}</MenuItem>}
                    </Menu>
                  </div>
                </>
              ) : (
                <Button
                  size="smaller"
                  color="translucent-bordered"
                  iconName="reload-arrows"
                  onClick={isSyncing ? onCancelSync : onSync}
                >
                  {lang(isSyncing ? 'XydriveStopSync' : 'XydriveSyncAll')}
                </Button>
              )}
            </div>
          </header>
          <AudioPlayer isCompact />
          <XydriveTransfers
            ownerId={ownerId}
            sourceId={sourceId}
            files={files}
            pickerRef={uploadRef}
            canUpload={isDrive && drive?.error !== 'unavailable'}
          >
            {mediaError && (
              <p className={styles.notice} role="alert">
                {lang(mediaError === 'wait' ? 'XydriveWait' : 'XydriveMediaUnavailable')}
              </p>
            )}
            {!isDrive && <p className={styles.notice} role="status">{lang(indexStatus)}</p>}
            {section === 'overview' ? (
              <div className={styles.overview}>
                <XydriveOverview
                  files={indexedFiles}
                  folders={folders}
                  index={index}
                  ownerId={ownerId}
                />
              </div>
            ) : (
              <XydriveExplorer
                key={isDrive ? folder?.id || 'root' : section}
                files={isDrive ? files : libraryFiles}
                indexedFiles={isDrive ? indexedFiles : undefined}
                organization={org}
                folders={folders}
                childrenFolders={shownFolders}
                isRecent={section === 'recent'}
                ownerId={ownerId}
                sourceId={isDrive ? sourceId : undefined}
                view={view}
                onChangeView={setView}
                isComplete={isDrive ? drive?.status === 'ready' && !hasMore : isIndexComplete}
                isIndexComplete={isIndexComplete}
                isLoading={isDrive ? isLoading : Boolean(isSyncing)}
                hasMore={isDrive && hasMore}
                loadError={isDrive && hasError ? driveError : undefined}
                emptyLabel={isDrive ? sourceId ? 'XydriveEmptyFolder' : 'XydriveEmpty' : 'XydriveEmptyCollection'}
                onLoadMore={onLoadMore}
                onUpload={isDrive && drive?.error !== 'unavailable'
                  ? () => uploadRef.current?.click() : undefined}
                onOpenFolder={(channelId) => openSection('drive', channelId)}
                onOpenMessage={onOpenMessage}
                onPreview={onPreview}
                previewingId={previewingId}
                onLabel={onLabel}
                onMutate={onMutate}
                mutationStatus={mutationStatus}
              />
            )}
          </XydriveTransfers>
        </main>
      </div>
      <Modal
        isOpen={isNavigationOpen}
        isSlim
        hasCloseButton
        title={lang('XydriveNavigation')}
        onClose={() => setIsNavigationOpen(false)}
      >
        {renderNavigation()}
      </Modal>
      {dialog && (
        <XydriveFolders
          key={dialog}
          dialog={dialog}
          folder={folder}
          folders={folders}
          organization={org}
          chats={chats}
          mountingId={mountingId}
          mountError={mountError}
          createStatus={createStatus}
          onCreate={onCreate}
          onMount={onMount}
          onUnmount={onUnmount}
          onReparent={onReparent}
          onClose={() => setDialog(undefined)}
        />
      )}
    </section>
  );
};

export default memo(Xydrive);
