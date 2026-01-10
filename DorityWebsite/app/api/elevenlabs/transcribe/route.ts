import { NextRequest, NextResponse } from 'next/server';

/**
 * Transcribe audio using Eleven Labs Speech-to-Text API
 * POST /api/elevenlabs/transcribe
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'ELEVENLABS_API_KEY not configured',
      }, { status: 500 });
    }

    // Get the audio file from the request
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json({
        success: false,
        error: 'No audio file provided',
      }, { status: 400 });
    }

    console.log(`🎤 Transcribing audio file: ${audioFile.name} (${audioFile.size} bytes)`);

    // Eleven Labs Speech-to-Text endpoint
    const elevenlabsUrl = 'https://api.elevenlabs.io/v1/speech-to-text';
    
    // Create form data for Eleven Labs
    const elevenlabsFormData = new FormData();
    elevenlabsFormData.append('audio', audioFile);
    
    // Optional: Add model parameter (e.g., 'eleven_multilingual_v2' for better accuracy)
    const model = formData.get('model') as string || 'eleven_multilingual_v2';
    elevenlabsFormData.append('model', model);

    const response = await fetch(elevenlabsUrl, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: elevenlabsFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Eleven Labs API error:', errorText);
      return NextResponse.json({
        success: false,
        error: `Eleven Labs API error: ${response.status} - ${errorText}`,
      }, { status: response.status });
    }

    const data = await response.json();
    
    // Eleven Labs returns: { text: "transcribed text here" }
    const transcript = data.text || data.transcript || '';
    
    console.log('✅ Transcription complete:', transcript.substring(0, 100) + '...');

    return NextResponse.json({
      success: true,
      transcript: transcript,
      metadata: {
        model: model,
        duration: audioFile.size,
        fileName: audioFile.name,
      },
    });

  } catch (error: any) {
    console.error('❌ Transcription error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error occurred',
    }, { status: 500 });
  }
}

/**
 * Health check endpoint
 * GET /api/elevenlabs/transcribe
 */
export async function GET(request: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  return NextResponse.json({
    status: 'ok',
    configured: !!apiKey,
    endpoint: '/api/elevenlabs/transcribe',
    method: 'POST',
    description: 'Upload audio file for transcription',
    usage: {
      contentType: 'multipart/form-data',
      fields: {
        audio: 'Audio file (mp3, wav, etc.)',
        model: 'Optional: Model to use (default: eleven_multilingual_v2)',
      },
    },
  });
}
