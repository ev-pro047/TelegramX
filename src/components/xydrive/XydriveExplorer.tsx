import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { XydriveItem } from '../../lib/xydrive/collection';
import type { XydriveDirection, XydriveFilter, XydriveSort } from '../../lib/xydrive/explorer';
import type {
  XydriveFile, XydriveIndex, XydriveMount, XydriveMutation, XydriveOrganization,
} from '../../lib/xydrive/types';
import type { RegularLangKey } from '../../types/language';
import type { FileOperation } from './XydriveFileDialog';

import {
  buildXydriveItems, canManageXydriveSource, CATEGORY_LABELS, getXydrivePage,
  MAX_XYDRIVE_MOVE_OR_DELETE, queryXydriveItems, summarizeXydriveItems, XYDRIVE_CATEGORIES,
} from '../../lib/xydrive/collection';
import { EMPTY_XYDRIVE_SELECTION, restrictXydriveSelection, selectXydriveFile } from '../../lib/xydrive/explorer';
import { getFolderChain } from '../../lib/xydrive/organization';
import { enqueueXydriveDownload } from '../../lib/xydrive/transfers';
import {
  buildFolderTree, flattenFolderTree, getXydriveLocationState, getXydrivePreferences, storeXydriveLocationState,
} from '../../lib/xydrive/workspace';
import buildClassName from '../../util/buildClassName';
import captureKeyboardListeners from '../../util/captureKeyboardListeners';
import { copyTextToClipboard } from '../../util/clipboard';
import { getOpenModalCount } from '../../util/openModals';
import { formatFileSize } from '../../util/text/textFormat';

import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useKeyboardShortcutHint from '../../hooks/useKeyboardShortcutHint';
import useKeyboardShortcuts from '../../hooks/useKeyboardShortcuts';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Icon from '../common/icons/Icon';
import DropdownMenu from '../ui/DropdownMenu';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import MenuSeparator from '../ui/MenuSeparator';
import Modal from '../ui/Modal';
import XydriveCollection from './XydriveCollection';
import XydriveFileDialog from './XydriveFileDialog';
import XydriveInspector from './XydriveInspector';

import workspaceStyles from './Xydrive.module.scss';
import styles from './XydriveExplorer.module.scss';

const PAGE_SIZE = 48;
const SEARCH_DELAY = 170;
const DOWNLOAD_BATCH_LIMIT = 100;
const SORT_FIELDS: ReadonlyArray<readonly [XydriveSort, RegularLangKey]> = [
  ['name', 'XydriveSortName'], ['date', 'XydriveSortDate'], ['size', 'XydriveSortSize'], ['type', 'XydriveSortType'],
];

type OwnProps = {
  files: readonly XydriveFile[];
  indexedFiles?: readonly XydriveFile[];
  index?: XydriveIndex;
  childrenFolders: XydriveMount[];
  folders: XydriveMount[];
  organization: XydriveOrganization;
  sourceId?: string;
  ownerId?: string;
  locationKey: string;
  view: 'grid' | 'list';
  initialFilter?: XydriveFilter;
  isRecent?: boolean;
  isLibraryScope?: boolean;
  isComplete: boolean;
  isIndexComplete: boolean;
  isLoading: boolean;
  isSyncing: boolean;
  isNarrow: boolean;
  isNativeViewerOpen?: boolean;
  hasMore: boolean;
  loadError?: RegularLangKey;
  emptyLabel: RegularLangKey;
  previewingId?: string;
  mutation?: XydriveMutation;
  onChangeView: (view: 'grid' | 'list') => void;
  onPreferences: (filter: XydriveFilter, sort: XydriveSort, direction: XydriveDirection) => void;
  onLoadMore: NoneToVoidFunction;
  onSync: NoneToVoidFunction;
  onUpload?: NoneToVoidFunction;
  onCreate?: NoneToVoidFunction;
  onOpenFolder: (id?: string) => void;
  onManageFolder: (folder: XydriveMount, destination?: XydriveMount) => void;
  onOpenMessage: (file: XydriveFile) => void;
  onForward: (file: XydriveFile) => void;
  onPreview: (file: XydriveFile) => void;
  onLabel: (id: string, patch: { alias?: string }) => void;
  onBulkLabel: (fileIds: string[], folderIds: string[], patch: { favorite?: boolean; pinned?: boolean }) => void;
  onMutate: (ids: string[], operation: 'move' | 'delete', destinationId?: string) => void;
};

