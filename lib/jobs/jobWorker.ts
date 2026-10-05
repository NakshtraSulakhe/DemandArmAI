import { dbStore } from '../db/store';
import { speechService } from '../stt/speechService';
import { geminiService } from '../ai/geminiService';
import { qaEngine } from '../qa/qaEngine';
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
  public async processQueue(maxBatch: number = 10): Promise<{ processedCount: number; errorsCount: number }> {
    if (this.isPaused()) {
      console.log('[JobWorker] Queue processing skipped: Pipeline is PAUSED by user.');
      return { processedCount: 0, errorsCount: 0 };
    }

    if (this.isProcessing) {
      return { processedCount: 0, errorsCount: 0 };
    }

    this.isProcessing = true;
    let processedCount = 0;
    let errorsCount = 0;

    try {
      const allJobs = dbStore.getJobs();
      const pendingJobs = allJobs
        .filter((j) => j.status === 'PENDING' || j.status === 'AUDIO_RETRIEVED' || j.status === 'TRANSCRIBING' || j.status === 'AI_EDITING' || j.status === 'QA_EVALUATING')
        .slice(0, maxBatch);

      for (const job of pendingJobs) {
        try {
          await this.processSingleJob(job.id);
          processedCount++;
        } catch (err: any) {
          console.error(`Error processing job ${job.id}:`, err);
          errorsCount++;
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return { processedCount, errorsCount };
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

    if (!client || !campaign) {
      const errorMsg = `Matching Client (${lead.clientCode}) or Campaign (${lead.campaignCode}) configuration missing or inactive.`;
      job.status = 'FAILED';
      job.stepError = errorMsg;
      dbStore.saveJob(job);
      dbStore.addAuditLog(job.id, 'JOB_FAILED', errorMsg);
      return job;
    }

    job.attempts += 1;

    try {
      // Step 1: Audio Retrieval / GCS URI setup
      if (job.status === 'PENDING') {
        dbStore.addAuditLog(job.id, 'STEP_AUDIO_RETRIEVAL', `Retrieving recording URL for ${lead.leadRef}...`);
        const settings = dbStore.getSettings();
        job.gcsAudioUri = `gs://${settings.gcsBucketName}/audio/${lead.leadRef}.wav`;
        job.status = 'AUDIO_RETRIEVED';
        dbStore.saveJob(job);
      }

      // Step 2: Speech-to-Text Transcription
      if (job.status === 'AUDIO_RETRIEVED' || !job.rawTranscript) {
        job.status = 'TRANSCRIBING';
        dbStore.saveJob(job);
        dbStore.addAuditLog(job.id, 'STEP_TRANSCRIBING', `Running Google Speech-to-Text recognition with speaker diarization...`);

        const { gcsUri, rawTranscript } = await speechService.transcribeAudio(
          lead.recordingUrl,
          lead.leadRef,
          client.code,
          campaign.code
        );

        job.gcsAudioUri = gcsUri;
        job.rawTranscript = rawTranscript;
        job.status = 'AI_EDITING'; // Progress to next state
        dbStore.saveJob(job);
      }

      // Step 3: AI Transcript Editing (Gemini)
      if (job.status === 'AI_EDITING' || !job.editedTranscript) {
        // Point 16: Client Without Prompt Check
        if (!client.globalPrompt || client.globalPrompt.trim() === '') {
          const errMsg = `Transcript editing prompt is not configured for client ${client.code}.`;
          job.status = 'CONFIGURATION_REQUIRED';
          job.stepError = errMsg;
          dbStore.saveJob(job);
          dbStore.addAuditLog(job.id, 'CONFIGURATION_REQUIRED', errMsg);
          return job;
        }

        // Point 17: Campaign Without Configuration Check
        if (!campaign && client.allowClientPromptFallback === false) {
          const errMsg = `Campaign configuration missing for code ${lead.campaignCode} and client prompt fallback is disabled for client ${client.code}.`;
          job.status = 'CAMPAIGN_CONFIGURATION_REQUIRED';
          job.stepError = errMsg;
          dbStore.saveJob(job);
          dbStore.addAuditLog(job.id, 'CAMPAIGN_CONFIGURATION_REQUIRED', errMsg);
          return job;
        }

        dbStore.addAuditLog(
          job.id,
          'STEP_AI_EDITING',
          `Constructing dynamic prompt (${client.code} v${client.promptVersion || 1} ${campaign ? `+ Campaign ${campaign.code}` : ''}) and dispatching to Gemini API...`
        );

        const { editedTranscript, versionTag } = await geminiService.editTranscript(
          client,
          campaign,
          lead,
          job.rawTranscript!
        );

        job.editedTranscript = editedTranscript;
        job.promptVersionUsed = versionTag;
        job.status = 'QA_EVALUATING'; // Progress to next state
        dbStore.saveJob(job);
      }

      // Step 4: Quality Assurance Evaluation
      if (job.status === 'QA_EVALUATING' || !job.qaResultJson) {
        dbStore.addAuditLog(job.id, 'STEP_QA_EVALUATING', `Evaluating call evidence against Client & Campaign qualification criteria...`);

        const qaResult = await qaEngine.evaluateLead(
          client,
          campaign,
          lead,
          job.rawTranscript!,
          job.editedTranscript!
        );

        job.qaResultJson = qaResult;
        job.qaStatus = qaResult.qualificationStatus;
        job.status = 'COMPLETED';
        job.stepError = undefined;
        dbStore.saveJob(job);

        dbStore.addAuditLog(
          job.id,
          'JOB_COMPLETED',
          `Pipeline completed successfully. Qualification Result: ${qaResult.qualificationStatus} (Score: ${qaResult.overallScore}%)`
        );
      }
    } catch (err: any) {
      const stepError = err.message || 'Pipeline execution failed during processing step.';
      job.status = 'FAILED';
      job.stepError = stepError;
      dbStore.saveJob(job);
      dbStore.addAuditLog(job.id, 'JOB_FAILED', `Error during processing: ${stepError}`);
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

    // Determine step to resume from
    if (job.rawTranscript && !job.editedTranscript) {
      job.status = 'AI_EDITING';
    } else if (job.rawTranscript && job.editedTranscript && !job.qaResultJson) {
      job.status = 'QA_EVALUATING';
    } else {
      job.status = 'PENDING';
    }

    job.stepError = undefined;
    dbStore.saveJob(job);
    dbStore.addAuditLog(job.id, 'JOB_RETRY', `Manual retry initiated. Resuming job lifecycle at state: ${job.status}`);

    return this.processSingleJob(job.id);
  }
}

export const jobWorker = new JobWorker();
