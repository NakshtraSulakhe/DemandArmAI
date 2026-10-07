import { dbStore } from '../db/store';
import { speechService } from '../stt/speechService';
import { geminiService } from '../ai/geminiService';
import { qaEngine } from '../qa/qaEngine';
import { pushQaResultToCrm } from '../crm/crmWriteback';
import { ProcessingJobItem } from '../types';

export class JobWorker {
  private isProcessing = false;

  public isPaused(): boolean {
    const settings = dbStore.getSettings();
    return !!settings.isProcessingPaused;
  }

  /**
   * Triggers processing of pending or failed jobs in configurable batch sizes.
   */
  public async processQueue(maxBatch?: number): Promise<{ processedCount: number; errorsCount: number }> {
    if (this.isPaused()) {
      return { processedCount: 0, errorsCount: 0 };
    }

    if (this.isProcessing) {
      return { processedCount: 0, errorsCount: 0 };
    }

    this.isProcessing = true;
    let processedCount = 0;
    let errorsCount = 0;

    try {
      const settings = dbStore.getSettings();
      const concurrency = Math.min(8, Math.max(1, settings.maxConcurrency || 1));
      const batchSize = maxBatch ?? Math.max(concurrency * 2, 6);
      const pendingJobs = dbStore
        .getJobs()
        .filter((j) =>
          j.status === 'PENDING' ||
          j.status === 'AUDIO_RETRIEVED' ||
          j.status === 'TRANSCRIBING' ||
          j.status === 'AI_EDITING' ||
          j.status === 'QA_EVALUATING'
        )
        .slice(0, batchSize);

      let cursor = 0;
      const runWorker = async () => {
        while (cursor < pendingJobs.length) {
          if (this.isPaused()) return;
          const job = pendingJobs[cursor];
          cursor += 1;
          try {
            await this.processSingleJob(job.id);
            processedCount += 1;
          } catch (err: any) {
            console.error(`Error processing job ${job.id}:`, err);
            errorsCount += 1;
          }
        }
      };

      const workers = Math.min(concurrency, pendingJobs.length);
      if (workers > 0) {
        await Promise.all(Array.from({ length: workers }, () => runWorker()));
      }
    } finally {
      this.isProcessing = false;
    }

    return { processedCount, errorsCount };
  }

  /** Clears stored audio pointers after the retention window. Playback still uses the CRM URL. */
  public async releaseExpiredAudio(): Promise<number> {
    const days = dbStore.getSettings().audioRetentionDays || 0;
    if (days <= 0) return 0;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let released = 0;

    for (const job of dbStore.getJobs()) {
      if (!job.gcsAudioUri || !job.gcsAudioUri.startsWith('gs://')) continue;
      const updated = new Date(job.updatedAt || job.createdAt).getTime();
      if (updated > cutoff) continue;
      job.gcsAudioUri = undefined;
      dbStore.saveJob(job);
      dbStore.addAuditLog(job.id, 'AUDIO_RETENTION', `Cleared stored audio pointer after ${days} days.`);
      released += 1;
    }

    return released;
  }

