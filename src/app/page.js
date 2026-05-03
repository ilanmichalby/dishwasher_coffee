'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, Clock, Play, PowerOff, CheckCircle, AlertCircle, RefreshCw, Trash2, Edit2, PlusCircle, Save } from 'lucide-react';

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [schedules, setSchedules] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [dishwashers, setDishwashers] = useState([]);
  const [isScheduling, setIsScheduling] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form state
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [program, setProgram] = useState('Dishcare.Dishwasher.Program.Eco50');
  const [applianceId, setApplianceId] = useState('');
  
  // Template Form State
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');

  useEffect(() => {
    checkAuth();
    fetchData();
    fetchDishwashers();
    
    // Set default date to today, default time to 22:00
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
        if (data.dishwashers && data.dishwashers.length > 0) {
          setApplianceId(data.dishwashers[0].haId);
        }
      }
    } catch (error) {
      console.error('Failed to fetch dishwashers', error);
    }
  };

  const fetchData = async () => {
    const { data: scheduleData } = await supabase
      .from('schedules')
      .select('*')
      .order('scheduled_time', { ascending: true })
      .limit(10);
      
    if (scheduleData) setSchedules(scheduleData);

    const { data: templateData } = await supabase.from('templates').select('*');
    if (templateData) setTemplates(templateData);
  };

  const handleSchedule = async (e) => {
    if (e) e.preventDefault();
    setIsScheduling(true);

    try {
      const scheduledDateTime = new Date(`${date}T${time}:00`);
      
      if (editingId) {
        const { error } = await supabase.from('schedules').update({
          scheduled_time: scheduledDateTime.toISOString(),
          program_key: program,
          appliance_id: applianceId
        }).eq('id', editingId);

        if (error) throw error;
        alert('התזמון עודכן בהצלחה!');
        setEditingId(null);
      } else {
        const { error } = await supabase.from('schedules').insert([{
          scheduled_time: scheduledDateTime.toISOString(),
          program_key: program,
          appliance_id: applianceId,
          status: 'pending'
        }]);

        if (error) throw error;
        alert('המדיח תוכנת בהצלחה!');
      }
      
      fetchData();
    } catch (error) {
      alert('שגיאה בתזמון: ' + error.message);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleCreateTemplate = async (e) => {
    if (e) e.preventDefault();
    setIsScheduling(true);
    
    try {
      const { error } = await supabase.from('templates').insert([{
        name: templateName,
        program_key: program,
        default_time_of_day: time,
        appliance_id: applianceId
      }]);

      if (error) throw error;
      alert('התבנית נשמרה בהצלחה!');
      setIsCreatingTemplate(false);
      setTemplateName('');
      fetchData();
    } catch (error) {
      alert('שגיאה בשמירת התבנית: ' + error.message);
    } finally {
      setIsScheduling(false);
    }
  };

  const scheduleTemplate = async (template) => {
    setIsScheduling(true);
    try {
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0];
      const scheduledDateTime = new Date(`${dateStr}T${template.default_time_of_day}:00`);
      
      if (scheduledDateTime < new Date()) {
        scheduledDateTime.setDate(scheduledDateTime.getDate() + 1);
      }

      const { error } = await supabase.from('schedules').insert([{
        scheduled_time: scheduledDateTime.toISOString(),
        program_key: template.program_key,
        appliance_id: template.appliance_id || applianceId,
        status: 'pending'
      }]);

      if (error) throw error;
      fetchData();
      alert(`תבנית '${template.name}' תוכנתה ל-${scheduledDateTime.toLocaleString('he-IL')}`);
    } catch (error) {
      alert('שגיאה בהפעלת תבנית: ' + error.message);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleEdit = (schedule) => {
    setEditingId(schedule.id);
    const d = new Date(schedule.scheduled_time);
    const tzOffset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d.getTime() - tzOffset)).toISOString();
    
    setDate(localISOTime.split('T')[0]);
    setTime(localISOTime.split('T')[1].substring(0, 5));
    setProgram(schedule.program_key);
    if (schedule.appliance_id) setApplianceId(schedule.appliance_id);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק תזמון זה?')) return;
    try {
      const { error } = await supabase.from('schedules').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      alert('שגיאה במחיקה: ' + error.message);
    }
  };

  const handleDeleteTemplate = async (id, e) => {
    e.stopPropagation();
    if (!confirm('האם אתה בטוח שברצונך למחוק תבנית זו?')) return;
    try {
      const { error } = await supabase.from('templates').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      alert('שגיאה במחיקת התבנית: ' + error.message);
    }
  };

  const formatDateTime = (isoString) => {
    const d = new Date(isoString);
    return d.toLocaleString('he-IL', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatProgramName = (key) => {
    return key.split('.').pop().replace(/([A-Z])/g, ' $1').trim();
  };
  
  const getApplianceName = (haId) => {
    const appliance = dishwashers.find(d => d.haId === haId);
    return appliance ? appliance.name : 'מדיח לא ידוע';
  };

  if (isLoading) {
    return <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <RefreshCw className="pulse" size={48} color="var(--primary)" />
    </div>;
  }

  if (!isAuthenticated) {
    return (
      <main className="container">
        <div className="login-container">
          <h1>מנהל הפעלות למדיח בוש</h1>
          <p>אנא התחבר לחשבון ה-Home Connect שלך כדי להמשיך.</p>
          <a href="/api/auth/bosch/login" className="btn btn-primary">
            <PowerOff size={20} style={{ marginLeft: '8px' }} />
            התחבר לחשבון
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="container" dir="rtl">
      <h1>מנהל מדיחים</h1>

      <section className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, border: 'none' }}>תבניות מהירות</h2>
        </div>
        
        {templates.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: '1rem' }}>לא נמצאו תבניות שמורות.</p>
        ) : (
          <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
            {templates.map(t => (
              <div key={t.id} style={{ position: 'relative' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => scheduleTemplate(t)}
                  disabled={isScheduling}
                  style={{ width: '100%', height: '100%', flexDirection: 'column', alignItems: 'flex-start', padding: '1rem' }}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                    <Play size={14} style={{ marginLeft: '4px', display: 'inline', verticalAlign: 'middle' }} />
                    {t.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{t.default_time_of_day} | {getApplianceName(t.appliance_id || applianceId)}</div>
                </button>
                <button 
                  onClick={(e) => handleDeleteTemplate(t.id, e)} 
                  style={{ position: 'absolute', top: '8px', left: '8px', background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
                >
                  <Trash2 size={16}/>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2>{editingId ? 'עריכת תזמון' : 'תזמון ידני'}</h2>
        
        {/* Toggle Mode */}
        {!editingId && (
          <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem' }}>
            <button 
              className={`btn ${!isCreatingTemplate ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => setIsCreatingTemplate(false)}
              style={{ flex: 1, padding: '0.5rem' }}
            >
              הפעל פעם אחת
            </button>
            <button 
              className={`btn ${isCreatingTemplate ? 'btn-primary' : 'btn-secondary'}`} 
              onClick={() => setIsCreatingTemplate(true)}
              style={{ flex: 1, padding: '0.5rem' }}
            >
              שמור כתבנית קבועה
            </button>
          </div>
        )}

        <form onSubmit={isCreatingTemplate ? handleCreateTemplate : handleSchedule}>
          
          {isCreatingTemplate && (
            <div className="form-group">
              <label>שם התבנית (לדוגמה: תוכנית לילה בשרי)</label>
              <input 
                type="text" 
                className="form-control" 
                value={templateName} 
                onChange={e => setTemplateName(e.target.value)} 
                required 
                placeholder="הכנס שם..."
              />
            </div>
          )}

          <div className="grid-2">
            {!isCreatingTemplate && (
              <div className="form-group">
                <label><Calendar size={14} style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'middle' }}/> תאריך</label>
                <input 
                  type="date" 
                  className="form-control" 
                  value={date} 
                  onChange={e => setDate(e.target.value)} 
                  required 
                />
              </div>
            )}
            <div className="form-group">
              <label><Clock size={14} style={{ display: 'inline', marginLeft: '4px', verticalAlign: 'middle' }}/> שעת הפעלה</label>
              <input 
                type="time" 
                className="form-control" 
                value={time} 
                onChange={e => setTime(e.target.value)} 
                required 
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>בחר מדיח</label>
              <select 
                className="form-control" 
                value={applianceId} 
                onChange={e => setApplianceId(e.target.value)}
                required
              >
                {dishwashers.length === 0 && <option value="">טוען מדיחים...</option>}
                {dishwashers.map(d => (
                  <option key={d.haId} value={d.haId}>{d.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>תוכנית הפעלה</label>
              <select 
                className="form-control" 
                value={program} 
                onChange={e => setProgram(e.target.value)}
              >
                <option value="Dishcare.Dishwasher.Program.Eco50">חסכוני 50°C</option>
                <option value="Dishcare.Dishwasher.Program.Auto2">אוטומטי 45-65°C</option>
                <option value="Dishcare.Dishwasher.Program.Intensiv70">אינטנסיבי 70°C</option>
                <option value="Dishcare.Dishwasher.Program.Quick45">מהיר 45°C</option>
                <option value="Dishcare.Dishwasher.Program.Kurz60">מהיר 60°C</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={isScheduling}>
              {isScheduling ? 'שומר...' : (
                isCreatingTemplate ? 'שמור תבנית' : (editingId ? 'עדכן תזמון' : 'הפעל תזמון')
              )}
            </button>
            
            {editingId && (
              <button type="button" className="btn btn-secondary" onClick={() => {
                setEditingId(null);
                const today = new Date();
                setDate(today.toISOString().split('T')[0]);
                setTime('22:00');
              }}>
                ביטול עריכה
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card">
        <h2>הפעלות קרובות וקודמות</h2>
        {schedules.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>לא נמצאו תזמונים.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {schedules.map(schedule => (
              <div key={schedule.id} className="schedule-item">
                <div className="schedule-details">
                  <span className="schedule-time">{formatDateTime(schedule.scheduled_time)}</span>
                  <span className="schedule-program" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <strong>{getApplianceName(schedule.appliance_id)}</strong> • {formatProgramName(schedule.program_key)}
                  </span>
                  {schedule.last_error && (
                    <span style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px' }}>
                      שגיאה: {schedule.last_error} (ניסיונות: {schedule.retry_count})
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                  {schedule.status === 'pending' && <span className="badge badge-pending"><Clock size={12} style={{marginLeft:'4px'}}/> ממתין</span>}
                  {schedule.status === 'completed' && <span className="badge badge-completed"><CheckCircle size={12} style={{marginLeft:'4px'}}/> הושלם</span>}
                  {schedule.status === 'failed' && <span className="badge badge-failed"><AlertCircle size={12} style={{marginLeft:'4px'}}/> נכשל</span>}
                  
                  {schedule.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                      <button onClick={() => handleEdit(schedule)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Edit2 size={16}/> 
                      </button>
                      <button onClick={() => handleDelete(schedule.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Trash2 size={16}/> 
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
