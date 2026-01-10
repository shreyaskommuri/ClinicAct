import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@deepgram/sdk';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'DEEPGRAM_API_KEY not configured' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const audio = formData.get('audio') as Blob;

    if (!audio) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    const deepgram = createClient(apiKey);

    // Convert blob to buffer
    const audioBuffer = Buffer.from(await audio.arrayBuffer());

    // Transcribe with Flux model, speaker diarization, and medical terminology
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-2-medical', // Medical-specific model
        smart_format: true,
        diarize: true, // Enable speaker diarization
        punctuate: true,
        paragraphs: true,
        utterances: true,
      }
    );

    if (error) {
      console.error('Deepgram transcription error:', error);
      return NextResponse.json(
        { error: 'Transcription failed' },
        { status: 500 }
      );
    }

    // Extract transcript with speaker labels
    const transcript = result.results?.channels[0]?.alternatives[0]?.transcript || '';
    const words = result.results?.channels[0]?.alternatives[0]?.words || [];
    const paragraphs = result.results?.channels[0]?.alternatives[0]?.paragraphs;
    const utterances = result.results?.utterances || [];

    // Format with speaker labels
    let formattedTranscript = '';
    if (utterances && utterances.length > 0) {
      formattedTranscript = utterances
        .map((utterance) => `Speaker ${utterance.speaker}: ${utterance.transcript}`)
        .join('\n\n');
    } else {
      formattedTranscript = transcript;
    }

    return NextResponse.json({
      success: true,
      transcript: formattedTranscript,
      rawTranscript: transcript,
      metadata: {
        duration: result.metadata?.duration,
        speakers: utterances?.length > 0 ? Math.max(...utterances.map(u => u.speaker)) + 1 : 0,
        words: words.length,
      },
    });
  } catch (error) {
    console.error('Error in stream transcription:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
