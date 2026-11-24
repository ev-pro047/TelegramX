import { memo, useEffect, useMemo, useRef, useState } from '../../lib/teact/teact';

import type { ApiChat } from '../../api/types';
import type {
  XydriveCategory, XydriveFile, XydriveFolderLabel, XydriveIndex, XydriveMount,
  XydriveMutation, XydriveOrganization, XydriveState,
} from '../../lib/xydrive/types';
import type { XydriveSection } from '../../lib/xydrive/workspace';
import type { IconName } from '../../types/icons';
import type { RegularLangKey } from '../../types/language';
import type { FolderDialog } from './XydriveFolders';

import { getFileLabel, getFolderChain, getFolderChildren, getOrganization } from '../../lib/xydrive/organization';
import {
  getXydriveLocation, getXydrivePreferences, storeXydriveLocation, storeXydriveLocationState, storeXydrivePreferences,
} from '../../lib/xydrive/workspace';
import buildClassName from '../../util/buildClassName';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';

import useLang from '../../hooks/useLang';

import Icon from '../common/icons/Icon';
import AudioPlayer from '../middle/panes/AudioPlayer';
import Button from '../ui/Button';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import MenuSeparator from '../ui/MenuSeparator';
import Modal from '../ui/Modal';
import XydriveExplorer from './XydriveExplorer';
import XydriveFolders from './XydriveFolders';
import XydriveNavigation from './XydriveNavigation';
import XydriveOverview from './XydriveOverview';
import XydriveTransfers from './XydriveTransfers';

import styles from './Xydrive.module.scss';

type Section = XydriveSection;

const SECTIONS: { id: Section; icon: IconName; label: RegularLangKey }[] = [
  { id: 'drive', icon: 'folder-filled', label: 'XydriveMyDrive' },
  { id: 'favorites', icon: 'star-outline', label: 'XydriveFavorites' },
  { id: 'pinned', icon: 'pin', label: 'XydrivePinned' },
  { id: 'recent', icon: 'clock', label: 'XydriveRecent' },
  { id: 'overview', icon: 'piechart-filled', label: 'XydriveOverview' },
];
const DRAWER_QUERY = '(max-width: 52rem), (max-width: 950px) and (max-height: 450px)';
const EMPTY_FILES: XydriveFile[] = [];
const EMPTY_FOLDERS: XydriveMount[] = [];

