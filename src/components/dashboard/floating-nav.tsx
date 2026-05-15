"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Home, Calendar, Activity, Settings, Plus } from "lucide-react"

const navItems = [
  { icon: Home, label: "בית", active: true },
  { icon: Calendar, label: "תזמונים", active: false },
  { icon: Activity, label: "פעילות", active: false },
  { icon: Settings, label: "הגדרות", active: false },
]

export function FloatingNav() {
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 px-3 pb-6 pt-2 sm:hidden flex justify-center">
      <div className="max-w-md w-full">
        <div className="rounded-2xl p-1.5 flex items-center justify-between gap-1 shadow-2xl shadow-black/50 bg-slate-900/80 backdrop-blur-2xl border border-white/10">
          {navItems.map((item, index) => (
            <Button
              key={item.label}
              variant="ghost"
              size="sm"
              className={`flex-col gap-0.5 h-12 min-w-0 flex-1 rounded-xl transition-all duration-300 px-1 ${
                activeIndex === index
                  ? "bg-indigo-500/20 text-indigo-400"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
              onClick={() => setActiveIndex(index)}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="text-[9px] font-medium truncate">{item.label}</span>
            </Button>
          ))}
          
          {/* Quick Add Button */}
          <Button
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/30 text-white"
          >
            <Plus className="h-5 w-5" />
            <span className="sr-only">הוסף</span>
          </Button>
        </div>
      </div>
    </nav>
  )
}
