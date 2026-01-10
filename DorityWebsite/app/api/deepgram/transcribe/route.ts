import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@deepgram/sdk';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

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

    // Transcribe with Nova-2-Medical or Flux model
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: 'nova-2-medical', // Use medical-optimized model
        smart_format: true,
        diarize: true, // Identify different speakers
        punctuate: true,
        paragraphs: true,
        utterances: true,
        filler_words: true,
        detect_language: true,
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
    const utterances = result.results?.utterances || [];

    // Format with speaker labels
    let formattedTranscript = '';
    if (utterances && utterances.length > 0) {
      formattedTranscript = utterances
        .map((utterance) => {
          const speaker = utterance.speaker === 0 ? 'Doctor' : 'Patient';
          return `${speaker}: ${utterance.transcript}`;
        })
        .join('\n\n');
    } else {
      formattedTranscript = transcript;
    }

    // Extract medical information using AI
    let medicalSummary = null;
    if (anthropicKey && formattedTranscript) {
      try {
        const anthropic = new Anthropic({ apiKey: anthropicKey });
        const message = await anthropic.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: `You are a medical AI assistant. Analyze this doctor-patient conversation and extract structured clinical information in JSON format:

Conversation:
${formattedTranscript}

Extract the following information (if present):
{
  "chiefComplaint": "main reason for visit",
  "symptoms": ["symptom1", "symptom2"],
  "vitalSigns": {"temperature": "", "bloodPressure": "", "heartRate": ""},
  "diagnoses": ["diagnosis1"],
  "medications": [{"name": "", "dosage": "", "frequency": ""}],
  "procedures": ["procedure1"],
  "labOrders": ["lab test 1"],
  "imagingOrders": ["imaging test 1"],
  "referrals": ["specialist referral"],
  "followUp": "follow-up instructions",
  "notes": "additional clinical notes"
}

Only include fields where information is clearly stated. Return valid JSON only.`,
            },
          ],
        });

        const content = message.content[0];
        if (content.type === 'text') {
          // Extract JSON from the response
          const jsonMatch = content.text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            medicalSummary = JSON.parse(jsonMatch[0]);
          }
        }
      } catch (aiError) {
        console.error('AI medical summary error:', aiError);
        // Continue without summary if AI fails
      }
    }

    return NextResponse.json({
      success: true,
      transcript: formattedTranscript,
      rawTranscript: transcript,
      medicalSummary,
      metadata: {
        duration: result.metadata?.duration,
        speakers: utterances?.length > 0 ? Math.max(...utterances.map(u => u.speaker)) + 1 : 0,
        words: result.results?.channels[0]?.alternatives[0]?.words?.length || 0,
        confidence: result.results?.channels[0]?.alternatives[0]?.confidence || 0,
      },
    });
  } catch (error) {
    console.error('Error in transcription:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