type OwnProps = {
  ownerId?: string;
  accountName?: string;
  drive?: XydriveState;
  sourceId?: string;
  folders?: XydriveMount[];
  chats?: Record<string, ApiChat>;
  mountingId?: string;
  mountError?: 'wait' | 'generic' | 'unavailable';
  organization?: XydriveOrganization;
  index?: XydriveIndex;
  mutation?: XydriveMutation;
  renameStatus?: { folderId: string; status: 'working' | 'complete' | 'error' | 'wait' };
  isNativeViewerOpen?: boolean;
  createStatus?: 'creating' | 'created' | 'error' | 'limit' | 'unverified';
  previewingId?: string;
  mediaError?: 'wait' | 'unavailable';
  textPreview?: { fileId: string; name: string; text: string };
  onCloseTextPreview: NoneToVoidFunction;
  onClose: NoneToVoidFunction;
  onOpenSaved: NoneToVoidFunction;
  onLoadMore: NoneToVoidFunction;
  onRefresh: NoneToVoidFunction;
  onCreate: (title: string, parentId?: string) => void;
  onLabelFolder: (id: string, patch: XydriveFolderLabel) => void;
  onLabel: (fileId: string, patch: { alias?: string; favorite?: boolean; pinned?: boolean }) => void;
  onBulkLabel: (fileIds: string[], folderIds: string[], patch: XydriveFolderLabel) => void;
  onRenameFolder: (folderId: string, title: string) => void;
  onForward: (file: XydriveFile) => void;
  onMutate: (fileIds: string[], operation: 'delete' | 'move', destinationId?: string) => void;
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
  ownerId, accountName, drive, sourceId, folders = EMPTY_FOLDERS, chats, mountingId, mountError,
  onClose, onOpenSaved, onLoadMore, onOpenMessage, onSelectSource, onMount, onUnmount,
  onPreview, previewingId, mediaError, textPreview, onCloseTextPreview, onCreate, onRefresh, createStatus,
  organization, index, mutation, renameStatus, isNativeViewerOpen, onLabel, onLabelFolder, onBulkLabel,
  onRenameFolder, onForward, onMutate, onReparent, onSync, onCancelSync,
}: OwnProps) => {
  const lang = useLang();
  const [section, setSection] = useState<Section>(() => getXydriveLocation(ownerId).section);
  const [categoryScope, setCategoryScope] = useState<XydriveCategory>();
  const [preferences, setPreferences] = useState(() => getXydrivePreferences(ownerId));
  const { view, density, isSidebarCollapsed } = preferences;
  const navigationRef = useRef<HTMLButtonElement>();
  const sidebarRef = useRef<HTMLElement>();
  const [isDrawerLayout, setIsDrawerLayout] = useState(() => window.matchMedia(DRAWER_QUERY).matches);
  const [dialogFolderId, setDialogFolderId] = useState<string>();
  const [dialogDestinationId, setDialogDestinationId] = useState<string>();
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [dialog, setDialog] = useState<FolderDialog>();
  const uploadRef = useRef<HTMLInputElement>();

  const org = useMemo(() => getOrganization(organization, ownerId || ''), [organization, ownerId]);
  const folder = folders.find(({ id }) => id === sourceId);
  const chain = useMemo(() => getFolderChain(org, folders, sourceId), [org, folders, sourceId]);
  const children = useMemo(() => getFolderChildren(org, folders, sourceId), [org, folders, sourceId]);
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

  useEffect(() => {
    storeXydrivePreferences(ownerId, preferences);
  }, [ownerId, preferences]);

  useEffect(() => {
    storeXydriveLocation(ownerId, { section, sourceId });
  }, [ownerId, section, sourceId]);

  useEffect(() => {
    const media = window.matchMedia(DRAWER_QUERY);
    const update = () => {
      setIsDrawerLayout(media.matches);
      setIsNavigationOpen(false);
    };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!isDrawerLayout || !isNavigationOpen || !sidebarRef.current) return undefined;
    const sidebar = sidebarRef.current;
    const trigger = navigationRef.current;
    sidebar.querySelector<HTMLButtonElement>('button')?.focus();
    const releaseKeys = captureKeyboardListeners({
      onEsc: () => setIsNavigationOpen(false),
      onTab: (event) => {
        const focusable = Array.from(sidebar.querySelectorAll<HTMLElement>(
          'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]), [role="treeitem"][tabindex="0"]',
        ));
        if (!focusable.length) return false;
        const current = focusable.indexOf(sidebar.ownerDocument.activeElement as HTMLElement);
        const next = current < 0 ? event.shiftKey ? focusable.length - 1 : 0
          : (current + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length;
        event.preventDefault();
        focusable[next].focus();
        return true;
      },
    });
    return () => {
      releaseKeys();
      trigger?.focus();
    };
  }, [isDrawerLayout, isNavigationOpen]);

  function openFolderDialog(next: FolderDialog, target = sourceId, destinationId?: string) {
    setIsNavigationOpen(false);
    setDialogFolderId(target);
    setDialogDestinationId(destinationId);
    setDialog(next);
  }

  function openSection(next: Section, channelId?: string) {
    setSection(next);
    setCategoryScope(undefined);
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
        <XydriveNavigation
          folders={folders}
          organization={org}
          index={index}
          selectedId={isDrive ? sourceId : undefined}
          expanded={preferences.expanded}
          onExpand={(expanded) => setPreferences((current) => ({ ...current, expanded }))}
          onOpen={(id) => openSection('drive', id)}
          onManage={(item) => openFolderDialog('manage', item.id)}
        />
        <button type="button" className={styles.indexStatus} onClick={() => openSection('overview')}>
          <Icon name="info" />
          <span>
            {lang(index?.status === 'syncing' ? 'XydriveIndexSyncing' : isIndexComplete
              ? 'XydriveSourceIndexed' : 'XydriveIndexPartial')}
          </span>
        </button>
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
      className={buildClassName(styles.page, density === 'compact' && styles.compact)}
      dir={lang.isRtl ? 'rtl' : 'ltr'}
      aria-label={lang('XydriveTitle')}
    >
      <div className={buildClassName(styles.layout, isSidebarCollapsed && styles.collapsed)}>
        <aside
          id="xydrive-navigation"
          role={isDrawerLayout && isNavigationOpen ? 'dialog' : undefined}
          aria-modal={isDrawerLayout && isNavigationOpen ? true : undefined}
          aria-label={lang('XydriveNavigation')}
          ref={sidebarRef}
          className={buildClassName(styles.sidebar, isNavigationOpen && styles.drawerOpen)}
        >
          <div className={styles.sidebarHeader}>
            <div className={styles.brand}>
              <span className={styles.brandMark}><Icon name="folder-filled" /></span>
              <div className={styles.brandText}>
                <strong>{lang('XydriveTitle')}</strong>
                {accountName && <span className={styles.accountName} dir="auto">{accountName}</span>}
              </div>
              <span className={styles.beta}>{lang('XydriveBeta')}</span>
            </div>
            {isDrawerLayout && (
              <button
                type="button"
                className={styles.more}
                aria-label={lang('Close')}
                onClick={() => setIsNavigationOpen(false)}
              >
                <Icon name="close" />
              </button>
            )}
          </div>
          {renderNavigation()}
        </aside>
        {isNavigationOpen && (
          <button
            type="button"
            className={styles.drawerBackdrop}
            aria-label={lang('Close')}
            onClick={() => {
              setIsNavigationOpen(false);
              navigationRef.current?.focus();
            }}
          />
        )}
        <main className={styles.workspace} aria-label={lang('XydriveExplorer')}>
          <header className={styles.toolbar}>
            <div className={styles.navigationActions}>
              <button
                type="button"
                className={styles.more}
                aria-label={lang('XydriveBackToChats')}
                title={lang('XydriveBackToChats')}
                onClick={onClose}
              >
                <Icon name={lang.isRtl ? 'arrow-right' : 'arrow-left'} />
              </button>
              <button
                ref={navigationRef}
                type="button"
                className={styles.more}
                aria-label={lang('XydriveNavigation')}
                aria-controls="xydrive-navigation"
                aria-expanded={isDrawerLayout ? isNavigationOpen : !isSidebarCollapsed}
                onClick={() => {
                  if (isDrawerLayout) setIsNavigationOpen(!isNavigationOpen);
                  else setPreferences({ ...preferences, isSidebarCollapsed: !isSidebarCollapsed });
                }}
              >
                <Icon name={isDrawerLayout ? 'hamburger' : 'sidebar'} />
              </button>
            </div>
            <div className={styles.location}>
              <h1 className={styles.heading} dir="auto" title={title}>{title}</h1>
              {isDrive && Boolean(sourceId) && (
                <nav className={styles.breadcrumb} aria-label={lang('XydriveFolderPath')}>
                  <button
                    type="button"
                    className={styles.crumb}
                    disabled={!sourceId}
                    onClick={() => openSection('drive')}
                  >
                    {lang('XydriveRoot')}
                  </button>
                  {chain.slice(0, -1).map((item) => (
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
            </div>
            <div className={styles.actions}>
              {isDrive ? (
                <>
                  <Button
                    size="smaller"
                    className={styles.createButton}
                    color="translucent"
                    iconName="add"
                    noFastClick
                    disabled={createStatus === 'creating'}
                    onClick={() => openFolderDialog('create')}
                  >
                    {lang('XydriveNewFolder')}
                  </Button>
                  <Button
                    size="smaller"
                    className={styles.uploadButton}
                    iconName="arrow-up-circle-filled"
                    ariaLabel={lang('XydriveUpload')}
                    noFastClick
                    disabled={drive?.error === 'unavailable'}
                    onClick={() => uploadRef.current?.click()}
                  >
                    <span className={styles.uploadLabel}>{lang('XydriveUpload')}</span>
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
                      <MenuItem
                        className={styles.menuCreate}
                        icon="add"
                        disabled={createStatus === 'creating'}
                        onClick={() => openFolderDialog('create')}
                      >
                        {lang('XydriveNewFolder')}
                      </MenuItem>
                      <MenuItem icon="reload-arrows" disabled={isLoading} onClick={onRefresh}>
                        {lang('XydriveRefresh')}
                      </MenuItem>
                      <MenuItem
                        icon="list"
                        onClick={() => setPreferences({
                          ...preferences, density: density === 'compact' ? 'comfortable' : 'compact',
                        })}
                      >
                        {lang(density === 'compact' ? 'XydriveComfortable' : 'XydriveCompact')}
                      </MenuItem>
                      <MenuItem icon="folder" onClick={() => openFolderDialog('mount')}>
                        {lang('XydriveMountFolder')}
                      </MenuItem>
                      <MenuSeparator />
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
                          <MenuItem icon="folder" onClick={() => openFolderDialog('move')}>
                            {lang('XydriveMoveFolder')}
                          </MenuItem>
                          <MenuItem destructive onClick={() => openFolderDialog('unmount')}>
                            {lang('XydriveUnmount')}
                          </MenuItem>
                        </>
                      ) : <MenuItem icon="arrow-right" onClick={onOpenSaved}>{lang('XydriveOpenSaved')}</MenuItem>}
                      <MenuSeparator />
                      <MenuItem icon="keyboard" onClick={() => setIsShortcutsOpen(true)}>
                        {lang('XydriveShortcuts')}
                      </MenuItem>
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
            destinationName={folder?.title}
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
                  organization={org}
                  onOpenCategory={(category) => {
                    openSection('drive');
                    setCategoryScope(category);
                  }}
                  onOpenFolder={(id) => openSection('drive', id)}
                  onOpenFile={(file) => {
                    if (file.previewKind) onPreview(file);
                    else {
                      const id = file.chatId === ownerId ? undefined : file.chatId;
                      storeXydriveLocationState(ownerId, id || 'root', { query: file.name, page: 0, scrollTop: 0 });
                      openSection('drive', id);
                    }
                  }}
                />
              </div>
            ) : (
              <XydriveExplorer
                key={categoryScope || (isDrive ? folder?.id || 'root' : section)}
                files={categoryScope ? indexedFiles : isDrive ? files : libraryFiles}
                initialFilter={categoryScope}
                isLibraryScope={Boolean(categoryScope)}
                locationKey={isDrive ? folder?.id || 'root' : section}
                index={index}
                isNarrow={isDrawerLayout}
                isNativeViewerOpen={isNativeViewerOpen}
                isSyncing={isSyncing}
                onSync={onSync}
                onCreate={isDrive ? () => openFolderDialog('create') : undefined}
                onPreferences={(filter, sort, direction) => setPreferences((current) => ({
                  ...current, filter, sort, direction,
                }))}
                indexedFiles={isDrive ? indexedFiles : undefined}
                organization={org}
                folders={folders}
                childrenFolders={shownFolders}
                isRecent={section === 'recent'}
                ownerId={ownerId}
                sourceId={isDrive ? sourceId : undefined}
                view={view}
                onChangeView={(next) => setPreferences({ ...preferences, view: next })}
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
                onManageFolder={(item, target) => openFolderDialog(target ? 'move' : 'manage', item.id, target?.id)}
                onForward={onForward}
                onBulkLabel={onBulkLabel}
                onOpenMessage={onOpenMessage}
                onPreview={onPreview}
                previewingId={previewingId}
                onLabel={onLabel}
                onMutate={onMutate}
                mutation={mutation}
              />
            )}
          </XydriveTransfers>
        </main>
      </div>
      {isShortcutsOpen && (
        <Modal
          isOpen
          isSlim
          hasCloseButton
          title={lang('XydriveShortcuts')}
          dialogClassName={styles.dialogFrame}
          onClose={() => setIsShortcutsOpen(false)}
        >
          <div className={styles.dialog}>
            <p className={styles.description}>{lang('XydriveKeyboardOpen')}</p>
            <p className={styles.description}>{lang('XydriveKeyboardSelect')}</p>
            <p className={styles.description}>{lang('XydriveKeyboardSearch')}</p>
            <p className={styles.description}>{lang('XydriveTouchSelect')}</p>
          </div>
        </Modal>
      )}
      {textPreview && (
        <Modal
          isOpen
          hasCloseButton
          title={textPreview.name}
          dialogClassName={styles.dialogFrame}
          onClose={onCloseTextPreview}
        >
          <pre className={styles.textPreview} dir="auto">{textPreview.text}</pre>
        </Modal>
      )}
      {dialog && (
        <XydriveFolders
          key={dialog}
          dialog={dialog}
          folder={folders.find(({ id }) => id === dialogFolderId)}
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
          onOpenFolder={(id) => {
            setDialog(undefined);
            openSection('drive', id);
          }}
          onLabelFolder={onLabelFolder}
          onChangeDialog={setDialog}
          onRename={onRenameFolder}
          renameStatus={renameStatus?.folderId === dialogFolderId ? renameStatus?.status : undefined}
          destinationId={dialogDestinationId}
          onClose={() => setDialog(undefined)}
        />
      )}
    </section>
  );
};

export default memo(Xydrive);
