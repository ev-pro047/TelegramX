import { memo, useMemo, useState } from '../../lib/teact/teact';

import type { XydriveMount, XydriveOrganization } from '../../lib/xydrive/types';

import { getFolderChain } from '../../lib/xydrive/organization';
import { buildFolderTree } from '../../lib/xydrive/workspace';

import useLang from '../../hooks/useLang';

import Icon from '../common/icons/Icon';

import styles from './Xydrive.module.scss';

const PAGE_SIZE = 40;

type OwnProps = {
  folders: XydriveMount[];
  organization: XydriveOrganization;
  folderId?: string;
  excludedIds?: string[];
  isManagedOnly?: boolean;
  canChooseRoot?: boolean;
  onChoose: (id: string | undefined, canChoose: boolean) => void;
};

const XydriveDestination = ({
  folders, organization, folderId, excludedIds, isManagedOnly, canChooseRoot = true, onChoose,
}: OwnProps) => {
  const lang = useLang();
  const [location, setLocation] = useState(folderId);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const tree = useMemo(() => buildFolderTree(folders, organization.parents), [folders, organization.parents]);
  const path = useMemo(() => getFolderChain(organization, folders, location), [organization, folders, location]);
  const term = query.trim().toLocaleLowerCase();
  const excluded = useMemo(() => new Set(excludedIds), [excludedIds]);
  const current = path.at(-1);
  const isEligible = (folder?: XydriveMount) => folder
    ? !excluded.has(folder.id) && (!isManagedOnly || Boolean(folder.isManaged)) : canChooseRoot;

  function openFolder(folder?: XydriveMount) {
    setLocation(folder?.id);
    setQuery('');
    setPage(0);
    onChoose(folder?.id, isEligible(folder));
  }

  const choices = term ? folders.filter(({ title }) => title.toLocaleLowerCase().includes(term))
    : tree.get(location) || [];
  const shown = choices.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <section className={styles.dialog} aria-label={lang('XydriveDestination')}>
      <nav className={styles.breadcrumb} aria-label={lang('XydriveFolderPath')}>
        <button type="button" className={styles.crumb} onClick={() => openFolder()}>{lang('XydriveRoot')}</button>
        {path.map((folder) => (
          <button
            key={folder.id}
            type="button"
            className={styles.crumb}
            dir="auto"
            aria-current={current?.id === folder.id ? 'location' : undefined}
            onClick={() => openFolder(folder)}
          >
            {folder.title}
          </button>
        ))}
      </nav>
      <input
        className={styles.input}
        type="search"
        value={query}
        placeholder={lang('XydriveFolderSearch')}
        aria-label={lang('XydriveFolderSearch')}
        onInput={(event) => {
          setQuery(event.currentTarget.value);
          setPage(0);
        }}
      />
      <div className={styles.destinationList}>
        {shown.map((folder) => (
          <button key={folder.id} type="button" className={styles.navItem} onClick={() => openFolder(folder)}>
            <Icon name={folder.isManaged ? 'folder-filled' : 'folder'} />
            <span dir="auto">{folder.title}</span>
            <Icon name={lang.isRtl ? 'arrow-left' : 'arrow-right'} />
          </button>
        ))}
        {!shown.length && (
          <span className={styles.description}>
            {lang(term ? 'XydriveNoMatches' : 'XydriveNoSubfolders')}
          </span>
        )}
      </div>
      {choices.length > PAGE_SIZE && (
        <div className={styles.treePager}>
          <button type="button" disabled={!page} onClick={() => setPage(page - 1)}>{lang('Back')}</button>
          <span>{lang.number(page + 1)}</span>
          <button
            type="button"
            disabled={(page + 1) * PAGE_SIZE >= choices.length}
            onClick={() => setPage(page + 1)}
          >
            {lang('Next')}
          </button>
        </div>
      )}
      <p className={styles.description} role="status">
        {lang(isEligible(current)
          ? 'XydriveCanUseDestination' : 'XydriveCannotUseDestination')}
      </p>
    </section>
  );
};

export default memo(XydriveDestination);
