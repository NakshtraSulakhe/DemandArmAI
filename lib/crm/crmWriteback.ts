import { dbStore } from '../db/store';
import { decryptCredential } from '../security/encryption';
import { CrmLeadItem, ProcessingJobItem } from '../types';

export async function pushQaResultToCrm(job: ProcessingJobItem, lead?: CrmLeadItem): Promise<void> {
  const settings = dbStore.getSettings();
  const url = settings.crmWritebackUrl?.trim();
  if (!url) return;

  const status = job.manualOverrideStatus || job.qaStatus || 'NEEDS_REVIEW';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.crmApiKey ? { Authorization: `Bearer ${decryptCredential(settings.crmApiKey)}` } : {}),
      },
      body: JSON.stringify({
        leadRef: job.leadRef,
        clientCode: lead?.clientCode,
        campaignCode: lead?.campaignCode,
        qaStatus: status,
        overallScore: job.qaResultJson?.overallScore ?? null,
        notes: job.manualOverrideNotes || '',
        reviewedBy: job.reviewedBy || '',
        reviewedAt: job.reviewedAt || new Date().toISOString(),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      dbStore.addAuditLog(job.id, 'CRM_WRITEBACK_FAILED', `CRM write-back returned HTTP ${res.status}: ${body.slice(0, 180)}`);
      return;
    }

    dbStore.addAuditLog(job.id, 'CRM_WRITEBACK', `Sent ${status} for ${job.leadRef} to the CRM write-back URL.`);
  } catch (err: any) {
    dbStore.addAuditLog(job.id, 'CRM_WRITEBACK_FAILED', err.name === 'AbortError' ? 'CRM write-back timed out.' : err.message);
  } finally {
    clearTimeout(timeout);
  }
}
