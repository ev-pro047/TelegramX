import {
  memo, useEffect, useMemo, useRef, useState,
} from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { XydriveDirection, XydriveFilter, XydriveSort } from '../../lib/xydrive/explorer';
import type {
  XydriveCategory, XydriveFile, XydriveMount, XydriveMutationStatus, XydriveOrganization,
} from '../../lib/xydrive/types';
import type { IconName } from '../../types/icons';
import type { RegularLangKey } from '../../types/language';

import {
  EMPTY_XYDRIVE_SELECTION, queryXydriveFiles, restrictXydriveSelection, selectXydriveFile,
} from '../../lib/xydrive/explorer';
import { getFileLabel, getFolderChain } from '../../lib/xydrive/organization';
import { enqueueXydriveDownload } from '../../lib/xydrive/transfers';
import buildClassName from '../../util/buildClassName';
import { copyTextToClipboard } from '../../util/clipboard';
import { formatFileSize } from '../../util/text/textFormat';

import useAppLayout from '../../hooks/useAppLayout';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import useKeyboardListNavigation from '../../hooks/useKeyboardListNavigation';
import useLang from '../../hooks/useLang';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import Loading from '../ui/Loading';
import Menu from '../ui/Menu';
import MenuItem from '../ui/MenuItem';
import Modal from '../ui/Modal';
import XydriveThumbnail from './XydriveThumbnail';

import styles from './XydriveExplorer.module.scss';

type OwnProps = {
  files: readonly XydriveFile[];
  indexedFiles?: readonly XydriveFile[];
  childrenFolders: XydriveMount[];
  sourceId?: string;
  view: 'grid' | 'list';
  isIndexComplete?: boolean;
  hasMore: boolean;
  isRecent?: boolean;
  loadError?: RegularLangKey;
  emptyLabel: RegularLangKey;
  onChangeView: (view: 'grid' | 'list') => void;
  onLoadMore: NoneToVoidFunction;
  onUpload?: NoneToVoidFunction;
  onOpenFolder: (id: string) => void;
  isComplete: boolean;
  isLoading: boolean;
  onOpenMessage: (file: XydriveFile) => void;
  onPreview: (file: XydriveFile) => void;
  previewingId?: string;
  organization: XydriveOrganization;
  folders: XydriveMount[];
  ownerId?: string;
  onLabel: (fileId: string, patch: { alias?: string; favorite?: boolean; pinned?: boolean }) => void;
  onMutate: (fileId: string, operation: 'delete' | 'move', destinationId?: string) => void;
  mutationStatus?: XydriveMutationStatus;
};

const RESULT_BATCH_SIZE = 120;

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

const CATEGORIES: XydriveCategory[] = ['images', 'videos', 'audio', 'documents', 'archives', 'other'];
const SORT_OPTIONS: { key: XydriveSort; label: RegularLangKey }[] = [
  { key: 'date', label: 'XydriveSortDate' },
  { key: 'name', label: 'XydriveSortName' },
  { key: 'size', label: 'XydriveSortSize' },
  { key: 'type', label: 'XydriveSortType' },
];

