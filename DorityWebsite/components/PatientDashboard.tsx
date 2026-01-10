"use client";

import { useEffect, useState } from "react";

interface PatientContact {
  system?: string;
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
}

export default function PatientDashboard({ patientId, open, onClose }: { patientId?: string | null; open: boolean; onClose: () => void }) {
  const [patient, setPatient] = useState<EnhancedPatientData | null>(null);
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
          <div className="space-y-3">
            <div>
              <p className="text-xs text-zinc-500">Name</p>
              <p className="font-semibold">{patient.fullName}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-zinc-500">DOB / Age</p>
                <p>{patient.dateOfBirth} {patient.age ? `• ${patient.age} yrs` : ''}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500">Gender</p>
                <p>{patient.gender}</p>
              </div>
            </div>

            <div>
              <p className="text-xs text-zinc-500">Contact</p>
              <p>{patient.primaryPhone} {patient.email ? `• ${patient.email}` : ''}</p>
            </div>

            <div>
              <p className="text-xs text-zinc-500">Address</p>
              <p>{patient.address?.full}</p>
            </div>

            <div>
              <p className="text-xs text-zinc-500">Emergency Contact</p>
              <p>{patient.emergencyContacts?.[0]?.name} {patient.emergencyContacts?.[0]?.phone ? `• ${patient.emergencyContacts?.[0]?.phone}` : ''}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
