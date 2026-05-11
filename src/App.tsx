import { useState, useEffect, useCallback } from 'react'
import L from 'leaflet'
import './App.css'
import { supabase } from './lib/supabase'
import LoginPage from './LoginPage'
import type { User } from '@supabase/supabase-js'
import { UserCtx, DATA_KEYS } from './context'
import { useCloudTable, useSyncError } from './hooks'
import type { ModalType, SidebarPage, TerraFazenda, TerraTalhao, Folder, Goal, Transaction, Rental, Vehicle, Maintenance, Collector, Bill, AppAlert, SearchResult, FamilyMember, Imovel, Produto, CalEvent } from './types'
import { TALHAO_USOS } from './constants'
import { effectiveStatus, buildAutoEvents, fmtCurrency } from './utils'
import TerraPage from './pages/TerraPage'
import PublicMapPage from './pages/PublicMapPage'
import PaymentHubPage from './pages/PaymentHubPage'
import PatrimonioPage from './pages/PatrimonioPage'
import FinancePanel, { FinancingSimulator } from './pages/FinancePanel'
import VehicleHistorySection from './pages/VehicleHistorySection'
import CalendarPage from './pages/CalendarPage'
import GoalsPage from './pages/GoalsPage'
import TripsPage from './pages/TripsPage'
import RentalsSection from './pages/RentalsSection'
import MaintenanceSection from './pages/MaintenanceSection'
import PatrimonySection from './pages/PatrimonySection'
import DocumentsPanel from './pages/DocumentsPanel'
import NotesSection from './pages/NotesSection'
import SettingsPage from './pages/SettingsPage'
import Calculator from './components/Calculator'
import Notepad from './components/Notepad'
import NewItemModal from './components/NewItemModal'
import AlertsPanel from './components/AlertsPanel'
import SharePanel from './components/SharePanel'
import OnboardingWizard from './components/OnboardingWizard'




function buildAlerts(): AppAlert[] {
  const alerts: AppAlert[] = []
  const now = Date.now()

  const vehicles: Vehicle[] = (() => { try { return JSON.parse(localStorage.getItem('lion-vehicles') || '[]') } catch { return [] } })()
  for (const v of vehicles) {
    const kmLeft = v.nextRevisionKm > 0 ? v.nextRevisionKm - v.currentKm : null
    const daysRev = v.nextRevisionDate ? Math.ceil((new Date(v.nextRevisionDate + 'T12:00:00').getTime() - now) / 86400000) : null
    if (kmLeft !== null && kmLeft <= 0) alerts.push({ id: `veh-km-${v.id}`, severity: 'danger', category: 'Veículo', title: `${v.name} — revisão atrasada`, detail: `Passou ${Math.abs(kmLeft).toLocaleString('pt-BR')} km do limite` })
    else if (kmLeft !== null && kmLeft <= 1000) alerts.push({ id: `veh-km-${v.id}`, severity: 'warning', category: 'Veículo', title: `${v.name} — revisão próxima`, detail: `Faltam ${kmLeft.toLocaleString('pt-BR')} km` })
    if (daysRev !== null && daysRev < 0) alerts.push({ id: `veh-dt-${v.id}`, severity: 'danger', category: 'Veículo', title: `${v.name} — revisão atrasada`, detail: `Venceu há ${Math.abs(daysRev)} dia${Math.abs(daysRev) !== 1 ? 's' : ''}` })
    else if (daysRev !== null && daysRev <= 14) alerts.push({ id: `veh-dt-${v.id}`, severity: 'warning', category: 'Veículo', title: `${v.name} — revisão em breve`, detail: `Daqui a ${daysRev} dia${daysRev !== 1 ? 's' : ''}` })
    if (v.ipvaExpiry) {
      const d = Math.ceil((new Date(v.ipvaExpiry + 'T12:00:00').getTime() - now) / 86400000)
      if (d < 0) alerts.push({ id: `veh-ipva-${v.id}`, severity: 'danger', category: 'Veículo', title: `${v.name} — IPVA vencido`, detail: `Venceu há ${Math.abs(d)} dia${Math.abs(d) !== 1 ? 's' : ''}` })
      else if (d <= 30) alerts.push({ id: `veh-ipva-${v.id}`, severity: 'warning', category: 'Veículo', title: `${v.name} — IPVA vence em ${d}d`, detail: new Date(v.ipvaExpiry + 'T12:00:00').toLocaleDateString('pt-BR') })
    }
    if (v.insuranceExpiry) {
      const d = Math.ceil((new Date(v.insuranceExpiry + 'T12:00:00').getTime() - now) / 86400000)
      if (d < 0) alerts.push({ id: `veh-ins-${v.id}`, severity: 'danger', category: 'Veículo', title: `${v.name} — Seguro vencido`, detail: `Venceu há ${Math.abs(d)} dia${Math.abs(d) !== 1 ? 's' : ''}` })
      else if (d <= 30) alerts.push({ id: `veh-ins-${v.id}`, severity: 'warning', category: 'Veículo', title: `${v.name} — Seguro vence em ${d}d`, detail: new Date(v.insuranceExpiry + 'T12:00:00').toLocaleDateString('pt-BR') })
    }
  }

  const maints: Maintenance[] = (() => { try { return JSON.parse(localStorage.getItem('lion-maintenance') || '[]') } catch { return [] } })()
  for (const m of maints.filter(x => x.status !== 'feito')) {
    if (!m.scheduledDate) continue
    const d = Math.ceil((new Date(m.scheduledDate + 'T12:00:00').getTime() - now) / 86400000)
    if (d < 0) alerts.push({ id: `maint-${m.id}`, severity: 'danger', category: 'Manutenção', title: `${m.asset} — ${m.type} atrasado`, detail: `Venceu há ${Math.abs(d)} dia${Math.abs(d) !== 1 ? 's' : ''}` })
    else if (d <= 7) alerts.push({ id: `maint-${m.id}`, severity: 'warning', category: 'Manutenção', title: `${m.asset} — ${m.type} em breve`, detail: `Daqui a ${d} dia${d !== 1 ? 's' : ''}` })
  }

  const rentals: Rental[] = (() => { try { return JSON.parse(localStorage.getItem('lion-rentals') || '[]') } catch { return [] } })()
  const curMonth = new Date().toISOString().slice(0, 7)
  for (const r of rentals) {
    const status = r.payments?.[curMonth]
    if (status === 'atrasado') alerts.push({ id: `rent-${r.id}`, severity: 'danger', category: 'Aluguel', title: `${r.property} — aluguel atrasado`, detail: `${r.tenant} · ${r.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` })
    else if (!status || status === 'pendente') {
      const today = new Date().getDate()
      if (today >= r.dueDay) alerts.push({ id: `rent-${r.id}`, severity: 'warning', category: 'Aluguel', title: `${r.property} — aluguel pendente`, detail: `Vencimento dia ${r.dueDay}` })
    }
  }

  const goals: Goal[] = (() => { try { return JSON.parse(localStorage.getItem('lion-goals') || '[]') } catch { return [] } })()
  for (const g of goals) {
    if (!g.deadline) continue
    const d = Math.ceil((new Date(g.deadline + 'T12:00:00').getTime() - now) / 86400000)
    if (d < 0 && g.current < g.target) alerts.push({ id: `goal-${g.id}`, severity: 'danger', category: 'Meta', title: `${g.name} — prazo vencido`, detail: `${((g.current / g.target) * 100).toFixed(0)}% atingido` })
    else if (d <= 30 && g.current < g.target) alerts.push({ id: `goal-${g.id}`, severity: 'warning', category: 'Meta', title: `${g.name} — prazo em ${d}d`, detail: `${((g.current / g.target) * 100).toFixed(0)}% atingido` })
  }

  const bills: Bill[] = (() => { try { return JSON.parse(localStorage.getItem('lion-bills') || '[]') } catch { return [] } })()
  const collectors: Collector[] = (() => { try { return JSON.parse(localStorage.getItem('lion-collectors') || '[]') } catch { return [] } })()
  for (const b of bills) {
    if (b.status === 'pago' || b.status === 'cancelado') continue
    const d = Math.ceil((new Date(b.dueDate + 'T23:59:59').getTime() - now) / 86400000)
    const coll = collectors.find(c => c.id === b.collectorId)
    const name = coll?.name || b.description || 'Conta'
    const valor = b.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    if (d < 0) alerts.push({ id: `bill-${b.id}`, severity: 'danger', category: 'Conta', title: `${name} — vencida`, detail: `${valor} · Venceu há ${Math.abs(d)} dia${Math.abs(d) !== 1 ? 's' : ''}` })
    else if (d <= 5) alerts.push({ id: `bill-${b.id}`, severity: 'warning', category: 'Conta', title: `${name} — vence em ${d}d`, detail: `${valor} · ${new Date(b.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}` })
  }

  alerts.sort((a, b) => (a.severity === 'danger' ? 0 : 1) - (b.severity === 'danger' ? 0 : 1))
  return alerts
}


