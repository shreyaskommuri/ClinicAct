"use client";

import Sidebar from "@/components/Sidebar";
import TopNav from "@/components/TopNav";
import WorkflowStepper from "@/components/WorkflowStepper";
import PatientSearchPanel from "@/components/PatientSearchPanel";
import TranscriptInputPanel from "@/components/TranscriptInputPanel";
import ActionList from "@/components/ActionList";
import AftercarePanel from "@/components/AftercarePanel";
import { useSession } from "@/contexts/SessionContext";

function HomeContent() {
  const { currentStep, approvedActions, suggestedActions } = useSession();
  const allApproved = suggestedActions.length > 0 && suggestedActions.every((a) => a.status === "approved");

  return (
    <>
      {/* Sidebar - Fixed on the left */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation */}
        <TopNav />

        {/* Workflow Stepper */}
        <WorkflowStepper />

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 py-6 space-y-8">
            {/* Upper Section: Patient Search + Transcript */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Patient Search */}
              <PatientSearchPanel />

              {/* Right: Transcript Input */}
              <TranscriptInputPanel />
            </div>

            {/* Lower Section: Draft Clinical Actions */}
            {currentStep >= 3 && (
              <div>
                <div className="mb-6">
                  <h1 className="text-2xl font-semibold text-zinc-900 mb-2">
                    Draft Clinical Actions
                  </h1>
                  <p className="text-sm text-zinc-600">
                    AI-generated draft orders from the current consultation. Review and approve to send to Medplum EMR.
                  </p>
                </div>

                <ActionList />
              </div>
            )}

            {/* After-Care Section (shown when on step 4) */}
            {currentStep >= 4 && (
              <div>
                <AftercarePanel />
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}

export default function Home() {
  return <HomeContent />;
}
