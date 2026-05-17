"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Calendar, Settings2, Waves, Timer } from "lucide-react"
import type { Appliance } from "@/app/page"
import { useState, useEffect } from "react"

interface DishwasherCardProps {
  appliance: Appliance
  onSchedule: () => void
  onControl: () => void
  nextScheduledTime?: string | null
}

function CountdownTimer({ targetTime }: { targetTime: string }) {
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [isUrgent, setIsUrgent] = useState(false)

  useEffect(() => {
    const calculate = () => {
      const diff = new Date(targetTime).getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft('עכשיו!')
        setIsUrgent(true)
        return
      }
      const totalSeconds = Math.floor(diff / 1000)
      const days = Math.floor(totalSeconds / 86400)
      const hours = Math.floor((totalSeconds % 86400) / 3600)
      const minutes = Math.floor((totalSeconds % 3600) / 60)
      const seconds = totalSeconds % 60
      setIsUrgent(diff < 3600_000) // urgent when less than 1h
      if (days > 0) {
        setTimeLeft(`${days}י ${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`)
      } else {
        setTimeLeft(`${hours.toString().padStart(2,'0')}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`)
      }
    }
    calculate()
    const id = setInterval(calculate, 1000)
    return () => clearInterval(id)
  }, [targetTime])

  return (
    <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border ${
      isUrgent
        ? 'bg-amber-500/10 border-amber-500/30'
        : 'bg-indigo-500/10 border-indigo-500/20'
    }`}>
      <Timer className={`h-3.5 w-3.5 shrink-0 ${isUrgent ? 'text-amber-400' : 'text-indigo-400'}`} />
      <div className="min-w-0">
        <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold leading-none mb-0.5">הפעלה הבאה</p>
        <p className={`text-sm font-mono font-bold tabular-nums ${
          isUrgent ? 'text-amber-300' : 'text-indigo-300'
        }`}>{timeLeft}</p>
      </div>
    </div>
  )
}

const statusLabels: Record<string, { label: string; className: string }> = {
  running: { label: "פועל", className: "bg-emerald/20 text-emerald border-emerald/30" },
  ready: { label: "מוכן", className: "bg-sky/20 text-sky border-sky/30" },
  finished: { label: "הסתיים", className: "bg-muted text-muted-foreground border-muted" },
}

const typeLabels: Record<string, { label: string; className: string }> = {
  meaty: { label: "בשרי", className: "bg-rose/20 text-rose border-rose/30" },
  dairy: { label: "חלבי", className: "bg-sky/20 text-sky border-sky/30" },
}

export function DishwasherCard({ appliance, onSchedule, onControl, nextScheduledTime }: DishwasherCardProps) {
  const status = statusLabels[appliance.status]
  const type = typeLabels[appliance.type]

  return (
    <Card className="glass-card border-0 overflow-hidden group hover:bg-white/10 transition-all duration-500">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-2xl ${appliance.type === "meaty" ? "bg-rose-500/20" : "bg-sky-500/20"}`}>
              <Waves className={`h-6 w-6 ${appliance.type === "meaty" ? "text-rose-400" : "text-sky-400"}`} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-xl text-white truncate">{appliance.nameHe}</h3>
              <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">{appliance.name}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <Badge variant="outline" className={`${status.className} border-0 px-3 py-1 rounded-full text-[10px] font-bold`}>
              {status.label}
            </Badge>
            <Badge variant="outline" className={`${type.className} border-0 px-3 py-1 rounded-full text-[10px] font-bold`}>
              {type.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="pt-2">
        {appliance.status === "running" && appliance.progress !== undefined && (
          <div className="mb-4 space-y-3 bg-white/5 p-4 rounded-2xl border border-white/5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-300 font-medium">{appliance.program}</span>
              <span className="font-bold text-emerald">{appliance.remainingTime}</span>
            </div>
            <Progress value={appliance.progress} className="h-2 bg-slate-800" />
            <p className="text-[10px] text-slate-400 text-center font-bold uppercase tracking-wider">{appliance.progress}% הושלם</p>
          </div>
        )}
        
        {appliance.status === "ready" && (
          <div className="mb-4 py-2 text-center">
            <p className="text-muted-foreground text-sm">מוכן להפעלה</p>
          </div>
        )}
        
        {appliance.status === "finished" && (
          <div className="mb-4 py-2 text-center">
            <p className="text-emerald text-sm font-medium">✓ התוכנית הסתיימה בהצלחה</p>
          </div>
        )}

        {nextScheduledTime && appliance.status !== "running" && (
          <div className="mb-4">
            <CountdownTimer targetTime={nextScheduledTime} />
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            className="flex-1 glass hover:bg-accent/50"
            onClick={onSchedule}
          >
            <Calendar className="h-4 w-4 ml-2" />
            תזמון
          </Button>
          <Button 
            variant="secondary" 
            className="flex-1 glass hover:bg-accent/50"
            onClick={onControl}
          >
            <Settings2 className="h-4 w-4 ml-2" />
            שליטה
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
