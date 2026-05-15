import { Card, CardContent } from "@/components/ui/card"
import { Activity, Zap, Calendar } from "lucide-react"

interface SummaryCardsProps {
  activeDevices: number
  powerUsage: string
  upcomingSchedules: number
}

export function SummaryCards({ activeDevices, powerUsage, upcomingSchedules }: SummaryCardsProps) {
  const cards = [
    {
      title: "מכשירים פעילים",
      value: activeDevices.toString(),
      icon: Activity,
      color: "text-emerald",
      bgColor: "bg-emerald/10",
    },
    {
      title: "תזמונים קרובים",
      value: upcomingSchedules.toString(),
      icon: Calendar,
      color: "text-indigo-400",
      bgColor: "bg-indigo-500/10",
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl">
      {cards.map((card) => (
        <Card key={card.title} className="glass-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${card.bgColor}`}>
                <card.icon className={`h-6 w-6 ${card.color}`} />
              </div>
              <div>
                <p className="text-sm text-slate-400 font-medium">{card.title}</p>
                <p className="text-3xl font-bold text-white tracking-tight">{card.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
