"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Settings, Bell, Printer } from "lucide-react"

export function DashboardHeader() {
  const [currentTime, setCurrentTime] = useState<Date | null>(null)

  useEffect(() => {
    setCurrentTime(new Date())
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handlePrint = () => {
    window.print()
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("he-IL", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tighter">
          שלום, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-sky-400">משפחת כהן</span>
        </h1>
        {currentTime && (
          <p className="text-slate-400 font-medium mt-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {formatDate(currentTime)} • {formatTime(currentTime)}
          </p>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        <Button 
          variant="secondary" 
          className="glass-card hover:bg-white/10 transition-colors hidden sm:flex items-center gap-2 px-4"
          onClick={handlePrint}
        >
          <Printer className="h-5 w-5" />
          <span>הדפס לוח זמנים</span>
        </Button>
        <Button 
          variant="secondary" 
          size="icon" 
          className="glass-card hover:bg-white/10 transition-colors"
        >
          <Bell className="h-5 w-5" />
          <span className="sr-only">התראות</span>
        </Button>
        <Button 
          variant="secondary" 
          size="icon"
          className="glass-card hover:bg-white/10 transition-colors"
        >
          <Settings className="h-5 w-5" />
          <span className="sr-only">הגדרות</span>
        </Button>
      </div>
    </header>
  )
}
