"use client";

import { useState, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { useSession, PatientSelection } from "@/contexts/SessionContext";

// Real Medplum patient interface
interface MedplumPatient {
  patientId: string;
  patientFirstName: string | undefined;
  patientLastName: string | undefined;
  patientAddress?: string;
  preferredPharmacy?: string;
  generalPractitioner?: string;
  organizationAddress?: string;
}

export default function PatientSearchPanel() {
  const { patient, startSession, isLoading, error, clearError } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [allPatients, setAllPatients] = useState<MedplumPatient[]>([]);
  const [searchResults, setSearchResults] = useState<MedplumPatient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch all patients on component mount
  useEffect(() => {
    async function fetchPatients() {
      try {
        setIsSearching(true);
        const response = await fetch('/api/medplum/patients');
        
        if (!response.ok) {
          throw new Error('Failed to fetch patients from Medplum');
        }

        const data = await response.json();
        setAllPatients(data.patients ?? []);
        setFetchError(null);
      } catch (err) {
        console.error('Error fetching patients:', err);
        setFetchError(err instanceof Error ? err.message : 'Failed to load patients');
      } finally {
        setIsSearching(false);
      }
    }

    fetchPatients();
  }, []);

  // Debounced search through fetched patients
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      const query = searchQuery.toLowerCase();
      const results = allPatients.filter((p) => {
        const firstName = p.patientFirstName?.toLowerCase() || '';
        const lastName = p.patientLastName?.toLowerCase() || '';
        const fullName = `${firstName} ${lastName}`.trim();
        const patientId = p.patientId.toLowerCase();
        
        return fullName.includes(query) || 
               firstName.includes(query) || 
               lastName.includes(query) ||
               patientId.includes(query);
      });

      setSearchResults(results);
      setIsSearching(false);
      setHasSearched(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, allPatients]);

  const handleSelectPatient = async (patientId: string) => {
    clearError();
    const selectedPatient = allPatients.find((p) => p.patientId === patientId);
    const patientIndex = allPatients.findIndex((p) => p.patientId === patientId);
    
    // Hardcoded session IDs as requested
    // Patient 1 -> Session 3
    // Patient 2 -> Session 4
    // Patient 3 -> Session 6
    // Patient 4 -> Session 7
    const ASSIGNED_SESSIONS = [
      '209429578973190336673242710141917128963', // Session 3
      '316272209747326581157737075663692625433', // Session 4
      '189878368687884891206528465309407076433', // Session 6
      '179340005192510878551324680590964837821', // Session 7
    ];

    const heidiSessionId = patientIndex >= 0 && patientIndex < ASSIGNED_SESSIONS.length 
      ? ASSIGNED_SESSIONS[patientIndex] 
      : undefined;

    const selection: PatientSelection | undefined = selectedPatient
      ? {
          patientAddress: selectedPatient.patientAddress,
          preferredPharmacy: selectedPatient.preferredPharmacy,
          generalPractitioner: selectedPatient.generalPractitioner,
          organizationAddress: selectedPatient.organizationAddress,
          heidiSessionId,
        }
      : undefined;

    await startSession(patientId, selection);
  };

  return (
    <div className="bg-white border border-zinc-200/70 rounded-2xl shadow-sm p-6 flex flex-col min-h-[500px]">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-zinc-900 mb-1">Patient Search</h2>
        <p className="text-xs text-zinc-600">Find and select a patient from the EMR</p>
      </div>

      {/* Search Input */}
      <div className="mb-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search for a patient…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-zinc-200/70 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7C2D3E]/20 focus:border-[#7C2D3E]/30 transition-all placeholder:text-zinc-400"
          />
          {isSearching && (
            <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 animate-spin" />
          )}
        </div>
      </div>

      {/* Fetch Error */}
      {fetchError && (
        <div className="mb-4 bg-red-50 border border-red-200/50 rounded-xl p-3 text-sm text-red-900">
          {fetchError}
        </div>
      )}

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {!hasSearched && !isSearching && allPatients.length > 0 && (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <Search className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">Start typing to search</p>
              <p className="text-xs text-zinc-400 mt-1">
                {allPatients.length} patients loaded from Medplum
              </p>
            </div>
          </div>
        )}

        {hasSearched && searchResults.length === 0 && (
          <div className="flex items-center justify-center h-full text-center">
            <div>
              <Search className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
              <p className="text-sm font-medium text-zinc-500">No patients found</p>
              <p className="text-xs text-zinc-400 mt-1">
                Try a different search term
              </p>
            </div>
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((p) => {
              const fullName = `${p.patientFirstName || ''} ${p.patientLastName || ''}`.trim() || 'Unknown Patient';
              const isSelected = patient?.id === p.patientId;
              return (
                <button
                  key={p.patientId}
                  onClick={() => handleSelectPatient(p.patientId)}
                  disabled={isLoading.startSession}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSelected
                      ? "bg-[#F9F3EE] border-[#7C2D3E] shadow-sm"
                      : "bg-white border-zinc-200/70 hover:bg-[#F9F3EE]/50 hover:border-zinc-300"
                  }`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <h3 className="font-semibold text-sm text-zinc-900">
                      {fullName}
                    </h3>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-[#7C2D3E] flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-zinc-600">
                    <span className="font-mono text-xs">ID: {p.patientId.substring(0, 8)}...</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading.startSession && (
        <div className="mt-4 bg-blue-50/50 border border-blue-200/50 rounded-xl p-3 flex items-center gap-2.5">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <p className="text-sm text-blue-900">Starting session...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200/50 rounded-xl p-3 text-sm text-red-900">
          {error}
        </div>
      )}

      {/* Selected Patient Info */}
      {patient && (
        <div className="mt-4 pt-4 border-t border-zinc-200/70">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500">Selected Patient</p>
              <p className="text-sm font-semibold text-zinc-900 mt-0.5">
                {patient.name}
              </p>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
          </div>
        </div>
      )}
    </div>
  );
}
