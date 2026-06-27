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
import { Calendar, Star, History, CheckCircle2, XCircle, Clock, RefreshCw, Pencil, Trash2, ListChecks } from "lucide-react"
import type { ScheduleEvent, ScheduledTask } from "@/app/page"

interface ScheduleTableProps {
  schedules: ScheduledTask[]
  onDelete?: (id: string) => void
  onEdit?: (schedule: ScheduledTask) => void
}

export function ScheduleTable({ schedules, onDelete, onEdit }: ScheduleTableProps) {
  const [showPast, setShowPast] = useState(false);
  const [expandedScheduleId, setExpandedScheduleId] = useState<string | null>(null);

  const now = new Date();

  // Sort: pending/future first, then by date descending for past
  const sortedSchedules = [...schedules].sort((a, b) => {
    return new Date(a.rawDate || 0).getTime() - new Date(b.rawDate || 0).getTime();
  });

  const filteredSchedules = sortedSchedules.filter(s => {
    if (showPast) return true;
    // Show only if date is in the future
    if (s.rawDate && new Date(s.rawDate) >= now) return true;
    return false;
  });

  const expandedSchedule = filteredSchedules.find(s => s.id === expandedScheduleId);

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

  const formatEventTime = (value: string) => {
    return new Date(value).toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Asia/Jerusalem'
    });
  }

  const formatEventDetails = (event: ScheduleEvent) => {
    const details = event.details || {};
    const parts = [];

    if (details.attempt) parts.push(`ניסיון ${details.attempt}${details.max_attempts ? `/${details.max_attempts}` : ''}`);
    if (details.next_attempt) parts.push(`הבא: ניסיון ${details.next_attempt}`);
    if (details.switchbot_status) parts.push(`SwitchBot ${details.switchbot_status}`);
    if (details.switchbot_message) parts.push(details.switchbot_message);
    if (details.next_step) parts.push(`השלב הבא: ${details.next_step}`);
    if (details.next_time) {
      parts.push(`בשעה ${new Date(details.next_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' })}`);
    }
    if (details.error_type) parts.push(details.error_type);
    if (details.message) parts.push(details.message);

    return parts.length > 0 ? parts.join(' · ') : '';
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
                <TableHead className="text-right text-muted-foreground">פעולות</TableHead>
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
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-amber-400"
                        onClick={() => setExpandedScheduleId(expandedScheduleId === schedule.id ? null : schedule.id)}
                        title="פרטי ריצה"
                        disabled={!schedule.events || schedule.events.length === 0}
                      >
                        <ListChecks className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-white"
                        onClick={() => onEdit?.(schedule)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-500"
                        onClick={() => {
                          if (confirm('האם אתה בטוח שברצונך למחוק תזמון זה?')) {
                            onDelete?.(schedule.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {expandedSchedule && (
          <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/50 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">פרטי ריצה</p>
                <p className="text-xs text-muted-foreground">
                  {expandedSchedule.applianceName} · {expandedSchedule.date} · {expandedSchedule.time}
                </p>
              </div>
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300">
                {expandedSchedule.events?.length || 0} אירועים
              </Badge>
            </div>
            <div className="grid gap-2">
              {expandedSchedule.events?.map((event) => {
                const details = formatEventDetails(event);
                return (
                  <div key={event.id} className="grid grid-cols-[82px_minmax(180px,260px)_1fr] gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
                    <span className="font-mono text-slate-400 tabular-nums">{formatEventTime(event.created_at)}</span>
                    <span className="font-semibold text-slate-200">{event.event_type}</span>
                    <span className="min-w-0 break-words text-slate-400">{details || '—'}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        
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
