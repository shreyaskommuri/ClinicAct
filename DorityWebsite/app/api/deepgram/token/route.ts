import { NextRequest, NextResponse } from 'next/server';

/**
 * Get Deepgram API key for client-side real-time transcription
 * GET /api/deepgram/token
 * 
 * Note: In production, this should generate a temporary token with limited scope.
 * For development/demo purposes, we return the API key directly.
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({
        error: 'DEEPGRAM_API_KEY not configured in environment variables',
      }, { status: 500 });
    }

    // Return the API key (in production, generate a temporary token instead)
    return NextResponse.json({
      apiKey: apiKey,
    });

  } catch (error) {
    console.error('Error getting Deepgram API key:', error);
    return NextResponse.json({
      error: 'Failed to get Deepgram API key',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
