import { memo, useEffect, useMemo, useState } from '../../lib/teact/teact';

import type { ApiChat } from '../../api/types';
import type { XydriveMount, XydriveOrganization } from '../../lib/xydrive/types';

import { isXydriveChannelEligible } from '../../lib/xydrive/folders';
import { getFolderChain } from '../../lib/xydrive/organization';

import useLang from '../../hooks/useLang';

import Icon from '../common/icons/Icon';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

import styles from './Xydrive.module.scss';

export type FolderDialog = 'create' | 'mount' | 'move' | 'unmount';

const TITLES = {
  create: 'XydriveNewFolder',
  mount: 'XydriveMountFolder',
  move: 'XydriveMoveFolder',
  unmount: 'XydriveUnmount',
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
  onCreate: (title: string, parentId?: string) => void;
  onMount: (channelId: string) => void;
  onUnmount: (channelId: string) => void;
  onReparent: (channelId: string, parentId?: string) => void;
  onClose: NoneToVoidFunction;
};

const XydriveFolders = ({
  dialog, folder, folders, organization, chats, mountingId, mountError, createStatus,
  onCreate, onMount, onUnmount, onReparent, onClose,
}: OwnProps) => {
  const lang = useLang();
  const [value, setValue] = useState(() => dialog === 'move' && folder ? organization.parents[folder.id] || '' : '');
  const [requestedMount, setRequestedMount] = useState<string>();
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const isCreating = dialog === 'create' && createStatus === 'creating';
  const candidates = useMemo(() => {
    if (dialog !== 'mount' || !chats) return [];
    const mounted = new Set(folders.map(({ id }) => id));
    const query = value.trim().toLocaleLowerCase();
    return Object.values(chats)
      .filter((chat) => isXydriveChannelEligible(chat) && !mounted.has(chat.id)
        && chat.title.toLocaleLowerCase().includes(query))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [dialog, chats, folders, value]);
  const destinations = useMemo(() => {
    if (dialog !== 'move' || !folder) return [];
    return folders.map(({ id }) => getFolderChain(organization, folders, id))
      .filter((chain) => !chain.some(({ id }) => id === folder.id));
  }, [dialog, folder, folders, organization]);

  useEffect(() => {
    if ((dialog === 'create' && hasSubmitted && createStatus === 'created')
      || (dialog === 'mount' && requestedMount && folders.some(({ id }) => id === requestedMount))) onClose();
  }, [dialog, hasSubmitted, createStatus, requestedMount, folders, onClose]);

  function submitFolder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dialog === 'create' && !isCreating && value.trim()) {
      setHasSubmitted(true);
      onCreate(value.trim(), folder?.id);
    } else if (dialog === 'move' && folder) {
      onReparent(folder.id, value || undefined);
      onClose();
    } else if (dialog === 'unmount' && folder) {
      onUnmount(folder.id);
      onClose();
    }
  }

  return (
    <Modal isOpen isSlim hasCloseButton title={lang(TITLES[dialog])} noBackdropClose={isCreating} onClose={onClose}>
      {dialog === 'mount' ? (
        <div className={styles.dialog}>
          <p className={styles.description}>{lang('XydriveMountDesc')}</p>
          <input
            className={styles.input}
            type="search"
            value={value}
            aria-label={lang('XydriveSearchChannels')}
            placeholder={lang('XydriveSearchChannels')}
            onInput={(event) => setValue(event.currentTarget.value)}
          />
          <div className={styles.mountList}>
            {candidates.length === 0 && <p className={styles.description}>{lang('XydriveNoChannels')}</p>}
            {candidates.map((chat) => (
              <div className={styles.mountRow} key={chat.id}>
                <Icon name="folder" />
                <span dir="auto">{chat.title}</span>
                <Button
                  size="smaller"
                  color="translucent"
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
          {requestedMount && mountError && (
            <p role="alert" className={styles.description}>
              {lang(mountError === 'wait' ? 'XydriveWait'
                : mountError === 'unavailable' ? 'XydriveUnavailable' : 'XydriveMountError')}
            </p>
          )}
        </div>
      ) : (
        <form className={styles.dialog} onSubmit={submitFolder}>
          {dialog === 'create' && (
            <>
              <p className={styles.description}>{lang('XydriveCreateDesc')}</p>
              <input
                className={styles.input}
                value={value}
                maxLength={128}
                disabled={isCreating}
                aria-label={lang('XydriveFolderName')}
                placeholder={lang('XydriveFolderName')}
                onInput={(event) => setValue(event.currentTarget.value)}
              />
              {hasSubmitted && createStatus && createStatus !== 'creating' && createStatus !== 'created' && (
                <p role="alert" className={styles.description}>
                  {lang(createStatus === 'limit' ? 'XydriveCreateLimit'
                    : createStatus === 'unverified' ? 'XydriveCreateUnverified' : 'XydriveCreateError')}
                </p>
              )}
            </>
          )}
          {dialog === 'move' && (
            <select
              className={styles.input}
              value={value}
              aria-label={lang('XydriveDestination')}
              onChange={(event) => setValue(event.currentTarget.value)}
            >
              <option value="">{lang('XydriveRoot')}</option>
              {destinations.map((chain) => {
                const { id } = chain.at(-1)!;
                return <option key={id} value={id}>{chain.map(({ title }) => title).join(' / ')}</option>;
              })}
            </select>
          )}
          {dialog === 'unmount' && (
            <>
              <strong dir="auto">{folder?.title}</strong>
              <p className={styles.description}>{lang('XydriveUnmountDesc')}</p>
            </>
          )}
          <div className={styles.dialogActions}>
            <Button size="smaller" color="translucent" onClick={onClose}>{lang('Cancel')}</Button>
            <Button
              size="smaller"
              type="submit"
              noPreventDefault
              color={dialog === 'unmount' ? 'danger' : 'primary'}
              isLoading={isCreating}
              disabled={isCreating || (dialog === 'create' && !value.trim())}
            >
              {lang(dialog === 'create' ? 'XydriveCreateFolder' : dialog === 'move' ? 'XydriveMove' : 'XydriveUnmount')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default memo(XydriveFolders);
