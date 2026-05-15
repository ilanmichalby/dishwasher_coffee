"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Coffee, Power, Droplets, Bean } from "lucide-react"

export function CoffeeMachineCard() {
  const [isOn, setIsOn] = useState(true)
  const [isBrewing, setIsBrewing] = useState(false)
  const waterLevel = 75
  const beanLevel = 60

  const handleBrew = () => {
    if (!isOn) return
    setIsBrewing(true)
    setTimeout(() => setIsBrewing(false), 3000)
  }

  return (
    <Card className="glass-card border-0 overflow-hidden group hover:bg-white/10 transition-all duration-500">
      <CardHeader className="p-5 pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-amber-500/20">
              <Coffee className="h-6 w-6 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-xl text-white truncate">מכונת קפה</h3>
              <p className="text-xs text-slate-400 font-semibold tracking-wide uppercase">Coffee Maker</p>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className={`${isOn 
              ? "bg-emerald-500/20 text-emerald-400" 
              : "bg-slate-800 text-slate-400"
            } border-0 px-3 py-1 rounded-full text-[10px] font-bold shrink-0`}
          >
            {isOn ? "פועל" : "כבוי"}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pt-2">
        {/* Status Indicators */}
        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-3">
            <Droplets className="h-4 w-4 text-sky" />
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300 font-medium">מפלס מים</span>
                <span className="font-bold text-white">{waterLevel}%</span>
              </div>
              <Progress value={waterLevel} className="h-1.5 bg-slate-800" />
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Bean className="h-4 w-4 text-amber-600" />
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-300 font-medium">פולי קפה</span>
                <span className="font-bold text-white">{beanLevel}%</span>
              </div>
              <Progress value={beanLevel} className="h-1.5 bg-slate-800" />
            </div>
          </div>
        </div>

        {isBrewing && (
          <div className="mb-4 py-3 px-4 rounded-xl bg-amber-500/10 text-center">
            <p className="text-amber-500 text-sm font-medium animate-pulse">☕ מכין קפה...</p>
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            variant={isOn ? "secondary" : "default"}
            className={`flex-1 ${isOn ? "glass hover:bg-accent/50" : "bg-emerald hover:bg-emerald/80 text-emerald-foreground"}`}
            onClick={() => setIsOn(!isOn)}
          >
            <Power className="h-4 w-4 ml-2" />
            {isOn ? "כיבוי" : "הפעלה"}
          </Button>
          <Button 
            variant="default"
            className="flex-1 bg-primary hover:bg-primary/80"
            onClick={handleBrew}
            disabled={!isOn || isBrewing}
          >
            <Coffee className="h-4 w-4 ml-2" />
            הכנת קפה
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
