export type XydriveCategory = 'images' | 'videos' | 'audio' | 'documents' | 'archives' | 'other';

export type XydriveFile = {
  id: string;
  chatId: string;
  messageId: number;
  mediaId?: string;
  name: string;
  mimeType?: string;
  size?: number;
  date: number;
  category: XydriveCategory;
  mediaType: 'photo' | 'video' | 'audio' | 'voice' | 'document' | 'sticker';
};

export type XydriveState = {
  ownerId: string;
  files: XydriveFile[];
  scannedCount: number;
  nextOffsetId?: number;
  status: 'loading' | 'ready' | 'error';
  requestId?: number;
  error?: 'wait' | 'generic';
};
