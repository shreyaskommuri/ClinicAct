import { NextRequest, NextResponse } from 'next/server';
import { getMedplumClient } from '@/lib/medplum-client';
import { extractPatientData } from '@/lib/patient-utils';
import { Patient } from '@medplum/fhirtypes';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const medplum = await getMedplumClient();

    // Read the Patient resource
    const patient = (await medplum.readResource('Patient', id)) as Patient;

    if (!patient) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }

    // Map to enhanced shape for the UI
    const mapped = extractPatientData(patient);

    // Optionally fetch related summary resources (conditions, medications)
    // Keep lightweight for the dashboard; these can be expanded later
    const conditions = await medplum.searchResources('Condition', { patient: id, _count: '10' });
    const medications = await medplum.searchResources('MedicationStatement', { patient: id, _count: '10' });

    return NextResponse.json({ patient: mapped, conditions, medications });
  } catch (error: any) {
    console.error('[medplum/patient] Error fetching patient', id, error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch patient' },
      { status: 500 }
    );
  }
}
