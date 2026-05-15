"use client"

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Power, PowerOff, Play, Square, Zap } from "lucide-react"
import type { Appliance } from "@/app/page"

interface ControlSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  appliance: Appliance | null
  onAction: (action: string) => void
}

export function ControlSheet({ open, onOpenChange, appliance, onAction }: ControlSheetProps) {
  const actions = [
    {
      id: "powerOn",
      label: "הפעלה",
      icon: Power,
      className: "bg-emerald/20 hover:bg-emerald/30 text-emerald border-emerald/30",
    },
    {
      id: "powerOff",
      label: "כיבוי",
      icon: PowerOff,
      className: "bg-rose/20 hover:bg-rose/30 text-rose border-rose/30",
    },
    {
      id: "startQuick",
      label: "התחל תוכנית מהירה",
      icon: Play,
      className: "bg-sky/20 hover:bg-sky/30 text-sky border-sky/30",
    },
    {
      id: "stop",
      label: "עצור",
      icon: Square,
      className: "bg-muted hover:bg-muted/80 text-foreground border-muted",
    },
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="glass border-t border-border/50 rounded-t-3xl">
        <SheetHeader className="text-right">
          <SheetTitle className="text-xl flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            שליטה מיידית
          </SheetTitle>
          <SheetDescription>
            {appliance ? `פעולות עבור ${appliance.nameHe}` : "בחר מכשיר לשליטה"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 grid grid-cols-2 gap-3">
          {actions.map((action) => (
            <Button
              key={action.id}
              variant="outline"
              className={`h-20 flex-col gap-2 ${action.className} border transition-all duration-200`}
              onClick={() => onAction(action.id)}
            >
              <action.icon className="h-6 w-6" />
              <span className="text-sm font-medium">{action.label}</span>
            </Button>
          ))}
        </div>

        <div className="mt-6">
          <Button
            variant="secondary"
            className="w-full glass hover:bg-accent/50"
            onClick={() => onOpenChange(false)}
          >
            סגור
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
