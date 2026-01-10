"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import type { ClinicalAction } from "./ActionList";

interface Patient {
  id: string;
  name: string;
  mrn: string;
  dob: string;
  keyInfo: string;
  email?: string;
}

interface WorkflowContextType {
  currentStep: 1 | 2 | 3 | 4;
  setCurrentStep: (step: 1 | 2 | 3 | 4) => void;
  selectedPatient: Patient | null;
  setSelectedPatient: (patient: Patient | null) => void;
  transcript: string;
  setTranscript: (transcript: string) => void;
  actions: ClinicalAction[];
  setActions: (actions: ClinicalAction[]) => void;
  allApproved: boolean;
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;
  updateAction: (actionId: string, updates: Partial<ClinicalAction>) => void;
}

const WorkflowContext = createContext<WorkflowContextType | undefined>(undefined);

export function WorkflowProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [transcript, setTranscript] = useState("");
  const [actions, setActions] = useState<ClinicalAction[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const allApproved = actions.length > 0 && actions.every((action) => action.approved === true);

  const updateAction = (actionId: string, updates: Partial<ClinicalAction>) => {
    setActions((prev) =>
      prev.map((action) =>
        action.id === actionId ? { ...action, ...updates } : action
      )
    );
  };

  return (
    <WorkflowContext.Provider
      value={{
        currentStep,
        setCurrentStep,
        selectedPatient,
        setSelectedPatient,
        transcript,
        setTranscript,
        actions,
        setActions,
        allApproved,
        isGenerating,
        setIsGenerating,
        updateAction,
      }}
    >
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflow() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useWorkflow must be used within WorkflowProvider");
  }
  return context;
}

export type { Patient };
