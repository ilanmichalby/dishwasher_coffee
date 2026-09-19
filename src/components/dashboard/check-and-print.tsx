"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Printer, Loader2, AlertTriangle, CheckCircle2, Info } from "lucide-react"

// The last thing you do before Shabbat: verify, then print the sheet for the
// fridge. Printing an unverified sheet is the failure we keep hitting — it
// looks authoritative on the fridge while the Fingerbot is offline. So the
// check gates the print: healthy prints immediately, unhealthy stops and says
// what to go fix, with an override for when you have decided to print anyway.

interface CheckResult {
  healthy: boolean
  problems: string[]
  warnings: string[]
  message: string
}

export function CheckAndPrint() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CheckResult | null>(null)

  const checkThenPrint = async () => {
    setLoading(true)
    setResult(null)
    try {
      const response = await fetch('/api/health/pre-shabbat', { method: 'POST' })

      // 200 = ready, 503 = a real problem was found. Anything else is the
      // check itself failing, which must not be read as "all clear".
      if (response.status !== 200 && response.status !== 503) {
        throw new Error(`הבדיקה לא רצה (${response.status})`)
      }

      const data: CheckResult = await response.json()
      setResult(data)

      if (data.healthy) {
        // Let React paint the green state before the print dialog blocks.
        setTimeout(() => window.print(), 100)
      }
    } catch (err) {
      setResult({
        healthy: false,
        problems: [],
        warnings: [],
        message: err instanceof Error ? err.message : 'שגיאה בלתי צפויה',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-3">
      <Button onClick={checkThenPrint} disabled={loading} className="gap-2">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
        {loading ? 'בודק...' : 'בדוק והדפס'}
      </Button>

      {result && !result.healthy && (
        <div className="w-full max-w-md rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-right">
          <div className="mb-2 flex items-center justify-end gap-2 font-semibold text-red-300">
            <span>לא מוכן לשבת</span>
            <AlertTriangle className="h-4 w-4" />
          </div>
          {result.problems?.length > 0 ? (
            <ul className="space-y-1 text-sm text-red-200">
              {result.problems.map((p, i) => <li key={i}>• {p}</li>)}
            </ul>
          ) : (
            <p className="text-sm text-red-200">{result.message}</p>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 text-red-200 hover:text-white"
            onClick={() => window.print()}
          >
            הדפס בכל זאת
          </Button>
        </div>
      )}

      {result?.healthy && (
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4" />
            <span>מוכן — מדפיס.</span>
          </div>

          {/* Amber, not red: an open door while you are still loading is a
              reminder, not a fault, and it does not block the print. */}
          {result.warnings?.length > 0 && (
            <div className="w-full max-w-md rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-right">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start justify-end gap-2 text-sm text-amber-200">
                  <span>{w}</span>
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
