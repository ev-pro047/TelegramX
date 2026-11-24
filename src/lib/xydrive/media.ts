import type { ApiMessage } from '../../api/types';
import type { XydriveFile } from './types';

import {
  getMediaHash, getMessageIsSpoiler, isDocumentPhoto, isDocumentVideo,
} from '../../global/helpers/messageMedia';
import { getXydriveFile } from './fileMetadata';

export function getXydriveMediaFile(message: ApiMessage, sourceId: string): XydriveFile | undefined {
  const file = getXydriveFile(message, sourceId);
  if (!file || getMessageIsSpoiler(message)) return file;

  const { photo, video, audio, voice, document } = message.content;
  if (file.mediaType === 'photo' && photo) {
    return { ...file, previewKind: 'viewer', thumbnailHash: getMediaHash(photo, 'pictogram') };
  }
  if (file.mediaType === 'video' && video && !video.isRound) {
    return { ...file, previewKind: 'viewer', thumbnailHash: getMediaHash(video, 'pictogram') };
  }
  if (file.mediaType === 'document' && document) {
    const shouldForceDownload = document.innerMediaType === 'photo' && document.mediaSize
      && !document.mediaSize.fromDocumentAttribute && !document.mediaSize.fromPreload;
    if (!shouldForceDownload && (isDocumentPhoto(document) || isDocumentVideo(document))) {
      return { ...file, previewKind: 'viewer', thumbnailHash: getMediaHash(document, 'pictogram') };
    }
  }
  if (file.mediaType === 'audio' && audio) {
    return { ...file, previewKind: 'audio', thumbnailHash: getMediaHash(audio, 'pictogram') };
  }
  if (file.mediaType === 'voice' && voice) return { ...file, previewKind: 'audio' };
  return file;
}

export function matchesXydriveMedia(file: XydriveFile, current: XydriveFile): boolean {
  return file.id === current.id && file.chatId === current.chatId && file.messageId === current.messageId
    && file.mediaId === current.mediaId && file.previewKind === current.previewKind;
}
