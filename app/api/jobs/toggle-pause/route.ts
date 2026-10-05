import { NextRequest, NextResponse } from 'next/server';
import { dbStore } from '../../../../lib/db/store';

export async function GET() {
  try {
    const settings = dbStore.getSettings();
    return NextResponse.json({
      success: true,
      isProcessingPaused: !!settings.isProcessingPaused,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const settings = dbStore.getSettings();

    // Toggle if not explicitly set in body
    const nextState =
      typeof body.isProcessingPaused === 'boolean'
        ? body.isProcessingPaused
        : !settings.isProcessingPaused;

    dbStore.updateSettings({ isProcessingPaused: nextState });

    dbStore.addAuditLog(
      'global',
      nextState ? 'PIPELINE_PAUSED' : 'PIPELINE_RESUMED',
      nextState
        ? 'Global Speech-to-Text & Gemini AI processing pipeline PAUSED by user. Credit usage stopped.'
        : 'Global Speech-to-Text & Gemini AI processing pipeline RESUMED by user.'
    );

    return NextResponse.json({
      success: true,
      isProcessingPaused: nextState,
      message: nextState
        ? 'Continuous STT & Gemini processing pipeline has been PAUSED to protect API credits.'
        : 'Continuous STT & Gemini processing pipeline has been RESUMED.',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
