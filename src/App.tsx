import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { supabase } from './lib/supabase'
import LoginPage from './LoginPage'
import type { User } from '@supabase/supabase-js'
import { UserCtx, DATA_KEYS } from './context'
import { useCloudTable, useSyncError } from './hooks'
import type { ModalType, SidebarPage, TerraFazenda, TerraTalhao, Folder, Goal, Transaction, Rental, Vehicle, Maintenance, Collector, Bill, AppAlert, ActivityItem, SearchResult, FamilyMember } from './types'
import { TALHAO_USOS } from './constants'
import { fmtDate, effectiveStatus } from './utils'
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

// ─── Dashboard data ───────────────────────────────────────────────────────────

function computeDashData() {
  const txs: Transaction[] = (() => { try { return JSON.parse(localStorage.getItem('lion-txs') || '[]') } catch { return [] } })()
  const goals: Goal[] = (() => { try { return JSON.parse(localStorage.getItem('lion-goals') || '[]') } catch { return [] } })()
  const rentals: Rental[] = (() => { try { return JSON.parse(localStorage.getItem('lion-rentals') || '[]') } catch { return [] } })()
  const alerts = buildAlerts()

  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const balance = txs.filter(t => t.date <= thisMonth).reduce((s, t) => s + (t.type === 'receita' ? t.amount : -t.amount), 0)
  const totalGoals = goals.reduce((s, g) => s + (g.current || 0), 0)
  const targetGoals = goals.reduce((s, g) => s + (g.target || 0), 0)
  const goalsProgress = targetGoals > 0 ? Math.round(totalGoals / targetGoals * 100) : 0
  const monthlyRent = rentals.reduce((s, r) => s + (r.value || 0), 0)
  const dangerCount = alerts.filter(a => a.severity === 'danger').length
  const warnCount = alerts.filter(a => a.severity === 'warning').length

  // month-over-month balance change
  const lastMonth = (() => { const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })()
  const thisMonthNet = txs.filter(t => t.date === thisMonth).reduce((s, t) => s + (t.type === 'receita' ? t.amount : -t.amount), 0)
  const lastMonthNet = txs.filter(t => t.date === lastMonth).reduce((s, t) => s + (t.type === 'receita' ? t.amount : -t.amount), 0)

  return { balance, totalGoals, targetGoals, goalsProgress, monthlyRent, dangerCount, warnCount, totalAlerts: alerts.length, txCount: txs.length, rentCount: rentals.length, goalsCount: goals.length, thisMonthNet, lastMonthNet }
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



// ─── Activity data ────────────────────────────────────────────────────────────

const ICON_TX_IN = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
const ICON_TX_OUT = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
const ICON_GOAL = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg>
const ICON_RENTAL = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
const ICON_VEHICLE = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="9" width="22" height="11" rx="2"/><path d="M6 9V7a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="6" cy="20" r="2"/><circle cx="18" cy="20" r="2"/></svg>
const ICON_MAINT = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>

function relTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'agora'
  if (mins < 60) return `${mins}min atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h atrás`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d atrás`
  return `${Math.floor(days / 30)}mês atrás`
}

function buildActivity(): ActivityItem[] {
  const items: ActivityItem[] = []

  const txs: Transaction[] = (() => { try { return JSON.parse(localStorage.getItem('lion-txs') || '[]') } catch { return [] } })()
  txs.forEach(t => {
    const ts = parseInt(t.id) || 0
    const sign = t.type === 'receita' ? '+' : '-'
    items.push({ id: `tx-${t.id}`, icon: t.type === 'receita' ? ICON_TX_IN : ICON_TX_OUT, title: t.description || t.category, sub: `${t.type === 'receita' ? 'Receita' : 'Despesa'} · ${sign} R$ ${t.amount.toLocaleString('pt-BR')} · ${t.category}`, time: relTime(ts), color: t.type === 'receita' ? 'green' : 'red', ts })
  })

  const goals: Goal[] = (() => { try { return JSON.parse(localStorage.getItem('lion-goals') || '[]') } catch { return [] } })()
  goals.forEach(g => {
    const ts = parseInt(g.id) || 0
    items.push({ id: `g-${g.id}`, icon: ICON_GOAL, title: g.name, sub: `Meta · R$ ${(g.current||0).toLocaleString('pt-BR')} / R$ ${(g.target||0).toLocaleString('pt-BR')}`, time: relTime(ts), color: 'blue', ts })
  })

  const rentals: Rental[] = (() => { try { return JSON.parse(localStorage.getItem('lion-rentals') || '[]') } catch { return [] } })()
  rentals.forEach(r => {
    const ts = parseInt(r.id) || 0
    items.push({ id: `r-${r.id}`, icon: ICON_RENTAL, title: r.property, sub: `Aluguel · ${r.tenant} · R$ ${(r.value||0).toLocaleString('pt-BR')}/mês`, time: relTime(ts), color: 'amber', ts })
  })

  const vehicles: Vehicle[] = (() => { try { return JSON.parse(localStorage.getItem('lion-vehicles') || '[]') } catch { return [] } })()
  vehicles.forEach(v => {
    const ts = parseInt(v.id) || 0
    items.push({ id: `v-${v.id}`, icon: ICON_VEHICLE, title: v.name, sub: `Veículo · ${v.plate} · ${v.year}`, time: relTime(ts), color: 'amber', ts })
  })

  const maint: Maintenance[] = (() => { try { return JSON.parse(localStorage.getItem('lion-maintenance') || '[]') } catch { return [] } })()
  maint.forEach(m => {
    const ts = parseInt(m.id) || 0
    items.push({ id: `m-${m.id}`, icon: ICON_MAINT, title: m.asset, sub: `Manutenção · ${m.description}`, time: relTime(ts), color: 'purple', ts })
  })

  return items.sort((a, b) => b.ts - a.ts).slice(0, 8)
}

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





// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [showCalc, setShowCalc] = useState(false)
  const [showNp, setShowNp] = useState(false)
  const [showFin, setShowFin] = useState(false)
  const [showSim, setShowSim] = useState(false)
  const [showDocs, setShowDocs] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)
  const [activityOpen, setActivityOpen] = useState(true)
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

  const [dashData, setDashData] = useState(() => computeDashData())
  const [activity, setActivity] = useState(() => buildActivity())
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
    const onLogoChange = () => setCustomLogo(localStorage.getItem('lion-logo') || '')
    window.addEventListener('lion-logo-changed', onLogoChange)
    return () => window.removeEventListener('lion-logo-changed', onLogoChange)
  }, [])

  useEffect(() => {
    const fav = localStorage.getItem('lion-favicon')
    if (fav) {
      const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]') || (() => {
        const l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); return l
      })()
      link.href = fav
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

  useEffect(() => {
    const refresh = () => { setDashData(computeDashData()); setActivity(buildActivity()) }
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [])

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

  const dashMiniMapInstance = useRef<L.Map | null>(null)
  const dashMiniMapRef = useCallback((node: HTMLDivElement | null) => {
    if (dashMiniMapInstance.current) { dashMiniMapInstance.current.remove(); dashMiniMapInstance.current = null }
    if (!node) return
    const fazArr: TerraFazenda[] = (() => { try { return JSON.parse(localStorage.getItem('lion-terra') || '[]') } catch { return [] } })()
    const talArr: TerraTalhao[] = (() => { try { return JSON.parse(localStorage.getItem('lion-talhoes') || '[]') } catch { return [] } })()
    if (!fazArr.length) return
    const fz = fazArr[0]
    const map = L.map(node, {
      zoomControl: false, dragging: false, scrollWheelZoom: false,
      doubleClickZoom: false, touchZoom: false, boxZoom: false,
      keyboard: false, attributionControl: false,
    })
    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20 }).addTo(map)
    if (fz.perimetro?.length >= 3) {
      const perim = L.polygon(fz.perimetro, { color: '#dc2626', weight: 2, fillOpacity: 0.08, dashArray: '6 3' }).addTo(map)
      talArr.filter(t => t.fazendaId === fz.id && t.poligono?.length >= 3).forEach(t => {
        const cor = t.cor || TALHAO_USOS.find(u => u.value === t.uso)?.cor || '#6b7280'
        L.polygon(t.poligono, { color: cor, weight: 1, fillColor: cor, fillOpacity: 0.15 }).addTo(map)
      })
      map.fitBounds(perim.getBounds(), { padding: [10, 10] })
    } else {
      map.setView([fz.latitude, fz.longitude], 14)
    }
    dashMiniMapInstance.current = map
    setTimeout(() => map.invalidateSize(), 200)
  }, [sidebarPage])

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
          <button className={`sidebar-nav-item${showNp ? ' sidebar-nav-active' : ''}`} onClick={toggleNp} title="Notas (N)">
            <span className="sidebar-nav-icon"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3.5 3.5h13v13h-13z" rx="2"/><path d="M7 1.5v3.5M10 1.5v3.5M13 1.5v3.5" strokeLinecap="round"/><line x1="7" y1="10" x2="13" y2="10" strokeLinecap="round"/><line x1="7" y1="13" x2="10" y2="13" strokeLinecap="round"/></svg></span>
            <span className="sidebar-nav-label">Notas</span>
          </button>
          <button className={`sidebar-nav-item${showCalc ? ' sidebar-nav-active' : ''}`} onClick={toggleCalc} title="Calculadora (C)">
            <span className="sidebar-nav-icon"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3.5" y="1.5" width="13" height="17" rx="2.5"/><rect x="6" y="4" width="8" height="3.5" rx="1" fill="currentColor" opacity=".3" stroke="none"/><circle cx="7" cy="11" r=".7" fill="currentColor" stroke="none"/><circle cx="10" cy="11" r=".7" fill="currentColor" stroke="none"/><circle cx="13" cy="11" r=".7" fill="currentColor" stroke="none"/><circle cx="7" cy="14.5" r=".7" fill="currentColor" stroke="none"/><circle cx="10" cy="14.5" r=".7" fill="currentColor" stroke="none"/><circle cx="13" cy="14.5" r=".7" fill="currentColor" stroke="none"/></svg></span>
            <span className="sidebar-nav-label">Calculadora</span>
          </button>
          <button className="sidebar-nav-item" onClick={handleLogout}>
            <span className="sidebar-nav-icon"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 15l3-5-3-5" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 10H7" strokeLinecap="round"/><path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" strokeLinecap="round"/></svg></span>
            <span className="sidebar-nav-label">Sair</span>
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
              ? <img src={customLogo} alt="Logo" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6 }} />
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

      {/* ── Dashboard bento ── */}
      {(() => {
        if (sidebarPage !== 'dashboard') return null
        const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

        // Sparkline: last 6 months cumulative saldo
        const txsRaw: Transaction[] = (() => { try { return JSON.parse(localStorage.getItem('lion-txs') || '[]') } catch { return [] } })()
        const sparkMonths: number[] = []
        let running = 0
        for (let i = 5; i >= 0; i--) {
          const d = new Date(); d.setMonth(d.getMonth() - i)
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
          running += txsRaw.filter(t => t.date === key).reduce((s,t) => s+(t.type==='receita'?t.amount:-t.amount),0)
          sparkMonths.push(running)
        }
        const sparkPath = sparkMonths.length >= 2 ? (() => {
          const mn = Math.min(...sparkMonths), mx = Math.max(...sparkMonths), rng = mx - mn || 1
          const pts = sparkMonths.map((v,i) => `${(i/(sparkMonths.length-1))*260},${42-((v-mn)/rng*38)}`)
          return { line: `M${pts.join(' L')}`, area: `M${pts.join(' L')} L260,44 L0,44Z` }
        })() : null

        // Monthly income/expenses
        const now2 = new Date()
        const curKey = `${now2.getFullYear()}-${String(now2.getMonth()+1).padStart(2,'0')}`
        const monthInc = txsRaw.filter(t=>t.date===curKey&&t.type==='receita').reduce((s,t)=>s+t.amount,0)
        const monthExp = txsRaw.filter(t=>t.date===curKey&&t.type==='despesa').reduce((s,t)=>s+t.amount,0)

        const momPct = dashData.lastMonthNet !== 0 ? Math.round((dashData.thisMonthNet-dashData.lastMonthNet)/Math.abs(dashData.lastMonthNet)*100) : 0

        return (
          <main className="dash-content">
            {/* ── Row 1: Hero + 3 metrics ── */}
            <div className="bento-row bento-r1">

              {/* Hero card */}
              <div className="bc bc-hero">
                <div className="hero-eyebrow">Saldo Financeiro</div>
                <div className="hero-amount">{fmt(dashData.balance)}</div>
                <span className={`hero-pill ${momPct >= 0 ? 'hero-pill-pos' : 'hero-pill-neg'}`}>
                  {momPct >= 0 ? '↑' : '↓'} {Math.abs(momPct)}% vs mês anterior
                </span>
                {sparkPath && (
                  <div className="hero-spark">
                    <div className="hero-spark-lbl">Evolução — últimos 6 meses</div>
                    <svg className="spark-svg" viewBox="0 0 260 44" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="sg2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity=".3"/>
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
                        </linearGradient>
                      </defs>
                      <path d={sparkPath.area} fill="url(#sg2)"/>
                      <path d={sparkPath.line} stroke="#60a5fa" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="260" cy={42-((sparkMonths[5]-Math.min(...sparkMonths))/(Math.max(...sparkMonths)-Math.min(...sparkMonths)||1)*38)} r="3" fill="#60a5fa"/>
                    </svg>
                  </div>
                )}
              </div>

              {/* Metric: Receita */}
              <div className="bc bc-metric">
                <div className="metric-ico mi-green">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 2v16M14 5H8a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H6" strokeLinecap="round"/></svg>
                </div>
                <div className="metric-lbl">Receita mensal</div>
                <div className="metric-val">{fmt(monthInc)}</div>
                <div className={`metric-chg ${monthInc > 0 ? 'mc-pos' : 'mc-neu'}`}>
                  {monthInc > 0 ? '↑' : '—'} {curKey.split('-').reverse().join('/')}
                </div>
              </div>

              {/* Metric: Gastos */}
              <div className="bc bc-metric">
                <div className="metric-ico mi-red">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7h14M3 7l2-3h10l2 3M3 7v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div className="metric-lbl">Gastos mensais</div>
                <div className="metric-val">{fmt(monthExp)}</div>
                <div className={`metric-chg ${monthExp > monthInc ? 'mc-neg' : 'mc-neu'}`}>
                  {monthExp > monthInc ? '↑ Acima da receita' : monthExp > 0 ? `${Math.round((monthExp/Math.max(monthInc,1))*100)}% da receita` : 'Sem gastos'}
                </div>
              </div>

              {/* Metric: Alertas */}
              <div className="bc bc-metric" style={{ cursor:'pointer' }} onClick={toggleAlerts}>
                <div className={`metric-ico ${dashData.dangerCount > 0 ? 'mi-red' : dashData.warnCount > 0 ? 'mi-amber' : 'mi-green'}`}>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8.57 3.43L1.5 15.5a1.5 1.5 0 0 0 1.29 2.25h14.42A1.5 1.5 0 0 0 18.5 15.5L11.43 3.43a1.65 1.65 0 0 0-2.86 0z" strokeLinejoin="round"/><path d="M10 8v4M10 14h.01" strokeLinecap="round"/></svg>
                </div>
                <div className="metric-lbl">Alertas ativos</div>
                <div className="metric-val">{dashData.totalAlerts}</div>
                <div className={`metric-chg ${dashData.dangerCount > 0 ? 'mc-neg' : dashData.warnCount > 0 ? 'mc-neu' : 'mc-pos'}`}>
                  {dashData.totalAlerts === 0 ? '✓ Tudo em ordem' : `${dashData.dangerCount} crítico(s)`}
                </div>
              </div>

            </div>

            {/* ── Row 2: Activity + Goals + Quick Actions ── */}
            <div className="bento-row bento-r2">

              {/* Activity feed */}
              <div className="bc">
                <div className="bc-title" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setActivityOpen(v => !v)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg viewBox="0 0 12 12" fill="none" style={{ width: '10px', height: '10px', transition: 'transform .2s', transform: activityOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    Atividade Recente
                  </span>
                  <button className="bc-title-btn" onClick={e => { e.stopPropagation(); setSidebarPage('financas') }}>+ Transação</button>
                </div>
                {activityOpen && (activity.length === 0 ? (
                  <div className="feed-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ width: 32, height: 32, opacity: .3, marginBottom: 6 }}><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12h8M12 8v8" strokeLinecap="round"/></svg>
                    <span>Nenhuma atividade ainda</span>
                    <button className="feed-empty-btn" onClick={() => setSidebarPage('financas')}>Adicionar transação</button>
                  </div>
                ) : activity.slice(0,6).map(a => (
                  <div key={a.id} className="feed-row">
                    <div className="feed-dot" style={{ background: a.color === 'green' ? 'var(--green)' : a.color === 'red' ? 'var(--red)' : a.color === 'amber' ? 'var(--amber)' : 'var(--blue)' }}/>
                    <div className="feed-info">
                      <div className="feed-name">{a.title}</div>
                      <div className="feed-time">{a.time}</div>
                    </div>
                    <div className="feed-amt" style={{ color: a.color === 'green' ? 'var(--green-l)' : a.color === 'red' ? '#f87171' : a.color === 'amber' ? 'var(--amber-l)' : 'var(--blue-l)' }}>{a.sub}</div>
                  </div>
                )))}
              </div>

              {/* Hub de Pagamentos summary */}
              {(() => {
                const hubBills: Bill[] = (() => { try { return JSON.parse(localStorage.getItem('lion-bills') || '[]') } catch { return [] } })()
                const hubNow = new Date()
                const hubMonth = `${hubNow.getFullYear()}-${String(hubNow.getMonth() + 1).padStart(2, '0')}`
                const monthBills = hubBills.filter(b => b.dueDate?.startsWith(hubMonth) && b.status !== 'cancelado')
                const aberto = monthBills.filter(b => effectiveStatus(b) === 'em_aberto')
                const vencido = monthBills.filter(b => effectiveStatus(b) === 'vencido')
                const pago = monthBills.filter(b => b.status === 'pago')
                const totalAberto = aberto.reduce((s, b) => s + b.amount, 0) + vencido.reduce((s, b) => s + b.amount, 0)
                const totalPago = pago.reduce((s, b) => s + b.amount, 0)
                const progress = (totalAberto + totalPago) > 0 ? Math.round((totalPago / (totalAberto + totalPago)) * 100) : 0
                return (
                  <div className="bc">
                    <div className="bc-title">
                      Contas do Mês
                      <button className="bc-title-btn" onClick={() => setSidebarPage('payment-hub')}>Ver todas</button>
                    </div>
                    {monthBills.length === 0 ? (
                      <div className="feed-empty">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ width: 32, height: 32, opacity: .3, marginBottom: 6 }}><rect x="2" y="5" width="20" height="14" rx="3"/><path d="M2 10h20" strokeLinecap="round"/><path d="M6 15h4" strokeLinecap="round"/></svg>
                        <span>Nenhuma conta este mês</span>
                        <button className="feed-empty-btn" onClick={() => setSidebarPage('payment-hub')}>Adicionar conta</button>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                          <div style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: 'rgba(239,68,68,.1)' }}>
                            <div style={{ fontSize: 'calc(.65rem * var(--fs))', color: 'var(--text)', opacity: .6 }}>A pagar</div>
                            <div style={{ fontSize: 'calc(.85rem * var(--fs))', fontWeight: 600, color: vencido.length > 0 ? 'var(--red)' : 'var(--text)' }}>{fmt(totalAberto)}</div>
                            <div style={{ fontSize: 'calc(.6rem * var(--fs))', color: 'var(--text)', opacity: .5 }}>{aberto.length + vencido.length} conta{(aberto.length + vencido.length) !== 1 ? 's' : ''}{vencido.length > 0 ? ` · ${vencido.length} vencida` : ''}</div>
                          </div>
                          <div style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: 'rgba(16,185,129,.1)' }}>
                            <div style={{ fontSize: 'calc(.65rem * var(--fs))', color: 'var(--text)', opacity: .6 }}>Pago</div>
                            <div style={{ fontSize: 'calc(.85rem * var(--fs))', fontWeight: 600, color: 'var(--green)' }}>{fmt(totalPago)}</div>
                            <div style={{ fontSize: 'calc(.6rem * var(--fs))', color: 'var(--text)', opacity: .5 }}>{pago.length} quitada{pago.length !== 1 ? 's' : ''}</div>
                          </div>
                        </div>
                        <div style={{ background: 'var(--bg3)', borderRadius: '6px', height: '6px', overflow: 'hidden' }}>
                          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--green)', borderRadius: '6px', transition: 'width .3s' }} />
                        </div>
                        <div style={{ fontSize: 'calc(.6rem * var(--fs))', color: 'var(--text)', opacity: .5, marginTop: '4px', textAlign: 'right' }}>{progress}% quitado</div>
                        {vencido.slice(0, 3).map(b => {
                          const collectors: Collector[] = (() => { try { return JSON.parse(localStorage.getItem('lion-collectors') || '[]') } catch { return [] } })()
                          const c = collectors.find(cl => cl.id === b.collectorId)
                          return (
                            <div key={b.id} className="feed-row">
                              <div className="feed-dot" style={{ background: 'var(--red)' }} />
                              <div className="feed-info">
                                <div className="feed-name">{c?.name || 'Conta'}{b.description ? ` — ${b.description}` : ''}</div>
                                <div className="feed-time">Vencida · {fmtDate(b.dueDate)}</div>
                              </div>
                              <div className="feed-amt" style={{ color: '#f87171' }}>{fmt(b.amount)}</div>
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>
                )
              })()}


            </div>

            {/* ── Row 3: Terra overview ── */}
            {(() => {
              const dashFazendas: TerraFazenda[] = (() => { try { return JSON.parse(localStorage.getItem('lion-terra') || '[]') } catch { return [] } })()
              const dashTalhoes: TerraTalhao[] = (() => { try { return JSON.parse(localStorage.getItem('lion-talhoes') || '[]') } catch { return [] } })()
              if (dashFazendas.length === 0) return null
              const faz = dashFazendas[0]
              const fazTal = dashTalhoes.filter(t => t.fazendaId === faz.id)
              const areaUtilVal = faz.areaUtil || 0
              const utilizPct = faz.areaTotal > 0 ? ((areaUtilVal / faz.areaTotal) * 100).toFixed(1) : '0'
              const somaTal = fazTal.reduce((s, t) => s + t.areaHa, 0)
              const fmtHa2 = (v: number) => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' ha'

              const pieItems = fazTal.length > 0
                ? fazTal.map(t => {
                    const usoInfo = TALHAO_USOS.find(u => u.value === t.uso)
                    return { label: t.nome, value: t.areaHa, cor: t.cor || usoInfo?.cor || '#6b7280' }
                  }).filter(i => i.value > 0)
                : [
                    { label: 'Lavoura', value: faz.areaLavoura, cor: '#f59e0b' },
                    { label: 'Pastagem', value: faz.areaPastagem, cor: '#22c55e' },
                    { label: 'APP', value: faz.areaApp, cor: '#0d9488' },
                    { label: 'Reflorestamento', value: faz.areaReflorestamento, cor: '#65a30d' },
                    { label: 'Benfeitorias', value: faz.areaBenfeitorias, cor: '#8b5cf6' },
                  ].filter(i => i.value > 0)

              const pieTotal = pieItems.reduce((s, i) => s + i.value, 0)
              let pieCum = 0
              const slices = pieTotal > 0 ? pieItems.map(item => {
                const startFrac = pieCum / pieTotal
                pieCum += item.value
                const frac = item.value / pieTotal
                const r = 70
                const circ = 2 * Math.PI * r
                return { ...item, strokeDasharray: `${frac * circ} ${circ}`, strokeDashoffset: -startFrac * circ, pct: ((item.value / pieTotal) * 100).toFixed(0) }
              }) : []

              const docs = [faz.geoReferenciado, faz.licencaAmbiental, !!faz.matricula, !!faz.carNumero]
              const docsOk = docs.filter(Boolean).length

              return (
                <div className="bento-row bento-r3">
                  <div className="bc bc-metric">
                    <div className="metric-ico mi-green">
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 18C6 10 14 10 18 18" strokeLinecap="round"/><path d="M10 2c2 4 6 5 8 4-1 3-5 5-8 3-3 2-7 0-8-3 2 1 6 0 8-4z" strokeLinejoin="round"/></svg>
                    </div>
                    <div className="metric-lbl">Área Útil</div>
                    <div className="metric-val">{fmtHa2(areaUtilVal)}</div>
                    <div className={`metric-chg ${Number(utilizPct) >= 70 ? 'mc-pos' : 'mc-neu'}`}>{utilizPct}% de utilização</div>
                  </div>

                  <div className="bc bc-metric">
                    <div className="metric-ico mi-amber">
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="7" height="7" rx="1" strokeLinejoin="round"/><rect x="11" y="2" width="7" height="7" rx="1" strokeLinejoin="round"/><rect x="2" y="11" width="7" height="7" rx="1" strokeLinejoin="round"/><rect x="11" y="11" width="7" height="7" rx="1" strokeLinejoin="round"/></svg>
                    </div>
                    <div className="metric-lbl">Talhões</div>
                    <div className="metric-val">{fazTal.length}</div>
                    <div className="metric-chg mc-neu">{fmtHa2(somaTal)} mapeados</div>
                  </div>

                  <div className="bc">
                    <div className="bc-title">
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 18C6 10 14 10 18 18" strokeLinecap="round"/><path d="M10 2c2 4 6 5 8 4-1 3-5 5-8 3-3 2-7 0-8-3 2 1 6 0 8-4z" strokeLinejoin="round"/></svg>
                        {faz.nome}
                      </span>
                      <button className="bc-title-btn" onClick={() => setSidebarPage('terra')}>Ver Terra</button>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                      <div ref={dashMiniMapRef} style={{ width: 120, height: 120, borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: 'var(--bg3)', cursor: 'pointer' }} onClick={() => setSidebarPage('terra')} title="Ver mapa completo" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {faz.municipio && <div style={{ fontSize: 'calc(.7rem * var(--fs))', color: 'var(--text)', opacity: .7, marginBottom: '4px' }}>{faz.municipio}{faz.uf ? ` — ${faz.uf}` : ''}</div>}
                        <div style={{ fontSize: 'calc(.72rem * var(--fs))', color: 'var(--text2)', fontWeight: 600 }}>Área Total: {fmtHa2(faz.areaTotal)}</div>
                        <div style={{ fontSize: 'calc(.65rem * var(--fs))', color: 'var(--text)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: docsOk === 4 ? 'var(--green)' : docsOk >= 2 ? 'var(--amber)' : 'var(--red)', display: 'inline-block', flexShrink: 0 }} />
                          Documentação: {docsOk}/4 completo{docsOk !== 1 ? 's' : ''}
                        </div>
                        {slices.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 8px', marginTop: '8px' }}>
                            {slices.slice(0, 5).map((s, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: 'calc(.6rem * var(--fs))', color: 'var(--text)' }}>
                                <span style={{ width: 8, height: 8, borderRadius: '2px', background: s.cor, flexShrink: 0 }} />
                                {s.label} {s.pct}%
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {slices.length > 0 && (
                        <div style={{ width: 80, height: 80, flexShrink: 0, alignSelf: 'center' }}>
                          <svg viewBox="0 0 200 200" style={{ width: '100%', height: '100%' }}>
                            {slices.map((s, i) => (
                              <circle key={i} cx="100" cy="100" r="70" fill="none" stroke={s.cor} strokeWidth="28" strokeDasharray={s.strokeDasharray} strokeDashoffset={s.strokeDashoffset} transform="rotate(-90 100 100)" />
                            ))}
                            <circle cx="100" cy="100" r="56" fill="var(--bg2)" />
                            <text x="100" y="96" textAnchor="middle" fill="var(--text3)" fontSize="24" fontWeight="700">{slices.length}</text>
                            <text x="100" y="114" textAnchor="middle" fill="var(--text)" fontSize="11" opacity=".6">usos</text>
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}

          </main>
        )
      })()}

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
