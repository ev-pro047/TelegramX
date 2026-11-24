import { memo, useEffect, useMemo, useState } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { ApiChat } from '../../api/types';
import type { XydriveFolderLabel, XydriveMount, XydriveOrganization } from '../../lib/xydrive/types';

import { isXydriveChannelEligible } from '../../lib/xydrive/folders';
import { getFolderChain } from '../../lib/xydrive/organization';
import { buildFolderTree, flattenFolderTree } from '../../lib/xydrive/workspace';

import useLang from '../../hooks/useLang';

import Avatar from '../common/Avatar';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import XydriveDestination from './XydriveDestination';

import styles from './Xydrive.module.scss';

export type FolderDialog = 'create' | 'mount' | 'move' | 'unmount' | 'manage' | 'rename';

const FOLDER_TONES = [
  ['default', 'XydriveFolderDefault'], ['teal', 'XydriveFolderTeal'],
  ['amber', 'XydriveFolderAmber'], ['violet', 'XydriveFolderViolet'],
] as const;

const PAGE_SIZE = 32;
const TITLES = {
  create: 'XydriveNewFolder',
  manage: 'XydriveFolderActions',
  mount: 'XydriveMountFolder',
  move: 'XydriveMoveFolder',
  unmount: 'XydriveUnmount',
  rename: 'XydriveRenameFolder',
} as const;

type OwnProps = {
  dialog: FolderDialog;
  folder?: XydriveMount;
  folders: XydriveMount[];
  organization: XydriveOrganization;
  chats?: Record<string, ApiChat>;
  mountingId?: string;
  mountError?: 'wait' | 'generic' | 'unavailable';
  createStatus?: 'creating' | 'created' | 'error' | 'limit' | 'unverified';
  renameStatus?: 'working' | 'complete' | 'error' | 'wait';
  destinationId?: string;
  onCreate: (title: string, parentId?: string) => void;
  onMount: (channelId: string) => void;
  onUnmount: (channelId: string) => void;
  onReparent: (channelId: string, parentId?: string) => void;
  onRename: (channelId: string, title: string) => void;
  onOpenFolder: (id: string) => void;
  onChangeDialog: (dialog: FolderDialog) => void;
  onLabelFolder: (id: string, patch: XydriveFolderLabel) => void;
  onClose: NoneToVoidFunction;
};

