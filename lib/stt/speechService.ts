import { credentialService } from '../config/credentialService';
import { dbStore } from '../db/store';
import { RawTranscriptData, SpeakerUtterance } from '../types';

const mimeTypes: Record<string, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  webm: 'audio/webm',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
};

export async function transcribeWithGeminiAudio(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const { apiKey, model: primaryModel } = await credentialService.getGeminiCredentials();

  console.log('=== GEMINI STT CONFIG ===');
  console.log('Primary Model:', primaryModel);
  console.log('Key exists:', !!apiKey);

  const ext = fileName.split('.').pop()?.toLowerCase() || 'wav';
  const mimeType = mimeTypes[ext] || 'audio/wav';
  const base64Audio = buffer.toString('base64');

  const cleanModelName = (m: string) => m.replace(/-high$/i, '').trim();

  const candidateModels = Array.from(
    new Set([
      cleanModelName(primaryModel),
      'gemini-3.5-transcribe',
      'gemini-3.8-flash',
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-3.8-flash',
    ].filter(Boolean))
  );

  let lastError = '';

  for (const model of candidateModels) {
    try {
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
                    inlineData: {
                      mimeType,
                      data: base64Audio,
                    },
                  },
                  {
                    text: `
Transcribe this call recording verbatim.

Requirements:
- Preserve the full conversation.
- Do not summarize.
- Do not rewrite.
- Identify speakers as [Speaker 1], [Speaker 2], etc.
- Include timestamps when reasonably possible.
- Preserve names, companies, emails and job titles accurately.
- Return only the transcript.
`,
                  },
                ],
              },
            ],
          }),
        }
      );

      const responseText = await response.text();

      if (!response.ok) {
        lastError = `Gemini STT failed (${response.status}): ${responseText}`;
        console.warn(`Gemini STT warning for model ${model}: ${lastError}. Trying candidate fallback...`);
        continue;
      }

      const data = JSON.parse(responseText);
      const fullText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

      if (fullText) {
        return fullText;
      }
    } catch (err: any) {
      lastError = err.message;
      console.warn(`Gemini STT exception for model ${model}: ${err.message}. Trying candidate fallback...`);
    }
  }

  throw new Error(`Gemini Multimodal STT failed: ${lastError || 'No transcript generated.'}`);
}

export class SpeechService {
  /**
   * Process recording URL using live Speech-to-Text API (Gemini Multimodal STT, Google Cloud Speech API, or AssemblyAI).
   */
  public async transcribeAudio(
    recordingUrl: string,
    leadRef: string,
    clientCode: string,
    campaignCode: string
  ): Promise<{ gcsUri: string; rawTranscript: RawTranscriptData }> {
    const provider = await credentialService.getDefaultSttProvider();
    const googleCreds = await credentialService.getGoogleSttCredentials();
    const bucketName = googleCreds.gcsBucket || 'qtranscript-recordings';
    const gcsUri = `gs://${bucketName}/audio/${leadRef}.wav`;

    if (provider === 'gemini' || !googleCreds.hasPrivateKey) {
      try {
        const rawTranscript = await this.transcribeAudioViaGemini(recordingUrl, leadRef);
        return { gcsUri, rawTranscript };
      } catch (geminiErr: any) {
        console.error(`Gemini Multimodal STT Error for lead ${leadRef}:`, geminiErr);
        throw new Error(`Gemini Multimodal STT Error: ${geminiErr.message}`);
      }
    }

    if (provider === 'assemblyai') {
      try {
        const rawTranscript = await this.transcribeAudioViaAssemblyAi(recordingUrl, leadRef);
        return { gcsUri, rawTranscript };
      } catch (assErr: any) {
        console.error(`AssemblyAI STT Error for lead ${leadRef}:`, assErr);
        throw new Error(`AssemblyAI STT Error: ${assErr.message}`);
      }
    }

    try {
      const rawTranscript = await this.callGoogleCloudSpeechToText(recordingUrl, gcsUri, googleCreds);
      return { gcsUri, rawTranscript };
    } catch (err: any) {
      console.error(`Google Cloud Speech-to-Text API Error for lead ${leadRef}:`, err);
      throw new Error(`Google Cloud Speech-to-Text API Error: ${err.message}`);
    }
  }

