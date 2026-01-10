"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, AlertCircle } from "lucide-react";
import { createClient } from "@deepgram/sdk";
import type { LiveClient } from "@deepgram/sdk";

interface AIScribeProps {
  onTranscriptUpdate: (transcript: string) => void;
  disabled?: boolean;
}

export default function AIScribe({ onTranscriptUpdate, disabled }: AIScribeProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const deepgramClientRef = useRef<LiveClient | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const connectionIdRef = useRef<string | null>(null);
  const transcriptBufferRef = useRef<string>("");

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopRecording();
    };
  }, []);

  const startRecording = async () => {
    try {
      setError(null);
      setIsConnecting(true);

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      
      mediaStreamRef.current = stream;

      // Get Deepgram API key from our backend
      const tokenResponse = await fetch("/api/deepgram/token");
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(errorData.error || "Failed to get Deepgram API key");
      }

      const { apiKey } = await tokenResponse.json();
      if (!apiKey) {
        throw new Error("No API key received from server");
      }

      // Create Deepgram client
      const deepgram = createClient(apiKey);

      // Check if listen.live exists
      if (!deepgram.listen || !deepgram.listen.live) {
        throw new Error("Deepgram listen.live API not available. Check SDK version.");
      }

      // Create live connection for real-time transcription
      let connection;
      try {
        connection = deepgram.listen.live({
          model: "nova-2",
          language: "en-US",
          smart_format: true,
          interim_results: true,
          punctuate: true,
          diarize: false,
        });
      } catch (connError: any) {
        throw new Error(`Failed to create Deepgram connection: ${connError.message || connError}`);
      }

      deepgramClientRef.current = connection;

      // Debug: Log connection object structure
      console.log("🔍 Connection object:", connection);
      const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(connection));
      console.log("🔍 Connection methods:", methods);
      
      // Set up audio processing
      const audioContext = new AudioContext({ sampleRate: 16000 });
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);

      // Store audio processing references
      (connection as any).audioContext = audioContext;
      (connection as any).processor = processor;
      (connection as any).source = source;

      let audioChunksSent = 0;

      // Process transcription result (helper function)
      const processTranscript = (data: any, eventName: string) => {
        console.log(`📝 [${eventName}] Received data:`, data);
        try {
          // Try different data structures that Deepgram might use
          const transcript = 
            data?.channel?.alternatives?.[0]?.transcript ||
            data?.alternatives?.[0]?.transcript ||
            data?.transcript ||
            data?.result?.channel?.alternatives?.[0]?.transcript ||
            data?.result?.alternatives?.[0]?.transcript;

          const isFinal = data?.is_final ?? data?.isFinal ?? data?.result?.is_final ?? false;

          if (transcript && transcript.trim()) {
            console.log(`✅ Found transcript: "${transcript}" (is_final: ${isFinal})`);
            if (isFinal) {
              transcriptBufferRef.current = transcriptBufferRef.current + transcript + " ";
              onTranscriptUpdate(transcriptBufferRef.current.trim());
            } else {
              const interimText = transcriptBufferRef.current + transcript;
              onTranscriptUpdate(interimText.trim());
            }
          } else {
            console.log("No transcript found in data structure");
          }
        } catch (err) {
          console.error("Error processing transcript:", err);
        }
      };

      // Handle connection events - USE addListener instead of .on()
      connection.addListener("Open", () => {
        console.log("✅ Deepgram connection opened, readyState:", connection.getReadyState());
        setIsConnecting(false);
        setIsRecording(true);
        transcriptBufferRef.current = "";

        // Set up audio processing - send ALL chunks to keep connection alive
        processor.onaudioprocess = (event) => {
          try {
            const readyState = connection.getReadyState();
            if (readyState === 1) { // OPEN
              const inputData = event.inputBuffer.getChannelData(0);
              
              // Convert Float32Array to Int16Array for Deepgram (PCM 16-bit)
              const int16Data = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
              }
              
              // Send audio data to Deepgram - send all chunks including silence to keep connection alive
              try {
                connection.send(int16Data.buffer);
                audioChunksSent++;
                if (audioChunksSent === 1 || audioChunksSent % 50 === 0) {
                  console.log(`📤 Sent ${audioChunksSent} audio chunks to Deepgram`);
                }
              } catch (sendErr: any) {
                console.error("Error calling connection.send:", sendErr);
              }
            } else if (readyState !== 0) { // Not CONNECTING
              console.warn("⚠️ Connection not open, readyState:", readyState);
            }
          } catch (err: any) {
            console.error("Error processing audio:", err);
          }
        };

        // Connect audio processing chain
        source.connect(processor);
        processor.connect(audioContext.destination);
        console.log("🎤 Audio processing connected and started");
      });

      connection.addListener("Error", (error: any) => {
        console.error("❌ Deepgram error event fired:", error);
        console.error("Error details:", {
          message: error?.message,
          type: error?.type,
          error: error,
          stringified: JSON.stringify(error, null, 2)
        });
        const errorMessage = error?.message || error?.type || error?.error || (typeof error === 'string' ? error : JSON.stringify(error)) || "Unknown error";
        setError(`Transcription error: ${errorMessage}`);
        setIsConnecting(false);
        setIsRecording(false);
        stopRecording();
      });

      connection.addListener("Close", (event: any) => {
        console.log("🔒 Deepgram connection closed", event);
        console.log("Connection closed reason:", event?.reason || event?.code || "Unknown");
        setIsRecording(false);
      });

      // Listen for transcripts - try multiple event names
      const eventNames = ["Transcript", "Results", "transcript", "results", "result", "data", "message"];
      eventNames.forEach(eventName => {
        try {
          connection.addListener(eventName, (data: any) => {
            console.log(`🎯 Event "${eventName}" fired:`, data);
            processTranscript(data, eventName);
          });
        } catch (e) {
          console.log(`Failed to register listener for "${eventName}":`, e);
        }
      });

      connection.addListener("Metadata", (data: any) => {
        console.log("📊 Metadata:", data);
        connectionIdRef.current = data.request_id || data?.request_id || null;
      });

    } catch (err) {
      console.error("Error starting recording:", err);
      setError(err instanceof Error ? err.message : "Failed to start recording");
      setIsConnecting(false);
      setIsRecording(false);
      
      // Clean up on error
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
    }
  };

  const stopRecording = () => {
    // Close Deepgram connection first
    if (deepgramClientRef.current) {
      const connection = deepgramClientRef.current;
      
      // Clean up audio processing
      const audioContext = (connection as any).audioContext;
      const processor = (connection as any).processor;
      const source = (connection as any).source;
      
      if (processor) {
        processor.disconnect();
      }
      if (source) {
        source.disconnect();
      }
      if (audioContext) {
        audioContext.close().catch(console.error);
      }
      
      if (connection.getReadyState() === 1) {
        connection.finish();
      }
      deepgramClientRef.current = null;
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    setIsRecording(false);
    setIsConnecting(false);
    connectionIdRef.current = null;
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <div className="space-y-3">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">Error</p>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Recording Controls */}
      <div className="flex flex-col gap-2">
        <button
          onClick={handleToggleRecording}
          disabled={disabled || isConnecting}
          className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors text-sm font-medium ${
            isRecording
              ? "bg-red-600 text-white hover:bg-red-700 animate-pulse"
              : "bg-[#7C2D3E] text-white hover:bg-[#6B2635]"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isConnecting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Connecting...
            </>
          ) : isRecording ? (
            <>
              <MicOff className="w-4 h-4" />
              Stop Recording
            </>
          ) : (
            <>
              <Mic className="w-4 h-4" />
              Enable Microphone & Start
            </>
          )}
        </button>

        {isRecording && (
          <div className="flex items-center gap-2 text-xs text-zinc-600 px-1">
            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
            <span>Recording... Speech is being transcribed in real-time</span>
          </div>
        )}

        {!isRecording && !error && (
          <p className="text-xs text-zinc-500 px-1">
            Click to enable microphone and start real-time transcription. Your speech will appear in the text box below.
          </p>
        )}
      </div>
    </div>
  );
}