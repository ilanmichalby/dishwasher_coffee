'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { APPLIANCE_NAMES } from '@/lib/constants';
import { 
  Calendar, 
  Clock, 
  Play, 
  Power, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Trash2, 
  Settings, 
  Plus, 
  Coffee, 
  ChevronRight,
  X,
  Droplets,
  Star,
  Printer
} from 'lucide-react';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [dishwashers, setDishwashers] = useState([]);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  // Selection state
  const [selectedAppliance, setSelectedAppliance] = useState(null);
  
  // Form state
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [program, setProgram] = useState('Dishcare.Dishwasher.Program.Eco50');

  useEffect(() => {
    checkAuth();
    fetchData();
    fetchDishwashers();
    
    const today = new Date();
    setDate(today.toISOString().split('T')[0]);
    setTime('22:00');
  }, []);

  const checkAuth = async () => {
    const { data } = await supabase.from('bosch_auth').select('id').limit(1);
    setIsAuthenticated(data && data.length > 0);
    setIsLoading(false);
  };

  const fetchDishwashers = async () => {
    try {
      const res = await fetch('/api/dishwashers');
      if (res.ok) {
        const data = await res.json();
        setDishwashers(data.dishwashers || []);
      }
    } catch (error) {
      console.error('Failed to fetch dishwashers', error);
    }
  };

  const fetchData = async () => {
    const { data: scheduleData } = await supabase
      .from('schedules')
      .select('*')
      .order('scheduled_time', { ascending: true });
      
    if (scheduleData) setSchedules(scheduleData);

    const { data: templateData } = await supabase.from('templates').select('*');
    if (templateData) setTemplates(templateData);
  };

  const openScheduling = (appliance) => {
    setSelectedAppliance(appliance);
    setIsSheetOpen(true);
  };

  const handleSchedule = async () => {
    try {
      const scheduledDateTime = new Date(`${date}T${time}:00`);
      
      const { error } = await supabase.from('schedules').insert([{
        scheduled_time: scheduledDateTime.toISOString(),
        program_key: program,
        appliance_id: selectedAppliance.haId,
        status: 'pending'
      }]);

      if (error) throw error;
      
      setIsSheetOpen(false);
      fetchData();
    } catch (error) {
      alert('שגיאה בתזמון: ' + error.message);
    }
  };

  const applyTemplate = (template) => {
    setProgram(template.program_key);
    if (template.default_time_of_day) {
      setTime(template.default_time_of_day);
    }
  };

  const deleteSchedule = async (id) => {
    const { error } = await supabase.from('schedules').delete().eq('id', id);
    if (!error) fetchData();
  };

  const formatDateShort = (isoString) => {
    const d = new Date(isoString);
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    if (d.toDateString() === today.toDateString()) return 'היום';
    if (d.toDateString() === tomorrow.toDateString()) return 'מחר';
    
    return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
  };

  const formatProgramName = (key) => {
    if (key.includes('Eco50')) return 'Eco 50°C';
    if (key.includes('Auto2')) return 'Auto 45-65°C';
    if (key.includes('Intensiv70')) return 'Intensive 70°C';
    if (key.includes('Quick45')) return 'Quick 45°C';
    if (key.includes('Kurz60')) return 'Quick 60°C';
    return key.split('.').pop();
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <RefreshCw className="pulse" size={32} color="var(--primary)" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="container" dir="rtl">
        <header>
          <h1>הבית החכם</h1>
        </header>
        <div className="device-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div className="device-icon" style={{ margin: '0 auto 1.5rem auto', width: '64px', height: '64px' }}>
            <Power size={32} />
          </div>
          <h2 style={{ marginBottom: '1rem' }}>צריך להתחבר</h2>
          <p style={{ color: 'var(--secondary)', marginBottom: '2rem' }}>אנא התחבר לחשבון ה-Home Connect שלך כדי לשלוט במכשירים.</p>
          <a href="/api/auth/bosch/login" className="btn-primary" style={{ textDecoration: 'none', display: 'block' }}>
            התחבר עכשיו
          </a>
        </div>
      </main>
    );
  }

  const pendingSchedules = schedules.filter(s => s.status === 'pending');

  return (
    <main className="container" dir="rtl">
      {/* Printable Section */}
      <div className="print-only">
        <div className="print-title">לוח זמנים להפעלת מכשירים - שבת קודש</div>
        <table className="print-table">
          <thead>
            <tr>
              <th>מכשיר</th>
              <th>יום/תאריך</th>
              <th>שעה</th>
              <th>תוכנית</th>
            </tr>
          </thead>
          <tbody>
            {pendingSchedules.map(s => (
              <tr key={s.id}>
                <td>{APPLIANCE_NAMES[s.appliance_id] || 'מדיח'}</td>
                <td>{new Date(s.scheduled_time).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' })}</td>
                <td>{new Date(s.scheduled_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</td>
                <td>{formatProgramName(s.program_key)}</td>
              </tr>
            ))}
            {pendingSchedules.length === 0 && (
              <tr>
                <td colSpan="4" style={{ textAlign: 'center' }}>אין הפעלות מתוזמנות</td>
              </tr>
            )}
          </tbody>
        </table>
        <div style={{ marginTop: '30px', fontSize: '12pt', color: '#666', textAlign: 'center' }}>
          הודפס ב- {new Date().toLocaleString('he-IL')}
        </div>
      </div>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>הבית החכם</h1>
        <button onClick={handlePrint} style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <Printer size={20} />
          הדפס לשבת
        </button>
      </header>

      <div className="section-title">מדיחים</div>
      
      {dishwashers.length === 0 ? (
        <div className="device-card" style={{ alignItems: 'center', color: 'var(--secondary)' }}>
          <RefreshCw className="pulse" size={24} />
          <p>מחפש מכשירים...</p>
        </div>
      ) : (
        dishwashers.map(d => {
          const isHalavi = APPLIANCE_NAMES[d.haId]?.includes('חלבי');
          const applianceName = APPLIANCE_NAMES[d.haId] || d.name;
          const applianceSchedule = pendingSchedules.find(s => s.appliance_id === d.haId);

          return (
            <div key={d.haId} className="device-card">
              <div className="device-header">
                <div className="device-info">
                  <div className="device-icon" style={{ backgroundColor: isHalavi ? '#e1f0ff' : '#ffebeb', color: isHalavi ? '#007aff' : '#ff3b30' }}>
                    <Droplets size={24} />
                  </div>
                  <div>
                    <div className="device-name">{applianceName}</div>
                    <div className="device-status">מחובר וממתין</div>
                  </div>
                </div>
                <div className={`badge ${isHalavi ? 'badge-blue' : 'badge-red'}`}>
                  {isHalavi ? 'חלבי' : 'בשרי'}
                </div>
              </div>

              {applianceSchedule ? (
                <div className="schedule-row" style={{ backgroundColor: isHalavi ? 'rgba(0,122,255,0.05)' : 'rgba(255,59,48,0.05)' }}>
                  <div className="schedule-time-box">
                    <div className="schedule-label">הפעלה מתוזמנת ל{formatDateShort(applianceSchedule.scheduled_time)}</div>
                    <div className="schedule-time-value" style={{ color: isHalavi ? 'var(--primary)' : 'var(--error)' }}>
                      {new Date(applianceSchedule.scheduled_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <button onClick={() => deleteSchedule(applianceSchedule.id)} style={{ background: 'none', border: 'none', color: 'var(--error)' }}>
                    <Trash2 size={20} />
                  </button>
                </div>
              ) : (
                <button className="btn-add" onClick={() => openScheduling(d)}>
                  <Plus size={18} />
                  תזמן הפעלה חדשה
                </button>
              )}
            </div>
          );
        })
      )}

      <div className="section-title">מכשירים נוספים</div>
      <div className="device-card" style={{ opacity: 0.6 }}>
        <div className="device-header">
          <div className="device-info">
            <div className="device-icon" style={{ backgroundColor: '#f2f2f7', color: '#8e8e93' }}>
              <Coffee size={24} />
            </div>
            <div>
              <div className="device-name">מכונת קפה</div>
              <div className="device-status">בקרוב...</div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="section-title">הפעלות אחרונות</div>
      <div className="device-card" style={{ padding: '0.5rem 0' }}>
        {schedules.filter(s => s.status !== 'pending').slice(0, 5).map(s => (
          <div key={s.id} className="schedule-item" style={{ borderBottom: '1px solid var(--border)', padding: '1rem 1.25rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: '600' }}>{APPLIANCE_NAMES[s.appliance_id] || 'מדיח'}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--secondary)' }}>
                {new Date(s.scheduled_time).toLocaleDateString('he-IL')} • {new Date(s.scheduled_time).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className={`badge ${s.status === 'completed' ? 'badge-green' : 'badge-red'}`}>
              {s.status === 'completed' ? 'בוצע' : 'נכשל'}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Sheet for Scheduling */}
      <div className={`overlay ${isSheetOpen ? 'open' : ''}`} onClick={() => setIsSheetOpen(false)} />
      <div className={`bottom-sheet ${isSheetOpen ? 'open' : ''}`} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>תזמון {selectedAppliance && (APPLIANCE_NAMES[selectedAppliance.haId] || selectedAppliance.name)}</h2>
          <button onClick={() => setIsSheetOpen(false)} style={{ background: '#f2f2f7', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label><Calendar size={14} style={{ verticalAlign: 'middle', marginLeft: '4px' }} /> תאריך</label>
            <input type="date" className="form-control" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label><Clock size={14} style={{ verticalAlign: 'middle', marginLeft: '4px' }} /> שעה</label>
            <input type="time" className="form-control" value={time} onChange={e => setTime(e.target.value)} />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
          <label>תוכנית הפעלה</label>
          <select className="form-control" value={program} onChange={e => setProgram(e.target.value)}>
            <option value="Dishcare.Dishwasher.Program.Eco50">Eco 50°C</option>
            <option value="Dishcare.Dishwasher.Program.Auto2">Auto 45-65°C</option>
            <option value="Dishcare.Dishwasher.Program.Intensiv70">Intensive 70°C</option>
            <option value="Dishcare.Dishwasher.Program.Quick45">Quick 45°C</option>
            <option value="Dishcare.Dishwasher.Program.Kurz60">Quick 60°C</option>
          </select>
        </div>

        {templates.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--secondary)', marginBottom: '0.75rem', display: 'block' }}>תבניות קבועות</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              {templates.map(t => (
                <button key={t.id} className="preset-card" onClick={() => applyTemplate(t)} style={{ display: 'flex', alignItems: 'center', gap: '8px', textAlign: 'right' }}>
                  <Star size={14} color="var(--warning)" fill="var(--warning)" />
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{t.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>{t.default_time_of_day}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <button className="btn-primary" onClick={handleSchedule} style={{ marginTop: '0.5rem', height: '56px', fontSize: '1.1rem' }}>
          אשר תזמון הפעלה
        </button>
      </div>

      <style jsx>{`
        .form-control {
          width: 100%;
          padding: 0.75rem;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: #f2f2f7;
          font-family: inherit;
          font-size: 1rem;
        }
        .form-group label {
          display: block;
          font-size: 0.85rem;
          color: var(--secondary);
          margin-bottom: 0.5rem;
          margin-right: 0.25rem;
        }
        .preset-card {
          background: #f2f2f7;
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 10px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .preset-card:active {
          background: var(--primary-soft);
          border-color: var(--primary);
        }
      `}</style>
    </main>
  );
}
