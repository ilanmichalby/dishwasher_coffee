'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { APPLIANCE_NAMES } from '@/lib/constants';
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { DishwasherCard } from "@/components/dashboard/dishwasher-card";
import { CoffeeMachineCard } from "@/components/dashboard/coffee-machine-card";
import { ScheduleSheet } from "@/components/dashboard/schedule-sheet";
import { ControlSheet } from "@/components/dashboard/control-sheet";
import { ScheduleTable } from "@/components/dashboard/schedule-table";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { FloatingNav } from "@/components/dashboard/floating-nav";
import { Button } from "@/components/ui/button";
import { RefreshCw, Power } from 'lucide-react';

export default function SmartHomeDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [dishwashers, setDishwashers] = useState([]);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [scheduleSheetOpen, setScheduleSheetOpen] = useState(false);
  const [controlSheetOpen, setControlSheetOpen] = useState(false);
  const [selectedAppliance, setSelectedAppliance] = useState(null);

  useEffect(() => {
    checkAuth();
    fetchData();
    fetchDishwashers();
  }, []);

  const checkAuth = async () => {
    const { data } = await supabase.from('bosch_auth').select('id').limit(1);
    setIsAuthenticated(data && data.length > 0);
    setIsLoading(false);
  };

  const fetchData = async () => {
    const { data: scheduleData } = await supabase
      .from('schedules')
      .select('*')
      .order('scheduled_time', { ascending: true });
      
    if (scheduleData) setSchedules(scheduleData);
  };

  const fetchDishwashers = async () => {
    try {
      setError(null);
      const res = await fetch('/api/dishwashers');
      if (res.ok) {
        const data = await res.json();
        const allAppliances = [
          ...(data.dishwashers || []),
          {
            haId: '9103117a-3163-4aa6-a4fb-b0a50acf832a',
            name: 'מכונת קפה',
            type: 'CoffeeMaker'
          }
        ];
        setDishwashers(allAppliances);
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'נכשל במשיכת מכשירים');
      }
    } catch (error) {
      setError('שגיאת תקשורת בחיפוש מכשירים');
    }
  };

  const handleOpenSchedule = (appliance) => {
    setSelectedAppliance(appliance);
    setScheduleSheetOpen(true);
  };

  const handleOpenControl = (appliance) => {
    setSelectedAppliance(appliance);
    setControlSheetOpen(true);
  };

  const handleAddSchedule = async (scheduleData) => {
    try {
      const response = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scheduled_time: new Date(`${scheduleData.date}T${scheduleData.time}:00`).toISOString(),
          program_key: scheduleData.program,
          appliance_id: selectedAppliance.haId
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'נכשל בתזמון');
      }
      
      setScheduleSheetOpen(false);
      fetchData();
    } catch (error) {
      alert('שגיאה בתזמון: ' + error.message);
    }
  };

  const handleControlAction = async (actionName) => {
    try {
      const response = await fetch('/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: actionName,
          applianceId: selectedAppliance.haId
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'הפעולה נכשלה');
      
      setControlSheetOpen(false);
      fetchDishwashers();
    } catch (error) {
      alert('שגיאה בשליחת הפקודה: ' + error.message);
    }
  };

  const handleTriggerQueue = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/process-queue', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}` 
        }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'נכשלה הפעלת התור');
      alert('התור עובד! ' + (data.results?.length || 0) + ' תזמונים עובדו.');
      fetchData();
      fetchDishwashers();
    } catch (error) {
      alert('שגיאה בהפעלת התור: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const getMappedStatus = (d) => {
    if (!d.status) return "ready";
    const opState = d.status.status?.find(s => s.key === 'BSH.Common.Status.OperationState')?.value;
    if (opState === 'BSH.Common.EnumType.OperationState.Run') return "running";
    if (opState === 'BSH.Common.EnumType.OperationState.Finished') return "finished";
    return "ready";
  };

  const getRemainingTime = (d) => {
    const active = d.status?.activeProgram;
    const remaining = active?.options?.find(o => o.key === 'BSH.Common.Option.RemainingProgramTime')?.value;
    if (remaining) {
      const mins = Math.round(remaining / 60);
      return `${mins} דקות`;
    }
    return null;
  };

  const getProgress = (d) => {
    const active = d.status?.activeProgram;
    const progress = active?.options?.find(o => o.key === 'BSH.Common.Option.ProgramProgress')?.value;
    return progress || 0;
  };

  const mappedDishwashers = dishwashers
    .filter(d => d.type !== 'CoffeeMaker')
    .map(d => ({
      id: d.haId,
      haId: d.haId,
      name: d.name,
      nameHe: APPLIANCE_NAMES[d.haId] || d.name,
      type: APPLIANCE_NAMES[d.haId]?.includes('חלבי') ? 'dairy' : 'meaty',
      status: getMappedStatus(d),
      progress: getProgress(d),
      remainingTime: getRemainingTime(d),
      program: d.status?.activeProgram?.key?.split('.').pop() || 'Eco 50°C'
    }));

  const mappedSchedules = schedules.map(s => ({
    id: s.id,
    applianceId: s.appliance_id,
    applianceName: APPLIANCE_NAMES[s.appliance_id] || 'מכשיר',
    date: new Date(s.scheduled_time).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' }),
    time: new Date(s.scheduled_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' }),
    program: s.program_key.split('.').pop(),
    isShabbat: true // All schedules in this app are essentially for Shabbat
  }));

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-950">
        <RefreshCw className="animate-spin text-indigo-500" size={48} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center" dir="rtl">
        <div className="w-20 h-20 bg-indigo-500/20 rounded-3xl flex items-center justify-center text-indigo-500 mb-8">
          <Power size={40} />
        </div>
        <h1 className="text-4xl font-bold mb-4">הבית החכם</h1>
        <p className="text-slate-400 mb-8 max-w-md">אנא התחבר לחשבון ה-Home Connect שלך כדי לשלוט במכשירים.</p>
        <a href="/api/auth/bosch/login" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-8 rounded-2xl transition-all shadow-xl shadow-indigo-500/20 flex items-center gap-3">
          <RefreshCw size={20} />
          התחבר לחשבון המעודכן
        </a>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-white pb-24 rtl" dir="rtl">
      <div className="fixed inset-0 bg-gradient-to-br from-indigo-950 via-slate-950 to-indigo-900 pointer-events-none" />
      
      <div className="relative z-10 container mx-auto px-6 py-10 max-w-screen-2xl">
        <DashboardHeader />
        
        <SummaryCards 
          activeDevices={mappedDishwashers.filter(d => d.status === 'running').length}
          upcomingSchedules={mappedSchedules.length}
        />

        <div className="flex justify-end mt-4">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleTriggerQueue} 
            disabled={isProcessing}
            className="bg-white/5 border-white/10 text-slate-300 hover:text-white"
          >
            <RefreshCw className={`ml-2 h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
            הפעל תזמונים ממתינים כעת
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-12 mt-8">
          {/* Main Content Area */}
          <div className="xl:col-span-8 space-y-12">
            <section>
              <h2 className="text-2xl font-bold mb-6 text-white tracking-tight flex items-center gap-2">
                <span className="w-1.5 h-6 bg-indigo-500 rounded-full" />
                מכשירי חשמל
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {mappedDishwashers.map((dishwasher) => (
                  <DishwasherCard
                    key={dishwasher.id}
                    appliance={dishwasher}
                    onSchedule={() => handleOpenSchedule(dishwasher)}
                    onControl={() => handleOpenControl(dishwasher)}
                  />
                ))}
                <CoffeeMachineCard />
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-6 text-white tracking-tight flex items-center gap-2">
                <span className="w-1.5 h-6 bg-emerald-500 rounded-full" />
                לוח זמנים מתוזמן
              </h2>
              <ScheduleTable schedules={mappedSchedules} />
            </section>
          </div>

          {/* Sidebar Area */}
          <div className="xl:col-span-4 space-y-12">
            <section>
              <h2 className="text-2xl font-bold mb-6 text-white tracking-tight flex items-center gap-2">
                <span className="w-1.5 h-6 bg-amber-500 rounded-full" />
                פעילות אחרונה
              </h2>
              <RecentActivity activity={[]} />
            </section>
          </div>
        </div>
      </div>

      <FloatingNav />

      <ScheduleSheet
        open={scheduleSheetOpen}
        onOpenChange={setScheduleSheetOpen}
        appliance={selectedAppliance}
        onAddSchedule={handleAddSchedule}
      />
      
      <ControlSheet
        open={controlSheetOpen}
        onOpenChange={setControlSheetOpen}
        appliance={selectedAppliance}
        onAction={handleControlAction}
      />
    </div>
  );
}
