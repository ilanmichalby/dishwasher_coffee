import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, CheckCircle2, XCircle } from "lucide-react"
import type { ActivityLog } from "@/app/page"

interface RecentActivityProps {
  activity: ActivityLog[]
}

export function RecentActivity({ activity }: RecentActivityProps) {
  return (
    <Card className="glass-card border-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="h-5 w-5 text-emerald" />
          פעילות אחרונה
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activity.map((log) => (
            <div
              key={log.id}
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className={`p-2 rounded-lg ${log.success ? "bg-emerald/10" : "bg-rose/10"}`}>
                {log.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald" />
                ) : (
                  <XCircle className="h-4 w-4 text-rose" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{log.applianceName}</p>
                <p className="text-xs text-muted-foreground truncate">{log.action}</p>
                {!log.success && log.last_error && (
                  <p className="text-xs text-rose mt-1 break-words" title={log.last_error}>
                    סיבת כישלון: {log.last_error}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge 
                  variant="outline" 
                  className={log.success 
                    ? "bg-emerald/10 text-emerald border-emerald/30 text-xs" 
                    : "bg-rose/10 text-rose border-rose/30 text-xs"
                  }
                >
                  {log.success ? "הצלחה" : "נכשל"}
                </Badge>
                <span className="text-xs text-muted-foreground">{log.timestamp}</span>
              </div>
            </div>
          ))}
        </div>

        {activity.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>אין פעילות אחרונה</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