const XydriveExplorer = ({
  files, isComplete, isLoading, onOpenMessage, onPreview, previewingId,
  organization, folders, ownerId, onLabel, onMutate, mutationStatus, indexedFiles,
  childrenFolders, sourceId, view, isIndexComplete, hasMore, loadError, emptyLabel,
  onChangeView, onLoadMore, onUpload, onOpenFolder, isRecent,
}: OwnProps) => {
  const { showNotification } = getActions();
  const lang = useLang();
  const { isMobile, isTouchScreen } = useAppLayout();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<XydriveFilter>('all');
  const [sort, setSort] = useState<XydriveSort | 'opened'>(isRecent ? 'opened' : 'date');
  const [direction, setDirection] = useState<XydriveDirection>('desc');
  const [resultLimit, setResultLimit] = useState(RESULT_BATCH_SIZE);
  const [selection, setSelection] = useState(EMPTY_XYDRIVE_SELECTION);
  const [detailsId, setDetailsId] = useState<string | undefined>(undefined);
  const [menuId, setMenuId] = useState<string | undefined>(undefined);
  const [edit, setEdit] = useState<{ file: XydriveFile; mode: 'rename' | 'delete' | 'move' } | undefined>();
  const [value, setValue] = useState('');
  const busy = mutationStatus === 'working';
  function startEdit(file: XydriveFile, mode: 'rename' | 'delete' | 'move') {
    setEdit({ file, mode });
    setValue(mode === 'rename' ? (getFileLabel(organization, file)?.alias || file.name) : '');
    setMenuId(undefined);
  }
  const listRef = useRef<HTMLUListElement>();
  // Undefined observer root uses the viewport; ancestor scroll clipping is respected.
  const scrollRef = useRef<HTMLDivElement>();
  const menuRef = useRef<HTMLDivElement>();
  const menuTriggerRef = useRef<HTMLElement>();
  const { observe } = useIntersectionObserver({ rootRef: scrollRef });

  const folderPaths = useMemo(() => new Map(folders.map(({ id }) => {
    const chain = getFolderChain(organization, folders, id);
    return [id, { chain, title: chain.map(({ title }) => title).join(' / ') }];
  })), [folders, organization]);
  const term = query.trim().normalize('NFC').toLowerCase();
  const isRecursiveSearch = Boolean(term && indexedFiles);
  const hasFilter = Boolean(term) || category !== 'all';
  const resultsAreComplete = isRecursiveSearch ? isIndexComplete : isComplete;
  const folderLabels = organization.folderLabels;
  const visibleFolders = useMemo(() => {
    if (category !== 'all') return [];
    const candidates = isRecursiveSearch ? folders.filter(({ id }) => id !== sourceId
      && (!sourceId || folderPaths.get(id)?.chain.some((folder) => folder.id === sourceId))) : childrenFolders;
    return candidates.filter(({ title }) => title.normalize('NFC').toLowerCase().includes(term))
      .sort((left, right) => Number(Boolean(folderLabels?.[right.id]?.pinned))
        - Number(Boolean(folderLabels?.[left.id]?.pinned))
        || left.title.localeCompare(right.title, undefined, { numeric: true })
        * (sort === 'name' && direction === 'desc' ? -1 : 1));
  }, [
    category, childrenFolders, direction, folderLabels, folderPaths, folders, isRecursiveSearch, sort, sourceId, term,
  ]);

  const matchingFiles = useMemo(() => {
    const candidates = term && indexedFiles ? indexedFiles.filter(({ chatId }) => !sourceId
      || chatId === sourceId || folderPaths.get(chatId)?.chain.some(({ id }) => id === sourceId)) : files;
    const originals = new Map(candidates.map((file) => [file.id, file]));
    return queryXydriveFiles(candidates.map((file) => {
      const alias = getFileLabel(organization, file)?.alias;
      return alias ? { ...file, name: alias } : file;
    }), query, category, sort === 'opened' ? 'date' : sort, direction)
      .sort((a, b) => {
        if (sort === 'opened') {
          return ((getFileLabel(organization, b)?.lastOpened || 0) - (getFileLabel(organization, a)?.lastOpened || 0))
            * (direction === 'desc' ? 1 : -1);
        }
        return Number(Boolean(getFileLabel(organization, b)?.pinned))
          - Number(Boolean(getFileLabel(organization, a)?.pinned));
      })
      .map(({ id }) => originals.get(id)!);
  }, [files, indexedFiles, query, term, category, sort, direction, organization, sourceId, folderPaths]);
  const visibleFiles = useMemo(() => matchingFiles.slice(0, resultLimit), [matchingFiles, resultLimit]);
  const visibleIds = useMemo(() => visibleFiles.map(({ id }) => id), [visibleFiles]);
  const visibleSelection = useMemo(
    () => restrictXydriveSelection(selection, visibleIds), [selection, visibleIds],
  );
  const details = visibleFiles.find(({ id }) => id === detailsId);
  const detailLabel = details && getFileLabel(organization, details);
  const editTitle = edit?.mode === 'rename' ? 'XydriveRename' : edit?.mode === 'move' ? 'XydriveMove' : 'XydriveDelete';
  const editDescription = edit?.mode === 'rename' ? 'XydriveAliasDesc'
    : edit?.mode === 'move' ? 'XydriveMoveDesc' : 'XydriveDeleteDesc';
  const managedFolders = useMemo(() => folders.filter(({ isManaged }) => isManaged), [folders]);
  const navigateWithKeyboard = useKeyboardListNavigation(listRef, true, undefined, '[data-xydrive-file]', true);

  useEffect(() => {
    setSelection((current) => restrictXydriveSelection(current, visibleIds));
    if (detailsId && !visibleIds.includes(detailsId)) setDetailsId(undefined);
    if (menuId && !visibleIds.includes(menuId)) setMenuId(undefined);
  }, [visibleIds, detailsId, menuId]);

  function selectAll() {
    setSelection({ ids: new Set(visibleIds), anchor: visibleIds[0] });
  }

  function handleListKeyDown(event: React.KeyboardEvent<HTMLUListElement>) {
    if (menuId) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      selectAll();
      return;
    }
    navigateWithKeyboard(event);
  }

  function handleFileClick(event: React.MouseEvent<HTMLButtonElement>, file: XydriveFile) {
    const mode = event.shiftKey ? 'range' : event.ctrlKey || event.metaKey ? 'toggle' : 'replace';
    setSelection((current) => selectXydriveFile(current, visibleIds, file.id, mode));
    if (mode === 'replace' && detailsId) setDetailsId(file.id);
  }

  function toggleFile(id: string) {
    setSelection((current) => selectXydriveFile(current, visibleIds, id, 'toggle'));
  }

  function clearFilters() {
    setQuery('');
    setCategory('all');
    setResultLimit(RESULT_BATCH_SIZE);
  }

  function copyNames(filesToCopy: XydriveFile[]) {
    const names = filesToCopy.map((file) => getFileLabel(organization, file)?.alias || file.name);
    const isCopied = copyTextToClipboard(names.join('\n'));
    showNotification({ message: { key: isCopied ? 'XydriveNamesCopied' : 'XydriveClipboardError' } });
  }

  function openFile(file: XydriveFile) {
    if (file.previewKind) {
      if (!previewingId) onPreview(file);
    } else {
      onOpenMessage(file);
    }
  }

  function getMenuAnchor() {
    const rect = menuTriggerRef.current!.getBoundingClientRect();
    return { x: rect.left, y: rect.bottom, width: rect.width };
  }

  function renderDetails(file: XydriveFile) {
    return (
      <div className={styles.detailContent}>
        <Icon name={CATEGORY_ICONS[file.category]} className={styles.detailIcon} />
        <strong className={styles.detailName} dir="auto">{detailLabel?.alias || file.name}</strong>
        <dl className={styles.metadata}>
          {detailLabel?.alias && (
            <>
              <dt>{lang('XydriveOriginalName')}</dt>
              <dd dir="auto">{file.name}</dd>
            </>
          )}
          <dt>{lang('XydriveLocation')}</dt>
          <dd dir="auto">{folderPaths.get(file.chatId)?.title || lang('XydriveRoot')}</dd>
          <dt>{lang('XydriveSortType')}</dt>
          <dd>{lang(CATEGORY_LABELS[file.category])}</dd>
          <dt>{lang('XydriveSortSize')}</dt>
          <dd>{file.size === undefined ? lang('XydriveUnknownSize') : formatFileSize(lang, file.size)}</dd>
          <dt>{lang('XydriveSortDate')}</dt>
          <dd>{new Date(file.date * 1000).toLocaleDateString()}</dd>
          <dt>{lang('XydriveMimeType')}</dt>
          <dd>{file.mimeType || lang('XydriveUnknownValue')}</dd>
        </dl>
        <div className={styles.detailActions}>
          {file.previewKind && (
            <Button
              size="smaller"
              isLoading={previewingId === file.id}
              disabled={Boolean(previewingId)}
              onClick={() => onPreview(file)}
            >
              {lang('XydrivePreview')}
            </Button>
          )}
          <Button
            size="smaller"
            color="translucent-bordered"
            iconName="download"
            onClick={() => enqueueXydriveDownload(file)}
          >
            {lang('XydriveTransferDownload')}
          </Button>
          <Button size="smaller" color="translucent" onClick={() => onOpenMessage(file)}>
            {lang('XydriveOpenMessage')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <section className={styles.explorer} aria-label={lang('XydriveExplorer')}>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Icon name="search" />
          <input
            type="search"
            aria-label={lang('XydriveSearch')}
            placeholder={lang('XydriveSearch')}
            value={query}
            onInput={(event) => {
              setQuery(event.currentTarget.value);
              setResultLimit(RESULT_BATCH_SIZE);
            }}
          />
        </div>
        <div className={styles.controls}>
          <select
            aria-label={lang('XydriveFilter')}
            value={category}
            onChange={(event) => {
              setCategory(event.currentTarget.value as XydriveFilter);
              setResultLimit(RESULT_BATCH_SIZE);
            }}
          >
            <option value="all">{lang('XydriveAllTypes')}</option>
            {CATEGORIES.map((item) => <option key={item} value={item}>{lang(CATEGORY_LABELS[item])}</option>)}
          </select>
          <select
            aria-label={lang('XydriveSort')}
            value={sort}
            onChange={(event) => setSort(event.currentTarget.value as typeof sort)}
          >
            {isRecent && <option value="opened">{lang('XydriveLastOpened')}</option>}
            {SORT_OPTIONS.map(({ key, label }) => <option key={key} value={key}>{lang(label)}</option>)}
          </select>
          <button
            type="button"
            className={styles.controlButton}
            aria-label={lang(direction === 'asc' ? 'XydriveAscending' : 'XydriveDescending')}
            title={lang(direction === 'asc' ? 'XydriveAscending' : 'XydriveDescending')}
            onClick={() => setDirection(direction === 'asc' ? 'desc' : 'asc')}
          >
            <span aria-hidden="true">{direction === 'asc' ? '↑' : '↓'}</span>
          </button>
          <div className={styles.viewToggle}>
            <button
              type="button"
              className={buildClassName(styles.controlButton, view === 'grid' && styles.activeControl)}
              aria-pressed={view === 'grid'}
              aria-label={lang('XydriveGrid')}
              title={lang('XydriveGrid')}
              onClick={() => onChangeView('grid')}
            >
              <span className={styles.gridIcon} aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
            </button>
            <button
              type="button"
              className={buildClassName(styles.controlButton, view === 'list' && styles.activeControl)}
              aria-pressed={view === 'list'}
              aria-label={lang('XydriveList')}
              title={lang('XydriveList')}
              onClick={() => onChangeView('list')}
            >
              <Icon name="list" />
            </button>
          </div>
        </div>
      </div>
      {edit && (
        <Modal
          isOpen
          isSlim
          hasCloseButton
          title={lang(editTitle)}
          onClose={() => setEdit(undefined)}
        >
          <div className={styles.editPanel}>
            <strong dir="auto">{getFileLabel(organization, edit.file)?.alias || edit.file.name}</strong>
            <p className={styles.scope}>{lang(editDescription)}</p>
            {edit.mode === 'rename' && (
              <input
                className={styles.editInput}
                aria-label={lang('XydriveRename')}
                value={value}
                maxLength={255}
                onInput={(event) => setValue(event.currentTarget.value)}
              />
            )}
            {edit.mode === 'move' && (
              <select
                className={styles.editInput}
                aria-label={lang('XydriveDestination')}
                value={value}
                onChange={(event) => setValue(event.currentTarget.value)}
              >
                <option value="">{lang(edit.file.chatId === ownerId ? 'XydriveChooseFolder' : 'XydriveRoot')}</option>
                {managedFolders.filter(({ id }) => id !== edit.file.chatId).map(({ id }) => (
                  <option key={id} value={id}>{folderPaths.get(id)?.title}</option>
                ))}
              </select>
            )}
            <div className={styles.selectionActions}>
              <Button size="smaller" color="translucent" onClick={() => setEdit(undefined)}>{lang('Close')}</Button>
              <Button
                size="smaller"
                color={edit.mode === 'delete' ? 'danger' : 'primary'}
                disabled={busy || (edit.mode === 'move' && (value || ownerId) === edit.file.chatId)}
                onClick={() => {
                  if (edit.mode === 'rename') onLabel(edit.file.id, { alias: value });
                  else onMutate(edit.file.id, edit.mode, value || undefined);
                  setEdit(undefined);
                }}
              >
                {lang(edit.mode === 'rename' ? 'XydriveSaveName' : editTitle)}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {mutationStatus && (
        <p className={styles.scope} role="status">
          {lang(mutationStatus === 'working' ? 'XydriveMutationWorking'
            : mutationStatus === 'complete' ? 'XydriveMutationComplete'
              : mutationStatus === 'copied' ? 'XydriveMutationCopied'
                : mutationStatus === 'copyUnknown' ? 'XydriveMutationCopyUnknown'
                  : mutationStatus === 'deleteUnknown' ? 'XydriveMutationDeleteUnknown'
                    : mutationStatus === 'wait' ? 'XydriveWait' : 'XydriveMutationError')}
        </p>
      )}
      {visibleSelection.ids.size > 0 && (
        <div className={styles.selectionBar}>
          <strong>
            {lang('XydriveSelected')}
            {' '}
            ·
            {' '}
            {lang.number(visibleSelection.ids.size)}
          </strong>
          <div className={styles.selectionActions}>
            <Button
              size="tiny"
              color="translucent"
              onClick={() => {
                visibleFiles.filter(({ id }) => visibleSelection.ids.has(id)).forEach(enqueueXydriveDownload);
              }}
            >
              {lang('XydriveTransferDownloadSelected')}
            </Button>
            <Button
              size="tiny"
              color="translucent"
              onClick={() => copyNames(visibleFiles.filter(({ id }) => visibleSelection.ids.has(id)))}
            >
              {lang('XydriveCopyNames')}
            </Button>
            <Button size="tiny" color="translucent" onClick={() => setSelection(EMPTY_XYDRIVE_SELECTION)}>
              {lang('XydriveClearSelection')}
            </Button>
          </div>
        </div>
      )}
      <div className={buildClassName(styles.body, details && !isMobile && styles.withDetails)}>
        <div
          className={styles.collection}
          ref={scrollRef}
          aria-busy={isLoading}
          onScroll={menuId ? () => setMenuId(undefined) : undefined}
        >
          {view === 'list' && (visibleFolders.length > 0 || visibleFiles.length > 0) && (
            <div className={styles.columnHead} aria-hidden="true">
              <span>{lang('XydriveSortName')}</span>
              <span className={styles.dateColumn}>{lang('XydriveSortDate')}</span>
              <span className={styles.sizeColumn}>{lang('XydriveSortSize')}</span>
              <span className={styles.actionColumn} />
            </div>
          )}
          {visibleFolders.length > 0 && (
            <section className={styles.group} aria-label={lang('XydriveFolders')}>
              {view === 'grid' && <h2 className={styles.groupTitle}>{lang('XydriveFolders')}</h2>}
              <ul className={buildClassName(styles.files, view === 'grid' ? styles.grid : styles.list)}>
                {visibleFolders.map((item) => (
                  <li key={item.id}>
                    <button
                      className={styles.folder}
                      type="button"
                      onClick={() => onOpenFolder(item.id)}
                      title={item.title}
                    >
                      <span className={styles.folderMark}><Icon name="folder-filled" /></span>
                      <span className={styles.fileText}>
                        <span className={styles.fileTitle}>
                          <span className={styles.name} dir="auto">{item.title}</span>
                          <span className={styles.labelMarks} aria-hidden="true">
                            {organization.folderLabels?.[item.id]?.favorite && <Icon name="star-regular-filled" />}
                            {organization.folderLabels?.[item.id]?.pinned && <Icon name="pin" />}
                          </span>
                        </span>
                        <span className={styles.meta} dir="auto">
                          {isRecursiveSearch
                            ? folderPaths.get(item.id)?.title
                            : lang(item.isManaged ? 'XydriveManagedFolder' : 'XydriveMountedChannel')}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {!visibleFiles.length && !visibleFolders.length && !isLoading && !loadError && (
            <div className={styles.empty}>
              <Icon name={hasFilter ? 'search' : 'folder'} className={styles.detailIcon} />
              <p>
                {lang(hasFilter ? resultsAreComplete ? 'XydriveNoMatches' : 'XydriveNoLoadedMatches'
                  : hasMore ? 'XydriveNoFilesYet' : emptyLabel)}
              </p>
              {hasFilter ? (
                <Button size="smaller" color="translucent" onClick={clearFilters}>{lang('XydriveClearFilters')}</Button>
              ) : onUpload && (
                <Button size="smaller" color="translucent-bordered" onClick={onUpload}>{lang('XydriveUpload')}</Button>
              )}
            </div>
          )}
          {view === 'grid' && visibleFiles.length > 0 && visibleFolders.length > 0 && (
            <h2 className={styles.groupTitle}>{lang('XydriveFolderFiles')}</h2>
          )}
          {visibleFiles.length > 0 && (
            <ul
              ref={listRef}
              className={buildClassName(styles.files, view === 'grid' ? styles.grid : styles.list)}
              onKeyDown={handleListKeyDown}
            >
              {visibleFiles.map((file) => {
                const isSelected = visibleSelection.ids.has(file.id);
                const canManage = file.chatId === ownerId || managedFolders.some(({ id }) => id === file.chatId);
                const label = getFileLabel(organization, file);
                const name = label?.alias || file.name;
                const date = new Date(file.date * 1000).toLocaleDateString();
                const size = file.size === undefined ? lang('XydriveUnknownSize') : formatFileSize(lang, file.size);
                const location = file.chatId === ownerId ? lang('XydriveRoot') : folderPaths.get(file.chatId)?.title;
                return (
                  <li
                    key={file.id}
                    className={buildClassName(styles.file, isSelected && styles.selected)}
                  >
                    <button
                      type="button"
                      data-xydrive-file="true"
                      className={styles.fileMain}
                      aria-pressed={isSelected}
                      title={name}
                      onClick={(event) => {
                        if (isTouchScreen && !visibleSelection.ids.size && event.detail) openFile(file);
                        else handleFileClick(event, file);
                      }}
                      onDoubleClick={() => { if (!isTouchScreen) openFile(file); }}
                      onKeyDown={(event) => {
                        if (event.key !== 'Enter') return;
                        event.preventDefault();
                        openFile(file);
                      }}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        menuTriggerRef.current = event.currentTarget;
                        setMenuId(file.id);
                      }}
                    >
                      <XydriveThumbnail file={file} icon={CATEGORY_ICONS[file.category]} observe={observe} />
                      <span className={styles.fileText}>
                        <span className={styles.fileTitle}>
                          <span className={styles.name} dir="auto">{name}</span>
                          <span className={styles.labelMarks} aria-hidden="true">
                            {label?.favorite && <Icon name="star-regular-filled" />}
                            {label?.pinned && <Icon name="pin" />}
                          </span>
                        </span>
                        <span className={styles.meta} dir="auto">
                          {isRecursiveSearch || !indexedFiles ? location : lang(CATEGORY_LABELS[file.category])}
                          {view === 'grid' && ` · ${size}`}
                        </span>
                      </span>
                    </button>
                    {view === 'list' && (
                      <>
                        <span className={styles.dateColumn}>{date}</span>
                        <span className={styles.sizeColumn}>{size}</span>
                      </>
                    )}
                    <div className={styles.fileActions}>
                      <button
                        type="button"
                        className={styles.controlButton}
                        aria-label={lang(isSelected ? 'XydriveDeselectFile' : 'XydriveSelectFile')}
                        aria-pressed={isSelected}
                        onClick={() => toggleFile(file.id)}
                      >
                        <span className={buildClassName(styles.selectionMark, isSelected && styles.checkedMark)}>
                          {isSelected && <Icon name="check" />}
                        </span>
                      </button>
                      <div className={styles.menuAnchor}>
                        <button
                          type="button"
                          className={styles.controlButton}
                          aria-label={lang('XydriveFileActions')}
                          aria-haspopup="menu"
                          aria-expanded={menuId === file.id}
                          onClick={(event) => {
                            menuTriggerRef.current = event.currentTarget;
                            setMenuId(menuId === file.id ? undefined : file.id);
                          }}
                        >
                          <Icon name="more" />
                        </button>
                        {menuId === file.id && (
                          <Menu
                            isOpen
                            autoClose
                            ariaLabel={lang('XydriveFileActions')}
                            ref={menuRef}
                            anchor={getMenuAnchor}
                            getTriggerElement={() => menuTriggerRef.current}
                            getRootElement={() => scrollRef.current?.ownerDocument.documentElement}
                            getMenuElement={() => menuRef.current}
                            getLayout={() => ({ withPortal: true })}
                            withPortal
                            withMaxHeight
                            onClose={() => setMenuId(undefined)}
                          >
                            {file.previewKind && (
                              <MenuItem icon="eye" disabled={Boolean(previewingId)} onClick={() => onPreview(file)}>
                                {lang('XydrivePreview')}
                              </MenuItem>
                            )}
                            <MenuItem icon="download" onClick={() => enqueueXydriveDownload(file)}>
                              {lang('XydriveTransferDownload')}
                            </MenuItem>
                            <MenuItem icon="copy" onClick={() => copyNames([file])}>{lang('XydriveCopyName')}</MenuItem>
                            <MenuItem icon="info" onClick={() => setDetailsId(file.id)}>
                              {lang('XydriveDetails')}
                            </MenuItem>
                            <MenuItem
                              icon="star-outline"
                              onClick={() => onLabel(file.id, { favorite: !label?.favorite })}
                            >
                              {lang(label?.favorite ? 'XydriveUnfavorite' : 'XydriveFavorite')}
                            </MenuItem>
                            <MenuItem icon="pin" onClick={() => onLabel(file.id, { pinned: !label?.pinned })}>
                              {lang(label?.pinned ? 'XydriveUnpin' : 'XydrivePin')}
                            </MenuItem>
                            <MenuItem icon="edit" onClick={() => startEdit(file, 'rename')}>
                              {lang('XydriveRename')}
                            </MenuItem>
                            {canManage && (
                              <>
                                <MenuItem
                                  icon="folder"
                                  disabled={busy || (file.chatId === ownerId && !managedFolders.length)}
                                  onClick={() => startEdit(file, 'move')}
                                >
                                  {lang('XydriveMove')}
                                </MenuItem>
                                <MenuItem destructive disabled={busy} onClick={() => startEdit(file, 'delete')}>
                                  {lang('XydriveDelete')}
                                </MenuItem>
                              </>
                            )}
                            <MenuItem icon="check" onClick={() => toggleFile(file.id)}>
                              {lang(isSelected ? 'XydriveDeselectFile' : 'XydriveSelectFile')}
                            </MenuItem>
                            <MenuItem icon="arrow-right" onClick={() => onOpenMessage(file)}>
                              {lang('XydriveOpenMessage')}
                            </MenuItem>
                          </Menu>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className={styles.pagination}>
            {isLoading && <Loading />}
            {loadError && <p className={styles.scope} role="alert">{lang(loadError)}</p>}
            {visibleFiles.length < matchingFiles.length && (
              <Button
                size="smaller"
                color="translucent-bordered"
                onClick={() => setResultLimit(resultLimit + RESULT_BATCH_SIZE)}
              >
                {lang('XydriveShowResults')}
              </Button>
            )}
            {!isLoading && (loadError || hasMore) && (
              <Button size="smaller" color="translucent" onClick={onLoadMore}>
                {lang(loadError ? 'XydriveRetry' : 'XydriveLoadMore')}
              </Button>
            )}
          </div>
        </div>
        {details && !isMobile && (
          <aside className={styles.details} aria-label={lang('XydriveDetails')}>
            <div className={styles.detailsHeader}>
              <strong>{lang('XydriveDetails')}</strong>
              <Button
                round
                size="tiny"
                color="translucent"
                iconName="close"
                ariaLabel={lang('Close')}
                onClick={() => setDetailsId(undefined)}
              />
            </div>
            {renderDetails(details)}
          </aside>
        )}
      </div>
      {details && isMobile && (
        <Modal isOpen isSlim hasCloseButton title={lang('XydriveDetails')} onClose={() => setDetailsId(undefined)}>
          {renderDetails(details)}
        </Modal>
      )}
      <footer className={styles.statusBar}>
        <span aria-live="polite">
          {lang('XydriveShowing')}
          {' '}
          ·
          {' '}
          {lang.number(visibleFolders.length + visibleFiles.length)}
          {' '}
          /
          {' '}
          {
            lang.number(visibleFolders.length + matchingFiles.length)
          }
        </span>
        {hasFilter && !resultsAreComplete && <span>{lang('XydriveLoadedOnly')}</span>}
        {visibleIds.length > 0 && (
          <Button size="tiny" color="translucent" onClick={selectAll}>{lang('XydriveSelectVisible')}</Button>
        )}
      </footer>
    </section>
  );
};

export default memo(XydriveExplorer);
