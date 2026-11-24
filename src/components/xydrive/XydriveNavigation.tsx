import { memo, useEffect, useMemo, useRef, useState } from '../../lib/teact/teact';

import type { XydriveIndex, XydriveMount, XydriveOrganization } from '../../lib/xydrive/types';

import { getFolderChain } from '../../lib/xydrive/organization';
import { buildFolderTree, flattenFolderTree } from '../../lib/xydrive/workspace';
import buildClassName from '../../util/buildClassName';

import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Icon from '../common/icons/Icon';
import DropdownMenu from '../ui/DropdownMenu';
import MenuItem from '../ui/MenuItem';

import styles from './Xydrive.module.scss';

const TREE_PAGE_SIZE = 80;

type OwnProps = {
  folders: XydriveMount[];
  organization: XydriveOrganization;
  index?: XydriveIndex;
  selectedId?: string;
  expanded: string[];
  onExpand: (ids: string[]) => void;
  onOpen: (id: string) => void;
  onManage: (folder: XydriveMount) => void;
};

const XydriveNavigation = ({
  folders, organization, index, selectedId, expanded, onExpand, onOpen, onManage,
}: OwnProps) => {
  const lang = useLang();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [focusedId, setFocusedId] = useState<string>();
  const treeRef = useRef<HTMLDivElement>();
  const tree = useMemo(() => buildFolderTree(folders, organization.parents), [folders, organization.parents]);
  const expandedSet = useMemo(() => new Set(expanded), [expanded]);
  const term = query.trim().toLocaleLowerCase();
  const rows = useMemo(() => {
    if (!term) return flattenFolderTree(tree, expandedSet);
    return folders.filter(({ title }) => title.toLocaleLowerCase().includes(term))
      .map((folder) => ({ folder, depth: 0, hasChildren: false }));
  }, [term, tree, expandedSet, folders]);
  const activePage = Math.min(page, Math.max(0, Math.ceil(rows.length / TREE_PAGE_SIZE) - 1));
  const visible = rows.slice(activePage * TREE_PAGE_SIZE, (activePage + 1) * TREE_PAGE_SIZE);

  const revealSelected = useLastCallback(() => {
    if (!selectedId) return;
    const ancestors = getFolderChain(organization, folders, selectedId).slice(0, -1);
    if (ancestors.some(({ id }) => !expandedSet.has(id))) {
      onExpand([...new Set([...expanded, ...ancestors.map(({ id }) => id)])]);
    }
  });
  useEffect(() => revealSelected(), [selectedId, revealSelected]);

  function toggle(id: string) {
    onExpand(expandedSet.has(id) ? expanded.filter((value) => value !== id) : [...expanded, id]);
  }

  function focus(indexInPage: number) {
    const next = visible[indexInPage];
    if (!next) return;
    setFocusedId(next.folder.id);
    treeRef.current?.querySelectorAll<HTMLElement>('[role="treeitem"]')[indexInPage]?.focus();
  }

  function handleKey(e: React.KeyboardEvent<HTMLElement>, folder: XydriveMount, row: number, hasChildren: boolean) {
    const forward = lang.isRtl ? 'ArrowLeft' : 'ArrowRight';
    const back = lang.isRtl ? 'ArrowRight' : 'ArrowLeft';
    if (e.target !== e.currentTarget) return;
    switch (e.key) {
      case 'ArrowDown':
        focus(row + 1);
        break;
      case 'ArrowUp':
        focus(row - 1);
        break;
      case 'Home':
        focus(0);
        break;
      case 'End':
        focus(visible.length - 1);
        break;
      case 'Enter':
      case ' ':
        onOpen(folder.id);
        break;
      case forward:
        if (hasChildren && !expandedSet.has(folder.id)) toggle(folder.id);
        else if (hasChildren) focus(row + 1);
        break;
      case back:
        if (hasChildren && expandedSet.has(folder.id)) toggle(folder.id);
        else focus(visible.findIndex((item) => item.folder.id === organization.parents[folder.id]));
        break;
      default: return;
    }
    e.preventDefault();
  }

  if (!folders.length) return undefined;
  const tabStop = visible.find(({ folder }) => folder.id === focusedId)?.folder.id || visible[0]?.folder.id;

  return (
    <div className={styles.treeSection}>
      <label className={styles.navHeading} htmlFor="xydrive-folder-search">{lang('XydriveFolders')}</label>
      <input
        id="xydrive-folder-search"
        className={styles.input}
        type="search"
        placeholder={lang('XydriveFolderSearch')}
        aria-label={lang('XydriveFolderSearch')}
        value={query}
        onInput={(event) => {
          setQuery(event.currentTarget.value);
          setPage(0);
        }}
      />
      <div ref={treeRef} role="tree" aria-label={lang('XydriveFolders')} className={styles.tree}>
        {visible.map(({ folder, depth, hasChildren }, row) => {
          const isOpen = hasChildren && expandedSet.has(folder.id);
          const snapshot = index?.sources[folder.id];
          return (
            <div
              role="treeitem"
              key={folder.id}
              tabIndex={tabStop === folder.id ? 0 : -1}
              aria-expanded={hasChildren ? isOpen : undefined}
              aria-level={depth + 1}
              aria-selected={selectedId === folder.id}
              aria-label={folder.title}
              className={buildClassName(styles.treeRow, selectedId === folder.id && styles.navActive)}
              style={`padding-inline-start: min(${depth * 0.7}rem, 32%)`}
              onKeyDown={(event) => handleKey(event, folder, row, hasChildren)}
              onContextMenu={(event) => {
                event.preventDefault();
                onManage(folder);
              }}
            >
              <button
                type="button"
                className={styles.treeToggle}
                tabIndex={-1}
                aria-label={lang(isOpen ? 'XydriveCollapseFolder' : 'XydriveExpandFolder')}
                disabled={!hasChildren}
                onClick={() => toggle(folder.id)}
              >
                {hasChildren && <Icon name={isOpen ? 'down' : lang.isRtl ? 'arrow-left' : 'arrow-right'} />}
              </button>
              <button type="button" tabIndex={-1} className={styles.treeTitle} onClick={() => onOpen(folder.id)}>
                <Icon name={folder.isManaged ? 'folder-filled' : 'folder'} />
                <span dir="auto" title={folder.title}>{folder.title}</span>
              </button>
              <span
                className={styles.treeCoverage}
                title={lang(snapshot?.complete ? 'XydriveSourceIndexed'
                  : snapshot ? 'XydriveSourcePartial' : 'XydriveSourceUnscanned')}
              >
                <Icon
                  name={snapshot?.complete ? 'check' : 'clock'}
                  ariaLabel={lang(snapshot?.complete
                    ? 'XydriveSourceIndexed' : snapshot ? 'XydriveSourcePartial' : 'XydriveSourceUnscanned')}
                />
              </span>
              <DropdownMenu
                withPortal
                trigger={({ onTrigger }) => (
                  <button
                    type="button"
                    className={styles.treeToggle}
                    aria-label={lang('XydriveFolderActions')}
                    onClick={onTrigger}
                  >
                    <Icon name="more" />
                  </button>
                )}
              >
                <MenuItem icon="folder" onClick={() => onOpen(folder.id)}>{lang('Open')}</MenuItem>
                <MenuItem icon="settings" onClick={() => onManage(folder)}>{lang('XydriveFolderActions')}</MenuItem>
              </DropdownMenu>
            </div>
          );
        })}
      </div>
      {term && !rows.length && <span className={styles.description}>{lang('XydriveNoMatches')}</span>}
      {rows.length > TREE_PAGE_SIZE && (
        <div className={styles.treePager}>
          <button type="button" disabled={!activePage} onClick={() => setPage(activePage - 1)}>{lang('Back')}</button>
          <span>{lang.number(activePage + 1)}</span>
          <button
            type="button"
            disabled={(activePage + 1) * TREE_PAGE_SIZE >= rows.length}
            onClick={() => setPage(activePage + 1)}
          >
            {lang('Next')}
          </button>
        </div>
      )}
    </div>
  );
};

export default memo(XydriveNavigation);
