import { NextRequest, NextResponse } from 'next/server';
import { getMedplumClient } from '@/lib/medplum-client';
import { Questionnaire } from '@medplum/fhirtypes';

export async function GET(request: NextRequest) {
  try {
    console.log('[Questionnaires] Fetching available questionnaires from Medplum...');
    
    const medplum = await getMedplumClient();
    
    // Fetch all questionnaires from Medplum
    const questionnaires = await medplum.searchResources('Questionnaire', {
      _count: '100',
      status: 'active',
    });

    console.log(`[Questionnaires] Found ${questionnaires.length} questionnaires`);

    // Map to simpler format for the AI
    const mappedQuestionnaires = questionnaires.map((q: Questionnaire) => ({
      id: q.id,
      name: q.name || q.title || 'Unnamed Questionnaire',
      title: q.title,
      description: q.description,
      code: q.code?.[0]?.code,
      type: categorizeQuestionnaire(q),
    }));

    return NextResponse.json({
      questionnaires: mappedQuestionnaires,
    });

  } catch (error) {
    console.error('[Questionnaires] Error fetching questionnaires:', error);
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch questionnaires',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// Categorize questionnaire based on name/title/code
function categorizeQuestionnaire(q: Questionnaire): string {
  const searchText = `${q.name || ''} ${q.title || ''} ${q.description || ''}`.toLowerCase();
  
  if (searchText.includes('medication') || searchText.includes('prescription') || searchText.includes('rx')) {
    return 'medication';
  }
  if (searchText.includes('lab') || searchText.includes('blood') || searchText.includes('test')) {
    return 'lab';
  }
  if (searchText.includes('imaging') || searchText.includes('xray') || searchText.includes('x-ray') || 
      searchText.includes('mri') || searchText.includes('ct') || searchText.includes('scan')) {
    return 'imaging';
  }
  if (searchText.includes('referral') || searchText.includes('consult')) {
    return 'referral';
  }
  if (searchText.includes('followup') || searchText.includes('follow-up') || searchText.includes('follow up')) {
    return 'followup';
  }
  if (searchText.includes('phq') || searchText.includes('health questionnaire')) {
    return 'assessment';
  }
  
  return 'other';
}