// ─── Appearance constants ──────────────────────────────────────────────────────

const THEMES = [
  { id: 'dark',     label: 'Meia-Noite', swatch: '#050505', bg: '#0f0f0f' },
  { id: 'charcoal', label: 'Grafite',    swatch: '#1a1a1a', bg: '#242424' },
  { id: 'slate',    label: 'Oceano',     swatch: '#0a1628', bg: '#152236' },
  { id: 'light',    label: 'Claro',      swatch: '#f5f5f5', bg: '#e5e5e5' },
]

const FONT_SIZES = [
  { id: 'compact',     label: 'A−',  size: '13px', title: 'Compacto' },
  { id: 'normal',      label: 'A',   size: '14px', title: 'Normal' },
  { id: 'comfortable', label: 'A+',  size: '15px', title: 'Confortável' },
  { id: 'large',       label: 'A++', size: '16px', title: 'Grande' },
]

const ACCENT_COLORS = [
  { id: 'blue',   label: 'Azul',     color: '#3b82f6', light: '#60a5fa' },
  { id: 'red',    label: 'Vermelho', color: '#c0392b', light: '#e74c3c' },
  { id: 'green',  label: 'Verde',   color: '#059669', light: '#34d399' },
  { id: 'purple', label: 'Roxo',    color: '#7c3aed', light: '#a78bfa' },
  { id: 'pink',   label: 'Rosa',    color: '#be185d', light: '#f472b6' },
  { id: 'amber',  label: 'Âmbar',   color: '#b45309', light: '#fbbf24' },
  { id: 'cyan',   label: 'Ciano',   color: '#0e7490', light: '#22d3ee' },
  { id: 'indigo', label: 'Índigo',  color: '#4338ca', light: '#818cf8' },
]




// ─── Search ───────────────────────────────────────────────────────────────────

function buildSearchIndex(q: string): SearchResult[] {
  if (q.trim().length < 2) return []
  const lq = q.toLowerCase()
  const results: SearchResult[] = []
  const push = (item: SearchResult) => { if (results.length < 12) results.push(item) }

  const txs: Transaction[] = (() => { try { return JSON.parse(localStorage.getItem('lion-txs') || '[]') } catch { return [] } })()
  txs.filter(t => t.description?.toLowerCase().includes(lq) || t.category?.toLowerCase().includes(lq)).forEach(t => {
    push({ id: t.id, type: 'Transação', label: t.description || t.category, sub: `${t.type === 'receita' ? '+' : '-'} R$ ${t.amount.toLocaleString('pt-BR')} · ${t.category}`, color: t.type === 'receita' ? 'green' : 'red', section: 'fin' })
  })

  const goals: Goal[] = (() => { try { return JSON.parse(localStorage.getItem('lion-goals') || '[]') } catch { return [] } })()
  goals.filter(g => g.name?.toLowerCase().includes(lq) || g.category?.toLowerCase().includes(lq)).forEach(g => {
    push({ id: g.id, type: 'Meta', label: g.name, sub: `R$ ${(g.current||0).toLocaleString('pt-BR')} / R$ ${(g.target||0).toLocaleString('pt-BR')}`, color: 'blue', section: 'goals' })
  })

  const rentals: Rental[] = (() => { try { return JSON.parse(localStorage.getItem('lion-rentals') || '[]') } catch { return [] } })()
  rentals.filter(r => r.property?.toLowerCase().includes(lq) || r.tenant?.toLowerCase().includes(lq)).forEach(r => {
    push({ id: r.id, type: 'Aluguel', label: r.property, sub: `${r.tenant} · R$ ${(r.value||0).toLocaleString('pt-BR')}/mês`, color: 'amber', section: 'rentals' })
  })

  const vehicles: Vehicle[] = (() => { try { return JSON.parse(localStorage.getItem('lion-vehicles') || '[]') } catch { return [] } })()
  vehicles.filter(v => v.name?.toLowerCase().includes(lq) || v.plate?.toLowerCase().includes(lq)).forEach(v => {
    push({ id: v.id, type: 'Veículo', label: v.name, sub: `${v.plate} · ${v.year} · ${(v.currentKm||0).toLocaleString('pt-BR')} km`, color: 'amber', section: 'vehicles' })
  })

  const maint: Maintenance[] = (() => { try { return JSON.parse(localStorage.getItem('lion-maintenance') || '[]') } catch { return [] } })()
  maint.filter(m => m.asset?.toLowerCase().includes(lq) || m.description?.toLowerCase().includes(lq)).forEach(m => {
    push({ id: m.id, type: 'Manutenção', label: m.asset, sub: `${m.description} · ${m.scheduledDate}`, color: 'purple', section: 'maint' })
  })

  const npFolders: Folder[] = (() => { try { return JSON.parse(localStorage.getItem('np-folders') || '[]') } catch { return [] } })()
  npFolders.forEach(folder => {
    folder.notes.filter(n => n.title?.toLowerCase().includes(lq) || n.content?.toLowerCase().includes(lq)).forEach(n => {
      push({ id: `${folder.id}:${n.id}`, type: 'Nota', label: n.title || 'Sem título', sub: `${folder.name} · ${n.content ? n.content.substring(0, 50) : 'Sem conteúdo'}`, color: 'blue', section: 'note' })
    })
  })

  return results
}


// ─── Family Page ─────────────────────────────────────────────────────────────

const MEMBER_COLORS = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#84cc16','#60a5fa']
const MEMBER_ROLES  = ['Responsável','Cônjuge','Filho(a)','Dependente','Sócio(a)','Outro']
const MEMBER_FORM_INIT = { name: '', role: MEMBER_ROLES[0], color: MEMBER_COLORS[0] }

