"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Coffee, Power, AlertCircle, CheckCircle2, Loader2, Info, Calendar, Settings2, Timer } from "lucide-react"

interface CoffeeStepInfo {
  step: 'POWER_ON' | 'PRESS' | 'POWER_OFF';
  targetTime: string;
}

interface CoffeeMachineCardProps {
  onSchedule?: () => void;
  nextStep?: CoffeeStepInfo | null;
}

const STEP_STYLES: Record<CoffeeStepInfo['step'], { label: string; icon: string; box: string; icon_cls: string; text: string }> = {
  POWER_ON: {
    label: 'הדלקה בעוד', icon: '🔌',
    box: 'bg-emerald-500/10 border-emerald-500/30',
    icon_cls: 'text-emerald-400',
    text: 'text-emerald-300',
  },
  PRESS: {
    label: 'לחיצה בעוד', icon: '☕',
    box: 'bg-amber-500/10 border-amber-500/30',
    icon_cls: 'text-amber-400',
    text: 'text-amber-300',
  },
  POWER_OFF: {
    label: 'כיבוי בעוד', icon: '🛑',
    box: 'bg-rose-500/10 border-rose-500/30',
    icon_cls: 'text-rose-400',
    text: 'text-rose-300',
  },
}

function CoffeeStepTimer({ info }: { info: CoffeeStepInfo }) {
  const [timeLeft, setTimeLeft] = useState<string>('')

  useEffect(() => {
    const calc = () => {
      const diff = new Date(info.targetTime).getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft('עכשיו!')
        return
      }
      const total = Math.floor(diff / 1000)
      const h = Math.floor(total / 3600)
      const m = Math.floor((total % 3600) / 60)
      const s = total % 60
      setTimeLeft(`${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`)
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [info.targetTime])

  const cfg = STEP_STYLES[info.step]
  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border ${cfg.box}`}>
      <Timer className={`h-3.5 w-3.5 shrink-0 ${cfg.icon_cls}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold leading-none mb-0.5">{cfg.icon} {cfg.label}</p>
        <p className={`text-sm font-mono font-bold tabular-nums ${cfg.text}`}>{timeLeft}</p>
      </div>
    </div>
  )
}

