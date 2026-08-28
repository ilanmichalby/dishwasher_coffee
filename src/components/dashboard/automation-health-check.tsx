"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RefreshCw, CheckCircle, AlertCircle, Clock } from "lucide-react"

interface HealthCheckResult {
  healthy: boolean
  fingerbot_online: boolean | null
  device_error: string | null
  upcoming_coffee_count: number
  next_coffee: string | null
  checked_at: string
  message: string
}

export function AutomationHealthCheck() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<HealthCheckResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastCheckTime, setLastCheckTime] = useState<Date | null>(null)

  const runCheck = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/health/check-automations', {
        method: 'POST',
        headers: {
          'x-internal-call': 'true',
        },
      })

      // 200 = healthy, 503 = unhealthy but valid check, 401/500 = error
      if (response.status !== 200 && response.status !== 503) {
        throw new Error(`שגיאה בשרת: ${response.statusText}`)
      }

      const data = await response.json()
      setResult(data)
      setLastCheckTime(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בלתי צפויה')
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Jerusalem',
    })
  }

  const getTimeSinceCheck = (lastCheck: Date | null) => {
    if (!lastCheck) return 'עדיין לא בוצעה בדיקה'
    const now = new Date()
    const diff = Math.floor((now.getTime() - lastCheck.getTime()) / 1000)
    if (diff < 60) return 'לפני כמה שניות'
    if (diff < 3600) return `לפני ${Math.floor(diff / 60)} דקות`
    return `לפני ${Math.floor(diff / 3600)} שעות`
  }

  return (
    <div className="w-full space-y-4">
      <Card className="glass-card border-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-2">בדיקת אוטומציות</h3>
              <p className="text-sm text-slate-400">
                בדוק את סטטוס הFingerbot והקפה המתוכננת
              </p>
            </div>
            <Button
              onClick={runCheck}
              disabled={loading}
              variant="default"
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              {loading ? 'בדיקה בתהליך...' : 'הרץ בדיקה'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {lastCheckTime && (
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <Clock className="h-3 w-3" />
          בדיקה אחרונה: {getTimeSinceCheck(lastCheckTime)} ({formatTime(result?.checked_at || new Date().toISOString())})
        </div>
      )}

      {error && (
        <Card className="glass-card border-0 bg-red-500/10 border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-400">שגיאה</p>
                <p className="text-sm text-red-300 mt-1">{error}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className={`glass-card border-0 ${result.healthy ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              {result.healthy ? (
                <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-medium ${result.healthy ? 'text-emerald-400' : 'text-red-400'}`}>
                  {result.healthy ? 'כל זה בסדר ✅' : 'בעיה גדולה! 🚨'}
                </p>
                <p className="text-sm text-slate-300 mt-1">{result.message}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm mt-4 pt-4 border-t border-white/10">
              <div>
                <p className="text-slate-400">Fingerbot</p>
                <p className={`font-medium ${result.fingerbot_online ? 'text-emerald-400' : result.fingerbot_online === false ? 'text-red-400' : 'text-slate-400'}`}>
                  {result.fingerbot_online ? 'מחובר ✅' : result.fingerbot_online === false ? 'לא מחובר ❌' : 'לא ידוע'}
                </p>
              </div>
              <div>
                <p className="text-slate-400">קפה מתוכננת</p>
                <p className={`font-medium ${result.upcoming_coffee_count > 0 ? 'text-blue-400' : 'text-slate-400'}`}>
                  {result.upcoming_coffee_count > 0 ? `${result.upcoming_coffee_count} תזמון${result.upcoming_coffee_count > 1 ? 'ים' : ''}` : 'אין'}
                </p>
              </div>
            </div>

            {result.next_coffee && (
              <div className="text-sm pt-2">
                <p className="text-slate-400">הקפה הבאה</p>
                <p className="font-medium text-slate-200">{formatTime(result.next_coffee)}</p>
              </div>
            )}

            {result.device_error && (
              <div className="text-sm bg-yellow-500/20 border border-yellow-500/30 rounded p-2">
                <p className="text-yellow-300 text-xs font-medium">⚠️ הערה טכנית</p>
                <p className="text-yellow-200 text-xs mt-1">{result.device_error}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