function FamilyPage() {
  const [members, setMembers] = useCloudTable<FamilyMember>('family_members', 'lion-family')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(MEMBER_FORM_INIT)
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))


  const initials = (name: string) => name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)

  function saveMember(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    const m: FamilyMember = { id: editId || Date.now().toString(), name: form.name.trim(), role: form.role, color: form.color }
    setMembers(prev => editId ? prev.map(x => x.id === editId ? m : x) : [...prev, m])
    setForm(MEMBER_FORM_INIT); setShowForm(false); setEditId(null)
  }

  function startEdit(m: FamilyMember) {
    setForm({ name: m.name, role: m.role, color: m.color })
    setEditId(m.id); setShowForm(true)
  }

  function delMember(id: string) { setMembers(prev => prev.filter(m => m.id !== id)) }

  // spending per member from transactions
  const txs: Transaction[] = (() => { try { return JSON.parse(localStorage.getItem('lion-txs') || '[]') } catch { return [] } })()
  const spending = (id: string) => txs.filter(t => (t as Transaction & { memberId?: string }).memberId === id && t.type === 'despesa').reduce((s, t) => s + t.amount, 0)
  const income   = (id: string) => txs.filter(t => (t as Transaction & { memberId?: string }).memberId === id && t.type === 'receita').reduce((s, t) => s + t.amount, 0)
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  return (
    <div className="family-page">
      <div className="family-page-header">
        <div>
          <h1 className="family-page-title">Família</h1>
          <p className="family-page-sub">Gerencie os membros e acompanhe gastos por pessoa</p>
        </div>
        <button className="goals-add-btn" onClick={() => { setShowForm(v => !v); setEditId(null); setForm(MEMBER_FORM_INIT) }}>
          {showForm && !editId ? '✕ Cancelar' : '+ Membro'}
        </button>
      </div>

      {showForm && (
        <form className="family-form" onSubmit={saveMember}>
          <div className="family-form-grid">
            <div className="fin-field">
              <label>Nome *</label>
              <input type="text" placeholder="Ex: Maria Silva" value={form.name} onChange={e => f('name', e.target.value)} required />
            </div>
            <div className="fin-field">
              <label>Papel</label>
              <select value={form.role} onChange={e => f('role', e.target.value)}>
                {MEMBER_ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="fin-field family-color-field">
              <label>Cor do avatar</label>
              <div className="family-colors">
                {MEMBER_COLORS.map(c => (
                  <button key={c} type="button" className={`family-color-dot${form.color === c ? ' selected' : ''}`}
                    style={{ background: c }} onClick={() => f('color', c)} />
                ))}
              </div>
            </div>
          </div>
          <div className="goal-form-actions">
            <button type="button" className="btn-ghost" onClick={() => { setShowForm(false); setEditId(null) }}>Cancelar</button>
            <button type="submit" className="btn-accent">{editId ? 'Salvar alterações' : 'Adicionar membro'}</button>
          </div>
        </form>
      )}

      {members.length === 0 && !showForm ? (
        <div className="family-empty">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" width="48" height="48" style={{ opacity: .25 }}>
            <path d="M24 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"/>
            <path d="M8 42a16 16 0 0 1 32 0"/>
            <path d="M36 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM44 36a8 8 0 0 0-8-8"/>
            <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM4 36a8 8 0 0 1 8-8"/>
          </svg>
          <p>Nenhum membro cadastrado ainda.</p>
          <button className="btn-accent" style={{ marginTop: 8 }} onClick={() => setShowForm(true)}>+ Adicionar primeiro membro</button>
        </div>
      ) : (
        <div className="family-grid">
          {members.map(m => {
            const sp = spending(m.id)
            const inc = income(m.id)
            return (
              <div key={m.id} className="family-card">
                <div className="family-card-top">
                  <div className="family-avatar" style={{ background: m.color }}>{initials(m.name)}</div>
                  <div className="family-card-info">
                    <div className="family-card-name">{m.name}</div>
                    <div className="family-card-role">{m.role}</div>
                  </div>
                  <div className="goal-actions">
                    <button className="goal-action-btn" onClick={() => startEdit(m)} title="Editar">
                      <svg viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                    </button>
                    <button className="goal-action-btn goal-del-btn" onClick={() => delMember(m.id)} title="Remover">
                      <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                </div>
                <div className="family-card-stats">
                  <div className="family-stat">
                    <span className="family-stat-label">Receitas</span>
                    <span className="family-stat-val" style={{ color: 'var(--green)' }}>{fmt(inc)}</span>
                  </div>
                  <div className="family-stat">
                    <span className="family-stat-label">Gastos</span>
                    <span className="family-stat-val" style={{ color: 'var(--red)' }}>{fmt(sp)}</span>
                  </div>
                  <div className="family-stat">
                    <span className="family-stat-label">Saldo</span>
                    <span className="family-stat-val" style={{ color: inc - sp >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(inc - sp)}</span>
                  </div>
                </div>
                <p className="family-card-hint">Associe transações a este membro no painel financeiro</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Appearance Page ──────────────────────────────────────────────────────────

interface AppearancePageProps {
  themeId: string; setThemeId: (v: string) => void
  fontSize: string; setFontSize: (v: string) => void
  accentId: string; setAccentId: (v: string) => void
  animations: boolean; setAnimations: (v: boolean) => void
  sidebarFixed: boolean; setSidebarFixed: (v: boolean) => void
}

function AppearancePage({ themeId, setThemeId, fontSize, setFontSize, accentId, setAccentId, animations, setAnimations, sidebarFixed, setSidebarFixed }: AppearancePageProps) {
  const currentAccent = ACCENT_COLORS.find(a => a.id === accentId) ?? ACCENT_COLORS[0]

  return (
    <div className="settings-page">
      <h2 className="settings-title">Aparência</h2>

      {/* Tema */}
      <section className="settings-card">
        <div className="settings-card-title">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="3"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" strokeLinecap="round"/></svg>
          Tema
        </div>
        <div className="ap-theme-grid">
          {THEMES.map(t => (
            <button key={t.id} className={`ap-theme-card${themeId === t.id ? ' ap-theme-active' : ''}`} onClick={() => setThemeId(t.id)}>
              <div className="ap-theme-preview" style={{ background: t.swatch }}>
                <div className="ap-theme-sidebar" style={{ background: t.bg }} />
                <div className="ap-theme-content">
                  <div className="ap-theme-bar" style={{ background: currentAccent.color }} />
                  <div className="ap-theme-line" style={{ background: t.id === 'light' ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.12)' }} />
                  <div className="ap-theme-line ap-theme-line-short" style={{ background: t.id === 'light' ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.08)' }} />
                </div>
              </div>
              <div className="ap-theme-label">
                {t.label}
                {themeId === t.id && <svg viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Cor de destaque */}
      <section className="settings-card">
        <div className="settings-card-title">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="7"/><path d="M10 3v2M10 15v2M3 10h2M15 10h2" strokeLinecap="round"/></svg>
          Cor de Destaque
        </div>
        <p className="settings-hint">Afeta botões, destaques e elementos interativos em todo o app.</p>
        <div className="ap-accent-grid">
          {ACCENT_COLORS.map(a => (
            <button key={a.id} className={`ap-accent-btn${accentId === a.id ? ' ap-accent-active' : ''}`}
              style={{ '--accent-col': a.color } as React.CSSProperties}
              onClick={() => setAccentId(a.id)} title={a.label}>
              <div className="ap-accent-swatch" style={{ background: `linear-gradient(135deg, ${a.color}, ${a.light})` }} />
              <span className="ap-accent-label">{a.label}</span>
              {accentId === a.id && <svg className="ap-accent-check" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
            </button>
          ))}
        </div>
      </section>

      {/* Tamanho da fonte */}
      <section className="settings-card">
        <div className="settings-card-title">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 16l5-12 5 12M5.5 11h5M13 7h4M15 5v10" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Tamanho da Fonte
        </div>
        <div className="ap-font-grid">
          {FONT_SIZES.map(f => (
            <button key={f.id} className={`ap-font-card${fontSize === f.id ? ' ap-font-active' : ''}`} onClick={() => setFontSize(f.id)}>
              <span className="ap-font-sample" style={{ fontSize: f.size }}>Aa</span>
              <span className="ap-font-label">{f.title}</span>
              {fontSize === f.id && <svg className="ap-font-check" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
            </button>
          ))}
        </div>
      </section>

      {/* Toggles */}
      <section className="settings-card">
        <div className="settings-card-title">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="6" width="16" height="8" rx="4"/><circle cx={animations ? '14' : '6'} cy="10" r="3" fill="currentColor" stroke="none"/></svg>
          Preferências
        </div>
        <div className="ap-toggle-row" onClick={() => setAnimations(!animations)}>
          <div className="ap-toggle-info">
            <span className="ap-toggle-name">Animações</span>
            <span className="ap-toggle-desc">Transições e efeitos visuais ao interagir com o app</span>
          </div>
          <div className={`ap-toggle${animations ? ' ap-toggle-on' : ''}`}>
            <div className="ap-toggle-thumb" />
          </div>
        </div>
        <div className="ap-toggle-row" onClick={() => setSidebarFixed(!sidebarFixed)}>
          <div className="ap-toggle-info">
            <span className="ap-toggle-name">Barra lateral sempre visível</span>
            <span className="ap-toggle-desc">Mantém o menu lateral aberto no desktop sem precisar clicar</span>
          </div>
          <div className={`ap-toggle${sidebarFixed ? ' ap-toggle-on' : ''}`}>
            <div className="ap-toggle-thumb" />
          </div>
        </div>
      </section>
    </div>
  )
}

// ─── Settings Page ────────────────────────────────────────────────────────────





// ─── Dashboard Terra Overview ─────────────────────────────────────────────────

function FazendaMiniMap({ faz, talhoes }: { faz: TerraFazenda; talhoes: TerraTalhao[] }) {
  const divRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const map = L.map(node, {
      zoomControl: false, dragging: false, scrollWheelZoom: false,
      doubleClickZoom: false, touchZoom: false, boxZoom: false,
      keyboard: false, attributionControl: false,
    })
    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20 }).addTo(map)
    if (faz.perimetro?.length >= 3) {
      const perim = L.polygon(faz.perimetro, { color: '#dc2626', weight: 2, fillOpacity: 0.08, dashArray: '6 3' }).addTo(map)
      talhoes.filter(t => t.fazendaId === faz.id && t.poligono?.length >= 3).forEach(t => {
        const cor = t.cor || TALHAO_USOS.find(u => u.value === t.uso)?.cor || '#6b7280'
        L.polygon(t.poligono, { color: cor, weight: 1, fillColor: cor, fillOpacity: 0.2 }).addTo(map)
      })
      map.fitBounds(perim.getBounds(), { padding: [8, 8] })
    } else if (faz.latitude && faz.longitude) {
      map.setView([faz.latitude, faz.longitude], 14)
    } else {
      map.setView([-15.77, -47.93], 4)
    }
    setTimeout(() => map.invalidateSize(), 150)
    return () => { map.remove() }
  }, [faz.id])
  return <div ref={divRef} style={{ width: '100%', height: 140, background: 'var(--bg3)' }} />
}

function Dashboard({ onNavigate }: { onNavigate: (page: SidebarPage) => void }) {
  const [imoveis]    = useCloudTable<Imovel>('imoveis', 'lion-imoveis')
  const [produtos]   = useCloudTable<Produto>('produtos', 'lion-produtos')
  const [vehicles]   = useCloudTable<Vehicle>('vehicles', 'lion-vehicles')
  const [txs]        = useCloudTable<Transaction>('transactions', 'lion-txs')
  const [bills]      = useCloudTable<Bill>('bills', 'lion-bills')
  const [collectors] = useCloudTable<Collector>('collectors', 'lion-collectors')
  const [userEvents] = useCloudTable<CalEvent>('calendar_events', 'lion-calendar')
  const [fazArr]     = useCloudTable<TerraFazenda>('terra_fazendas', 'lion-terra', { shared: true })
  const [talArr]     = useCloudTable<TerraTalhao>('terra_talhoes', 'lion-talhoes', { shared: true })
  const autoEvents = buildAutoEvents()
  const allEvents = [...userEvents, ...autoEvents]

  const totalImoveis = imoveis.reduce((s, i) => s + (parseFloat(i.valorAtual || i.valor || '0') || 0), 0)
  const totalProdutos = produtos.reduce((s, p) => s + (parseFloat(p.valor || '0') || 0) * (parseInt(p.quantidade || '1') || 1), 0)
  const totalVeiculos = vehicles.reduce((s, v) => {
    const m = v.notes?.match(/Atual:\s*R\$\s*([\d.,]+)/)
    return m ? s + (parseFloat(m[1].replace(/\./g, '').replace(',', '.')) || 0) : s
  }, 0)
  const totalPatrimonio = totalImoveis + totalProdutos + totalVeiculos

  const now = new Date()
  const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const txsAteMes = txs.filter(t => t.date <= curMonth)
  const totalReceitas = txsAteMes.reduce((s, t) => t.type === 'receita' ? s + t.amount : s, 0)
  const totalDespesas = txsAteMes.reduce((s, t) => t.type === 'despesa' ? s + t.amount : s, 0)
  const saldo = totalReceitas - totalDespesas

  const pendingBills = bills.filter(b => effectiveStatus(b) === 'em_aberto' || effectiveStatus(b) === 'vencido')
  const countAberto = bills.filter(b => effectiveStatus(b) === 'em_aberto').length
  const countVencido = bills.filter(b => effectiveStatus(b) === 'vencido').length
  const totalAberto = pendingBills.reduce((s, b) => s + b.amount, 0)
  const today = now.toISOString().slice(0, 10)
  const in7 = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10)
  const eventsToday = allEvents.filter(e => e.date === today).length
  const eventsWeek = allEvents.filter(e => e.date >= today && e.date <= in7).length

  type AgendaItem =
    | { kind: 'event'; date: string; item: CalEvent }
    | { kind: 'bill';  date: string; item: Bill }
    | { kind: 'tx';    date: string; item: Transaction }

  const agendaItems: AgendaItem[] = ([
    ...allEvents.filter(e => e.date >= today).map(e => ({ kind: 'event' as const, date: e.date, item: e })),
    ...pendingBills.map(b => ({ kind: 'bill' as const, date: b.dueDate, item: b })),
    ...txs.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4).map(t => ({ kind: 'tx' as const, date: t.date, item: t })),
  ] as AgendaItem[]).sort((a, b) => {
    const af = a.date >= today, bf = b.date >= today
    if (af && !bf) return -1
    if (!af && bf) return 1
    if (af && bf) return a.date.localeCompare(b.date)
    return b.date.localeCompare(a.date)
  }).slice(0, 10)

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem('lion-dash-collapsed') || '{}') } catch { return {} } })
  const toggleSection = (key: string) => setCollapsed(prev => { const next = { ...prev, [key]: !prev[key] }; localStorage.setItem('lion-dash-collapsed', JSON.stringify(next)); return next })

  const calColors: Record<string, string> = { financeiro: '#3b82f6', pessoal: '#8b5cf6', viagem: '#f59e0b', manutencao: '#10b981', sistema: '#94a3b8' }
  const fmtHa = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' ha'
  const fmtDay = (d: string) => { const [,m,dd] = d.split('-'); return `${dd}/${m}` }

  return (
    <main className="dash-content">
      {/* ── Summary Widgets ── */}
      <div className="dash-widgets">
        <div className="bc dash-widget" onClick={() => onNavigate('patrimonio')} title="Ver Patrimônio">
          <div className="metric-ico mi-blue">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l7-6 7 6v9H3V9z" strokeLinejoin="round"/><path d="M7 18V12h6v6" strokeLinecap="round"/></svg>
          </div>
          <div className="dash-widget-body">
            <div className="dash-widget-title">Patrimônio</div>
            <div className="dash-widget-value">{fmtCurrency(totalPatrimonio)}</div>
            <div className="dash-widget-sub">{imoveis.length} imóveis · {produtos.length} bens · {vehicles.length} veículos</div>
          </div>
        </div>

        <div className="bc dash-widget" onClick={() => onNavigate('financas')} title="Ver Finanças">
          <div className="metric-ico" style={{ background: saldo >= 0 ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)', color: saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 2v16M6 6l4-4 4 4" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 10h14" strokeLinecap="round"/></svg>
          </div>
          <div className="dash-widget-body">
            <div className="dash-widget-title">Finanças</div>
            <div className="dash-widget-value" style={{ color: saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtCurrency(saldo)}</div>
            <div className="dash-widget-sub">Receitas: {fmtCurrency(totalReceitas)} · Despesas: {fmtCurrency(totalDespesas)}</div>
          </div>
        </div>

        <div className="bc dash-widget" onClick={() => onNavigate('payment-hub')} title="Ver Hub de Pagamentos">
          <div className="metric-ico" style={{ background: 'rgba(245,158,11,.15)', color: 'var(--amber)' }}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8h14" strokeLinecap="round"/><path d="M7 12h3" strokeLinecap="round"/></svg>
          </div>
          <div className="dash-widget-body">
            <div className="dash-widget-title">Hub de Pagamentos</div>
            <div className="dash-widget-value">{countAberto + countVencido} pendentes</div>
            <div className="dash-widget-sub">
              {countVencido > 0 && <span style={{ color: 'var(--red)' }}>{countVencido} vencida{countVencido !== 1 ? 's' : ''} · </span>}
              {fmtCurrency(totalAberto)} em aberto
            </div>
          </div>
        </div>

        <div className="bc dash-widget" onClick={() => onNavigate('calendar')} title="Ver Calendário">
          <div className="metric-ico" style={{ background: 'rgba(139,92,246,.15)', color: '#8b5cf6' }}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="14" height="14" rx="2"/><path d="M3 8h14" strokeLinecap="round"/><path d="M7 2v4M13 2v4" strokeLinecap="round"/><circle cx="10" cy="13" r="1.5" fill="currentColor" stroke="none"/></svg>
          </div>
          <div className="dash-widget-body">
            <div className="dash-widget-title">Calendário</div>
            <div className="dash-widget-value">{eventsToday} evento{eventsToday !== 1 ? 's' : ''} hoje</div>
            <div className="dash-widget-sub">{eventsWeek} nos próximos 7 dias</div>
          </div>
        </div>
      </div>

      {/* ── Patrimônio Overview ── */}
      <div className="dash-patrimonio-overview" onClick={() => onNavigate('patrimonio')}>
        <div className="patr-summary">
          <div className="patr-summary-card">
            <div className="metric-ico mi-blue"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l7-6 7 6v9H3V9z" strokeLinejoin="round"/><path d="M7 18V12h6v6" strokeLinecap="round"/></svg></div>
            <div className="patr-summary-label">Imóveis</div>
            <div className="patr-summary-val">{fmtCurrency(totalImoveis)}</div>
            <div className="patr-summary-sub">{imoveis.length} imóve{imoveis.length !== 1 ? 'is' : 'l'}</div>
          </div>
          <div className="patr-summary-card">
            <div className="metric-ico mi-amber"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 17h10M6 13h8l1-4H5l1 4zM10 3v2M14 5l-1 1M6 5l1 1" strokeLinecap="round" strokeLinejoin="round"/><rect x="8" y="9" width="4" height="4" rx="1"/></svg></div>
            <div className="patr-summary-label">Veículos</div>
            <div className="patr-summary-val">{fmtCurrency(totalVeiculos)}</div>
            <div className="patr-summary-sub">{vehicles.length} veículo{vehicles.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="patr-summary-card">
            <div className="metric-ico mi-green"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7h14M3 7l2-3h10l2 3M3 7v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
            <div className="patr-summary-label">Bens / Produtos</div>
            <div className="patr-summary-val">{fmtCurrency(totalProdutos)}</div>
            <div className="patr-summary-sub">{produtos.length} ite{produtos.length !== 1 ? 'ns' : 'm'}</div>
          </div>
        </div>
      </div>

      {/* ── Detail Grid: 2 columns ── */}
      <div className="dash-detail-grid">
        {/* Left column — Agenda unificada */}
        <div className="dash-detail-col">
          <div className="bc dash-list-card">
            <div className="dash-list-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className={`dash-collapse-chevron${collapsed['agenda'] ? '' : ' dash-collapse-open'}`} onClick={e => { e.stopPropagation(); toggleSection('agenda') }}>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M7 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </span>
                <span className="dash-list-title">Agenda</span>
              </div>
            </div>
            {!collapsed['agenda'] && (agendaItems.length === 0 ? (
              <div className="dash-list-empty">Nenhum item na agenda</div>
            ) : (
              <div className="dash-list-items">
                {agendaItems.map((entry, i) => {
                  if (entry.kind === 'event') {
                    const ev = entry.item
                    return (
                      <div key={'ev-' + ev.id + i} className="dash-list-item" onClick={() => onNavigate('calendar')} style={{ cursor: 'pointer' }}>
                        <div className="dash-ev-dot" style={{ background: calColors[ev.category] || '#94a3b8' }} />
                        <div className="dash-list-item-body">
                          <div className="dash-list-item-title">{ev.title}</div>
                          <div className="dash-list-item-meta">{fmtDay(ev.date)}{ev.time ? ` · ${ev.time}` : ''} · Evento</div>
                        </div>
                        {ev.date === today && <span className="dash-badge dash-badge-today">Hoje</span>}
                      </div>
                    )
                  }
                  if (entry.kind === 'bill') {
                    const bill = entry.item
                    const st = effectiveStatus(bill)
                    const coll = collectors.find(c => c.id === bill.collectorId)
                    return (
                      <div key={'bill-' + bill.id} className="dash-list-item" onClick={() => onNavigate('payment-hub')} style={{ cursor: 'pointer' }}>
                        <div className="dash-bill-dot" style={{ background: coll?.color || 'var(--amber)' }} />
                        <div className="dash-list-item-body">
                          <div className="dash-list-item-title">{bill.description || coll?.name || 'Conta'}</div>
                          <div className="dash-list-item-meta">
                            Vence {fmtDay(bill.dueDate)} · Conta
                            {st === 'vencido' && <span style={{ color: 'var(--red)', fontWeight: 600 }}> · Vencida</span>}
                          </div>
                        </div>
                        <div className="dash-list-item-amount">{fmtCurrency(bill.amount)}</div>
                      </div>
                    )
                  }
                  const tx = entry.item
                  return (
                    <div key={'tx-' + tx.id} className="dash-list-item" onClick={() => onNavigate('financas')} style={{ cursor: 'pointer' }}>
                      <div className="dash-tx-icon" style={{ background: tx.type === 'receita' ? 'rgba(16,185,129,.15)' : 'rgba(239,68,68,.15)', color: tx.type === 'receita' ? 'var(--green)' : 'var(--red)' }}>
                        {tx.type === 'receita' ? '+' : '−'}
                      </div>
                      <div className="dash-list-item-body">
                        <div className="dash-list-item-title">{tx.description}</div>
                        <div className="dash-list-item-meta">{tx.category} · {fmtDay(tx.date)}</div>
                      </div>
                      <div className="dash-list-item-amount" style={{ color: tx.type === 'receita' ? 'var(--green)' : 'var(--red)' }}>
                        {tx.type === 'receita' ? '+' : '−'}{fmtCurrency(tx.amount)}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Right column — Fazendas */}
        <div className="dash-detail-col">
          <div className="bc dash-list-card">
            <div className="dash-list-header" onClick={() => onNavigate('terra')} style={{ cursor: 'pointer' }}>
              <span className="dash-list-title">Fazendas</span>
              <span className="dash-list-link">Ver todas &rsaquo;</span>
            </div>
            {fazArr.length === 0 ? (
              <div className="dash-list-empty">
                <div style={{ marginBottom: 8 }}>Nenhuma fazenda cadastrada</div>
                <button className="feed-empty-btn" onClick={() => onNavigate('terra')}>Ir para Terra</button>
              </div>
            ) : (
              <div className="dash-fazenda-grid">
                {fazArr.map(fz => (
                  <div key={fz.id} className="dash-fazenda-card" onClick={() => onNavigate('terra')} title="Ver Terra">
                    <FazendaMiniMap faz={fz} talhoes={talArr} />
                    <div style={{ padding: '8px 10px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 1 }}>{fz.nome}</div>
                      <div style={{ fontSize: 10, color: 'var(--text)', opacity: .7 }}>{fmtHa(fz.areaTotal)}{fz.municipio ? ` · ${fz.municipio}` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [showCalc, setShowCalc] = useState(false)
  const [showNp, setShowNp] = useState(false)
  const [showFin, setShowFin] = useState(false)
  const [showSim, setShowSim] = useState(false)
  const [showDocs, setShowDocs] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)
  const [alertCount, setAlertCount] = useState(() => buildAlerts().length)
  const [showShare, setShowShare] = useState(false)
  const [viewMode, setViewMode] = useState(false)
  const [viewOwner, setViewOwner] = useState('')
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('lion-onboarded'))
  const finishOnboarding = () => { localStorage.setItem('lion-onboarded', '1'); setShowOnboarding(false) }
  const syncError = useSyncError()

  interface FxRate { code: string; bid: string; pct: string }
  const [fxRates, setFxRates] = useState<FxRate[]>([])
  useEffect(() => {
    const CACHE_KEY = 'lion-fx-cache'
    const last8am = (() => { const d = new Date(); d.setHours(8,0,0,0); if (new Date() < d) d.setDate(d.getDate()-1); return d.getTime() })()
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) { try { const p = JSON.parse(cached); if (p.ts >= last8am) { setFxRates(p.rates); return } } catch { /* ignore */ } }
    fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,BTC-BRL,CNY-BRL')
      .then(r => r.json())
      .then(d => {
        const rates: FxRate[] = [
          { code: 'USD', bid: parseFloat(d.USDBRL.bid).toFixed(2), pct: d.USDBRL.pctChange },
          { code: 'EUR', bid: parseFloat(d.EURBRL.bid).toFixed(2), pct: d.EURBRL.pctChange },
          { code: 'BTC', bid: parseFloat(d.BTCBRL.bid).toLocaleString('pt-BR', { maximumFractionDigits: 0 }), pct: d.BTCBRL.pctChange },
          { code: 'CNY', bid: parseFloat(d.CNYBRL.bid).toFixed(3), pct: d.CNYBRL.pctChange },
        ]
        setFxRates(rates)
        localStorage.setItem(CACHE_KEY, JSON.stringify({ rates, ts: Date.now() }))
      })
      .catch(() => {})
  }, [])

  const [themeId, setThemeId] = useState(() => localStorage.getItem('lion-theme') || 'dark')
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('lion-font') || 'normal')
  const [accentId, setAccentId] = useState(() => localStorage.getItem('lion-accent') || 'blue')
  const [animations, setAnimations] = useState(() => localStorage.getItem('lion-animations') !== 'off')
  const [sidebarFixed, setSidebarFixed] = useState(() => localStorage.getItem('lion-sidebar-fixed') === 'on')
  const [modal, setModal] = useState<ModalType>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const [sidebarPage, setSidebarPage] = useState<SidebarPage>('dashboard')
  const [customLogo, setCustomLogo] = useState<string>(() => localStorage.getItem('lion-logo') || '')
  useEffect(() => {
    const onLogoChange = () => {
      const newLogo = localStorage.getItem('lion-logo') || ''
      setCustomLogo(newLogo)
      if (!localStorage.getItem('lion-favicon') && newLogo) {
        const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]') || (() => {
          const l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); return l
        })()
        link.href = newLogo
      }
    }
    window.addEventListener('lion-logo-changed', onLogoChange)
    return () => window.removeEventListener('lion-logo-changed', onLogoChange)
  }, [])

  useEffect(() => {
    const fav = localStorage.getItem('lion-favicon')
    const logoData = localStorage.getItem('lion-logo')
    const src = fav || logoData
    if (src) {
      const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]') || (() => {
        const l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); return l
      })()
      link.href = src
    }
  }, [])
  const [searchQ, setSearchQ] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [npTarget, setNpTarget] = useState<{ folderId: string; noteId: string } | null>(null)
  const searchResults = searchOpen && searchQ.trim().length >= 2 ? buildSearchIndex(searchQ) : []

  useEffect(() => {
    const el = document.documentElement
    el.removeAttribute('data-theme')
    el.classList.remove('light')
    if (themeId !== 'dark') el.setAttribute('data-theme', themeId === 'light' ? 'light' : themeId)
    localStorage.setItem('lion-theme', themeId)
  }, [themeId])

  useEffect(() => {
    const el = document.documentElement
    el.removeAttribute('data-fs')
    if (fontSize !== 'normal') el.setAttribute('data-fs', fontSize)
    localStorage.setItem('lion-font', fontSize)
  }, [fontSize])

  useEffect(() => {
    const accent = ACCENT_COLORS.find(a => a.id === accentId) ?? ACCENT_COLORS[0]
    document.documentElement.style.setProperty('--purple', accent.color)
    document.documentElement.style.setProperty('--purple-l', accent.light)
    localStorage.setItem('lion-accent', accentId)
  }, [accentId])

  useEffect(() => {
    if (animations) document.documentElement.removeAttribute('data-no-anim')
    else document.documentElement.setAttribute('data-no-anim', '')
    localStorage.setItem('lion-animations', animations ? 'on' : 'off')
  }, [animations])

  useEffect(() => {
    localStorage.setItem('lion-sidebar-fixed', sidebarFixed ? 'on' : 'off')
  }, [sidebarFixed])


  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    DATA_KEYS.forEach(k => localStorage.removeItem(k))
    await supabase?.auth.signOut()
  }

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? ''

  const closeAll = () => { setShowCalc(false); setShowNp(false); setShowFin(false); setShowSim(false); setShowDocs(false); setShowAlerts(false); setShowShare(false) }

  const handleSearchSelect = (r: SearchResult) => {
    setSearchQ(''); setSearchOpen(false)
    closeAll()
    if (r.section === 'fin') { setShowFin(true); return }
    if (r.section === 'note') {
      const [folderId, noteId] = r.id.split(':')
      setNpTarget({ folderId, noteId })
      setShowNp(true)
      return
    }
    setTimeout(() => {
      const sectionMap: Record<string, string> = { goals: '.goals-section', rentals: '.rentals-section', vehicles: '.vehicles-section', maint: '.maintenance-section', pat: '.pat-section' }
      const el = document.querySelector(sectionMap[r.section] || `.${r.section}-section`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }
  const toggleCalc   = () => { const v = !showCalc;   closeAll(); setShowCalc(v) }
  const toggleNp     = () => { const v = !showNp;     closeAll(); setShowNp(v) }
  const toggleFin    = () => { const v = !showFin;    closeAll(); setShowFin(v) }
  const toggleSim    = () => { const v = !showSim;    closeAll(); setShowSim(v) }
  const toggleDocs   = () => { const v = !showDocs;   closeAll(); setShowDocs(v) }
  const toggleAlerts = () => { const v = !showAlerts; closeAll(); setShowAlerts(v); if (!v) setAlertCount(buildAlerts().length) }
  const toggleShare  = () => { const v = !showShare;  closeAll(); setShowShare(v) }

  useEffect(() => {
    const refresh = () => setAlertCount(buildAlerts().length)
    window.addEventListener('storage', refresh)
    const id = setInterval(refresh, 60000)
    return () => { window.removeEventListener('storage', refresh); clearInterval(id) }
  }, [])

  const [kbHint, setKbHint] = useState<string | null>(null)
  const [showKbLegend, setShowKbLegend] = useState(false)


  useEffect(() => {
    let hintTimer: ReturnType<typeof setTimeout>
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const key = e.key.toLowerCase()
      const hints: Record<string, string> = { f: 'Finanças', n: 'Notas', c: 'Calculadora', s: 'Simulador', a: 'Alertas', d: 'Documentos', '?': 'Atalhos', escape: 'Fechar' }
      if (!hints[key] && key !== '?') return
      e.preventDefault()
      clearTimeout(hintTimer)
      if (key === '?') { setShowKbLegend(v => !v); return }
      setKbHint(hints[key])
      hintTimer = setTimeout(() => setKbHint(null), 1200)
      if (key === 'escape') { closeAll(); setShowKbLegend(false); return }
      if (key === 'f') toggleFin()
      if (key === 'n') toggleNp()
      if (key === 'c') toggleCalc()
      if (key === 's') toggleSim()
      if (key === 'a') toggleAlerts()
      if (key === 'd') toggleDocs()
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(hintTimer) }
  }, [showCalc, showNp, showFin, showSim, showDocs, showAlerts])


  if (!authReady) return null

  // Public map route — no auth required
  if (window.location.hash.startsWith('#/mapa')) return <PublicMapPage />

  if (supabase && !user) return <LoginPage />

  return (
    <UserCtx.Provider value={user?.id}>
    <div className={`app${viewMode ? ' view-mode' : ''}${sidebarFixed ? ' sidebar-pinned' : ''}`}>
      {kbHint && <div className="kb-toast">{kbHint}</div>}
      {showOnboarding && <OnboardingWizard onDone={finishOnboarding} />}

      {syncError && (
        <div className="sync-error-toast">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="7"/><path d="M8 4v5M8 11v1" strokeLinecap="round"/></svg>
          <span>{syncError}</span>
        </div>
      )}

      {/* ── Sidebar ── */}
      {showSidebar && <div className="sidebar-overlay" onClick={() => setShowSidebar(false)} />}
      <aside className={`sidebar${showSidebar ? ' sidebar-open' : ''}`}>
        <div className="sidebar-brand">
          {customLogo
            ? <img src={customLogo} alt="Logo" className="sidebar-brand-img" />
            : <svg viewBox="0 0 32 32" fill="none" className="sidebar-brand-logo">
                <rect width="32" height="32" rx="10" fill="#1a1a1a"/>
                <text x="16" y="22" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="18" fill="white" letterSpacing="-1">L<tspan fill="#3b82f6">I</tspan></text>
              </svg>
          }
          <span className="sidebar-brand-name">Lion Admin</span>
        </div>
        <div className="sidebar-user">
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{displayName.split('@')[0]}</div>
            <div className="sidebar-user-email">{user?.email || ''}</div>
          </div>
          <button className="sidebar-close-btn" onClick={() => setShowSidebar(false)} title="Fechar">
            <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <nav className="sidebar-nav">
          {([
            { icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="7" height="7" rx="1"/><rect x="11" y="2" width="7" height="7" rx="1"/><rect x="2" y="11" width="7" height="7" rx="1"/><rect x="11" y="11" width="7" height="7" rx="1"/></svg>, label: 'Dashboard', action: () => { setSidebarPage('dashboard'); setShowSidebar(false) }, active: sidebarPage === 'dashboard' },
            { icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="16" height="11" rx="2"/><path d="M2 9h16" strokeLinecap="round"/><path d="M5 13h3M11 13h4" strokeLinecap="round"/></svg>, label: 'Hub de Pagamentos', active: sidebarPage === 'payment-hub', action: () => { setSidebarPage('payment-hub'); setShowSidebar(false) } },
            { icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 2v16M6 6h5.5a2.5 2.5 0 0 1 0 5H6m0 0h6a2.5 2.5 0 0 1 0 5H6" strokeLinecap="round"/></svg>, label: 'Finanças', active: sidebarPage === 'financas', action: () => { setSidebarPage('financas'); setShowSidebar(false) } },
            { divider: true, label: 'Gestão' },
            { icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M4 18a6 6 0 0 1 12 0"/></svg>, label: 'Família', active: sidebarPage === 'family', action: () => { setSidebarPage('family'); setShowSidebar(false) } },
            { icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="16" height="14" rx="2"/><path d="M6 2v4M14 2v4M2 9h16" strokeLinecap="round"/></svg>, label: 'Calendário', active: sidebarPage === 'calendar', action: () => { setSidebarPage('calendar'); setShowSidebar(false) } },
            { icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l7-6 7 6v9H3V9z" strokeLinejoin="round"/><path d="M7 18V12h6v6" strokeLinecap="round"/><rect x="10" y="4" width="6" height="5" rx="1" fill="currentColor" opacity=".2" stroke="none"/></svg>, label: 'Patrimônio', active: sidebarPage === 'patrimonio', action: () => { setSidebarPage('patrimonio'); setShowSidebar(false) } },
            { icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 16l4-3 3 2 4-5 5 3" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 18h16" strokeLinecap="round"/><circle cx="16" cy="5" r="2" fill="currentColor" opacity=".3" stroke="none"/></svg>, label: 'Terra', active: sidebarPage === 'terra', action: () => { setSidebarPage('terra'); setShowSidebar(false) } },
            { divider: true, label: 'Sistema' },
            { icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="7"/><path d="M10 7v3l2 2" strokeLinecap="round"/><circle cx="10" cy="3" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="17" r="1" fill="currentColor" stroke="none"/><circle cx="3" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="17" cy="10" r="1" fill="currentColor" stroke="none"/></svg>, label: 'Aparência', active: sidebarPage === 'appearance', action: () => { setSidebarPage('appearance'); setShowSidebar(false) } },
            { icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2h4M10 2v3M7 5h6a1 1 0 0 1 1 1v1H6V6a1 1 0 0 1 1-1zM5 7h10l-1 10H6L5 7z" strokeLinejoin="round"/></svg>, label: 'Configurações', active: sidebarPage === 'settings', action: () => { setSidebarPage('settings'); setShowSidebar(false) } },
          ] as { icon?: React.ReactNode; label: string; active?: boolean; badge?: string; action?: () => void; divider?: boolean }[]).map(item => (
            item.divider ? <div key={item.label} className="sidebar-nav-divider"><span>{item.label}</span></div> :
            <button key={item.label} className={`sidebar-nav-item${item.active ? ' sidebar-nav-active' : ''}`} onClick={item.action}>
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span className="sidebar-nav-label">{item.label}</span>
              {item.badge && <span className="sidebar-nav-badge">{item.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className={`sidebar-footer-btn${showNp ? ' sidebar-nav-active' : ''}`} onClick={toggleNp} title="Notas (N)">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 3.5h13v13h-13z" rx="2"/><path d="M7 1.5v3.5M10 1.5v3.5M13 1.5v3.5" strokeLinecap="round"/><line x1="7" y1="10" x2="13" y2="10" strokeLinecap="round"/><line x1="7" y1="13" x2="10" y2="13" strokeLinecap="round"/></svg>
          </button>
          <button className={`sidebar-footer-btn${showCalc ? ' sidebar-nav-active' : ''}`} onClick={toggleCalc} title="Calculadora (C)">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3.5" y="1.5" width="13" height="17" rx="2.5"/><rect x="6" y="4" width="8" height="3.5" rx="1" fill="currentColor" opacity=".3" stroke="none"/><circle cx="7" cy="11" r=".7" fill="currentColor" stroke="none"/><circle cx="10" cy="11" r=".7" fill="currentColor" stroke="none"/><circle cx="13" cy="11" r=".7" fill="currentColor" stroke="none"/><circle cx="7" cy="14.5" r=".7" fill="currentColor" stroke="none"/><circle cx="10" cy="14.5" r=".7" fill="currentColor" stroke="none"/><circle cx="13" cy="14.5" r=".7" fill="currentColor" stroke="none"/></svg>
          </button>
          <button className="sidebar-footer-btn sidebar-footer-btn-logout" onClick={handleLogout} title="Sair">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 15l3-5-3-5" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 10H7" strokeLinecap="round"/><path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" strokeLinecap="round"/></svg>
          </button>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="main-col">

      {/* ── Topbar ── */}
      <header className="topbar">
        <button className="hamburger-btn" onClick={() => setShowSidebar(v => !v)} title="Menu">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 5h14M3 10h14M3 15h14"/>
          </svg>
        </button>
        {/* Brand — visible on mobile only, sidebar has it on desktop */}
        <div className="topbar-brand">
          <div className="topbar-brand-mark">
            {customLogo
              ? <img src={customLogo} alt="Logo" style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 12 }} />
              : <svg viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="10" fill="#1a1a1a"/>
                  <text x="16" y="22" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="18" fill="white" letterSpacing="-1">L<tspan fill="#3b82f6">I</tspan></text>
                </svg>
            }
          </div>
          <div className="topbar-brand-name">Lion Admin</div>
        </div>
        <button className="mobile-search-btn" onClick={() => setMobileSearchOpen(v => !v)} title="Buscar">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="9" cy="9" r="6"/><path d="M15 15l3 3" strokeLinecap="round"/>
          </svg>
        </button>
        <div className={`header-search-wrap topbar-search-wrap${mobileSearchOpen ? ' mobile-search-open' : ''}`}>
          <div className={`header-search${searchOpen ? ' search-active' : ''}`}>
            <svg className="search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="9" cy="9" r="6"/><path d="M15 15l3 3" strokeLinecap="round"/>
            </svg>
            <input
              className="search-input"
              placeholder="Buscar transações, metas, imóveis…"
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); setSearchOpen(true) }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 180)}
            />
            {searchQ && (
              <button className="search-clear" onClick={() => { setSearchQ(''); setSearchOpen(false) }}>
                <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            )}
            <button className="mobile-search-close" onClick={() => { setMobileSearchOpen(false); setSearchQ(''); setSearchOpen(false) }}>
              <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>
          {searchOpen && searchResults.length > 0 && (
            <div className="search-dropdown">
              {searchResults.map(r => (
                <button key={r.id} className="search-result" onMouseDown={() => handleSearchSelect(r)}>
                  <span className={`search-result-dot dot-${r.color}`}/>
                  <div className="search-result-text">
                    <span className="search-result-label">{r.label}</span>
                    <span className="search-result-sub"><span className="search-result-type">{r.type}</span> · {r.sub}</span>
                  </div>
                  <svg className="search-result-arrow" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              ))}
            </div>
          )}
          {searchOpen && searchQ.trim().length >= 2 && searchResults.length === 0 && (
            <div className="search-dropdown search-empty">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="9" cy="9" r="6"/><path d="M15 15l3 3" strokeLinecap="round"/></svg>
              <span>Nenhum resultado para "<strong>{searchQ}</strong>"</span>
            </div>
          )}
        </div>

        <div className="header-right">
          <button className="theme-toggle-btn" onClick={() => setThemeId(t => t === 'light' ? 'charcoal' : 'light')} title={themeId === 'light' ? 'Modo escuro' : 'Modo claro'}>
            {themeId === 'light' ? (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17.293 13.293A8 8 0 0 1 6.707 2.707a8.001 8.001 0 1 0 10.586 10.586z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="10" cy="10" r="4"/>
                <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" strokeLinecap="round"/>
              </svg>
            )}
          </button>
          <button className={`bell-btn${showAlerts ? ' bell-active' : ''}`} onClick={toggleAlerts} title="Alertas">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 2a6 6 0 0 0-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 0 0-6-6z" strokeLinejoin="round"/>
              <path d="M8.5 16.5a1.5 1.5 0 0 0 3 0" strokeLinecap="round"/>
            </svg>
            {alertCount > 0 && <span className="bell-badge">{alertCount > 9 ? '9+' : alertCount}</span>}
          </button>
        </div>
      </header>

      {/* ── View mode banner ── */}
      {viewMode && (
        <div className="view-mode-banner">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>
            <circle cx="8" cy="8" r="2"/>
          </svg>
          Modo visualização — dados de <strong>{viewOwner}</strong>
          <button onClick={() => { setViewMode(false); setViewOwner('') }}>Sair</button>
        </div>
      )}

      {/* ── Sub-pages (Família, Calendário, etc.) ── */}
      {sidebarPage !== 'dashboard' && (
        <div className={`page-content${sidebarPage === 'settings' ? ' page-content--settings' : ''}`}>
          <nav className="page-breadcrumb">
            <button className="breadcrumb-link" onClick={() => setSidebarPage('dashboard')}>Dashboard</button>
            <svg viewBox="0 0 8 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="breadcrumb-sep"><path d="M2 2l4 4-4 4"/></svg>
            <span className="breadcrumb-current">
              {{ 'family': 'Família', 'calendar': 'Calendário', 'trips': 'Viagens', 'goals': 'Metas', 'financas': 'Finanças', 'patrimonio': 'Patrimônio', 'terra': 'Terra', 'payment-hub': 'Hub de Pagamentos', 'appearance': 'Aparência', 'settings': 'Configurações' }[sidebarPage] || sidebarPage}
            </span>
          </nav>
          {sidebarPage === 'family'     && <FamilyPage />}
          {sidebarPage === 'calendar'   && <CalendarPage />}
          {sidebarPage === 'trips'        && <TripsPage />}
          {sidebarPage === 'goals'        && <GoalsPage />}
          {sidebarPage === 'financas'       && <div className="fin-page-wrap"><FinancePanel onClose={() => setSidebarPage('dashboard')} /></div>}
          {sidebarPage === 'patrimonio'    && <PatrimonioPage />}
          {sidebarPage === 'terra'          && <TerraPage />}
          {sidebarPage === 'payment-hub'  && <PaymentHubPage />}
          {sidebarPage === 'appearance'   && <AppearancePage themeId={themeId} setThemeId={setThemeId} fontSize={fontSize} setFontSize={setFontSize} accentId={accentId} setAccentId={setAccentId} animations={animations} setAnimations={setAnimations} sidebarFixed={sidebarFixed} setSidebarFixed={setSidebarFixed} />}
          {sidebarPage === 'settings'     && <SettingsPage user={user} />}
        </div>
      )}

      {/* ── Dashboard: visão geral Terra ── */}
      {sidebarPage === 'dashboard' && <Dashboard onNavigate={(p) => { setSidebarPage(p); setShowSidebar(false) }} />}

      {/* keep legacy section components referenced to avoid unused-locals TS error */}
      {false && <><PatrimonySection /><NotesSection onOpenNotepad={toggleNp} /><RentalsSection /><MaintenanceSection /><VehicleHistorySection />{fxRates}{toggleShare}{showKbLegend}</>}

      </div>{/* /main-col */}


      {/* ── Panels ── */}
      <div className={`float-panel panel-share${showShare ? ' panel-open' : ''}`}>
        <SharePanel onClose={() => setShowShare(false)} onImport={(owner) => { setViewMode(true); setViewOwner(owner); setShowShare(false) }} />
      </div>
      <div className={`float-panel panel-alerts${showAlerts ? ' panel-open' : ''}`}>
        <AlertsPanel onClose={() => setShowAlerts(false)} />
      </div>
      <div className={`float-panel panel-docs${showDocs ? ' panel-open' : ''}`}>
        <DocumentsPanel onClose={() => setShowDocs(false)} />
      </div>
      <div className={`float-panel panel-sim${showSim ? ' panel-open' : ''}`}>
        <FinancingSimulator onClose={() => setShowSim(false)} />
      </div>
      <div className={`float-panel panel-np${showNp ? ' panel-open' : ''}`}>
        <Notepad onClose={() => setShowNp(false)} npTarget={npTarget} onTargetHandled={() => setNpTarget(null)} />
      </div>
      <div className={`float-panel panel-calc${showCalc ? ' panel-open' : ''}`}>
        <Calculator onClose={() => setShowCalc(false)} />
      </div>

      {/* ── Modals ── */}
      {modal && <NewItemModal type={modal} onClose={() => setModal(null)} onNavigate={(page) => { setSidebarPage(page); setShowSidebar(false) }} />}

    </div>
    </UserCtx.Provider>
  )
}
