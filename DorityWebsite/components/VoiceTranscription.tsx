"use client";

import { useState, useRef } from "react";
import { Mic, MicOff, Upload, Loader2, AlertCircle, Check, FileText, Pill, Activity } from "lucide-react";

interface MedicalSummary {
  chiefComplaint?: string;
  symptoms?: string[];
  vitalSigns?: Record<string, string>;
  diagnoses?: string[];
  medications?: Array<{ name: string; dosage: string; frequency: string }>;
  procedures?: string[];
  labOrders?: string[];
  imagingOrders?: string[];
  referrals?: string[];
  followUp?: string;
  notes?: string;
}

interface VoiceTranscriptionProps {
  onTranscriptFetched: (transcript: string, metadata?: any) => void;
  disabled?: boolean;
  patientName?: string;
  patientId?: string;
}

export default function VoiceTranscription({ onTranscriptFetched, disabled, patientName, patientId }: VoiceTranscriptionProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [medicalSummary, setMedicalSummary] = useState<MedicalSummary | null>(null);
  const [showSummary, setShowSummary] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm',
      });
      
      chunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        await transcribeAudio(audioBlob);
      };
      
      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (err) {
      console.error('Error starting recording:', err);
      setError('Failed to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setError(null);
    await transcribeAudio(file);
  };

  const transcribeAudio = async (audioBlob: Blob | File) => {
    setIsTranscribing(true);
    setSuccess(false);
    setMedicalSummary(null);
    
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      // Add patient information for intelligent speaker labeling
      if (patientName) formData.append('patientName', patientName);
      if (patientId) formData.append('patientId', patientId);
      
      // Use Deepgram API with medical AI summary
      const response = await fetch('/api/deepgram/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Transcription failed');
      }

      const data = await response.json();
      
      if (data.success && data.transcript) {
        onTranscriptFetched(data.transcript, data.metadata);
        
        // Store medical summary if available
        if (data.medicalSummary) {
          setMedicalSummary(data.medicalSummary);
          setShowSummary(true);
        }
        
        setSuccess(true);
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccess(false), 5000);
      } else {
        throw new Error('No transcript received');
      }
      
    } catch (err) {
      console.error('Transcription error:', err);
      setError(err instanceof Error ? err.message : 'Failed to transcribe audio');
    } finally {
      setIsTranscribing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-3">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-900">Error</p>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Success Display */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
          <Check className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-900">Success</p>
            <p className="text-xs text-green-700 mt-0.5">
              Transcript loaded with speaker identification
              {medicalSummary && ' • Medical summary extracted'}
            </p>
          </div>
        </div>
      )}

      {/* Medical Summary Display */}
      {medicalSummary && showSummary && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-blue-900 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              AI Medical Summary
            </h3>
            <button
              onClick={() => setShowSummary(false)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Hide
            </button>
          </div>

          <div className="space-y-2 text-xs">
            {medicalSummary.chiefComplaint && (
              <div>
                <span className="font-medium text-blue-900">Chief Complaint:</span>
                <p className="text-blue-700 mt-0.5">{medicalSummary.chiefComplaint}</p>
              </div>
            )}

            {medicalSummary.symptoms && medicalSummary.symptoms.length > 0 && (
              <div>
                <span className="font-medium text-blue-900">Symptoms:</span>
                <ul className="text-blue-700 mt-0.5 ml-4 list-disc">
                  {medicalSummary.symptoms.map((symptom, i) => (
                    <li key={i}>{symptom}</li>
                  ))}
                </ul>
              </div>
            )}

            {medicalSummary.medications && medicalSummary.medications.length > 0 && (
              <div>
                <span className="font-medium text-blue-900 flex items-center gap-1">
                  <Pill className="w-3 h-3" />
                  Medications:
                </span>
                <ul className="text-blue-700 mt-0.5 ml-4 list-disc">
                  {medicalSummary.medications.map((med, i) => (
                    <li key={i}>
                      {med.name} {med.dosage && `- ${med.dosage}`} {med.frequency && `(${med.frequency})`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {medicalSummary.labOrders && medicalSummary.labOrders.length > 0 && (
              <div>
                <span className="font-medium text-blue-900">Lab Orders:</span>
                <ul className="text-blue-700 mt-0.5 ml-4 list-disc">
                  {medicalSummary.labOrders.map((lab, i) => (
                    <li key={i}>{lab}</li>
                  ))}
                </ul>
              </div>
            )}

            {medicalSummary.followUp && (
              <div>
                <span className="font-medium text-blue-900">Follow-up:</span>
                <p className="text-blue-700 mt-0.5">{medicalSummary.followUp}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recording Controls */}
      <div className="flex gap-2">
        {!isRecording ? (
          <>
            <button
              onClick={startRecording}
              disabled={disabled || isTranscribing}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#7C2D3E] text-white rounded-lg hover:bg-[#6B2635] transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <Mic className="w-4 h-4" />
              Start Recording
            </button>
            
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isTranscribing}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </>
        ) : (
          <button
            onClick={stopRecording}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium animate-pulse"
          >
            <MicOff className="w-4 h-4" />
            Stop Recording ({formatTime(recordingTime)})
          </button>
        )}
      </div>

      {/* Transcribing Status */}
      {isTranscribing && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm text-purple-900">
            <Loader2 className="w-4 h-4 animate-spin" />
            <div>
              <p className="font-medium">Processing with Deepgram Flux...</p>
              <p className="text-xs text-purple-700 mt-0.5">
                Transcribing audio, identifying speakers, and extracting medical information
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
