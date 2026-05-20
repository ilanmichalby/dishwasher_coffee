"use client";

import { useState, useEffect, useRef } from "react";
import { Mic, Sparkles, Check, Trash2, Calendar, Clock, Loader2, AlertCircle, Info, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseText } from "@/lib/nlpParser";

interface VoiceCommandBarProps {
  onScheduleSuccess: () => void;
}

export function VoiceCommandBar({ onScheduleSuccess }: VoiceCommandBarProps) {
  const [textInput, setTextInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [parsedResult, setParsedResult] = useState<any>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const previousTranscriptRef = useRef("");
  const isRecordingStateRef = useRef(false); // Track record state strictly across callbacks
  const textInputRef = useRef("");
  const lastStartRef = useRef<number>(0);
  const consecutiveAbortsRef = useRef<number>(0);

  // Keep the ref updated with the latest textInput state
  useEffect(() => {
    textInputRef.current = textInput;
  }, [textInput]);

  // Initialize Speech Recognition
  useEffect(() => {
    let rec: any = null;
    
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = "he-IL";

        rec.onstart = () => {
          setIsRecording(true);
          isRecordingStateRef.current = true;
          setErrorMessage(null);
        };

        rec.onend = () => {
          // If the browser stopped due to silence, but we are still supposed to be recording, restart!
          if (isRecordingStateRef.current) {
            // Save current input value as the history prefix
            previousTranscriptRef.current = textInputRef.current ? textInputRef.current + " " : "";
            
            // Measure session duration to prevent rapid restart loops
            const sessionDuration = Date.now() - lastStartRef.current;
            let delay = 350; // Use a safer 350ms delay for Chrome resource release

            if (sessionDuration < 1500) {
              consecutiveAbortsRef.current += 1;
              if (consecutiveAbortsRef.current > 3) {
                console.warn("Too many consecutive speech recognition aborts. Stopping.");
                setErrorMessage("חיבור המיקרופון נקטע שוב ושוב. אנא בדוק אם יש דפדפן אחר שמשתמש במיקרופון או נסה להקליד.");
                stopRecording();
                return;
              }
              delay = 1000; // Backoff delay if restarted too fast
            } else {
              consecutiveAbortsRef.current = 0;
            }

            setTimeout(() => {
              if (isRecordingStateRef.current && recognitionRef.current) {
                try {
                  lastStartRef.current = Date.now();
                  recognitionRef.current.start();
                } catch (e) {
                  console.error("Failed to restart speech recognition:", e);
                }
              }
            }, delay);
          } else {
            setIsRecording(false);
          }
        };

        rec.onresult = (event: any) => {
          let sessionResult = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            sessionResult += event.results[i][0].transcript;
          }
          const fullText = (previousTranscriptRef.current + sessionResult).trim().replace(/\s+/g, " ");
          if (fullText) {
            setTextInput(fullText);
            handleParsing(fullText);
          }
        };

        rec.onerror = (event: any) => {
          // Only process and display errors if we are actually supposed to be recording
          if (isRecordingStateRef.current) {
            if (event.error !== "no-speech" && event.error !== "aborted") {
              console.error("Speech recognition error:", event.error);
              setErrorMessage("שגיאה בזיהוי דיבור: " + event.error);
              stopRecording();
            } else {
              console.warn("Speech recognition non-critical event:", event.error);
            }
          }
        };

        recognitionRef.current = rec;
      }
    }

    return () => {
      if (rec) {
        isRecordingStateRef.current = false;
        try {
          rec.abort();
        } catch (e) {}
      }
    };
  }, []);

  const startRecording = () => {
    if (!recognitionRef.current) {
      alert("זיהוי דיבור אינו נתמך בדפדפן זה. אנא הקלד את המשפט שלך.");
      return;
    }
    
    consecutiveAbortsRef.current = 0;
    lastStartRef.current = Date.now();
    previousTranscriptRef.current = "";
    setTextInput("");
    setParsedResult(null);
    setErrorMessage(null);
    
    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error("Failed to start speech recognition:", e);
    }
  };

  const stopRecording = () => {
    isRecordingStateRef.current = false;
    setIsRecording(false);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const getCoffeeMode = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('coffeeMode') || 'brew_only';
    }
    return 'brew_only';
  };

  const handleParsing = (text: string) => {
    if (!text.trim()) {
      setParsedResult(null);
      return;
    }
    const result = parseText(text, getCoffeeMode());
    setParsedResult(result);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTextInput(val);
    handleParsing(val);
  };

  const handleClear = () => {
    setTextInput("");
    setParsedResult(null);
    setErrorMessage(null);
    stopRecording();
  };

  const handleSchedule = async () => {
    if (!parsedResult || !parsedResult.device || !parsedResult.program || !parsedResult.date || !parsedResult.time) {
      return;
    }

    setIsScheduling(true);
    setErrorMessage(null);

    try {
      const scheduledTimeStr = `${parsedResult.date}T${parsedResult.time}:00`;
      const response = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduled_time: new Date(scheduledTimeStr).toISOString(),
          program_key: parsedResult.program.key,
          appliance_id: parsedResult.device.id,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "נכשל בתזמון");
      }

      // Success!
      handleClear();
      onScheduleSuccess();
    } catch (error: any) {
      setErrorMessage("שגיאה בתזמון המכשיר: " + error.message);
    } finally {
      setIsScheduling(false);
    }
  };

  // Pre-configured preset sentences for quick test
  const quickPresets = [
    "מדיח חלבי מחר ב-2 בלילה מהיר",
    "מדיח בשרי ביום ראשון בשמונה בערב חיסכון",
    "היום ב-16:00 אוטומטי",
    "קפה מחר בשש בבוקר",
  ];

  const applyPreset = (presetText: string) => {
    setTextInput(presetText);
    handleParsing(presetText);
  };

  return (
    <div className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl space-y-6 relative overflow-hidden transition-all duration-300 hover:border-white/15">
      {/* Background radial highlight */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
            תזמון חכם בקול ובטקסט
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            דבר בקולך או הקלד פקודה חופשית בעברית לתזמון מהיר. התחל ב&quot;קפה&quot; לתזמון מכונת קפה
          </p>
        </div>

        {/* Recording Visualizer Wave */}
        {isRecording && (
          <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-2xl animate-pulse">
            <div className="flex gap-1 h-4 items-center">
              <span className="w-1 bg-rose-500 rounded-full h-2 animate-bounce [animation-delay:0.1s]" />
              <span className="w-1 bg-rose-500 rounded-full h-4 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1 bg-rose-500 rounded-full h-3 animate-bounce [animation-delay:0.3s]" />
              <span className="w-1 bg-rose-500 rounded-full h-1 animate-bounce [animation-delay:0.4s]" />
            </div>
            <span className="text-xs font-semibold text-rose-400">מקשיב לך ברצף...</span>
          </div>
        )}
      </div>

      {/* Voice/Text Control Input */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Input
            value={textInput}
            onChange={handleInputChange}
            placeholder='נסה: "תקבע לי למחר בשתיים בלילה מדיח חלבי על תוכנית מהירה" או פשוט "מחר בשתיים"'
            className="w-full pr-4 pl-12 h-14 bg-slate-900/60 border-white/10 text-white placeholder-slate-500 focus:border-indigo-500 rounded-2xl text-base"
          />
          {textInput && (
            <button
              onClick={handleClear}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            >
              <Trash2 className="h-5 w-5" />
            </button>
          )}
        </div>

        <button
          onClick={toggleRecording}
          className={`h-14 w-14 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-lg ${
            isRecording
              ? "bg-rose-500 text-white shadow-rose-500/25 scale-105 animate-pulse"
              : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20 hover:scale-105"
          }`}
          title={isRecording ? "לחץ להפסקת הקלטה" : "לחץ להקלטה קולית"}
        >
          <Mic className={`h-6 w-6 ${isRecording ? "animate-pulse" : ""}`} />
        </button>
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <span className="text-xs text-slate-400 font-medium ml-2">הצעות מהירות:</span>
        {quickPresets.map((preset) => (
          <button
            key={preset}
            onClick={() => applyPreset(preset)}
            className="text-xs bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 px-3 py-1.5 rounded-xl text-slate-300 hover:text-white transition-all"
          >
            {preset}
          </button>
        ))}
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 flex gap-3 text-rose-400 text-sm">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{errorMessage}</p>
        </div>
      )}

      {/* Confirmation & Parsed Preview Card */}
      {parsedResult && (
        <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <span className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
              <Info className="h-4 w-4 text-indigo-400" />
              תצוגת תזמון מפענוח שפה
            </span>
            {parsedResult.device && parsedResult.program && parsedResult.date && parsedResult.time ? (
              <span className="text-xs font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-lg">
                מוכן לתזמון
              </span>
            ) : (
              <span className="text-xs font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2.5 py-1 rounded-lg">
                חסרים פרטים לשיבוץ
              </span>
            )}
          </div>

          {/* Value Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`p-3 rounded-xl border transition-all ${parsedResult.device ? "bg-white/5 border-emerald-500/20" : "bg-white/0 border-white/5"}`}>
              <div className="text-xs text-slate-400">מכשיר</div>
              <div className="text-sm font-bold text-white mt-1">
                {parsedResult.device ? parsedResult.device.name : "ממתין..."}
              </div>
            </div>

            <div className={`p-3 rounded-xl border transition-all ${parsedResult.program ? "bg-white/5 border-emerald-500/20" : "bg-white/0 border-white/5"}`}>
              <div className="text-xs text-slate-400">תוכנית</div>
              <div className="text-sm font-bold text-white mt-1">
                {parsedResult.program ? parsedResult.program.name : "ממתין..."}
              </div>
            </div>

            <div className={`p-3 rounded-xl border transition-all ${parsedResult.date ? "bg-white/5 border-emerald-500/20" : "bg-white/0 border-white/5"}`}>
              <div className="text-xs text-slate-400">תאריך</div>
              <div className="text-sm font-bold text-white mt-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                {parsedResult.date ? `${parsedResult.date.split("-").reverse().join(".")} (${parsedResult.dateStr || "מחושב"})` : "ממתין..."}
              </div>
            </div>

            <div className={`p-3 rounded-xl border transition-all ${parsedResult.time ? "bg-white/5 border-emerald-500/20" : "bg-white/0 border-white/5"}`}>
              <div className="text-xs text-slate-400">שעת הפעלה</div>
              <div className="text-sm font-bold text-white mt-1 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                {parsedResult.time ? parsedResult.time : "ממתין..."}
              </div>
            </div>
          </div>

          {/* Schedule Button */}
          {parsedResult.device && parsedResult.program && parsedResult.date && parsedResult.time && (
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSchedule}
                disabled={isScheduling}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-5 px-6 rounded-xl transition-all shadow-md flex items-center gap-2 hover:scale-[1.02]"
              >
                {isScheduling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : parsedResult?.isCoffee ? (
                  <Coffee className="h-4 w-4" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {parsedResult?.isCoffee ? 'אשר ותזמן קפה ☕' : 'אשר ותזמן מדיח'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
