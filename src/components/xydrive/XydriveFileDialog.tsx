import { memo, useState } from '../../lib/teact/teact';

import type { XydriveItem } from '../../lib/xydrive/collection';
import type {
  XydriveMount, XydriveMutation, XydriveMutationStatus, XydriveOrganization,
} from '../../lib/xydrive/types';
import type { RegularLangKey } from '../../types/language';

import useLang from '../../hooks/useLang';

import Button from '../ui/Button';
import Modal from '../ui/Modal';
import XydriveDestination from './XydriveDestination';

import styles from './Xydrive.module.scss';

const STATUS: Record<XydriveMutationStatus, RegularLangKey> = {
  working: 'XydriveMutationWorking', complete: 'XydriveMutationComplete', wait: 'XydriveWait',
  unavailable: 'XydriveMutationError', error: 'XydriveMutationError', copied: 'XydriveMutationCopied',
  copyUnknown: 'XydriveMutationCopyUnknown', deleteUnknown: 'XydriveMutationDeleteUnknown',
};

export type FileOperation = 'rename' | 'move' | 'delete';

type OwnProps = {
  operation: FileOperation;
  items: XydriveItem[];
  folders: XydriveMount[];
  ownerId?: string;
  organization: XydriveOrganization;
  destinationId?: string;
  mutation?: XydriveMutation;
  onLabel: (fileId: string, patch: { alias: string }) => void;
  onRun: (fileIds: string[], operation: 'move' | 'delete', destinationId?: string) => void;
  onClose: NoneToVoidFunction;
};

const XydriveFileDialog = ({
  operation, items, folders, ownerId, organization, destinationId, mutation, onLabel, onRun, onClose,
}: OwnProps) => {
  const lang = useLang();
  const [value, setValue] = useState(items[0]?.name || '');
  const [destination, setDestination] = useState(destinationId);
  const [canChoose, setCanChoose] = useState(Boolean(destinationId));
  const [previousMutationId, setPreviousMutationId] = useState<number>();
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const result = hasSubmitted && mutation?.id !== previousMutationId ? mutation : undefined;
  const isWorking = hasSubmitted && (!result || result.status === 'working');
  const title = operation === 'rename' ? 'XydriveRename' : operation === 'move' ? 'XydriveMove' : 'XydriveDelete';
  const description = operation === 'rename' ? 'XydriveAliasDesc' : operation === 'move'
    ? 'XydriveMoveDesc' : 'XydriveDeleteDesc';
  const sources = items.map(({ sourceId }) => sourceId).filter((id): id is string => Boolean(id));

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasSubmitted || (operation === 'move' && !canChoose)) return;
    if (operation === 'rename') {
      onLabel(items[0].id, { alias: value });
      onClose();
      return;
    }
    setPreviousMutationId(mutation?.id);
    setHasSubmitted(true);
    onRun(items.map(({ id }) => id), operation, destination);
  }

  return (
    <Modal
      isOpen
      isSlim
      hasCloseButton={!isWorking}
      noBackdropClose={isWorking}
      title={lang(title)}
      onClose={() => { if (!isWorking) onClose(); }}
    >
      <form className={styles.dialog} onSubmit={submit}>
        <strong dir="auto">
          {items.length === 1 ? items[0].name
            : lang('XydriveItemCount', { count: lang.number(items.length) })}
        </strong>
        <p className={styles.description}>{lang(description)}</p>
        {!hasSubmitted && operation === 'rename' && (
          <label className={styles.dialog}>
            {lang('XydriveAlias')}
            <input
              className={styles.input}
              value={value}
              maxLength={255}
              onInput={(event) => setValue(event.currentTarget.value)}
            />
          </label>
        )}
        {!hasSubmitted && operation === 'move' && (
          <XydriveDestination
            folders={folders}
            organization={organization}
            folderId={destination}
            isManagedOnly
            excludedIds={sources}
            canChooseRoot={!items.some(({ sourceId }) => sourceId === ownerId)}
            onChoose={(id, isAllowed) => {
              setDestination(id);
              setCanChoose(isAllowed);
            }}
          />
        )}
        {hasSubmitted && (
          <div role="status" className={styles.description}>
            <p>{lang(result ? STATUS[result.status] : 'XydriveMutationWorking')}</p>
            {result && (
              <progress
                value={result.completed}
                max={result.total || 1}
                aria-label={lang('XydriveBulkProgress', {
                  done: lang.number(result.completed), total: lang.number(result.total),
                })}
              />
            )}
            {result && (
              <p>
                {lang('XydriveBulkProgress', {
                  done: lang.number(result.completed), total: lang.number(result.total),
                })}
              </p>
            )}
          </div>
        )}
        <div className={styles.dialogActions}>
          <Button size="smaller" color="translucent" noFastClick disabled={isWorking} onClick={onClose}>
            {lang(hasSubmitted ? 'Close' : 'Cancel')}
          </Button>
          {!hasSubmitted && (
            <Button
              size="smaller"
              type="submit"
              noPreventDefault
              color={operation === 'delete' ? 'danger' : 'primary'}
              disabled={operation === 'move' && !canChoose}
            >
              {lang(operation === 'rename' ? 'XydriveSaveName' : title)}
            </Button>
          )}
        </div>
      </form>
    </Modal>
  );
};

export default memo(XydriveFileDialog);
