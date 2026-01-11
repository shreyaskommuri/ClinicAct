"use client";

import { useEffect, useState } from "react";

interface PatientContact {
  system?: string;
  value?: string;
}

interface Identifier {
  type?: string;
  value?: string;
}

interface EnhancedPatientData {
  id: string;
  fullName: string;
  dateOfBirth: string;
  age?: number;
  gender?: string;
  primaryPhone?: string;
  email?: string;
  address?: { full?: string };
  emergencyContacts?: Array<{ name?: string; phone?: string }>;
  mrn?: string;
  otherIdentifiers?: Identifier[];
}

export default function PatientDashboard({ patientId, open, onClose }: { patientId?: string | null; open: boolean; onClose: () => void }) {
  const [patient, setPatient] = useState<EnhancedPatientData | null>(null);
  const [conditions, setConditions] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !patientId) return;
    setLoading(true);
    setError(null);

    fetch(`/api/medplum/patient/${patientId}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || r.statusText);
        return r.json();
      })
      .then((data) => {
        setPatient(data.patient || null);
        setConditions(data.conditions || []);
        setMedications(data.medications || []);
      })
      .catch((e: any) => setError(e?.message || String(e)))
      .finally(() => setLoading(false));
  }, [open, patientId]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg w-11/12 md:w-3/4 lg:w-1/2 p-6 shadow-lg">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-semibold">Patient Dashboard</h3>
          <button onClick={onClose} className="text-sm text-zinc-600">Close</button>
        </div>

        {loading && <p>Loading patient…</p>}
        {error && <p className="text-red-600">Error: {error}</p>}

        {patient && (
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold text-zinc-900">Name</p>
                <p className="text-sm">{patient.fullName}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-900">DOB / Age</p>
                <p className="text-sm">{patient.dateOfBirth} {patient.age ? `• ${patient.age} yrs` : ''}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-900">Gender</p>
                <p className="text-sm">{patient.gender}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-900">Telecom</p>
                <div className="space-y-1">
                  {patient.primaryPhone && <p className="text-sm">Phone: {patient.primaryPhone}</p>}
                  {patient.mobilePhone && <p className="text-sm">Mobile: {patient.mobilePhone}</p>}
                  {patient.email && <p className="text-sm">Email: {patient.email}</p>}
                  {!patient.primaryPhone && !patient.mobilePhone && !patient.email && <p className="text-sm">No telecom info available</p>}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              <div>
                <p className="text-xs font-bold text-zinc-900">Address</p>
                <p className="text-sm">{patient.address?.full}</p>
              </div>

              {patient.mrn && (
                <div>
                  <p className="text-xs font-bold text-zinc-900">Medical Record Number (MRN)</p>
                  <p className="text-sm">{patient.mrn}</p>
                </div>
              )}

              {patient.otherIdentifiers && patient.otherIdentifiers.some((id: any) => id.type?.toLowerCase?.().includes('allerg')) && (
                <div>
                  <p className="text-xs font-bold text-zinc-900">Allergies</p>
                  <div className="space-y-1">
                    {patient.otherIdentifiers
                      .filter((id: any) => id.type?.toLowerCase?.().includes('allerg'))
                      .map((allergy: any, idx: number) => (
                        <p key={idx} className="text-sm">{allergy.value || 'Unknown Allergy'}</p>
                      ))}
                  </div>
                </div>
              )}

              {patient.otherIdentifiers && patient.otherIdentifiers.some((id: any) => id.type?.toLowerCase?.().includes('injur')) && (
                <div>
                  <p className="text-xs font-bold text-zinc-900">Injuries</p>
                  <div className="space-y-1">
                    {patient.otherIdentifiers
                      .filter((id: any) => id.type?.toLowerCase?.().includes('injur'))
                      .map((injury: any, idx: number) => (
                        <p key={idx} className="text-sm">{injury.value || 'No prior injuries'}</p>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
