import type { ApiMessage } from '../../api/types';
import type { XydriveCategory, XydriveFile } from './types';

const ARCHIVE_MIME_TYPES = new Set([
  'application/zip', 'application/x-zip-compressed', 'application/x-7z-compressed',
  'application/x-rar-compressed', 'application/vnd.rar', 'application/gzip',
  'application/x-gzip', 'application/x-tar', 'application/x-bzip2', 'application/x-xz',
]);
const ARCHIVE_EXTENSION = /\.(zip|7z|rar|tar|gz|bz2|xz|tgz)$/i;
const IMAGE_EXTENSION = /\.(jpg|jpeg|png|gif|webp|avif|heic|heif|bmp|tiff|svg)$/i;
const VIDEO_EXTENSION = /\.(mp4|webm|mov|mkv|avi|mpeg|m4v)$/i;
const AUDIO_EXTENSION = /\.(mp3|m4a|aac|flac|wav|ogg|opus|wma)$/i;
const DOCUMENT_EXTENSION = /\.(pdf|docx?|xlsx?|pptx?|txt|csv|odt|ods|odp|rtf|epub|md)$/i;

function normalizeMime(mimeType?: string): string | undefined {
  return mimeType?.split(';')[0].trim().toLowerCase() || undefined;
}

export function classifyXydriveFile(name: string, mimeType?: string): XydriveCategory {
  if (mimeType?.startsWith('image/')) return 'images';
  if (mimeType?.startsWith('video/')) return 'videos';
  if (mimeType?.startsWith('audio/')) return 'audio';
  if (mimeType && ARCHIVE_MIME_TYPES.has(mimeType)) return 'archives';
  if (ARCHIVE_EXTENSION.test(name)) return 'archives';
  if (IMAGE_EXTENSION.test(name)) return 'images';
  if (VIDEO_EXTENSION.test(name)) return 'videos';
  if (AUDIO_EXTENSION.test(name)) return 'audio';
  if (mimeType?.startsWith('text/') || DOCUMENT_EXTENSION.test(name)) return 'documents';
  return 'other';
}

export function getXydriveFile(message: ApiMessage, ownerId: string): XydriveFile | undefined {
  if (message.chatId !== ownerId || !Number.isSafeInteger(message.id) || message.id <= 0
    || message.isProtected || message.ttlPeriod || message.content.ttlSeconds !== undefined
    || message.isEphemeral || message.isScheduled || message.sendingState || message.isDeleting
    || message.restrictionReasons?.length) return undefined;

  const { photo, video, audio, voice, document, sticker } = message.content;
  const media = document || video || audio || photo || voice || sticker;
  if (!media) return undefined;

  const mediaType = media.mediaType;
  const mediaId = media.id;
  const extension = mediaType === 'photo' ? '.jpg' : mediaType === 'sticker'
    ? (media.isLottie ? '.tgs' : media.isVideo ? '.webm' : '.webp') : '';
  const name = ('fileName' in media && media.fileName.trim())
    || `${mediaType}-${message.id}${extension}`;
  const mimeType = 'mimeType' in media ? normalizeMime(media.mimeType)
    : mediaType === 'photo' ? 'image/jpeg' : undefined;
  const size = 'size' in media && Number.isSafeInteger(media.size) && media.size >= 0 ? media.size : undefined;
  const category = mediaType === 'photo' ? 'images' : mediaType === 'video' ? 'videos'
    : mediaType === 'audio' || mediaType === 'voice' ? 'audio'
      : mediaType === 'sticker' ? 'other' : classifyXydriveFile(name, mimeType);

  return {
    id: `${ownerId}:${message.id}:${mediaType}`,
    chatId: ownerId,
    messageId: message.id,
    mediaId,
    name,
    mimeType,
    size,
    date: message.date,
    category,
    mediaType,
  };
}

export function mergeXydriveFiles(existing: readonly XydriveFile[], incoming: readonly XydriveFile[]): XydriveFile[] {
  const byId = new Map(existing.map((file) => [file.id, file]));
  incoming.forEach((file) => byId.set(file.id, file));
  return Array.from(byId.values()).sort((left, right) => right.messageId - left.messageId);
}
