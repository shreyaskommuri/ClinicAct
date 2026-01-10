"use client";

import React from "react";
import { User, FileText, CheckCircle, Mail } from "lucide-react";
import { useSession } from "@/contexts/SessionContext";

const steps = [
  { number: 1, label: "Select Patient", icon: User },
  { number: 2, label: "Transcript", icon: FileText },
  { number: 3, label: "Actions", icon: CheckCircle },
  { number: 4, label: "After-care", icon: Mail },
];

export default function WorkflowStepper() {
  const { currentStep } = useSession();

  return (
    <div className="bg-white/60 backdrop-blur-sm border-b border-zinc-200/70 px-6 py-5">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.number;
            const isCompleted = currentStep > step.number;
            const isUpcoming = currentStep < step.number;

            return (
              <React.Fragment key={step.number}>
                {/* Step */}
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm transition-all shadow-sm ${
                      isActive
                        ? "bg-gradient-to-br from-[#7C2D3E] to-[#5A1F2D] text-white ring-4 ring-[#7C2D3E]/20"
                        : isCompleted
                        ? "bg-emerald-500 text-white"
                        : "bg-zinc-100 text-zinc-400 border border-zinc-200/70"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p
                      className={`text-xs font-medium ${
                        isActive ? "text-[#7C2D3E]" : isCompleted ? "text-emerald-600" : "text-zinc-400"
                      }`}
                    >
                      Step {step.number}
                    </p>
                    <p
                      className={`text-sm font-semibold ${
                        isActive ? "text-zinc-900" : isUpcoming ? "text-zinc-400" : "text-zinc-700"
                      }`}
                    >
                      {step.label}
                    </p>
                  </div>
                </div>

                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="flex-1 mx-4">
                    <div
                      className={`h-1 rounded-full transition-all ${
                        currentStep > step.number ? "bg-emerald-400" : "bg-zinc-200"
                      }`}
                    />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