  private async transcribeAudioViaGemini(
    recordingUrl: string,
    leadRef: string
  ): Promise<RawTranscriptData> {
    if (!recordingUrl || (!recordingUrl.startsWith('http://') && !recordingUrl.startsWith('https://'))) {
      throw new Error(`Invalid or unreachable audio recording URL: ${recordingUrl}`);
    }

    const audioRes = await fetch(recordingUrl);
    if (!audioRes.ok) {
      throw new Error(`Failed to fetch audio recording from ${recordingUrl} (HTTP ${audioRes.status})`);
    }

    const buffer = Buffer.from(await audioRes.arrayBuffer());
    const fileName = recordingUrl.split('/').pop()?.split('?')[0] || `${leadRef}.wav`;

    const fullText = await transcribeWithGeminiAudio(buffer, fileName);

    const lines = fullText.split('\n').filter((l: string) => l.trim().length > 0);
    const utterances: SpeakerUtterance[] = [];
    lines.forEach((line: string, index: number) => {
      const isSpeaker1 = line.includes('Speaker 1') || line.includes('Sales Rep') || line.includes('Agent') || index % 2 === 0;
      utterances.push({
        speakerTag: isSpeaker1 ? 1 : 2,
        speakerName: isSpeaker1 ? 'Speaker 1' : 'Speaker 2',
        startTime: `${index * 4}.0s`,
        endTime: `${(index + 1) * 4}.0s`,
        transcript: line.replace(/^\[.*?\]:\s*/, '').trim(),
      });
    });

    return {
      fullText,
      utterances: utterances.length > 0 ? utterances : [
        { speakerTag: 1, speakerName: 'Speaker', startTime: '0.0s', endTime: '0.0s', transcript: fullText }
      ],
      confidence: 0.99,
      languageCode: 'en-US',
      durationSeconds: Math.max(lines.length * 4, 30),
    };
  }

