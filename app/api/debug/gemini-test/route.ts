import { NextResponse } from 'next/server';
import { credentialService } from '@/lib/config/credentialService';

export async function GET() {
  return handleGeminiTest();
}

export async function POST() {
  return handleGeminiTest();
}

async function handleGeminiTest() {
  if (process.env.ENABLE_DEBUG_ROUTES !== 'true') {
    return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
  }

  try {
    const { apiKey, model } = await credentialService.getGeminiCredentials();

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Reply only with OK',
                },
              ],
            },
          ],
        }),
      }
    );

    const responseText = await response.text();

    if (!response.ok) {
      console.error('Gemini Test Route Error:', {
        status: response.status,
        model,
        response: responseText,
      });

      return NextResponse.json(
        {
          success: false,
          model,
          status: response.status,
          error: `Gemini API test failed (${response.status}): ${responseText}`,
        },
        { status: response.status }
      );
    }

    const data = JSON.parse(responseText);
    const replyText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    return NextResponse.json({
      success: true,
      model,
      response: replyText,
    });
  } catch (err: any) {
    console.error('Gemini Test Route Exception:', err);
    return NextResponse.json(
      {
        success: false,
        error: err.message,
      },
      { status: 500 }
    );
  }
}
