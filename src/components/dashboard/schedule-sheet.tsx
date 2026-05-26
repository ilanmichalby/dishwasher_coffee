"use client"

import { useState, useEffect } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Calendar, Clock, Sparkles, Coffee } from "lucide-react"
import type { Appliance, ScheduledTask } from "@/app/page"

const COFFEE_MACHINE_ID = '9103117a-3163-4aa6-a4fb-b0a50acf832a';

interface ScheduleSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appliance: Appliance | null
  onAddSchedule: (schedule: Omit<ScheduledTask, "id">) => void
  editingSchedule?: ScheduledTask | null
  onUpdateSchedule?: (id: string, schedule: Omit<ScheduledTask, "id">) => void
}

const programs = [
  { value: "Dishcare.Dishwasher.Program.Eco50", label: "Eco 50°C", labelHe: "חיסכון" },
  { value: "Dishcare.Dishwasher.Program.Auto2", label: "Auto 45-65°C", labelHe: "אוטומטי" },
  { value: "Dishcare.Dishwasher.Program.Intensiv70", label: "Intensive 70°C", labelHe: "אינטנסיבי" },
  { value: "Dishcare.Dishwasher.Program.Quick65", label: "Quick 1h (65°C)", labelHe: "מהיר (שעה)" },
  { value: "Dishcare.Dishwasher.Program.PreRinse", label: "Pre-Rinse", labelHe: "שטיפה מוקדמת" },
  { value: "Dishcare.Dishwasher.Program.MachineCare", label: "Machine Care", labelHe: "ניקוי מכונה" },
]

const presets = [
  { label: "ערב שבת", time: "15:00", icon: "🕯️" },
  { label: "מוצאי שבת", time: "21:00", icon: "✨" },
  { label: "בוקר יום חול", time: "07:00", icon: "☀️" },
]

export function ScheduleSheet({ open, onOpenChange, appliance, onAddSchedule, editingSchedule, onUpdateSchedule }: ScheduleSheetProps) {
  const isCoffee = appliance?.haId === COFFEE_MACHINE_ID;

  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [program, setProgram] = useState("Dishcare.Dishwasher.Program.Quick65")
  const [coffeeMode, setCoffeeMode] = useState<'full' | 'brew_only'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('coffeeMode') as 'full' | 'brew_only') || 'full';
    }
    return 'full';
  })

  useEffect(() => {
    if (editingSchedule) {
      if (editingSchedule.rawDate) {
        setDate(editingSchedule.rawDate.split('T')[0]);
        const d = new Date(editingSchedule.rawDate);
        setTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`);
      }
      if (editingSchedule.program_key?.startsWith('coffee.')) {
        setCoffeeMode(editingSchedule.program_key === 'coffee.brew_only' ? 'brew_only' : 'full');
      } else {
        setProgram(editingSchedule.program_key || "");
      }
    } else {
      setDate("");
      setTime("");
      setProgram("Dishcare.Dishwasher.Program.Quick65");
      if (typeof window !== 'undefined') {
        setCoffeeMode((localStorage.getItem('coffeeMode') as 'full' | 'brew_only') || 'full');
      }
    }
  }, [editingSchedule, open]);

  const handleSubmit = () => {
    if (!appliance || !date || !time) return
    if (!isCoffee && !program) return

    const actualProgram = isCoffee
      ? (coffeeMode === 'brew_only' ? 'coffee.brew_only' : 'coffee.full')
      : program;

    const scheduleData = {
      applianceId: appliance.haId,
      applianceName: appliance.nameHe,
      date,
      time,
      program: actualProgram,
      isShabbat: time === "15:00" || time === "21:00",
    };

    if (isCoffee) {
      localStorage.setItem('coffeeMode', coffeeMode);
    }

    if (editingSchedule && onUpdateSchedule) {
      onUpdateSchedule(editingSchedule.id, scheduleData);
    } else {
      onAddSchedule(scheduleData);
    }

    setDate("")
    setTime("")
    setProgram("Dishcare.Dishwasher.Program.Quick65")
  }

  const applyPreset = (preset: typeof presets[0]) => {
    setTime(preset.time)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="dark bg-slate-900/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl h-[85vh] sm:h-auto sm:max-h-[85vh] text-white">
        <SheetHeader className="text-right">
          <SheetTitle className="text-xl">{editingSchedule ? 'עריכת תזמון' : 'תזמון הפעלה'}</SheetTitle>
          <SheetDescription className="text-slate-400">
            {appliance ? `תזמון עבור ${appliance.nameHe}` : "בחר מכשיר לתזמון"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Presets */}
          <div>
            <Label className="text-sm text-slate-400 mb-3 block">
              <Sparkles className="inline h-4 w-4 ml-1 text-yellow-400" />
              תזמונים מהירים
            </Label>
            <div className="flex gap-2 flex-wrap">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="outline"
                  className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
                  onClick={() => applyPreset(preset)}
                >
                  <span className="ml-2">{preset.icon}</span>
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="date" className="flex items-center gap-2 text-slate-200">
              <Calendar className="h-4 w-4 text-primary" />
              תאריך
            </Label>
            <div className="flex gap-2">
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-white/5 border-white/10 text-white focus:ring-primary flex-1"
              />
              <Button
                variant="outline"
                className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
                onClick={() => {
                  const d = new Date();
                  setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                }}
              >
                היום
              </Button>
              <Button
                variant="outline"
                className="bg-white/5 border-white/10 hover:bg-white/10 text-white"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                }}
              >
                מחר
              </Button>
            </div>
          </div>

          {/* Time */}
          <div className="space-y-2">
            <Label htmlFor="time" className="flex items-center gap-2 text-slate-200">
              <Clock className="h-4 w-4 text-primary" />
              שעה
            </Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="bg-white/5 border-white/10 text-white focus:ring-primary"
            />
          </div>

          {/* Program / Coffee Mode */}
          {isCoffee ? (
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-slate-200">
                <Coffee className="h-4 w-4 text-amber-400" />
                מצב הכנה
              </Label>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className={`flex-1 border-white/10 ${coffeeMode === 'full' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-white/5 text-white hover:bg-white/10'}`}
                  onClick={() => setCoffeeMode('full')}
                >
                  🔌 הדלקה + הכנה + כיבוי
                </Button>
                <Button
                  variant="outline"
                  className={`flex-1 border-white/10 ${coffeeMode === 'brew_only' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-white/5 text-white hover:bg-white/10'}`}
                  onClick={() => setCoffeeMode('brew_only')}
                >
                  ☕ הכנה בלבד
                </Button>
              </div>
              <p className="text-[11px] text-slate-500">
                {coffeeMode === 'full'
                  ? 'המערכת תדליק את המכונה, תמתין להתחממות, תכין קפה ותכבה.'
                  : 'רק לחיצה על כפתור הקפה. הדלק את המכונה ידנית מראש.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-slate-200">תוכנית</Label>
              <Select value={program} onValueChange={setProgram}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="בחר תוכנית" />
                </SelectTrigger>
                <SelectContent className="dark bg-slate-900 border-white/10 text-white">
                  {programs.map((prog) => (
                    <SelectItem key={prog.value} value={prog.value}>
                      {prog.labelHe} ({prog.label})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              className="flex-1 bg-white/10 hover:bg-white/20 text-white border-none"
              onClick={() => onOpenChange(false)}
            >
              ביטול
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/80"
              onClick={handleSubmit}
              disabled={!date || !time || (!isCoffee && !program)}
            >
              {editingSchedule ? 'עדכן תזמון' : (isCoffee ? 'תזמן קפה ☕' : 'שמור תזמון')}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
