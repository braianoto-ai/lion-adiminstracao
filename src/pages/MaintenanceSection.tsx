import { useState } from 'react'
import { useCloudTable } from '../hooks'
import { MAINT_FORM_INIT, MAINT_TYPES } from '../constants'

import type { Maintenance } from '../types'

export default 
function MaintenanceSection() {
  const [items, setItems] = useCloudTable<Maintenance>('maintenance_items', 'lion-maintenance')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(MAINT_FORM_INIT)
  const [editId, setEditId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'todos' | 'pendente' | 'atrasado' | 'feito'>('todos')


  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  function computeStatus(m: Maintenance): Maintenance['status'] {
    if (m.status === 'feito') return 'feito'
    if (!m.scheduledDate) return 'pendente'
    return new Date(m.scheduledDate) < new Date(new Date().toDateString()) ? 'atrasado' : 'pendente'
  }

  function saveItem(e: React.FormEvent) {
    e.preventDefault()
    if (!form.asset.trim() || !form.scheduledDate) return
    const base: Maintenance = {
      id: editId || Date.now().toString(),
      asset: form.asset, type: form.type, description: form.description,
      scheduledDate: form.scheduledDate, doneDate: form.doneDate,
      status: form.doneDate ? 'feito' : 'pendente',
      cost: form.cost, notes: form.notes,
    }
    const item = { ...base, status: computeStatus(base) }
    setItems(prev => editId ? prev.map(x => x.id === editId ? item : x) : [...prev, item])
    setForm(MAINT_FORM_INIT); setShowForm(false); setEditId(null)
  }

  function markDone(id: string) {
    setItems(prev => prev.map(m => m.id === id ? { ...m, status: 'feito', doneDate: new Date().toISOString().slice(0, 10) } : m))
  }

  function delItem(id: string) { setItems(prev => prev.filter(m => m.id !== id)) }

  function startEdit(m: Maintenance) {
    setForm({ asset: m.asset, type: m.type, description: m.description, scheduledDate: m.scheduledDate, doneDate: m.doneDate, cost: m.cost, notes: m.notes })
    setEditId(m.id); setShowForm(true)
  }

  const withStatus = items.map(m => ({ ...m, status: computeStatus(m) }))
  const overdueCount = withStatus.filter(m => m.status === 'atrasado').length
  const soonCount = withStatus.filter(m => {
    if (m.status !== 'pendente' || !m.scheduledDate) return false
    const diff = (new Date(m.scheduledDate).getTime() - Date.now()) / 86400000
    return diff >= 0 && diff <= 7
  }).length

  const filtered = filter === 'todos' ? withStatus : withStatus.filter(m => m.status === filter)
  const sorted = [...filtered].sort((a, b) => {
    if (a.status === 'atrasado' && b.status !== 'atrasado') return -1
    if (b.status === 'atrasado' && a.status !== 'atrasado') return 1
    return (a.scheduledDate || '').localeCompare(b.scheduledDate || '')
  })

  const fmtDate = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const fmtCurr = (v: string) => v ? parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''

  function daysLabel(m: Maintenance) {
    if (!m.scheduledDate || m.status === 'feito') return null
    const diff = Math.ceil((new Date(m.scheduledDate).getTime() - Date.now()) / 86400000)
    if (diff < 0) return { text: `${Math.abs(diff)}d atrasado`, cls: 'maint-days-late' }
    if (diff === 0) return { text: 'Hoje!', cls: 'maint-days-today' }
    if (diff <= 7) return { text: `em ${diff}d`, cls: 'maint-days-soon' }
    return { text: `em ${diff}d`, cls: 'maint-days-ok' }
  }

  return (
    <section className="maint-section">
      <div className="goals-header">
        <div>
          <h2 className="section-title">Agenda de Manutenções</h2>
          <span className="goals-sub">
            {items.length} item{items.length !== 1 ? 'ns' : ''}
            {overdueCount > 0 && <span className="rentals-overdue-badge">{overdueCount} atrasado{overdueCount > 1 ? 's' : ''}</span>}
            {soonCount > 0 && <span className="maint-soon-badge">{soonCount} esta semana</span>}
          </span>
        </div>
        <button className="goals-add-btn" onClick={() => { setShowForm(v => !v); setEditId(null); setForm(MAINT_FORM_INIT) }}>
          {showForm && !editId ? '✕ Cancelar' : '+ Nova Manutenção'}
        </button>
      </div>

      {showForm && (
        <form className="goal-form" onSubmit={saveItem}>
          <div className="goal-form-grid">
            <div className="fin-field goal-span2">
              <label>Imóvel / Veículo</label>
              <input type="text" placeholder="Ex: Casa da Praia / BMW X5" value={form.asset} onChange={e => f('asset', e.target.value)} required />
            </div>
            <div className="fin-field">
              <label>Tipo</label>
              <select value={form.type} onChange={e => f('type', e.target.value)}>
                {MAINT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="fin-field">
              <label>Descrição</label>
              <input type="text" placeholder="Detalhes adicionais" value={form.description} onChange={e => f('description', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Data prevista</label>
              <input type="date" value={form.scheduledDate} onChange={e => f('scheduledDate', e.target.value)} required />
            </div>
            <div className="fin-field">
              <label>Custo estimado (R$)</label>
              <input type="number" step="0.01" placeholder="0,00" value={form.cost} onChange={e => f('cost', e.target.value)} />
            </div>
            <div className="fin-field goal-span2">
              <label>Observações</label>
              <input type="text" placeholder="Ex: Contatar técnico João - (11) 99999-9999" value={form.notes} onChange={e => f('notes', e.target.value)} />
            </div>
          </div>
          <div className="goal-form-actions">
            <button type="button" className="btn-ghost" onClick={() => { setShowForm(false); setEditId(null); setForm(MAINT_FORM_INIT) }}>Cancelar</button>
            <button type="submit" className="btn-accent">{editId ? 'Salvar' : 'Agendar'}</button>
          </div>
        </form>
      )}

      {items.length > 0 && (
        <div className="fin-filters" style={{ marginBottom: 12 }}>
          {(['todos', 'atrasado', 'pendente', 'feito'] as const).map(s => (
            <button key={s} className={`fin-chip${filter === s ? ' fin-chip-active' : ''}${s === 'atrasado' ? ' fin-chip-red' : s === 'feito' ? ' fin-chip-green' : ''}`}
              onClick={() => setFilter(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)} ({s === 'todos' ? withStatus.length : withStatus.filter(m => m.status === s).length})
            </button>
          ))}
        </div>
      )}

      {items.length === 0 && !showForm ? (
        <div className="goals-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>
          <p>Nenhuma manutenção agendada.</p>
          <span>Agende manutenções para imóveis e veículos e receba alertas.</span>
        </div>
      ) : (
        <div className="maint-list">
          {sorted.map(m => {
            const days = daysLabel(m)
            return (
              <div key={m.id} className={`maint-item maint-${m.status}`}>
                <div className={`maint-icon-col maint-icon-${m.status}`}>
                  {m.status === 'feito'
                    ? <svg viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    : m.status === 'atrasado'
                    ? <svg viewBox="0 0 16 16" fill="none"><path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/></svg>
                    : <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/><path d="M8 5v3.5L10.5 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  }
                </div>
                <div className="maint-body">
                  <div className="maint-top">
                    <span className="maint-asset">{m.asset}</span>
                    <span className="maint-type-badge">{m.type}</span>
                  </div>
                  {m.description && <span className="maint-desc">{m.description}</span>}
                  <div className="maint-meta">
                    <span>{m.status === 'feito' ? `Feito em ${fmtDate(m.doneDate)}` : `Previsto: ${fmtDate(m.scheduledDate)}`}</span>
                    {m.cost && <span>· {fmtCurr(m.cost)}</span>}
                    {m.notes && <span className="maint-notes-inline">· {m.notes}</span>}
                  </div>
                </div>
                <div className="maint-right">
                  {days && <span className={`maint-days ${days.cls}`}>{days.text}</span>}
                  <div className="goal-actions">
                    {m.status !== 'feito' && (
                      <button className="goal-action-btn maint-done-btn" onClick={() => markDone(m.id)} title="Marcar como feito">
                        <svg viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </button>
                    )}
                    <button className="goal-action-btn" onClick={() => startEdit(m)}>
                      <svg viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                    </button>
                    <button className="goal-action-btn goal-del-btn" onClick={() => delItem(m.id)}>
                      <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
