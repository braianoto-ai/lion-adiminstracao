import { useState } from 'react'
import { useCloudTable } from '../hooks'
import { GOAL_CATS, GOAL_COLORS, GOAL_FORM_INIT } from '../constants'
import type { Goal } from '../types'
import { exportGoalsPDF } from '../exportUtils'

export default 
function GoalsPage() {
  const [goals, setGoals] = useCloudTable<Goal>('goals', 'lion-goals')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [form, setForm]         = useState(GOAL_FORM_INIT)
  const [filterCat, setFilterCat] = useState('Todas')
  const [sortBy, setSortBy] = useState<'deadline' | 'pct-asc' | 'pct-desc' | 'missing'>('deadline')
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))


  function saveGoal(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.target) return
    const g: Goal = {
      id: editId || Date.now().toString(),
      name: form.name.trim(),
      category: form.category,
      target: parseFloat(form.target) || 0,
      current: parseFloat(form.current) || 0,
      deadline: form.deadline,
    }
    setGoals(prev => editId ? prev.map(x => x.id === editId ? g : x) : [...prev, g])
    setForm(GOAL_FORM_INIT); setShowForm(false); setEditId(null)
  }

  function startEdit(g: Goal) {
    setForm({ name: g.name, category: g.category, target: String(g.target), current: String(g.current), deadline: g.deadline })
    setEditId(g.id); setShowForm(true)
  }

  function delGoal(id: string) { setGoals(prev => prev.filter(g => g.id !== id)) }

  function addDeposit(id: string, amount: number) {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, current: Math.min(g.current + amount, g.target) } : g))
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  const pct = (g: Goal) => g.target > 0 ? Math.min((g.current / g.target) * 100, 100) : 0

  const daysLeft = (deadline: string) => {
    if (!deadline) return null
    const d = new Date(deadline + 'T12:00:00')
    if (isNaN(d.getTime())) return null
    const diff = Math.ceil((d.getTime() - Date.now()) / 86400000)
    if (diff < 0)   return { label: 'Vencida', color: 'var(--red)' }
    if (diff === 0)  return { label: 'Hoje', color: 'var(--amber)' }
    if (diff <= 30)  return { label: `${diff}d`, color: 'var(--amber)' }
    const months = Math.round(diff / 30)
    return { label: `${months}m`, color: 'var(--text)' }
  }

  const barColor = (g: Goal) => {
    const p = pct(g)
    if (p >= 100) return 'goal-bar-done'
    if (p >= 70)  return 'goal-bar-green'
    if (p >= 40)  return 'goal-bar-amber'
    return 'goal-bar-blue-solid'
  }

  const cats = ['Todas', ...GOAL_CATS.filter(c => goals.some(g => g.category === c))]
  const filtered = filterCat === 'Todas' ? goals : goals.filter(g => g.category === filterCat)
  const shown = [...filtered].sort((a, b) => {
    if (sortBy === 'deadline') return (a.deadline || '9999') < (b.deadline || '9999') ? -1 : 1
    if (sortBy === 'pct-asc')  return pct(a) - pct(b)
    if (sortBy === 'pct-desc') return pct(b) - pct(a)
    return (b.target - b.current) - (a.target - a.current)
  })
  const totalSaved  = goals.reduce((s, g) => s + g.current, 0)
  const totalTarget = goals.reduce((s, g) => s + g.target, 0)
  const done        = goals.filter(g => g.current >= g.target).length
  const urgent      = goals.filter(g => {
    if (g.current >= g.target || !g.deadline) return false
    const d = new Date(g.deadline + 'T12:00:00')
    if (isNaN(d.getTime())) return false
    const diff = Math.ceil((d.getTime() - Date.now()) / 86400000)
    return diff >= 0 && diff <= 30
  }).length
  const globalPct = totalTarget > 0 ? Math.min(Math.round((totalSaved / totalTarget) * 100), 100) : 0

  function projection(g: Goal): string | null {
    const missing = g.target - g.current
    if (missing <= 0) return null
    if (!g.deadline) return `falta ${fmt(missing)}`
    const dl = new Date(g.deadline + 'T12:00:00')
    if (isNaN(dl.getTime())) return `falta ${fmt(missing)}`
    const months = Math.max(1, Math.ceil((dl.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30)))
    const monthly = missing / months
    const label = dl.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    return `~${fmt(monthly)}/mês até ${label}`
  }

  return (
    <div className="goals-page">
      <div className="goals-page-header">
        <div>
          <h1 className="family-page-title">Metas Financeiras</h1>
          <p className="family-page-sub">{goals.length} meta{goals.length !== 1 ? 's' : ''} · {done} concluída{done !== 1 ? 's' : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {goals.length > 0 && (
            <button className="btn-ghost export-btn-sm" onClick={() => exportGoalsPDF(goals)} title="Exportar PDF">
              <svg viewBox="0 0 14 14" fill="none" width="12" height="12"><path d="M7 9V2M4 6l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 10v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
              PDF
            </button>
          )}
          <button className="goals-add-btn" onClick={() => { setShowForm(v => !v); setEditId(null); setForm(GOAL_FORM_INIT) }}>
            {showForm && !editId ? '✕ Cancelar' : '+ Nova Meta'}
          </button>
        </div>
      </div>

      {goals.length > 0 && (
        <div className="goals-hero">
          <div className="goals-hero-stats">
            <span className="goals-hero-saved">{fmt(totalSaved)}</span>
            <span className="goals-hero-sep">de</span>
            <span className="goals-hero-target">{fmt(totalTarget)}</span>
            <span className="goals-hero-dot">·</span>
            <span className="goals-hero-meta">{goals.length} meta{goals.length !== 1 ? 's' : ''}</span>
            <span className="goals-hero-dot">·</span>
            <span className="goals-hero-pct">{globalPct}%</span>
          </div>
          <div className="goals-hero-bar-track">
            <div className="goals-hero-bar-fill" style={{ width: `${globalPct}%` }} />
          </div>
          {(urgent > 0 || done > 0) && (
            <div className="goals-hero-chips">
              {urgent > 0 && (
                <span className="goals-hero-chip goals-hero-chip-amber">
                  ⚠ {urgent} com prazo próximo
                </span>
              )}
              {done > 0 && (
                <span className="goals-hero-chip goals-hero-chip-green">
                  ✓ {done} concluída{done !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {showForm && (
        <form className="goals-page-form" onSubmit={saveGoal}>
          <div className="goals-page-form-grid">
            <div className="fin-field gp-span2">
              <label>Nome da meta *</label>
              <input type="text" placeholder="Ex: Casa própria, Viagem Europa…" value={form.name} onChange={e => f('name', e.target.value)} required />
            </div>
            <div className="fin-field">
              <label>Categoria</label>
              <select value={form.category} onChange={e => f('category', e.target.value)}>
                {GOAL_CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="fin-field">
              <label>Prazo</label>
              <input type="date" value={form.deadline} onChange={e => f('deadline', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Valor alvo (R$) *</label>
              <input type="number" placeholder="0" value={form.target} onChange={e => f('target', e.target.value)} required min="1" />
            </div>
            <div className="fin-field">
              <label>Valor atual (R$)</label>
              <input type="number" placeholder="0" value={form.current} onChange={e => f('current', e.target.value)} min="0" />
            </div>
          </div>
          <div className="goal-form-actions">
            <button type="button" className="btn-ghost" onClick={() => { setShowForm(false); setEditId(null) }}>Cancelar</button>
            <button type="submit" className="btn-accent">{editId ? 'Salvar alterações' : 'Criar meta'}</button>
          </div>
        </form>
      )}

      {goals.length === 0 && !showForm && (
        <div className="family-empty">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" width="48" height="48" style={{ opacity:.2 }}>
            <circle cx="24" cy="24" r="20"/><circle cx="24" cy="24" r="12"/><circle cx="24" cy="24" r="4"/>
            <line x1="24" y1="4" x2="24" y2="44" strokeLinecap="round"/>
            <line x1="4" y1="24" x2="44" y2="24" strokeLinecap="round"/>
          </svg>
          <p>Nenhuma meta cadastrada ainda.</p>
          <button className="btn-accent" style={{ marginTop: 8 }} onClick={() => setShowForm(true)}>+ Criar primeira meta</button>
        </div>
      )}

      {goals.length > 1 && (
        <div className="goals-page-filters">
          <div className="goals-filter-cats">
            {cats.map(c => (
              <button key={c} className={`goals-filter-btn${filterCat === c ? ' active' : ''}`} onClick={() => setFilterCat(c)}>{c}</button>
            ))}
          </div>
          <select className="goals-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}>
            <option value="deadline">Prazo ↑</option>
            <option value="pct-desc">Progresso ↓</option>
            <option value="pct-asc">Progresso ↑</option>
            <option value="missing">Valor faltante</option>
          </select>
        </div>
      )}

      {shown.length > 0 && (
        <div className="goals-page-grid">
          {shown.map(g => {
            const p = pct(g)
            const dl = daysLeft(g.deadline)
            const color = GOAL_COLORS[g.category] || 'var(--text)'
            const isDone = p >= 100
            const isUrgent = !isDone && !!g.deadline && (() => {
              const d = new Date(g.deadline + 'T12:00:00')
              if (isNaN(d.getTime())) return false
              const diff = Math.ceil((d.getTime() - Date.now()) / 86400000)
              return diff >= 0 && diff <= 30
            })()
            const proj = !isDone ? projection(g) : null
            return (
              <div key={g.id} className={`goals-page-card${isDone ? ' gpc-done' : ''}${isUrgent ? ' gpc-urgent' : ''}`} style={{ '--gpc-color': color } as React.CSSProperties}>
                <div className="gpc-top">
                  <div className="gpc-cat-dot" style={{ background: color }} />
                  <span className="gpc-cat">{g.category}</span>
                  {dl && <span className="gpc-deadline" style={{ color: dl.color }}>{dl.label}</span>}
                  <div className="goal-actions" style={{ marginLeft: 'auto' }}>
                    <button className="goal-action-btn" onClick={() => startEdit(g)}>
                      <svg viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                    </button>
                    <button className="goal-action-btn goal-del-btn" onClick={() => delGoal(g.id)}>
                      <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                </div>

                <div className="gpc-name">{g.name}</div>

                <div className="gpc-amounts">
                  <span className="gpc-current">{fmt(g.current)}</span>
                  <span className="gpc-sep">/</span>
                  <span className="gpc-target">{fmt(g.target)}</span>
                </div>

                <div className="goal-bar-track">
                  <div className={`goal-bar-fill ${barColor(g)}`} style={{ width: `${p}%` }} />
                </div>

                <div className="gpc-footer">
                  <span className="gpc-pct" style={{ color: isDone ? 'var(--green)' : 'var(--text2)' }}>{Math.round(p)}%{isDone ? ' ✓' : ''}</span>
                  {!isDone && (
                    <GoalDepositBtn goalId={g.id} onDeposit={addDeposit} />
                  )}
                </div>
                {proj && <div className="gpc-projection">{proj}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function GoalDepositBtn({ goalId, onDeposit }: { goalId: string; onDeposit: (id: string, amount: number) => void }) {
  const [open, setOpen] = useState(false)
  const [val, setVal]   = useState('')
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const n = parseFloat(val)
    if (!n || n <= 0) return
    onDeposit(goalId, n); setVal(''); setOpen(false)
  }
  if (!open) return (
    <button className="gpc-deposit-btn" onClick={() => setOpen(true)}>+ Depositar</button>
  )
  return (
    <form className="gpc-deposit-form" onSubmit={submit}>
      <input autoFocus type="number" placeholder="R$ valor" value={val} onChange={e => setVal(e.target.value)} min="0.01" step="0.01" />
      <button type="submit" className="btn-accent" style={{ padding:'3px 10px', fontSize:11 }}>OK</button>
      <button type="button" className="btn-ghost" style={{ padding:'3px 8px', fontSize:11 }} onClick={() => setOpen(false)}>✕</button>
    </form>
  )
}
