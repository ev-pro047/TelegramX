import { FloodTestPhoneWaitError, FloodWaitError } from '../../../lib/gramjs/errors';
import { getServerTime } from '../../../util/serverTime';

// Shared by registry discovery and metadata reads/writes in the authenticated worker.
let retryAt = 0;

export function noteXydriveCloudBackoff(error: unknown) {
  if (error instanceof FloodWaitError || error instanceof FloodTestPhoneWaitError) {
    retryAt = Math.max(retryAt, getServerTime() + error.seconds);
  }
}

export function getXydriveCloudBackoff() {
  return Math.max(0, Math.ceil(retryAt - getServerTime()));
}
