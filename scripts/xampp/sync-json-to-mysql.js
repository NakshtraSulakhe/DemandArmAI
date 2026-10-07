/**
 * Copies records that exist in .data/db_store.json into the XAMPP MySQL database (qa_ai).
 * Existing rows are left in place. This does not start the processing pipeline.
 */
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match || process.env[match[1].trim()]) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
  }
}

loadEnv();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function asText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

async function main() {
  const storePath = path.join(process.cwd(), '.data', 'db_store.json');
  const data = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  const added = { clients: 0, campaigns: 0, prompts: 0, leads: 0, jobs: 0, audits: 0 };

  const clientCodes = new Set((await prisma.client.findMany({ select: { code: true } })).map((row) => row.code));
  for (const client of data.clients || []) {
    if (clientCodes.has(client.code)) continue;
    await prisma.client.create({
      data: {
        id: client.id,
        name: client.name || client.code,
        code: client.code,
        globalPrompt: client.globalPrompt || '',
        qualificationCriteria: client.qualificationCriteria || '',
        isActive: client.isActive !== false,
      },
    });
    clientCodes.add(client.code);
    added.clients += 1;
  }

  const campaignCodes = new Set((await prisma.campaign.findMany({ select: { code: true } })).map((row) => row.code));
  for (const campaign of data.campaigns || []) {
    if (campaignCodes.has(campaign.code)) continue;
    if (!clientCodes.has(campaign.clientCode)) {
      console.error(`Skipped campaign ${campaign.code}: client ${campaign.clientCode} is not in MySQL.`);
      continue;
    }
    await prisma.campaign.create({
      data: {
        id: campaign.id,
        name: campaign.name || campaign.code,
        code: campaign.code,
        clientCode: campaign.clientCode,
        assetTitle: campaign.assetTitle || '',
        valueProps: asText(campaign.valueProps || []),
        additionalEditingInstructions: campaign.additionalEditingInstructions || '',
        qualificationRulesOverride: campaign.qualificationRulesOverride || null,
        isActive: campaign.isActive !== false,
      },
    });
    campaignCodes.add(campaign.code);
    added.campaigns += 1;
  }

  const promptIds = new Set((await prisma.clientPromptVersion.findMany({ select: { id: true } })).map((row) => row.id));
  for (const prompt of data.clientPrompts || []) {
    if (promptIds.has(prompt.id)) continue;
    await prisma.clientPromptVersion.create({
      data: {
        id: prompt.id,
        clientCode: prompt.clientCode,
        version: prompt.version || 1,
        promptText: prompt.promptText || '',
        qualificationCriteria: prompt.qualificationCriteria || '',
        createdBy: prompt.createdBy || 'System Admin',
        createdAt: new Date(prompt.createdAt || Date.now()),
      },
    });
    promptIds.add(prompt.id);
    added.prompts += 1;
  }

  const leadRefs = new Set((await prisma.crmLead.findMany({ select: { leadRef: true } })).map((row) => row.leadRef));
  for (const lead of data.leads || []) {
    if (!lead.leadRef || leadRefs.has(lead.leadRef)) continue;
    await prisma.crmLead.create({
      data: {
        id: lead.id || `lead_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        leadRef: lead.leadRef,
        clientCode: lead.clientCode || '',
        campaignCode: lead.campaignCode || '',
        campaignName: lead.campaignName || null,
        agentId: lead.agentId || null,
        agentName: lead.agentName || null,
        contactName: lead.contactName || 'Lead',
        companyName: lead.companyName || 'Company',
        companySize: lead.companySize || null,
        industry: lead.industry || null,
        country: lead.country || null,
        jobTitle: lead.jobTitle || null,
        email: lead.email || null,
        phone: lead.phone || null,
        recordingUrl: lead.recordingUrl || '',
        qaStatusCrm: lead.qaStatusCrm || null,
        rawLeadData: lead.rawLeadData ? asText(lead.rawLeadData) : null,
        syncedAt: new Date(lead.syncedAt || Date.now()),
      },
    });
    leadRefs.add(lead.leadRef);
    added.leads += 1;
  }

  const leadsByRef = new Map(
    (await prisma.crmLead.findMany({ select: { id: true, leadRef: true } })).map((row) => [row.leadRef, row.id])
  );
  const jobIds = new Set((await prisma.processingJob.findMany({ select: { id: true } })).map((row) => row.id));
  for (const job of data.jobs || []) {
    if (jobIds.has(job.id)) continue;
    const leadId = leadsByRef.get(job.leadRef);
    if (!leadId) {
      console.error(`Skipped job ${job.id}: lead ${job.leadRef} is not in MySQL.`);
      continue;
    }
    await prisma.processingJob.create({
      data: {
        id: job.id,
        leadId,
        leadRef: job.leadRef,
        status: job.status || 'PENDING',
        stepError: job.stepError || null,
        gcsAudioUri: job.gcsAudioUri || null,
        rawTranscript: job.rawTranscript ? asText(job.rawTranscript) : null,
        editedTranscript: job.editedTranscript ? asText(job.editedTranscript) : null,
        promptVersionUsed: job.promptVersionUsed || null,
        qaStatus: job.qaStatus || null,
        qaResultJson: job.qaResultJson ? asText(job.qaResultJson) : null,
        manualOverrideStatus: job.manualOverrideStatus || null,
        manualOverrideNotes: job.manualOverrideNotes || null,
        reviewedBy: job.reviewedBy || null,
        reviewedAt: job.reviewedAt ? new Date(job.reviewedAt) : null,
        attempts: job.attempts || 0,
        promptTokens: job.promptTokens || 0,
        completionTokens: job.completionTokens || 0,
        audioDurationSeconds: job.audioDurationSeconds || 0,
        processingDurationMs: job.processingDurationMs || 0,
      },
    });
    jobIds.add(job.id);
    added.jobs += 1;
  }

  const auditIds = new Set((await prisma.auditLog.findMany({ select: { id: true } })).map((row) => row.id));
  for (const log of data.auditLogs || []) {
    if (auditIds.has(log.id)) continue;
    const jobId = log.jobId && jobIds.has(log.jobId) ? log.jobId : null;
    await prisma.auditLog.create({
      data: {
        id: log.id,
        jobId,
        action: log.action,
        details: log.details || '',
        timestamp: new Date(log.timestamp || Date.now()),
      },
    });
    auditIds.add(log.id);
    added.audits += 1;
  }

  console.log(JSON.stringify(added));
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
