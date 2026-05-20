"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Coffee, Power, AlertCircle, CheckCircle2, Loader2, Info } from "lucide-react"

export function CoffeeMachineCard() {
  const [isPowerLoading, setIsPowerLoading] = useState(false)
  const [isBrewLoading, setIsBrewLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

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
      </CardContent>
    </Card>
  )
}
