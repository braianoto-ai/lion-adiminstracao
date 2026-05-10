import type { Transaction, Goal, Rental, Maintenance, Vehicle, Bill, Collector, Folder, AppAlert, SearchResult, CalEvent, BillStatus } from './types'

// ─── Formatting ─────────────────────────────────────────────────────────────

export const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export const fmtDate = (s: string) => {
  if (!s) return '—'
  const d = new Date(s + 'T12:00:00')
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

export function relTime(ts: number): string {
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

// ─── Bills ──────────────────────────────────────────────────────────────────

export function isOverdue(bill: Bill): boolean {
  if (bill.status !== 'em_aberto') return false
  return new Date(bill.dueDate + 'T23:59:59') < new Date()
}

export function effectiveStatus(bill: Bill): BillStatus {
  return isOverdue(bill) ? 'vencido' : bill.status
}

// ─── Bank import parsers ────────────────────────────────────────────────────

export function parseNubankCSV(text: string): Omit<Transaction, 'id'>[] {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const header = lines[0].toLowerCase()
  const startIdx = (header.includes('data') || header.includes('date') || header.includes('title')) ? 1 : 0
  const results: Omit<Transaction, 'id'>[] = []
  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim())
    if (cols.length < 3) continue
    const [rawDate, title, rawAmount] = cols
    const dateMatch = rawDate.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/)
      || rawDate.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/)
    if (!dateMatch) continue
    let yyyy: string, mm: string
    if (rawDate.match(/^\d{4}/)) { yyyy = dateMatch[1]; mm = dateMatch[2] }
    else { yyyy = dateMatch[3]; mm = dateMatch[2] }
    const amount = parseFloat(rawAmount.replace(',', '.').replace(/[^\d.\-]/g, ''))
    if (isNaN(amount) || amount === 0) continue
    results.push({
      type: amount < 0 ? 'despesa' : 'receita',
      category: 'Outros',
      description: title,
      amount: Math.abs(amount),
      date: `${yyyy}-${mm}`,
    })
  }
  return results
}

export function parseBBOFX(text: string): Omit<Transaction, 'id'>[] {
  const results: Omit<Transaction, 'id'>[] = []
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || []
  const sgmlBlocks = text.split(/<STMTTRN>/i).slice(1)
  const toProcess = blocks.length > 0 ? blocks : sgmlBlocks
  for (const block of toProcess) {
    const getVal = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>[\\s]*([^<\\n\\r]+)`, 'i'))
      return m ? m[1].trim() : ''
    }
    const rawDate = getVal('DTPOSTED') || getVal('DTUSER')
    const rawAmount = getVal('TRNAMT')
    const memo = getVal('MEMO') || getVal('NAME') || getVal('FITID')
    if (!rawDate || !rawAmount) continue
    const yyyy = rawDate.slice(0, 4)
    const mm = rawDate.slice(4, 6)
    if (!yyyy || !mm || yyyy.length !== 4) continue
    const amount = parseFloat(rawAmount.replace(',', '.'))
    if (isNaN(amount) || amount === 0) continue
    results.push({
      type: amount < 0 ? 'despesa' : 'receita',
      category: 'Outros',
      description: memo,
      amount: Math.abs(amount),
      date: `${yyyy}-${mm}`,
    })
  }
  return results
}

export function detectAndParse(text: string, fileName: string): Omit<Transaction, 'id'>[] {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.ofx') || lower.endsWith('.qfx') || text.includes('<OFX') || text.includes('<ofx')) {
    return parseBBOFX(text)
  }
  return parseNubankCSV(text)
}

// ─── Dashboard data ─────────────────────────────────────────────────────────

export function buildAlerts(): AppAlert[] {
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

export function computeDashData() {
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

  const lastMonth = (() => { const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })()
  const thisMonthNet = txs.filter(t => t.date === thisMonth).reduce((s, t) => s + (t.type === 'receita' ? t.amount : -t.amount), 0)
  const lastMonthNet = txs.filter(t => t.date === lastMonth).reduce((s, t) => s + (t.type === 'receita' ? t.amount : -t.amount), 0)

  return { balance, totalGoals, targetGoals, goalsProgress, monthlyRent, dangerCount, warnCount, totalAlerts: alerts.length, txCount: txs.length, rentCount: rentals.length, goalsCount: goals.length, thisMonthNet, lastMonthNet }
}

export function buildSearchIndex(q: string): SearchResult[] {
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

export function buildAutoEvents(): CalEvent[] {
  const evs: CalEvent[] = []
  const now = new Date()

  const vehicles: Vehicle[] = (() => { try { return JSON.parse(localStorage.getItem('lion-vehicles') || '[]') } catch { return [] } })()
  for (const v of vehicles) {
    if (v.nextRevisionDate) evs.push({ id: `veh-rev-${v.id}`, title: `Revisão: ${v.name}`, date: v.nextRevisionDate, time: '', category: 'manutencao', notes: '', auto: true })
    if (v.ipvaExpiry)       evs.push({ id: `veh-ipva-${v.id}`, title: `IPVA: ${v.name}`, date: v.ipvaExpiry, time: '', category: 'financeiro', notes: '', auto: true })
    if (v.insuranceExpiry)  evs.push({ id: `veh-seg-${v.id}`, title: `Seguro: ${v.name}`, date: v.insuranceExpiry, time: '', category: 'financeiro', notes: '', auto: true })
  }

  const maint: Maintenance[] = (() => { try { return JSON.parse(localStorage.getItem('lion-maintenance') || '[]') } catch { return [] } })()
  for (const m of maint) {
    if (m.scheduledDate && m.status !== 'feito') evs.push({ id: `maint-${m.id}`, title: `${m.type}: ${m.asset}`, date: m.scheduledDate, time: '', category: 'manutencao', notes: m.notes, auto: true })
  }

  const rentals: Rental[] = (() => { try { return JSON.parse(localStorage.getItem('lion-rentals') || '[]') } catch { return [] } })()
  for (const r of rentals) {
    for (let m = 0; m < 3; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() + m, r.dueDay)
      const dateStr = d.toISOString().slice(0, 10)
      evs.push({ id: `rent-${r.id}-${m}`, title: `Aluguel: ${r.property}`, date: dateStr, time: '', category: 'financeiro', notes: `Locatário: ${r.tenant}`, auto: true })
    }
  }

  const bills: Bill[] = (() => { try { return JSON.parse(localStorage.getItem('lion-bills') || '[]') } catch { return [] } })()
  const collectors: Collector[] = (() => { try { return JSON.parse(localStorage.getItem('lion-collectors') || '[]') } catch { return [] } })()
  for (const b of bills) {
    if (b.dueDate && b.status !== 'cancelado') {
      const coll = collectors.find(c => c.id === b.collectorId)
      const collName = coll?.name || 'Conta'
      const statusLabel = b.status === 'pago' ? ' ✓' : ''
      evs.push({ id: `bill-${b.id}`, title: `${collName}: ${b.description}${statusLabel}`, date: b.dueDate, time: '', category: 'financeiro', notes: `R$ ${b.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, auto: true, paid: b.status === 'pago' })
    }
  }

  return evs
}

// ─── Notes default folders ──────────────────────────────────────────────────

export function defaultFolders(): Folder[] {
  return [
    { id: '1', name: 'Geral', color: '#7c3aed', notes: [] },
    { id: '2', name: 'Trabalho', color: '#3b82f6', notes: [] },
    { id: '3', name: 'Pessoal', color: '#10b981', notes: [] },
  ]
}