export function CoffeeMachineCard({ onSchedule, nextStep }: CoffeeMachineCardProps) {
  const [isPowerLoading, setIsPowerLoading] = useState(false)
  const [isBrewLoading, setIsBrewLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [coffeeMode, setCoffeeMode] = useState<'full' | 'brew_only'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('coffeeMode') as 'full' | 'brew_only') || 'full';
    }
    return 'full';
  })

  const toggleCoffeeMode = () => {
    const next = coffeeMode === 'full' ? 'brew_only' : 'full';
    setCoffeeMode(next);
    localStorage.setItem('coffeeMode', next);
  }

  const handleAction = async (actionName: 'coffeeOn' | 'coffeePress') => {
    const isPower = actionName === 'coffeeOn';
    if (isPower) {
      setIsPowerLoading(true);
    } else {
      setIsBrewLoading(true);
    }
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionName,
          applianceId: '9103117a-3163-4aa6-a4fb-b0a50acf832a'
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        let cleanErr = data.error || 'הפעולה נכשלה';
        if (cleanErr.includes('expired') || cleanErr.includes('28841002')) {
          cleanErr = 'מנוי Tuya פג תוקף. יש להיכנס ל-iot.tuya.com ולהאריך את מנוי ה-IoT Core בחינם.';
        }
        throw new Error(cleanErr);
      }

      setSuccessMsg(isPower ? 'כפתור ההפעלה (Fingerbot) נלחץ בהצלחה!' : 'כפתור הכנת הקפה (SwitchBot) נלחץ בהצלחה!');
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'שגיאת תקשורת בביצוע הפעולה');
    } finally {
      if (isPower) {
        setIsPowerLoading(false);
      } else {
        setIsBrewLoading(false);
      }
    }
  };

  return (
    <Card className="glass-card border-0 overflow-hidden group hover:bg-white/10 transition-all duration-500 relative">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-amber-500/20 shadow-lg shadow-amber-500/10">
              <Coffee className="h-6 w-6 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-xl text-white truncate">מכונת קפה</h3>
              <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">Coffee Maker</p>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className="bg-amber-500/20 text-amber-300 border-0 px-3 py-1 rounded-full text-[10px] font-bold shrink-0"
          >
            ללא חיווי מצב
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-2 space-y-4">
        {/* Success Banner */}
        {successMsg && (
          <div className="py-2.5 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2.5 text-emerald-400 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
            <p className="font-medium">{successMsg}</p>
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div className="py-3 px-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex flex-col gap-1 text-rose-400 text-xs animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="font-bold">שגיאה בביצוע הפעולה</span>
            </div>
            <p className="mr-6 text-slate-300 leading-relaxed">{errorMsg}</p>
            {errorMsg.includes('Tuya') && (
              <div className="mt-2 p-2 bg-slate-950/40 rounded border border-white/5 flex gap-2 mr-6 text-[10px]" dir="rtl">
                <Info className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                <span className="text-slate-400 leading-normal text-right">
                  הוראות להארכה בחינם: כנס ל-<strong>iot.tuya.com</strong> &larr; Cloud &larr; Cloud Services &larr; <strong>IoT Core</strong> &larr; View Details &larr; <strong>Extend Trial Period</strong>.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Next step countdown */}
        {nextStep && (
          <CoffeeStepTimer info={nextStep} />
        )}

        {/* Brewing Animation Effect */}
        {isBrewLoading && (
          <div className="py-3 px-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center animate-pulse">
            <p className="text-amber-400 text-sm font-medium flex items-center justify-center gap-2">
              ☕ מכין קפה כעת...
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1 glass hover:bg-slate-800/80 border-white/5 text-slate-200"
            onClick={() => handleAction('coffeeOn')}
            disabled={isPowerLoading || isBrewLoading}
          >
            {isPowerLoading ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin text-slate-400" />
            ) : (
              <Power className="h-4 w-4 ml-2 text-emerald-400" />
            )}
            כפתור הפעלה
          </Button>

          <Button
            variant="default"
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/10"
            onClick={() => handleAction('coffeePress')}
            disabled={isPowerLoading || isBrewLoading}
          >
            {isBrewLoading ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Coffee className="h-4 w-4 ml-2" />
            )}
            הכנת קפה
          </Button>
        </div>

        {/* Schedule & Settings */}
        <div className="flex gap-3">
          <Button
            variant="secondary"
            className="flex-1 glass hover:bg-slate-800/80 border-white/5 text-slate-200"
            onClick={onSchedule}
          >
            <Calendar className="h-4 w-4 ml-2 text-indigo-400" />
            תזמון קפה
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 text-slate-400 hover:text-white"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Coffee Mode Toggle */}
        {showSettings && (
          <div className="bg-slate-950/40 rounded-xl p-3 border border-white/5 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="text-xs text-slate-400 font-medium">מצב תזמון קפה</div>
            <button
              onClick={toggleCoffeeMode}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            >
              <span className="text-sm text-white">
                {coffeeMode === 'full' ? '🔌 הדלקה + הכנה + כיבוי' : '☕ הכנת קפה בלבד'}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                coffeeMode === 'full'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/20 text-amber-400'
              }`}>
                {coffeeMode === 'full' ? 'מלא' : 'חלקי'}
              </span>
            </button>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              {coffeeMode === 'full'
                ? 'התזמון ידליק את המכונה, ימתין להתחממות, יכין קפה ויכבה אותה.'
                : 'התזמון רק ילחץ על כפתור הקפה. עליך להדליק את המכונה ידנית מראש.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
