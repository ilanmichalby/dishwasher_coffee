import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Calendar, Star } from "lucide-react"
import type { ScheduledTask } from "@/app/page"

interface ScheduleTableProps {
  schedules: ScheduledTask[]
}

export function ScheduleTable({ schedules }: ScheduleTableProps) {
  return (
    <Card className="glass-card border-0">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" />
          תזמונים קרובים
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl overflow-hidden border border-border/30">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/30">
                <TableHead className="text-right text-muted-foreground">מכשיר</TableHead>
                <TableHead className="text-right text-muted-foreground">תאריך</TableHead>
                <TableHead className="text-right text-muted-foreground">שעה</TableHead>
                <TableHead className="text-right text-muted-foreground">תוכנית</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.map((schedule) => (
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
                  <TableCell className="text-muted-foreground">{schedule.date}</TableCell>
                  <TableCell className="text-muted-foreground">{schedule.time}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-0">
                      {schedule.program}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        
        {schedules.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>אין תזמונים קרובים</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
