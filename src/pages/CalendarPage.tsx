import { useState } from 'react'
import { useCloudTable } from '../hooks'
import { CAL_COLORS, CAL_FORM_INIT, CAL_LABELS } from '../constants'
import { buildAutoEvents } from '../utils'
import type { CalEvent } from '../types'

export default 
function CalendarPage() {
  const [userEvents, setUserEvents] = useCloudTable<CalEvent>('calendar_events', 'lion-calendar')
  const [autoEvents] = useState<CalEvent[]>(() => buildAutoEvents())
  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...CAL_FORM_INIT })


  const allEvents = [...userEvents, ...autoEvents]
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  function saveEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !selectedDate) return
    const event: CalEvent = { ...form, date: selectedDate, id: Date.now().toString() }
    setUserEvents(prev => {
      const next = [...prev, event]
      localStorage.setItem('lion-calendar', JSON.stringify(next))
      return next
    })
    setForm({ ...CAL_FORM_INIT }); setShowForm(false)
  }

  function delEvent(id: string) { setUserEvents(prev => prev.filter(e => e.id !== id)) }

  // Build calendar grid
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1 // Mon-start
  const today = new Date().toISOString().slice(0, 10)

  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const eventsOnDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return allEvents.filter(e => e.date === dateStr)
  }

  const selectedEvents = selectedDate ? allEvents.filter(e => e.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time)) : []

  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

  return (
    <div className="cal-page">
      <div className="cal-layout">
        {/* Calendar grid */}
        <div className="cal-main">
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10 4L6 8l4 4"/></svg>
            </button>
            <h2 className="cal-month-title">{monthNames[month]} {year}</h2>
            <button className="cal-nav-btn" onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 4l4 4-4 4"/></svg>
            </button>
            <button className="cal-today-btn" onClick={() => { const d = new Date(); d.setDate(1); setCurrentMonth(d); setSelectedDate(today) }}>Hoje</button>
          </div>

          <div className="cal-grid">
            {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d => (
              <div key={d} className="cal-weekday">{d}</div>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="cal-cell cal-cell-empty" />
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayEvents = eventsOnDay(day)
              const isToday = dateStr === today
              const isSelected = dateStr === selectedDate
              return (
                <button key={dateStr} className={`cal-cell${isToday ? ' cal-today' : ''}${isSelected ? ' cal-selected' : ''}`}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}>
                  <span className="cal-day-num">{day}</span>
                  <div className="cal-dots">
                    {dayEvents.slice(0, 3).map(ev => (
                      <span key={ev.id} className="cal-dot" style={{ background: CAL_COLORS[ev.category] }} />
                    ))}
                    {dayEvents.length > 3 && <span className="cal-dot-more">+{dayEvents.length - 3}</span>}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="cal-legend">
            {Object.entries(CAL_COLORS).map(([k, c]) => (
              <div key={k} className="cal-legend-item">
                <span className="cal-dot" style={{ background: c }} />
                <span>{CAL_LABELS[k as CalEvent['category']]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Day panel */}
        {selectedDate && <div className="cal-day-overlay" onClick={() => setSelectedDate(null)} />}
        <div className={`cal-sidebar${selectedDate ? ' cal-day-open' : ''}`}>
          {!selectedDate ? (
            <div className="cal-no-day">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="32" height="32" style={{ opacity: .2 }}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round"/></svg>
              <span>Selecione um dia</span>
            </div>
          ) : (
            <>
              <div className="cal-day-header">
                <div>
                  <div className="cal-day-title">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                  <div className="cal-day-count">{selectedEvents.length} evento{selectedEvents.length !== 1 ? 's' : ''}</div>
                </div>
                <button className="goals-add-btn" onClick={() => { setShowForm(v => !v); setForm({ ...CAL_FORM_INIT, date: selectedDate }) }}>
                  {showForm ? '✕' : '+ Evento'}
                </button>
              </div>

              {showForm && (
                <form className="cal-form" onSubmit={saveEvent}>
                  <div className="cal-form-date-label">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="3" width="14" height="11" rx="2"/><path d="M5 1v3M11 1v3M1 7h14" strokeLinecap="round"/></svg>
                    {selectedDate ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
                  </div>
                  <div className="fin-field">
                    <label>Título *</label>
                    <input type="text" value={form.title} onChange={e => f('title', e.target.value)} placeholder="Ex: Reunião de negócios" required autoFocus />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <div className="fin-field">
                      <label>Horário</label>
                      <input type="time" value={form.time} onChange={e => f('time', e.target.value)} />
                    </div>
                    <div className="fin-field">
                      <label>Categoria</label>
                      <select value={form.category} onChange={e => f('category', e.target.value)}>
                        {Object.entries(CAL_LABELS).filter(([k]) => k !== 'sistema').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="fin-field">
                    <label>Notas</label>
                    <input type="text" value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Opcional" />
                  </div>
                  <div className="goal-form-actions">
                    <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                    <button type="submit" className="btn-accent">Salvar</button>
                  </div>
                </form>
              )}

              {selectedEvents.length === 0 && !showForm ? (
                <div className="cal-empty-day">Nenhum evento neste dia.</div>
              ) : (
                <div className="cal-events-list">
                  {selectedEvents.map(ev => (
                    <div key={ev.id} className="cal-event-item" style={{ borderLeftColor: CAL_COLORS[ev.category] }}>
                      <div className="cal-event-top">
                        <span className="cal-event-cat" style={{ color: CAL_COLORS[ev.category] }}>{CAL_LABELS[ev.category]}</span>
                        {ev.time && <span className="cal-event-time">{ev.time}</span>}
                        {!ev.auto && <button className="goal-action-btn goal-del-btn" onClick={() => delEvent(ev.id)} style={{ marginLeft:'auto' }}>
                          <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </button>}
                        {ev.auto && <span className="cal-event-auto">automático</span>}
                      </div>
                      <div className="cal-event-title">{ev.title}</div>
                      {ev.notes && <div className="cal-event-notes">{ev.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
