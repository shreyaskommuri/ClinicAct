import { NextRequest, NextResponse } from "next/server";
import { getMedplumClient } from "@/lib/medplum-client";
import { Patient, Address, Coverage } from "@medplum/fhirtypes";
import { extractPatientData } from "@/lib/patient-utils";

const formatAddress = (address?: Address) => {
  if (!address) {
    return '';
  }

  return [
    address.line?.[0],
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ]
    .filter(Boolean)
    .join(', ');
};

const findPreferredPharmacy = (patient: Patient) => {
  const matchesPharmacy = (text?: string) =>
    !!text && text.toLowerCase().includes('pharm');

  const contact = patient.contact?.find((c) => {
    const relationshipMatches = c.relationship?.some((relationship) =>
      relationship.coding?.some(
        (coding) =>
          coding.code?.toLowerCase().includes('pharm') ||
          coding.display?.toLowerCase().includes('pharm')
      )
    );

    return (
      relationshipMatches ||
      matchesPharmacy(c.name?.text) ||
      matchesPharmacy(c.organization?.display)
    );
  });

  if (contact) {
    if (contact.organization?.display) {
      return contact.organization.display;
    }

    if (contact.name) {
      const nameParts = [
        contact.name.text,
        contact.name.given?.join(' '),
        contact.name.family,
      ]
        .filter(Boolean)
        .join(' ')
        .trim();

      if (nameParts) {
        return nameParts;
      }
    }
  }

  return patient.generalPractitioner?.[0]?.display || '';
};

interface PatientSelection {
  patientAddress?: string;
  preferredPharmacy?: string;
  generalPractitioner?: string;
  organizationAddress?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { patientId, patientSelection } = await request.json();

    if (!patientId) {
      return NextResponse.json(
        { error: "Patient ID is required" },
        { status: 400 }
      );
    }

    // Fetch real patient from Medplum with ALL fields
    const medplum = await getMedplumClient();
    const patient = await medplum.readResource("Patient", patientId);

    // Extract comprehensive patient data using utility
    const patientData = extractPatientData(patient);

    // Debug: Log patient structure to understand where insurance is stored
    console.log('[Session Start] Patient resource keys:', Object.keys(patient));
    if (patient.extension) {
      console.log('[Session Start] Patient extensions:', patient.extension.map(ext => ({ url: ext.url, hasValue: !!ext.valueString })));
    }
    if (patient.meta?.tag) {
      console.log('[Session Start] Patient meta tags:', patient.meta.tag.map(tag => ({ system: tag.system, code: tag.code, display: tag.display })));
    }

    // Extract pharmacy and GP from selection or FHIR data
    const patientAddress = patientData.address?.full || patientSelection?.patientAddress || "Not provided";
    const preferredPharmacy = findPreferredPharmacy(patient) || patientSelection?.preferredPharmacy || "Not specified";
    const generalPractitioner = patientSelection?.generalPractitioner || patient.generalPractitioner?.[0]?.display || "Not specified";
    const organizationAddress = patientSelection?.organizationAddress || "";

    // Fetch insurance from Coverage resource or generalPractitioner Organization
    let insurance = "Not specified";

    // First, check if generalPractitioner references an insurance company
    // (Some Medplum instances store insurance as an Organization in generalPractitioner)
    if (patient.generalPractitioner && patient.generalPractitioner.length > 0) {
      try {
        for (const gpRef of patient.generalPractitioner) {
          if (gpRef.reference) {
            const orgId = gpRef.reference.replace('Organization/', '');
            const org = await medplum.readResource('Organization', orgId);

            console.log('[Session Start] Checking generalPractitioner org:', {
              id: org.id,
              name: org.name,
              type: org.type?.[0]?.coding?.[0]?.display || org.type?.[0]?.text
            });

            // Check if this organization is an insurance company
            const isInsurance = org.type?.some(t =>
              t.text?.toLowerCase().includes('insurance') ||
              t.coding?.some(c => c.display?.toLowerCase().includes('insurance'))
            );

            if (isInsurance && org.name) {
              insurance = org.name;
              console.log('[Session Start] Found insurance in generalPractitioner:', insurance);
              break;
            }
          }
        }
      } catch (gpError) {
        console.error('[Session Start] Error checking generalPractitioner for insurance:', gpError);
      }
    }

