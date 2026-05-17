import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Calendar, Star, History, CheckCircle2, XCircle, Clock, RefreshCw } from "lucide-react"
import type { ScheduledTask } from "@/app/page"

interface ScheduleTableProps {
  schedules: ScheduledTask[]
}

export function ScheduleTable({ schedules }: ScheduleTableProps) {
  const [showPast, setShowPast] = useState(false);

  const now = new Date();

  // Sort: pending/future first, then by date descending for past
  const sortedSchedules = [...schedules].sort((a, b) => {
    return new Date(a.rawDate || 0).getTime() - new Date(b.rawDate || 0).getTime();
  });

  const filteredSchedules = sortedSchedules.filter(s => {
    if (showPast) return true;
    // Show if pending OR if date is in the future
    if (s.status === 'pending') return true;
    if (s.rawDate && new Date(s.rawDate) >= now) return true;
    return false;
  });

  const getStatusBadge = (status?: string, error?: string) => {
    switch(status) {
      case 'completed':
        return <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-xs whitespace-nowrap"><CheckCircle2 className="h-3 w-3 ml-1" /> הושלם</Badge>;
      case 'failed':
        return (
          <div className="flex flex-col gap-1 items-start">
            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30 text-xs whitespace-nowrap"><XCircle className="h-3 w-3 ml-1" /> נכשל</Badge>
            {error && <span className="text-[10px] text-red-400 max-w-[150px] truncate" title={error}>{error}</span>}
          </div>
        );
      case 'processing':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/30 text-xs whitespace-nowrap"><RefreshCw className="h-3 w-3 ml-1 animate-spin" /> מעבד...</Badge>;
      case 'pending':
      default:
        return <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/30 text-xs whitespace-nowrap"><Clock className="h-3 w-3 ml-1" /> ממתין</Badge>;
    }
  }

  return (
    <Card className="glass-card border-0">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          {showPast ? 'היסטוריית תזמונים' : 'תזמונים קרובים'}
        </CardTitle>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => setShowPast(!showPast)}
          className="text-muted-foreground hover:text-white"
        >
          <History className="h-4 w-4 ml-2" />
          {showPast ? 'הסתר היסטוריה' : 'הצג היסטוריה'}
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl overflow-hidden border border-border/30">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/30">
                <TableHead className="text-right text-muted-foreground">מכשיר</TableHead>
                <TableHead className="text-right text-muted-foreground">תאריך ושעה</TableHead>
                <TableHead className="text-right text-muted-foreground">תוכנית</TableHead>
                <TableHead className="text-right text-muted-foreground">סטטוס</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSchedules.map((schedule) => (
                <TableRow key={schedule.id} className="hover:bg-accent/30 border-border/30">
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {schedule.applianceName}
                      {schedule.isShabbat && (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-xs">
                          <Star className="h-3 w-3 ml-1" />
                          שבת
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex flex-col">
                      <span>{schedule.date}</span>
                      <span className="text-xs opacity-70">{schedule.time}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                      {schedule.program}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(schedule.status, schedule.last_error)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {filteredSchedules.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{showPast ? 'אין היסטוריית תזמונים' : 'אין תזמונים קרובים'}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