  private async transcribeAudioViaAssemblyAi(
    recordingUrl: string,
    leadRef: string
  ): Promise<RawTranscriptData> {
    const { apiKey } = await credentialService.getAssemblyAiCredentials();

    const submitRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        authorization: apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: recordingUrl,
        speaker_labels: true,
      }),
    });

    if (!submitRes.ok) {
      const errText = await submitRes.text();
      throw new Error(`AssemblyAI submission failed (${submitRes.status}): ${errText}`);
    }

    const submitData = await submitRes.json();
    const transcriptId = submitData.id;

    // Poll AssemblyAI status
    let pollingCount = 0;
    while (pollingCount < 30) {
      await new Promise((res) => setTimeout(res, 3000));
      pollingCount++;

      const pollRes = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: { authorization: apiKey },
      });

      if (!pollRes.ok) continue;

      const pollData = await pollRes.json();
      if (pollData.status === 'completed') {
        const fullText = pollData.text || '';
        const utterances: SpeakerUtterance[] = (pollData.utterances || []).map((u: any, idx: number) => ({
          speakerTag: u.speaker === 'A' ? 1 : 2,
          speakerName: u.speaker ? `Speaker ${u.speaker}` : `Speaker ${idx + 1}`,
          startTime: `${Math.round((u.start || 0) / 1000)}.0s`,
          endTime: `${Math.round((u.end || 0) / 1000)}.0s`,
          transcript: u.text,
        }));

        return {
          fullText,
          utterances: utterances.length > 0 ? utterances : [{ speakerTag: 1, speakerName: 'Speaker', startTime: '0.0s', endTime: '0.0s', transcript: fullText }],
          confidence: pollData.confidence || 0.95,
          languageCode: pollData.language_code || 'en_us',
          durationSeconds: pollData.audio_duration ? Math.round(pollData.audio_duration) : 45,
        };
      }

      if (pollData.status === 'error') {
        throw new Error(`AssemblyAI processing error: ${pollData.error}`);
      }
    }

    throw new Error('AssemblyAI transcription request timed out.');
  }

  private async callGoogleCloudSpeechToText(
    recordingUrl: string,
    gcsUri: string,
    creds: any
  ): Promise<RawTranscriptData> {
    let clientEmail = creds.clientEmail;
    let privateKey = creds.privateKey || '';
    let projectId = creds.projectId;

    if (privateKey.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(privateKey);
        if (parsed.client_email) clientEmail = parsed.client_email;
        if (parsed.private_key) privateKey = parsed.private_key;
        if (parsed.project_id) projectId = parsed.project_id;
      } catch (e) {}
    }
    privateKey = privateKey.replace(/\\n/g, '\n');

    const speech = require('@google-cloud/speech');
    const speechClient = new speech.SpeechClient({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      projectId: projectId,
    });

    let audioSource: any = { uri: gcsUri };

    if (recordingUrl) {
      if (recordingUrl.startsWith('gs://')) {
        audioSource = { uri: recordingUrl };
      } else if (recordingUrl.startsWith('http://') || recordingUrl.startsWith('https://')) {
        try {
          const audioRes = await fetch(recordingUrl);
          if (audioRes.ok) {
            const buffer = Buffer.from(await audioRes.arrayBuffer());
            audioSource = { content: buffer.toString('base64') };
          }
        } catch (fetchErr: any) {
          console.warn(`Could not fetch audio directly from ${recordingUrl}, attempting GCS URI ${gcsUri}:`, fetchErr.message);
        }
      }
    }

    const request = {
      config: {
        encoding: 'MP3',
        sampleRateHertz: 16000,
        languageCode: 'en-US',
        model: 'telephony',
        enableSpeakerDiarization: true,
        diarizationConfig: {
          enableSpeakerDiarization: true,
          minSpeakerCount: 2,
          maxSpeakerCount: 3,
        },
        enableWordTimeOffsets: true,
      },
      audio: audioSource,
    };

    let response: any;

    if (audioSource.content) {
      const [res] = await speechClient.recognize(request);
      response = res;
    } else {
      const [operation] = await speechClient.longRunningRecognize(request);
      const [res] = await operation.promise();
      response = res;
    }

    const utterances: SpeakerUtterance[] = [];
    let fullTextArr: string[] = [];

    if (response && response.results) {
      response.results.forEach((result: any) => {
        const alt = result.alternatives?.[0];
        if (alt) {
          if (alt.transcript) {
            fullTextArr.push(alt.transcript);
          }
          if (alt.words) {
            alt.words.forEach((w: any) => {
              const speakerTag = w.speakerTag || 1;
              const speakerName = speakerTag === 1 ? 'Sales Rep' : `Prospect (Speaker ${speakerTag})`;
              utterances.push({
                speakerTag,
                speakerName,
                startTime: `${w.startTime?.seconds || 0}.${w.startTime?.nanos ? Math.round(w.startTime.nanos / 1e8) : 0}s`,
                endTime: `${w.endTime?.seconds || 0}.${w.endTime?.nanos ? Math.round(w.endTime.nanos / 1e8) : 0}s`,
                transcript: w.word,
              });
            });
          }
        }
      });
    }

    const fullText = fullTextArr.join(' ').trim();
    if (!fullText) {
      throw new Error('Speech-to-Text API returned empty transcript text from audio recording.');
    }

    return {
      fullText,
      utterances: utterances.length > 0 ? utterances : [
        { speakerTag: 1, speakerName: 'Speaker', startTime: '0.0s', endTime: '0.0s', transcript: fullText }
      ],
      confidence: response.results?.[0]?.alternatives?.[0]?.confidence || 0.95,
      languageCode: 'en-US',
      durationSeconds: 45,
    };
  }
}

export const speechService = new SpeechService();
