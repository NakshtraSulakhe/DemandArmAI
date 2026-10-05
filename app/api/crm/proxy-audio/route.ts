import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return NextResponse.json({ success: false, error: 'Target recording URL is required' }, { status: 400 });
    }

    // Secure URL validation to ensure only authorized audio endpoints are fetched
    const isAuthorized =
      targetUrl.startsWith('https://app.tarajglobal.com/') ||
      targetUrl.startsWith('http://localhost/') ||
      targetUrl.startsWith('https://localhost/') ||
      targetUrl.startsWith('https://storage.googleapis.com/');

    if (!isAuthorized) {
      return NextResponse.json({ success: false, error: 'Unauthorized audio target domain' }, { status: 403 });
    }

    const audioRes = await fetch(targetUrl, {
      method: 'GET',
    });

    if (!audioRes.ok) {
      return NextResponse.json(
        { success: false, error: `CRM audio server returned status ${audioRes.status}` },
        { status: audioRes.status }
      );
    }

    const audioBuffer = await audioRes.arrayBuffer();
    const contentType = audioRes.headers.get('content-type') || 'audio/wav';

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': audioBuffer.byteLength.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
