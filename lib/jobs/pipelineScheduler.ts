import { crmSyncWorker } from '../crm/crmSyncWorker';
import { jobWorker } from './jobWorker';

let timer: NodeJS.Timeout | null = null;

/** Starts CRM sync and a short queue tick. Safe to call from several API routes. */
export function ensurePipelineStarted(): void {
  crmSyncWorker.ensureAutoSyncStarted();
  if (timer) return;

  timer = setInterval(() => {
    jobWorker.processQueue().catch((err) => console.error('[Pipeline] Queue tick failed:', err));
    jobWorker.releaseExpiredAudio().catch((err) => console.error('[Pipeline] Audio retention failed:', err));
  }, 20000);

  jobWorker.processQueue().catch((err) => console.error('[Pipeline] Initial queue run failed:', err));
}
