import { useState } from 'react'
import { useCloudTable } from '../hooks'
import { TRIP_FORM_INIT, TRIP_STATUS_COLOR } from '../constants'

import type { Trip } from '../types'

export default 
function TripsPage() {
  const [trips, setTrips] = useCloudTable<Trip>('trips', 'lion-trips')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(TRIP_FORM_INIT)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newItem, setNewItem] = useState('')
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))


  function saveTrip(e: React.FormEvent) {
    e.preventDefault()
    if (!form.destination.trim() || !form.departDate) return
    const t: Trip = { ...form, id: editId || Date.now().toString(), checklist: editId ? (trips.find(x => x.id === editId)?.checklist ?? []) : [] }
    setTrips(prev => editId ? prev.map(x => x.id === editId ? t : x) : [...prev, t])
    setForm(TRIP_FORM_INIT); setShowForm(false); setEditId(null)
  }

  function startEdit(t: Trip) {
    setForm({ destination: t.destination, country: t.country, departDate: t.departDate, returnDate: t.returnDate, budget: t.budget, spent: t.spent, status: t.status, notes: t.notes })
    setEditId(t.id); setShowForm(true); setExpandedId(null)
  }

  function delTrip(id: string) { setTrips(prev => prev.filter(t => t.id !== id)) }

  function addCheckItem(id: string) {
    if (!newItem.trim()) return
    setTrips(prev => prev.map(t => t.id === id ? { ...t, checklist: [...t.checklist, { id: Date.now().toString(), text: newItem.trim(), done: false }] } : t))
    setNewItem('')
  }

  function toggleCheck(tripId: string, itemId: string) {
    setTrips(prev => prev.map(t => t.id === tripId ? { ...t, checklist: t.checklist.map(c => c.id === itemId ? { ...c, done: !c.done } : c) } : t))
  }

  function delCheck(tripId: string, itemId: string) {
    setTrips(prev => prev.map(t => t.id === tripId ? { ...t, checklist: t.checklist.filter(c => c.id !== itemId) } : t))
  }

  const daysUntil = (date: string) => {
    const diff = Math.ceil((new Date(date + 'T12:00:00').getTime() - Date.now()) / 86400000)
    if (diff < 0) return null
    if (diff === 0) return 'Hoje!'
    return `${diff} dia${diff !== 1 ? 's' : ''}`
  }

  const duration = (d1: string, d2: string) => {
    if (!d1 || !d2) return ''
    const days = Math.ceil((new Date(d2 + 'T12:00:00').getTime() - new Date(d1 + 'T12:00:00').getTime()) / 86400000)
    return `${days} dia${days !== 1 ? 's' : ''}`
  }

  const fmtDate = (s: string) => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : ''
  const fmtCurr = (v: string) => v ? parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'R$ 0'

  const sorted = [...trips].sort((a, b) => a.departDate.localeCompare(b.departDate))
  const upcoming = sorted.filter(t => t.status !== 'concluído')
  const past     = sorted.filter(t => t.status === 'concluído')

  return (
    <div className="trips-page">
      <div className="trips-header">
        <div>
          <h1 className="family-page-title">Próximas Viagens</h1>
          <p className="family-page-sub">{upcoming.length} viagem{upcoming.length !== 1 ? 's' : ''} planejada{upcoming.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="goals-add-btn" onClick={() => { setShowForm(v => !v); setEditId(null); setForm(TRIP_FORM_INIT) }}>
          {showForm && !editId ? '✕ Cancelar' : '+ Nova Viagem'}
        </button>
      </div>

      {showForm && (
        <form className="trip-form" onSubmit={saveTrip}>
          <div className="trip-form-grid">
            <div className="fin-field trip-span2">
              <label>Destino *</label>
              <input type="text" placeholder="Ex: Paris, Nova York, Florianópolis" value={form.destination} onChange={e => f('destination', e.target.value)} required />
            </div>
            <div className="fin-field">
              <label>País / Estado</label>
              <input type="text" placeholder="Ex: França" value={form.country} onChange={e => f('country', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Status</label>
              <select value={form.status} onChange={e => f('status', e.target.value)}>
                {(['planejando','confirmado','em viagem','concluído'] as Trip['status'][]).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div className="fin-field">
              <label>Data de ida *</label>
              <input type="date" value={form.departDate} onChange={e => f('departDate', e.target.value)} required />
            </div>
            <div className="fin-field">
              <label>Data de volta</label>
              <input type="date" value={form.returnDate} onChange={e => f('returnDate', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Orçamento (R$)</label>
              <input type="number" placeholder="0" value={form.budget} onChange={e => f('budget', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Gasto até agora (R$)</label>
              <input type="number" placeholder="0" value={form.spent} onChange={e => f('spent', e.target.value)} />
            </div>
            <div className="fin-field trip-span2">
              <label>Notas</label>
              <input type="text" placeholder="Observações, hotel, passagem…" value={form.notes} onChange={e => f('notes', e.target.value)} />
            </div>
          </div>
          <div className="goal-form-actions">
            <button type="button" className="btn-ghost" onClick={() => { setShowForm(false); setEditId(null) }}>Cancelar</button>
            <button type="submit" className="btn-accent">{editId ? 'Salvar alterações' : 'Adicionar viagem'}</button>
          </div>
        </form>
      )}

      {trips.length === 0 && !showForm && (
        <div className="family-empty">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" width="48" height="48" style={{ opacity: .2 }}>
            <path d="M6 38l8-16 6 8 8-12 14 20H6z"/><circle cx="36" cy="12" r="6"/>
            <path d="M2 44h44" strokeLinecap="round"/>
          </svg>
          <p>Nenhuma viagem cadastrada.</p>
          <button className="btn-accent" style={{ marginTop: 8 }} onClick={() => setShowForm(true)}>+ Adicionar viagem</button>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="trips-section">
          <div className="trips-grid">
            {upcoming.map(t => {
              const days = daysUntil(t.departDate)
              const dur  = duration(t.departDate, t.returnDate)
              const budgetNum = parseFloat(t.budget) || 0
              const spentNum  = parseFloat(t.spent)  || 0
              const pct = budgetNum > 0 ? Math.min((spentNum / budgetNum) * 100, 100) : 0
              const isExp = expandedId === t.id
              const doneCount = t.checklist.filter(c => c.done).length
              return (
                <div key={t.id} className="trip-card">
                  <div className="trip-card-top">
                    <div className="trip-dest-wrap">
                      <span className="trip-flag"><svg viewBox="0 0 20 20" fill="none"><path d="M3 13l2-5 3 2 3-8 3 2-2 5 3 1-1 3-4-1-1 3-2-1 1-3-4-1-.5 1.5-1.5-1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg></span>
                      <div>
                        <div className="trip-destination">{t.destination}</div>
                        {t.country && <div className="trip-country">{t.country}</div>}
                      </div>
                    </div>
                    <div className="trip-actions-wrap">
                      {days && <span className="trip-countdown" style={{ color: TRIP_STATUS_COLOR[t.status] }}>{days}</span>}
                      <div className="goal-actions">
                        <button className="goal-action-btn" onClick={() => startEdit(t)}><svg viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg></button>
                        <button className="goal-action-btn goal-del-btn" onClick={() => delTrip(t.id)}><svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button>
                      </div>
                    </div>
                  </div>

                  <div className="trip-meta">
                    <span className="trip-status-badge" style={{ background: TRIP_STATUS_COLOR[t.status] + '22', color: TRIP_STATUS_COLOR[t.status], borderColor: TRIP_STATUS_COLOR[t.status] + '44' }}>{t.status}</span>
                    <span className="trip-dates">{fmtDate(t.departDate)}{t.returnDate && ` → ${fmtDate(t.returnDate)}`}{dur && ` · ${dur}`}</span>
                  </div>

                  {budgetNum > 0 && (
                    <div className="trip-budget">
                      <div className="trip-budget-row">
                        <span>Orçamento</span>
                        <span>{fmtCurr(t.spent)} / {fmtCurr(t.budget)}</span>
                      </div>
                      <div className="goal-bar-track">
                        <div className={`goal-bar-fill ${pct > 90 ? 'bar-red' : pct > 70 ? 'bar-amber' : 'bar-blue'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}

                  <button className="trip-checklist-toggle" onClick={() => setExpandedId(isExp ? null : t.id)}>
                    <span>Checklist {t.checklist.length > 0 && `(${doneCount}/${t.checklist.length})`}</span>
                    <svg viewBox="0 0 16 16" fill="none" style={{ transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </button>

                  {isExp && (
                    <div className="trip-checklist">
                      {t.checklist.map(c => (
                        <div key={c.id} className="trip-check-item">
                          <button className={`trip-check-box${c.done ? ' checked' : ''}`} onClick={() => toggleCheck(t.id, c.id)}>
                            {c.done && <svg viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                          </button>
                          <span style={{ textDecoration: c.done ? 'line-through' : 'none', color: c.done ? 'var(--text)' : 'var(--text2)', fontSize: 12 }}>{c.text}</span>
                          <button className="goal-action-btn goal-del-btn" style={{ marginLeft:'auto', width:18, height:18 }} onClick={() => delCheck(t.id, c.id)}>
                            <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          </button>
                        </div>
                      ))}
                      <div className="trip-check-add">
                        <input placeholder="Adicionar item…" value={newItem} onChange={e => setNewItem(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCheckItem(t.id) } }} />
                        <button className="btn-accent" onClick={() => addCheckItem(t.id)} style={{ padding:'4px 10px', fontSize:11 }}>+</button>
                      </div>
                    </div>
                  )}

                  {t.notes && <div className="trip-notes">{t.notes}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div className="trips-section">
          <div className="trips-section-title">Viagens concluídas</div>
          <div className="trips-grid">
            {past.map(t => (
              <div key={t.id} className="trip-card trip-card-past">
                <div className="trip-card-top">
                  <div className="trip-dest-wrap">
                    <span className="trip-flag" style={{ opacity:.5 }}>✈️</span>
                    <div>
                      <div className="trip-destination" style={{ opacity:.7 }}>{t.destination}</div>
                      {t.country && <div className="trip-country">{t.country}</div>}
                    </div>
                  </div>
                  <div className="goal-actions">
                    <button className="goal-action-btn goal-del-btn" onClick={() => delTrip(t.id)}><svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button>
                  </div>
                </div>
                <div className="trip-meta">
                  <span className="trip-dates">{fmtDate(t.departDate)}{t.returnDate && ` → ${fmtDate(t.returnDate)}`}</span>
                  {parseFloat(t.spent) > 0 && <span className="trip-dates">Gasto: {fmtCurr(t.spent)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
