import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '../../../../lib/db/store';
import { geminiService } from '../../../../lib/ai/geminiService';
import { PromptBuilder } from '../../../../lib/ai/promptBuilder';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { clientCode, campaignCode, promptText, sampleTranscript } = body;

    if (!clientCode) {
      return NextResponse.json({ success: false, error: 'clientCode is required' }, { status: 400 });
    }

    const client = dbStore.getClientByCode(clientCode);
    if (!client) {
      return NextResponse.json({ success: false, error: `Client not found for code ${clientCode}` }, { status: 404 });
    }

    const campaign = campaignCode ? dbStore.getCampaignByCode(campaignCode) : undefined;

    const sampleText =
      sampleTranscript && sampleTranscript.trim().length > 0
        ? sampleTranscript
        : `[Prospect]: Hi, this is Sarah from Austin Neurosurgical Institute. We are evaluating new medical billing and scheduling software for our 15 user seats.
[Sales Agent]: Great to speak with you Sarah! What is your implementation timeframe for a new system?
[Prospect]: We need to go live within 3 to 6 months. Budget is approved around $45k annually, but integration with Epic EHR is mandatory.
[Sales Agent]: Understood. Let's schedule a technical demo for next Tuesday at 2 PM.`;

    const promptResult = PromptBuilder.buildPrompt({
      client,
      campaign,
      customClientPrompt: promptText || client.globalPrompt,
      rawTranscript: {
        fullText: sampleText,
        utterances: [],
        confidence: 0.98,
        languageCode: 'en-US',
        durationSeconds: 120,
      },
    });

    const previewOutput = await geminiService.testPromptPreview(
      promptText || client.globalPrompt,
      sampleText,
      client,
      campaign
    );

    return NextResponse.json({
      success: true,
      effectivePrompt: promptResult.finalPrompt,
      previewOutput,
      versionTag: promptResult.versionTag,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