const XydriveFolders = ({
  dialog, folder, folders, organization, chats, mountingId, mountError, createStatus, renameStatus, destinationId,
  onCreate, onMount, onUnmount, onReparent, onRename, onClose, onOpenFolder, onChangeDialog, onLabelFolder,
}: OwnProps) => {
  const { showNotification } = getActions();
  const lang = useLang();
  const [value, setValue] = useState(() => dialog === 'rename' ? folder?.title || '' : '');
  const [destination, setDestination] = useState(destinationId);
  const [canChoose, setCanChoose] = useState(Boolean(destinationId));
  const [requestedMount, setRequestedMount] = useState<string>();
  const [page, setPage] = useState(0);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const isCreating = dialog === 'create' && createStatus === 'creating';
  const isRenaming = dialog === 'rename' && renameStatus === 'working';
  const isBusy = isCreating || isRenaming;
  const candidates = useMemo(() => {
    if (dialog !== 'mount' || !chats) return [];
    const mounted = new Set(folders.map(({ id }) => id));
    const query = value.trim().toLocaleLowerCase();
    return Object.values(chats).filter((chat) => isXydriveChannelEligible(chat) && !mounted.has(chat.id)
      && chat.title.toLocaleLowerCase().includes(query)).sort((a, b) => a.title.localeCompare(b.title));
  }, [dialog, chats, folders, value]);

  const descendants = useMemo(() => {
    if (dialog !== 'move' || !folder) return undefined;
    const tree = buildFolderTree(folders, organization.parents);
    const nodes = flattenFolderTree(tree, new Set(folders.map(({ id }) => id)), folder.id);
    return [folder.id, ...nodes.map((node) => node.folder.id)];
  }, [dialog, folder, folders, organization]);

  const folderPath = folder && getFolderChain(organization, folders, folder.id).map(({ title }) => title).join(' / ');
  const mounted = Boolean(requestedMount && folders.some(({ id }) => id === requestedMount));
  const isDone = mounted || (hasSubmitted && ((dialog === 'create' && createStatus === 'created')
    || (dialog === 'rename' && renameStatus === 'complete')));

  useEffect(() => {
    if (!isDone) return;
    const key = dialog === 'create' ? 'XydriveFolderCreated' : dialog === 'rename'
      ? 'XydriveFolderRenamed' : 'XydriveFolderMounted';
    showNotification({ message: { key } });
    onClose();
  }, [dialog, isDone, onClose, showNotification]);

  function submitFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isBusy) return;
    if (dialog === 'create' && value.trim()) {
      setHasSubmitted(true);
      onCreate(value.trim(), folder?.id);
    } else if (dialog === 'rename' && folder?.isManaged && value.trim() && value.trim() !== folder.title) {
      setHasSubmitted(true);
      onRename(folder.id, value.trim());
    } else if (dialog === 'move' && folder && canChoose) {
      onReparent(folder.id, destination);
      showNotification({ message: { key: 'XydriveFolderMoved' } });
      onClose();
    } else if (dialog === 'unmount' && folder) {
      onUnmount(folder.id);
      showNotification({ message: { key: 'XydriveFolderUnmounted' } });
      onClose();
    }
  }

  if (dialog === 'manage' && folder) {
    const label = organization.folderLabels?.[folder.id];
    return (
      <Modal isOpen isSlim hasCloseButton title={folder.title} onClose={onClose}>
        <div className={styles.dialog}>
          <p className={styles.description}>
            {lang(folder.isManaged ? 'XydriveManagedPolicy' : 'XydriveMountedPolicy')}
          </p>
          <Button color="translucent" noFastClick onClick={() => onOpenFolder(folder.id)}>{lang('Open')}</Button>
          <Button
            color="translucent"
            noFastClick
            onClick={() => onLabelFolder(folder.id, { favorite: !label?.favorite })}
          >
            {lang(label?.favorite ? 'XydriveUnfavorite' : 'XydriveFavorite')}
          </Button>
          <Button color="translucent" noFastClick onClick={() => onLabelFolder(folder.id, { pinned: !label?.pinned })}>
            {lang(label?.pinned ? 'XydriveUnpin' : 'XydrivePin')}
          </Button>
          {folder.isManaged && (
            <Button color="translucent" noFastClick onClick={() => onChangeDialog('rename')}>
              {lang('XydriveRenameFolder')}
            </Button>
          )}
          <Button color="translucent" noFastClick onClick={() => onChangeDialog('move')}>
            {lang('XydriveMoveFolder')}
          </Button>
          <fieldset className={styles.folderColors}>
            <legend>{lang('XydriveFolderColor')}</legend>
            {FOLDER_TONES.map(([tone, key]) => (
              <button
                key={tone}
                type="button"
                className={styles.tone}
                data-tone={tone}
                aria-pressed={(label?.tone || 'default') === tone}
                onClick={() => onLabelFolder(folder.id, { tone })}
              >
                {lang(key)}
              </button>
            ))}
          </fieldset>
          <Button color="danger" onClick={() => onChangeDialog('unmount')}>{lang('XydriveUnmount')}</Button>
        </div>
      </Modal>
    );
  }

  const canSubmit = dialog === 'create' ? Boolean(value.trim()) : dialog === 'rename'
    ? Boolean(folder?.isManaged && value.trim() && value.trim() !== folder.title)
    : dialog === 'move' ? canChoose : Boolean(folder);
  const title = dialog === 'create' ? 'XydriveCreateFolder' : dialog === 'rename'
    ? 'XydriveSaveName' : dialog === 'move' ? 'XydriveMove' : 'XydriveUnmount';

  return (
    <Modal
      isOpen
      isSlim
      hasCloseButton={!isBusy}
      title={lang(TITLES[dialog])}
      noBackdropClose={isBusy}
      onClose={() => { if (!isBusy) onClose(); }}
    >
      {dialog === 'mount' ? (
        <div className={styles.dialog}>
          <p className={styles.description}>{lang('XydriveMountDesc')}</p>
          <p className={styles.description}>{lang('XydriveMountedPolicy')}</p>
          <input
            className={styles.input}
            type="search"
            value={value}
            aria-label={lang('XydriveSearchChannels')}
            placeholder={lang('XydriveSearchChannels')}
            onInput={(event) => {
              setValue(event.currentTarget.value);
              setPage(0);
            }}
          />
          <div className={styles.mountList}>
            {!candidates.length && <p className={styles.description}>{lang('XydriveNoChannels')}</p>}
            {candidates.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((chat) => (
              <div className={styles.mountRow} key={chat.id}>
                <Avatar peer={chat} size="tiny" />
                <span dir="auto">{chat.title}</span>
                <Button
                  size="smaller"
                  color="translucent"
                  noFastClick
                  disabled={Boolean(mountingId)}
                  onClick={() => {
                    setRequestedMount(chat.id);
                    onMount(chat.id);
                  }}
                >
                  {lang(mountingId === chat.id ? 'XydriveMounting' : 'XydriveMount')}
                </Button>
              </div>
            ))}
          </div>
          {candidates.length > PAGE_SIZE && (
            <div className={styles.treePager}>
              <button type="button" disabled={!page} onClick={() => setPage(page - 1)}>{lang('Back')}</button>
              <button
                type="button"
                disabled={(page + 1) * PAGE_SIZE >= candidates.length}
                onClick={() => setPage(page + 1)}
              >
                {lang('Next')}
              </button>
            </div>
          )}
          {requestedMount && mountError && (
            <p role="alert" className={styles.description}>
              {lang(mountError === 'wait' ? 'XydriveWait'
                : mountError === 'unavailable' ? 'XydriveUnavailable' : 'XydriveMountError')}
            </p>
          )}
        </div>
      ) : (
        <form className={styles.dialog} onSubmit={submitFolder}>
          {(dialog === 'create' || dialog === 'rename') && (
            <>
              <p className={styles.description}>
                {lang(dialog === 'create' ? 'XydriveCreateDesc' : 'XydriveRenameFolderDesc')}
              </p>
              <p className={styles.description} dir="auto">{folderPath || lang('XydriveRoot')}</p>
              <label className={styles.dialog}>
                {lang('XydriveFolderName')}
                <input
                  className={styles.input}
                  value={value}
                  maxLength={128}
                  disabled={isBusy}
                  onInput={(event) => setValue(event.currentTarget.value)}
                />
              </label>
              {hasSubmitted && dialog === 'create' && createStatus
                && createStatus !== 'creating' && createStatus !== 'created' && (
                <p role="alert" className={styles.description}>
                  {lang(createStatus === 'limit' ? 'XydriveCreateLimit'
                    : createStatus === 'unverified' ? 'XydriveCreateUnverified' : 'XydriveCreateError')}
                </p>
              )}
              {hasSubmitted && dialog === 'rename' && (renameStatus === 'error' || renameStatus === 'wait')
                && (
                  <p role="alert" className={styles.description}>
                    {lang(renameStatus === 'wait' ? 'XydriveWait' : 'XydriveRenameFolderError')}
                  </p>
                )}
            </>
          )}
          {dialog === 'move' && (
            <>
              <strong dir="auto">{folder?.title}</strong>
              <XydriveDestination
                folderId={destination}
                folders={folders}
                organization={organization}
                excludedIds={descendants}
                onChoose={(id, isAllowed) => {
                  setDestination(id);
                  setCanChoose(isAllowed);
                }}
              />
            </>
          )}
          {dialog === 'unmount' && (
            <>
              <strong dir="auto">{folder?.title}</strong>
              <p className={styles.description}>{lang('XydriveUnmountDesc')}</p>
            </>
          )}
          <div className={styles.dialogActions}>
            <Button size="smaller" color="translucent" noFastClick disabled={isBusy} onClick={onClose}>
              {lang('Cancel')}
            </Button>
            <Button
              size="smaller"
              type="submit"
              noPreventDefault
              color={dialog === 'unmount' ? 'danger' : 'primary'}
              isLoading={isBusy}
              disabled={isBusy || !canSubmit}
            >
              {lang(title)}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default memo(XydriveFolders);