    // If not found in generalPractitioner, try Coverage resource
    if (insurance === "Not specified") {
      try {
        console.log('[Session Start] Fetching Coverage resources for patient:', patientId);

        const allCoverages = await medplum.searchResources('Coverage', {
          patient: `Patient/${patientId}`
        });

        console.log('[Session Start] Found coverages:', allCoverages.length);

        if (allCoverages.length > 0) {
          const coverage = allCoverages[0];
          console.log('[Session Start] Using coverage:', {
            id: coverage.id,
            status: coverage.status,
            hasPayor: !!coverage.payor,
            payorDisplay: coverage.payor?.[0]?.display
          });

          // Try to get insurance name from various fields
          if (coverage.payor && coverage.payor.length > 0) {
            insurance = coverage.payor[0].display || "Insurance on file";
          } else if (coverage.type?.text) {
            insurance = coverage.type.text;
          } else if (coverage.type?.coding?.[0]?.display) {
            insurance = coverage.type.coding[0].display;
          } else {
            insurance = "Insurance on file";
          }

          console.log('[Session Start] Extracted insurance from Coverage:', insurance);
        }
      } catch (coverageError) {
        console.error('[Session Start] Error fetching coverage:', coverageError);
      }
    }

    const heidiSessionId = patientSelection?.heidiSessionId;

    console.log('[Session Start] Extracted patient data:', {
      id: patientData.id,
      name: patientData.fullName,
      hasPhone: !!patientData.primaryPhone,
      hasEmail: !!patientData.email,
      hasAddress: !!patientData.address,
      emergencyContacts: patientData.emergencyContacts.length,
      insurance: insurance
    });

    // Build patient summary for session context
    const patientSummary = {
      id: patientData.id,
      name: patientData.fullName,
      mrn: patientData.mrn,
      dob: patientData.dateOfBirth,
      keyProblems: "Loading from medical history...",
      currentMeds: "Loading from medication list...",
      allergies: [] as string[],
      preferredPharmacy,
      address: patientAddress,
      generalPractitioner,
      organizationAddress,
      heidiSessionId,
      insurance, // Use extracted insurance
      // Include additional fields for questionnaire autofill
      gender: patientData.gender,
      age: patientData.age,
      phone: patientData.primaryPhone || patientData.mobilePhone,
      email: patientData.email,
      emergencyContactName: patientData.emergencyContacts[0]?.name,
      emergencyContactPhone: patientData.emergencyContacts[0]?.phone,
    };

    // Build detailed history summary
    const historySummary = [
      `Patient: ${patientData.fullName}`,
      patientData.age ? `Age: ${patientData.age} years` : '',
      `Date of Birth: ${patientData.dateOfBirth}`,
      `MRN: ${patientData.mrn}`,
      patientData.gender ? `Gender: ${patientData.gender}` : '',
      patientData.maritalStatus ? `Marital Status: ${patientData.maritalStatus}` : '',
      '',
      patientData.primaryPhone ? `Phone: ${patientData.primaryPhone}` : '',
      patientData.email ? `Email: ${patientData.email}` : '',
      patientData.address ? `Address: ${patientData.address.full}` : '',
      '',
      patientData.emergencyContacts.length > 0 ? `Emergency Contact: ${patientData.emergencyContacts[0].name}${patientData.emergencyContacts[0].phone ? ` (${patientData.emergencyContacts[0].phone})` : ''}` : '',
      '',
      'Note: Full medical history available in EMR'
    ].filter(Boolean).join('\n');

    return NextResponse.json({
      sessionId: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      patient: patientSummary,
      patientData: patientData, // Full patient data for questionnaire autofill
      historySummary,
    });
  } catch (error) {
    console.error("[Session Start] Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to start session",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