const XydriveExplorer = ({
  files, indexedFiles, index, childrenFolders, folders, organization, sourceId, ownerId, locationKey, view,
  initialFilter, isRecent, isLibraryScope, isComplete, isIndexComplete, isLoading,
  isSyncing, isNarrow, isNativeViewerOpen,
  hasMore, loadError, emptyLabel, previewingId, mutation, onChangeView, onPreferences, onLoadMore, onSync,
  onUpload, onCreate, onOpenFolder, onManageFolder, onOpenMessage, onForward, onPreview, onLabel, onBulkLabel, onMutate,
}: OwnProps) => {
  const { showNotification } = getActions();
  const lang = useLang();
  const searchHint = useKeyboardShortcutHint(lang('XydriveSearch'), 'xydriveSearch');
  const [initial] = useState(() => getXydriveLocationState(ownerId, locationKey));
  const [preferences] = useState(() => getXydrivePreferences(ownerId));
  const [query, setQuery] = useState(initialFilter ? '' : initial?.query || '');
  const [search, setSearch] = useState(query);
  const [filter, setFilter] = useState(initialFilter || preferences.filter);
  const [extension, setExtension] = useState(initialFilter ? '' : initial?.extension || '');
  const [sort, setSort] = useState<XydriveSort | 'opened'>(isRecent ? 'opened' : preferences.sort);
  const [direction, setDirection] = useState<XydriveDirection>(isRecent ? 'desc' : preferences.direction);
  const [page, setPage] = useState(initialFilter ? 0 : initial?.page || 0);
  const [selection, setSelection] = useState(EMPTY_XYDRIVE_SELECTION);
  const [menuItem, setMenuItem] = useState<XydriveItem>();
  const [hasInspector, setHasInspector] = useState(false);
  const [inspected, setInspected] = useState<XydriveItem>();
  const [operation, setOperation] = useState<{ type: FileOperation; items: XydriveItem[]; destinationId?: string }>();
  const scrollRef = useRef<HTMLDivElement>();
  const searchRef = useRef<HTMLInputElement>();
  const shouldFocusSearchRef = useRef(false);
  const menuAnchorRef = useRef<HTMLElement>();
  const menuRef = useRef<HTMLDivElement>();
  const scrollTopRef = useRef(initial?.scrollTop || 0);
  const hasRestoredRef = useRef(false);
  const { observe } = useIntersectionObserver({ rootRef: scrollRef });
  const hasSearch = Boolean(search.trim());
  const hasFilter = Boolean(query.trim() || extension.trim() || filter !== 'all');

  const { parents } = organization;
  const scope = useMemo(() => {
    const tree = buildFolderTree(folders, parents);
    const nodes = flattenFolderTree(tree, new Set(folders.map(({ id }) => id)), sourceId);
    return { ids: new Set([sourceId || ownerId, ...nodes.map(({ folder }) => folder.id)]),
      folders: nodes.map(({ folder }) => folder) };
  }, [folders, parents, sourceId, ownerId]);

  const items = useMemo(() => {
    const related = !isLibraryScope && hasSearch && indexedFiles
      ? indexedFiles.filter(({ chatId }) => scope.ids.has(chatId)) : files;
    const childItems = hasSearch && indexedFiles ? scope.folders : childrenFolders;
    return buildXydriveItems(related, childItems, organization, index?.sources);
  }, [hasSearch, indexedFiles, scope, files, childrenFolders, organization, index?.sources, isLibraryScope]);

  const matches = useMemo(() => queryXydriveItems(items, search, filter, sort, direction, extension),
    [items, search, filter, sort, direction, extension]);
  const matchIds = useMemo(() => matches.map(({ id }) => id), [matches]);
  const { visible, activePage, lastPage } = useMemo(() => getXydrivePage(matches, page, PAGE_SIZE), [matches, page]);
  const visibleSelection = useMemo(() => restrictXydriveSelection(selection, matchIds), [selection, matchIds]);
  const selected = useMemo(() => matches.filter(({ id }) => visibleSelection.ids.has(id)), [matches, visibleSelection]);
  const selectionStats = useMemo(() => summarizeXydriveItems(selected), [selected]);
  const isSearchComplete = isLibraryScope || (hasSearch && indexedFiles) ? isIndexComplete : isComplete;
  const isBusy = mutation?.status === 'working';
  const canChangeSelected = selected.length > 0 && selected.length <= MAX_XYDRIVE_MOVE_OR_DELETE
    && selected.every(canManageFile);
  const currentInspected = inspected && items.find(({ id }) => id === inspected.id);
  const described = currentInspected ? [currentInspected] : selected;

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query), SEARCH_DELAY);
    return () => window.clearTimeout(timer);
  }, [query]);

  useLayoutEffect(() => {
    if (hasRestoredRef.current || isLoading || !scrollRef.current) return;
    hasRestoredRef.current = true;
    scrollRef.current.scrollTop = scrollTopRef.current;
  }, [isLoading]);

  useEffect(() => {
    return () => storeXydriveLocationState(ownerId, locationKey, {
      query, page: activePage, scrollTop: scrollTopRef.current, extension,
    });
  }, [ownerId, locationKey, query, activePage, extension]);

  useEffect(() => {
    setSelection((current) => restrictXydriveSelection(current, matchIds));
  }, [matchIds]);

  const handleEscape = useLastCallback(() => {
    if (isNativeViewerOpen || getOpenModalCount() || menuItem || operation) return false;
    if (hasInspector) {
      setHasInspector(false);
      return true;
    }
    if (!visibleSelection.ids.size) return false;
    setSelection(EMPTY_XYDRIVE_SELECTION);
    return true;
  });
  useEffect(() => captureKeyboardListeners({ onEsc: handleEscape }), [handleEscape]);

  useEffect(() => {
    if (menuItem && !matchIds.includes(menuItem.id) && menuAnchorRef.current?.closest('[data-drive-item]')) {
      setMenuItem(undefined);
    }
  }, [menuItem, matchIds]);

  const focusSearch = useLastCallback(() => {
    if (isNativeViewerOpen || getOpenModalCount() || !searchRef.current) return false;
    if (selected.length > 0) {
      shouldFocusSearchRef.current = true;
      setSelection(EMPTY_XYDRIVE_SELECTION);
    } else {
      searchRef.current.focus();
    }
    return true;
  });

  useLayoutEffect(() => {
    if (selected.length > 0 || !shouldFocusSearchRef.current) return;
    shouldFocusSearchRef.current = false;
    searchRef.current?.focus();
  }, [selected.length]);

  const selectAllMatching = useLastCallback((event?: KeyboardEvent) => {
    if (isNativeViewerOpen || getOpenModalCount()
      || (event?.target instanceof HTMLElement && !scrollRef.current?.contains(event.target))) return false;
    setSelection({ ids: new Set(matchIds), anchor: matchIds[0] });
    return true;
  });
  const shortcuts = useMemo(() => ({ xydriveSearch: focusSearch, xydriveSelectAll: selectAllMatching }),
    [focusSearch, selectAllMatching]);
  useKeyboardShortcuts(shortcuts);

  function canManageFile(item: XydriveItem) {
    return item.kind === 'file' && Boolean(ownerId && canManageXydriveSource(item.file.chatId, ownerId, folders));
  }

  function canDropItem(item: XydriveItem, destination: XydriveItem) {
    if (isBusy || destination.kind !== 'folder' || item.id === destination.id) return false;
    if (item.kind === 'file') {
      return Boolean(destination.folder.isManaged && item.file.chatId !== destination.id && canManageFile(item));
    }
    return !getFolderChain(organization, folders, destination.id).some(({ id }) => id === item.id);
  }

  function jumpTo(next: number) {
    setPage(next);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    scrollTopRef.current = 0;
  }

  function setCategory(next: XydriveFilter) {
    setFilter(next);
    onPreferences(next, sort === 'opened' ? preferences.sort : sort, direction);
    jumpTo(0);
  }

  function setOrdering(next: XydriveSort | 'opened', order: XydriveDirection) {
    setSort(next);
    setDirection(order);
    onPreferences(filter, next === 'opened' ? preferences.sort : next, order);
    jumpTo(0);
  }

  function clearFilters() {
    setQuery('');
    setSearch('');
    setExtension('');
    setCategory('all');
  }

  function labelItems(targets: XydriveItem[], field: 'favorite' | 'pinned') {
    const key = field === 'favorite' ? 'isFavorite' : 'isPinned';
    onBulkLabel(targets.filter(({ kind }) => kind === 'file').map(({ id }) => id),
      targets.filter(({ kind }) => kind === 'folder').map(({ id }) => id),
      { [field]: !targets.every((item) => item[key]) });
  }

  function copyNames(targets: XydriveItem[]) {
    const isCopied = copyTextToClipboard(targets.map(({ name }) => name).join('\n'));
    showNotification({ message: { key: isCopied ? 'XydriveNamesCopied' : 'XydriveClipboardError' } });
  }

  function inspect(item?: XydriveItem) {
    setInspected(item);
    setHasInspector(true);
  }

  function openItem(item: XydriveItem) {
    if (item.kind === 'folder') onOpenFolder(item.id);
    else if (item.file.previewKind) onPreview(item.file);
    else inspect(item);
  }

  function openActions(item: XydriveItem, anchor: HTMLElement) {
    menuAnchorRef.current = anchor;
    setMenuItem(item);
  }

  function closeActions() {
    setMenuItem(undefined);
  }

  function getPath(id?: string) {
    return id && id !== ownerId ? getFolderChain(organization, folders, id).map(({ title }) => title).join(' / ')
      || lang('XydriveRoot') : lang('XydriveRoot');
  }

  function runOperation(type: FileOperation, targets: XydriveItem[], destinationId?: string) {
    setOperation({ type, items: targets, destinationId });
  }

  function renderMenu() {
    if (!menuItem) return undefined;
    const item = menuItem;
    const file = item.kind === 'file' ? item.file : undefined;
    const actions = (
      <>
        <MenuItem icon="eye" onClick={() => openItem(item)}>{lang('Open')}</MenuItem>
        <MenuItem icon="info" onClick={() => inspect(item)}>{lang('XydriveDetails')}</MenuItem>
        {file && (
          <>
            <MenuItem icon="download" onClick={() => enqueueXydriveDownload(file)}>
              {lang('XydriveTransferDownload')}
            </MenuItem>
            <MenuItem icon="forward" onClick={() => onForward(file)}>{lang('XydriveForward')}</MenuItem>
            <MenuItem icon="arrow-right" onClick={() => onOpenMessage(file)}>{lang('XydriveOpenMessage')}</MenuItem>
          </>
        )}
        <MenuSeparator />
        <MenuItem icon="star-outline" onClick={() => labelItems([item], 'favorite')}>
          {lang(item.isFavorite ? 'XydriveUnfavorite' : 'XydriveFavorite')}
        </MenuItem>
        <MenuItem icon="pin" onClick={() => labelItems([item], 'pinned')}>
          {lang(item.isPinned ? 'XydriveUnpin' : 'XydrivePin')}
        </MenuItem>
        <MenuItem icon="copy" onClick={() => copyNames([item])}>{lang('XydriveCopyName')}</MenuItem>
        {item.kind === 'folder' ? (
          <MenuItem icon="settings" onClick={() => onManageFolder(item.folder)}>
            {lang('XydriveFolderActions')}
          </MenuItem>
        ) : <MenuItem icon="edit" onClick={() => runOperation('rename', [item])}>{lang('XydriveRename')}</MenuItem>}
        {canManageFile(item) && (
          <>
            <MenuItem icon="folder" disabled={isBusy} onClick={() => runOperation('move', [item])}>
              {lang('XydriveMove')}
            </MenuItem>
            <MenuSeparator />
            <MenuItem icon="delete" destructive disabled={isBusy} onClick={() => runOperation('delete', [item])}>
              {lang('XydriveDelete')}
            </MenuItem>
          </>
        )}
      </>
    );
    if (isNarrow) {
      return (
        <Modal
          isOpen
          hasCloseButton
          title={item.name}
          onClose={closeActions}
          dialogClassName={workspaceStyles.sheetFrame}
        >
          <div className={styles.menuSheet} onClick={closeActions}>{actions}</div>
        </Modal>
      );
    }
    return (
      <Menu
        ref={menuRef}
        isOpen
        autoClose
        withPortal
        withMaxHeight
        ariaLabel={lang('XydriveActionsNamed', { name: item.name })}
        anchor={() => {
          const rect = menuAnchorRef.current!.getBoundingClientRect();
          return { x: rect.left, y: rect.bottom, width: rect.width };
        }}
        getTriggerElement={() => menuAnchorRef.current}
        getRootElement={() => scrollRef.current?.ownerDocument.documentElement}
        getMenuElement={() => menuRef.current}
        getLayout={() => ({ withPortal: true })}
        onClose={closeActions}
      >
        {actions}
      </Menu>
    );
  }

  return (
    <section className={styles.explorer} aria-label={lang('XydriveExplorer')}>
      <div className={styles.toolbar}>
        <div className={styles.browseTools} hidden={selected.length > 0}>
          <label className={styles.search}>
            <Icon name="search" />
            <input
              ref={searchRef}
              type="search"
              title={searchHint}
              value={query}
              aria-label={lang('XydriveSearch')}
              placeholder={lang('XydriveSearch')}
              onInput={(event) => {
                setQuery(event.currentTarget.value);
                setInspected(undefined);
                jumpTo(0);
              }}
            />
          </label>
          <div className={styles.controls}>
            <DropdownMenu
              withPortal
              trigger={({ onTrigger, isOpen }) => (
                <button
                  type="button"
                  className={buildClassName(styles.control, hasFilter && styles.active)}
                  aria-label={lang('XydriveFilter')}
                  aria-expanded={isOpen}
                  onClick={onTrigger}
                >
                  <Icon name="tag-filter" />
                </button>
              )}
            >
              <MenuItem onClick={() => setCategory('all')}>{lang('XydriveAllTypes')}</MenuItem>
              {XYDRIVE_CATEGORIES.map((category) => (
                <MenuItem key={category} onClick={() => setCategory(category)}>
                  {lang(CATEGORY_LABELS[category])}
                  {filter === category && <Icon name="check" />}
                </MenuItem>
              ))}
              <MenuSeparator />
              <label className={styles.extensionField}>
                {lang('XydriveFilterExtension')}
                <input
                  type="text"
                  value={extension}
                  maxLength={12}
                  autoComplete="off"
                  onClick={(event) => event.stopPropagation()}
                  onInput={(event) => {
                    setExtension(event.currentTarget.value);
                    jumpTo(0);
                  }}
                />
              </label>
            </DropdownMenu>
            <DropdownMenu
              withPortal
              trigger={({ onTrigger, isOpen }) => (
                <button
                  type="button"
                  className={styles.control}
                  aria-label={lang('XydriveSort')}
                  aria-expanded={isOpen}
                  onClick={onTrigger}
                >
                  <Icon name="dropdown-arrows" />
                </button>
              )}
            >
              {isRecent && (
                <MenuItem onClick={() => setOrdering('opened', direction)}>{lang('XydriveLastOpened')}</MenuItem>
              )}
              {SORT_FIELDS.map(([field, key]) => (
                <MenuItem key={field} onClick={() => setOrdering(field, direction)}>
                  {lang(key)}
                  {sort === field && <Icon name="check" />}
                </MenuItem>
              ))}
              <MenuSeparator />
              <div className={styles.extensionField}>{lang('XydrivePinnedOrder')}</div>
              <MenuItem icon="up" onClick={() => setOrdering(sort, 'asc')}>{lang('XydriveAscendingShort')}</MenuItem>
              <MenuItem icon="down" onClick={() => setOrdering(sort, 'desc')}>
                {lang('XydriveDescendingShort')}
              </MenuItem>
            </DropdownMenu>
            <button
              type="button"
              className={styles.control}
              aria-label={lang(view === 'grid' ? 'XydriveList' : 'XydriveGrid')}
              onClick={() => onChangeView(view === 'grid' ? 'list' : 'grid')}
            >
              <Icon name={view === 'grid' ? 'list' : 'media'} />
            </button>
            <button
              type="button"
              className={buildClassName(styles.control, hasInspector && styles.active)}
              aria-label={lang('XydriveDetails')}
              aria-pressed={hasInspector}
              onClick={() => {
                setInspected(undefined);
                setHasInspector(!hasInspector);
              }}
            >
              <Icon name="sidebar" />
            </button>
          </div>
        </div>
        {selected.length > 0 && (
          <div className={styles.selectionBar}>
            <div className={styles.selectionSummary}>
              <strong>{lang('XydriveItemCount', { count: lang.number(selected.length) })}</strong>
              <span>
                {formatFileSize(lang, selectionStats.bytes)}
                {selectionStats.unknown
                  ? ` + ${lang.number(selectionStats.unknown)} ${lang('XydriveUnknownSize')}` : ''}
              </span>
            </div>
            <DropdownMenu
              withPortal
              trigger={({ onTrigger }) => (
                <button
                  type="button"
                  className={styles.control}
                  aria-label={lang('XydriveSelectionActions')}
                  onClick={onTrigger}
                >
                  <Icon name="more" />
                </button>
              )}
            >
              <MenuItem icon="info" onClick={() => inspect()}>{lang('XydriveDetails')}</MenuItem>
              <MenuItem icon="copy" onClick={() => copyNames(selected)}>{lang('XydriveCopyNames')}</MenuItem>
              <MenuItem
                icon="download"
                disabled={!selectionStats.files || selectionStats.files > DOWNLOAD_BATCH_LIMIT}
                onClick={() => selected.forEach((item) => {
                  if (item.kind === 'file') enqueueXydriveDownload(item.file);
                })}
              >
                {lang('XydriveTransferDownloadSelected')}
              </MenuItem>
              <MenuItem icon="star-outline" onClick={() => labelItems(selected, 'favorite')}>
                {lang(selected.every(({ isFavorite }) => isFavorite) ? 'XydriveUnfavorite' : 'XydriveFavorite')}
              </MenuItem>
              <MenuItem icon="pin" onClick={() => labelItems(selected, 'pinned')}>
                {lang(selected.every(({ isPinned }) => isPinned) ? 'XydriveUnpin' : 'XydrivePin')}
              </MenuItem>
              <MenuItem
                icon="folder"
                disabled={!canChangeSelected || isBusy}
                onClick={() => runOperation('move', selected)}
              >
                {lang('XydriveMove')}
              </MenuItem>
              <MenuSeparator />
              <MenuItem
                icon="delete"
                destructive
                disabled={!canChangeSelected || isBusy}
                onClick={() => runOperation('delete', selected)}
              >
                {lang('XydriveDelete')}
              </MenuItem>
            </DropdownMenu>
            <button
              type="button"
              className={styles.control}
              aria-label={lang('XydriveClearSelection')}
              onClick={() => setSelection(EMPTY_XYDRIVE_SELECTION)}
            >
              <Icon name="close" />
            </button>
          </div>
        )}
      </div>
      {hasFilter && (
        <div className={styles.scope} role="status">
          <span>
            {lang(isLibraryScope ? 'XydriveLibraryScope' : filter === 'all' && !extension ? hasSearch && indexedFiles
              ? 'XydriveDescendantScope' : 'XydriveLoadedOnly' : 'XydriveFileFilterScope')}
          </span>
          {filter !== 'all' && <span className={styles.tag}>{lang(CATEGORY_LABELS[filter])}</span>}
          {extension && <span className={styles.tag} dir="auto">{extension}</span>}
          {!isSearchComplete && (
            <button
              type="button"
              className={styles.textButton}
              disabled={isSyncing}
              onClick={onSync}
            >
              {lang(isSyncing ? 'XydriveIndexSyncing' : 'XydriveIndexSearchMore')}
            </button>
          )}
          <button type="button" className={styles.textButton} onClick={clearFilters}>
            {lang('XydriveClearFilters')}
          </button>
        </div>
      )}
      <div className={buildClassName(styles.body, hasInspector && !isNarrow && styles.hasInspector)}>
        <div
          ref={scrollRef}
          className={styles.collection}
          aria-busy={isLoading}
          onScroll={(event) => {
            scrollTopRef.current = event.currentTarget.scrollTop;
            if (menuItem && !isNarrow) closeActions();
          }}
        >
          {visible.length > 0 && loadError && (
            <div className={styles.collectionError} role="alert">
              <Icon name="info" />
              <span>{lang(loadError)}</span>
              <button type="button" className={styles.textButton} onClick={onLoadMore}>{lang('XydriveRetry')}</button>
            </div>
          )}
          {visible.length > 0 ? (
            <XydriveCollection
              items={visible}
              selected={visibleSelection.ids}
              view={view}
              sort={sort}
              direction={direction}
              query={search}
              previewingId={previewingId}
              observe={observe}
              canDrag={(item) => !isBusy && (item.kind === 'folder' || canManageFile(item))}
              canDrop={canDropItem}
              onDrop={(item, destination) => {
                if (destination.kind !== 'folder' || !canDropItem(item, destination)) return;
                if (item.kind === 'folder') onManageFolder(item.folder, destination.folder);
                else runOperation('move', [item], destination.id);
              }}
              onOpen={openItem}
              onSelect={(item, mode) => {
                setInspected(undefined);
                setSelection((current) => selectXydriveFile(current, matchIds, item.id, mode));
              }}
              onTogglePage={() => {
                const all = visible.every(({ id }) => visibleSelection.ids.has(id));
                const ids = new Set(visibleSelection.ids);
                visible.forEach(({ id }) => {
                  if (all) ids.delete(id);
                  else ids.add(id);
                });
                setSelection({ ids, anchor: visible[0]?.id });
              }}
              onSort={(next) => setOrdering(next, sort === next && direction === 'asc' ? 'desc' : 'asc')}
              onMenu={openActions}
            />
          ) : isLoading ? (
            <div
              className={buildClassName(styles.skeletonGrid, view === 'list' && styles.skeletonList)}
              role="status"
              aria-label={lang('XydriveLoadingOlder')}
            >
              {Array.from({ length: 8 }, (_, i) => <span key={i} />)}
            </div>
          ) : (
            <div className={styles.empty}>
              <span className={styles.emptyGlyph}>
                <Icon name={loadError ? 'info' : hasFilter ? 'search' : 'folder'} />
              </span>
              <p className={styles.emptyTitle} role={loadError ? 'alert' : undefined}>
                {lang(loadError || (hasFilter
                  ? isSearchComplete ? 'XydriveNoMatches' : 'XydriveNoLoadedMatches'
                  : hasMore ? 'XydriveNoFilesYet' : emptyLabel))}
              </p>
              {!hasFilter && !loadError && !sourceId && indexedFiles && <p>{lang('XydriveWelcomeGuide')}</p>}
              <div className={styles.controls}>
                {hasFilter && (
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={clearFilters}
                  >
                    {lang('XydriveClearFilters')}
                  </button>
                )}
                {loadError && (
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={onLoadMore}
                  >
                    {lang('XydriveRetry')}
                  </button>
                )}
                {!hasFilter && !loadError && onCreate && (
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={onCreate}
                  >
                    {lang('XydriveNewFolder')}
                  </button>
                )}
                {!hasFilter && !loadError && onUpload && (
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={onUpload}
                  >
                    {lang('XydriveUpload')}
                  </button>
                )}
              </div>
            </div>
          )}
          {hasMore && !loadError && (
            <button type="button" className={styles.loadMore} disabled={isLoading} onClick={onLoadMore}>
              {lang(isLoading ? 'XydriveLoadingOlder' : 'XydriveLoadOlder')}
            </button>
          )}
        </div>
        {hasInspector && (
          <XydriveInspector
            items={described}
            isSheet={isNarrow}
            getPath={getPath}
            onGoTo={(id) => onOpenFolder(id === ownerId ? undefined : id)}
            onOpen={openItem}
            onNativeMessage={onOpenMessage}
            onActions={openActions}
            onClose={() => setHasInspector(false)}
          />
        )}
      </div>
      {lastPage > 0 && (
        <footer className={styles.status}>
          <span aria-live="polite">{lang('XydriveLoadedCount', { count: lang.number(matches.length) })}</span>
          {matches.length > visible.length && (
            <button
              type="button"
              className={styles.textButton}
              onClick={() => selectAllMatching()}
            >
              {lang('XydriveSelectLoaded')}
            </button>
          )}
          {lastPage > 0 && (
            <div className={styles.pagination}>
              <button
                type="button"
                className={styles.control}
                disabled={activePage === 0}
                aria-label={lang('Back')}
                onClick={() => jumpTo(activePage - 1)}
              >
                <Icon name={lang.isRtl ? 'arrow-right' : 'arrow-left'} />
              </button>
              <span>
                {lang.number(activePage + 1)}
                {' '}
                /
                {' '}
                {lang.number(lastPage + 1)}
              </span>
              <button
                type="button"
                className={styles.control}
                disabled={activePage === lastPage}
                aria-label={lang('Next')}
                onClick={() => jumpTo(activePage + 1)}
              >
                <Icon name={lang.isRtl ? 'arrow-left' : 'arrow-right'} />
              </button>
            </div>
          )}
        </footer>
      )}
      {renderMenu()}
      {operation && (
        <XydriveFileDialog
          operation={operation.type}
          items={operation.items}
          ownerId={ownerId}
          organization={organization}
          folders={folders}
          destinationId={operation.destinationId}
          mutation={mutation}
          onLabel={onLabel}
          onRun={onMutate}
          onClose={() => setOperation(undefined)}
        />
      )}
    </section>
  );
};

export default memo(XydriveExplorer);