  /**
   * Executes a single job through the step-by-step state machine:
   * PENDING -> AUDIO_RETRIEVED -> TRANSCRIBING -> AI_EDITING -> QA_EVALUATING -> COMPLETED
   * Intermediate results are preserved on state transition so retries skip finished steps!
   */
  public async processSingleJob(jobId: string): Promise<ProcessingJobItem> {
    let job = dbStore.getJobById(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    const lead = job.lead || dbStore.getLeadByRef(job.leadRef);
    if (!lead) {
      const errorMsg = `CRM Lead reference ${job.leadRef} not found in database.`;
      job.status = 'FAILED';
      job.stepError = errorMsg;
      dbStore.saveJob(job);
      dbStore.addAuditLog(job.id, 'JOB_FAILED', errorMsg);
      return job;
    }

    const client = dbStore.getClientByCode(lead.clientCode);
    const campaign = dbStore.getCampaignByCode(lead.campaignCode);
    const settings = dbStore.getSettings();

    if (!client) {
      const errorMsg = `Client ${lead.clientCode} is not in Configuration. Add the client, then retry this lead.`;
      job.status = 'CONFIGURATION_REQUIRED';
      job.stepError = errorMsg;
      dbStore.saveJob(job);
      dbStore.addAuditLog(job.id, 'CONFIGURATION_REQUIRED', errorMsg);
      return job;
    }

    if (!campaign && client.allowClientPromptFallback === false) {
      const errorMsg = `Campaign ${lead.campaignCode} is missing, and client ${client.code} does not allow the client prompt alone.`;
      job.status = 'CAMPAIGN_CONFIGURATION_REQUIRED';
      job.stepError = errorMsg;
      dbStore.saveJob(job);
      dbStore.addAuditLog(job.id, 'CAMPAIGN_CONFIGURATION_REQUIRED', errorMsg);
      return job;
    }

    const startedAt = Date.now();
    job.attempts += 1;

    try {
      if (!settings.autoGenerateTranscripts && !job.rawTranscript) {
        job.status = 'COMPLETED';
        job.stepError = undefined;
        job.processingDurationMs = Date.now() - startedAt;
        dbStore.saveJob(job);
        dbStore.addAuditLog(job.id, 'TRANSCRIPT_SKIPPED', 'Automatic transcription is off in Settings. Turn it on and retry this lead.');
        return job;
      }

      if (job.status === 'PENDING') {
        dbStore.addAuditLog(job.id, 'STEP_AUDIO_RETRIEVAL', `Using the CRM recording for ${lead.leadRef}.`);
        job.gcsAudioUri = lead.recordingUrl;
        job.status = 'AUDIO_RETRIEVED';
        dbStore.saveJob(job);
      }

      if (job.status === 'AUDIO_RETRIEVED' || !job.rawTranscript) {
        job.status = 'TRANSCRIBING';
        dbStore.saveJob(job);
        dbStore.addAuditLog(job.id, 'STEP_TRANSCRIBING', 'Transcribing the recording.');

        const { gcsUri, rawTranscript } = await speechService.transcribeAudio(
          lead.recordingUrl,
          lead.leadRef,
          client.code,
          lead.campaignCode
        );

        job.gcsAudioUri = gcsUri;
        job.rawTranscript = rawTranscript;
        job.audioDurationSeconds = rawTranscript.durationSeconds || 0;
        job.status = 'AI_EDITING';
        dbStore.saveJob(job);
      }

      if (job.status === 'AI_EDITING' || !job.editedTranscript) {
        if (!client.globalPrompt || client.globalPrompt.trim() === '') {
          const errMsg = `Add a transcript prompt for client ${client.code} in Configuration, then retry this lead.`;
          job.status = 'CONFIGURATION_REQUIRED';
          job.stepError = errMsg;
          dbStore.saveJob(job);
          dbStore.addAuditLog(job.id, 'CONFIGURATION_REQUIRED', errMsg);
          return job;
        }

        dbStore.addAuditLog(
          job.id,
          'STEP_AI_EDITING',
          `Editing transcript with ${client.code} v${client.promptVersion || 1}${campaign ? ` and campaign ${campaign.code}` : ''}.`
        );

        const edited = await geminiService.editTranscript(client, campaign, lead, job.rawTranscript!);
        job.editedTranscript = edited.editedTranscript;
        job.promptVersionUsed = edited.versionTag;
        job.promptTokens = (job.promptTokens || 0) + edited.promptTokens;
        job.completionTokens = (job.completionTokens || 0) + edited.completionTokens;
        job.status = 'QA_EVALUATING';
        dbStore.saveJob(job);
      }

      if (!settings.autoQaEvaluation && !job.qaResultJson) {
        job.status = 'COMPLETED';
        job.stepError = undefined;
        job.processingDurationMs = Date.now() - startedAt;
        dbStore.saveJob(job);
        dbStore.addAuditLog(job.id, 'QA_SKIPPED', 'Automatic QA is off in Settings. Turn it on and retry to score this lead.');
        return job;
      }

      if (job.status === 'QA_EVALUATING' || !job.qaResultJson) {
        dbStore.addAuditLog(job.id, 'STEP_QA_EVALUATING', 'Scoring the call against the client qualification criteria.');

        const qaResult = await qaEngine.evaluateLead(
          client,
          campaign,
          lead,
          job.rawTranscript!,
          job.editedTranscript!
        );

        job.qaResultJson = qaResult;
        job.qaStatus = qaResult.qualificationStatus;
        job.promptTokens = (job.promptTokens || 0) + Number(qaResult.metadata?.promptTokens || 0);
        job.completionTokens = (job.completionTokens || 0) + Number(qaResult.metadata?.completionTokens || 0);
        job.audioDurationSeconds = job.audioDurationSeconds || job.rawTranscript?.durationSeconds || 0;
        job.processingDurationMs = Date.now() - startedAt;
        job.status = 'COMPLETED';
        job.stepError = undefined;
        dbStore.saveJob(job);

        dbStore.addAuditLog(
          job.id,
          'JOB_COMPLETED',
          `Finished. Result: ${qaResult.qualificationStatus} (${qaResult.overallScore}%).`
        );
        await pushQaResultToCrm(job, lead);
      }
    } catch (err: any) {
      const stepError = err.message || 'Pipeline execution failed during processing step.';
      job.status = 'FAILED';
      job.stepError = stepError;
      job.processingDurationMs = Date.now() - startedAt;
      dbStore.saveJob(job);
      dbStore.addAuditLog(job.id, 'JOB_FAILED', stepError);
    }

    return job;
  }

  /**
   * Resets job state to allow clean retry, preserving finished intermediate steps where possible.
   */
  public async retryJob(jobId: string): Promise<ProcessingJobItem> {
    const job = dbStore.getJobById(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (!job.rawTranscript) {
      job.status = 'PENDING';
    } else if (!job.editedTranscript) {
      job.status = 'AI_EDITING';
    } else {
      job.status = 'QA_EVALUATING';
      job.qaResultJson = undefined;
      job.qaStatus = undefined;
    }

    job.stepError = undefined;
    dbStore.saveJob(job);
    dbStore.addAuditLog(job.id, 'JOB_RETRY', `Manual retry initiated. Resuming job lifecycle at state: ${job.status}`);

    return this.processSingleJob(job.id);
  }

  /**
   * Runs the full pipeline again from the recording, including transcription.
   */
  public async restartJob(jobId: string): Promise<ProcessingJobItem> {
    const job = dbStore.getJobById(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    job.status = 'PENDING';
    job.stepError = undefined;
    dbStore.saveJob(job);
    dbStore.addAuditLog(job.id, 'JOB_RESTART', 'Manual restart from the recording.');

    return this.processSingleJob(job.id);
  }
}

export const jobWorker = new JobWorker();
