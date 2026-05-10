import { useState } from 'react'
import { useCloudTable } from '../hooks'
import { BILL_INIT, BILL_RECURRENCE_LABEL, BILL_STATUS_LABEL, COLL_INIT, BILL_CATEGORIES, BILL_COLORS } from '../constants'
import { fmtCurrency, fmtDate, effectiveStatus } from '../utils'
import { CLOUD_BUS } from '../context'
import type { Collector, Bill, BillStatus, BillRecurrence, Transaction } from '../types'

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="ph-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ph-modal">
        <div className="ph-modal-header">
          <span className="ph-modal-title">{title}</span>
          <button className="ph-modal-close" onClick={onClose}>
            <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CollectorForm({ initial, onSave, onCancel }: { initial: typeof COLL_INIT; onSave: (v: typeof COLL_INIT) => void; onCancel: () => void }) {
  const [form, setForm] = useState(initial)
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  return (
    <form className="ph-modal-form" onSubmit={e => { e.preventDefault(); if (!form.name.trim()) return; onSave(form) }}>
      <div className="ph-field">
        <label>Nome *</label>
        <input autoFocus value={form.name} onChange={e => f('name', e.target.value)} placeholder="Ex: CEMIG, Claro, Condomínio…" required />
      </div>
      <div className="ph-field">
        <label>Categoria</label>
        <select value={form.category} onChange={e => f('category', e.target.value)}>
          {BILL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="ph-field">
        <label>Cor</label>
        <div className="ph-color-picker">
          {BILL_COLORS.map(c => (
            <button key={c} type="button" className={`ph-color-dot${form.color === c ? ' ph-color-active' : ''}`}
              style={{ background: c }} onClick={() => f('color', c)} />
          ))}
        </div>
      </div>
      <div className="ph-form-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-accent">Salvar</button>
      </div>
    </form>
  )
}

function BillForm({ initial, collectors, onSave, onCancel, onCreateCollector }: {
  initial: typeof BILL_INIT; collectors: Collector[]
  onSave: (v: typeof BILL_INIT) => void; onCancel: () => void
  onCreateCollector?: (name: string) => string
}) {
  const [form, setForm] = useState(initial)
  const [newCollName, setNewCollName] = useState('')
  const [showNewColl, setShowNewColl] = useState(false)
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleAddCollector = () => {
    if (!newCollName.trim() || !onCreateCollector) return
    const id = onCreateCollector(newCollName.trim())
    f('collectorId', id)
    setNewCollName('')
    setShowNewColl(false)
  }

  return (
    <form className="ph-modal-form" onSubmit={e => { e.preventDefault(); if (!form.amount || !form.dueDate) return; onSave(form) }}>
      <div className="ph-field">
        <label>Cobrador</label>
        {!showNewColl ? (
          <div className="ph-coll-select-row">
            <select value={form.collectorId} onChange={e => f('collectorId', e.target.value)}>
              <option value="">Selecione…</option>
              {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" className="ph-coll-add-btn" onClick={() => setShowNewColl(true)} title="Novo cobrador">
              <svg viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>
        ) : (
          <div className="ph-coll-select-row">
            <input value={newCollName} onChange={e => setNewCollName(e.target.value)} placeholder="Nome do cobrador" autoFocus
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCollector() } }} />
            <button type="button" className="ph-coll-add-btn ph-coll-confirm" onClick={handleAddCollector} title="Criar" disabled={!newCollName.trim()}>
              <svg viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button type="button" className="ph-coll-add-btn" onClick={() => { setShowNewColl(false); setNewCollName('') }} title="Cancelar">
              <svg viewBox="0 0 14 14" fill="none"><path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            </button>
          </div>
        )}
      </div>
      <div className="ph-field">
        <label>Descrição</label>
        <input value={form.description} onChange={e => f('description', e.target.value)} placeholder="Ex: Fatura março 2026" />
      </div>
      <div className="ph-form-row">
        <div className="ph-field">
          <label>Valor (R$) *</label>
          <input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => f('amount', e.target.value)} placeholder="0,00" required />
        </div>
        <div className="ph-field">
          <label>Vencimento *</label>
          <input type="date" value={form.dueDate} onChange={e => f('dueDate', e.target.value)} required />
        </div>
      </div>
      <div className="ph-form-row">
        <div className="ph-field">
          <label>Recorrência</label>
          <select value={form.recurrence} onChange={e => f('recurrence', e.target.value)}>
            {(Object.entries(BILL_RECURRENCE_LABEL) as [BillRecurrence, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="ph-field">
          <label>Status</label>
          <select value={form.status} onChange={e => f('status', e.target.value as BillStatus)}>
            {(Object.entries(BILL_STATUS_LABEL) as [BillStatus, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="ph-field">
        <label>Link de pagamento</label>
        <input type="url" value={form.paymentLink} onChange={e => f('paymentLink', e.target.value)} placeholder="https://…" />
      </div>
      <div className="ph-field">
        <label>Código de barras / PIX</label>
        <input value={form.barcode} onChange={e => f('barcode', e.target.value)} placeholder="Cole o código aqui" />
      </div>
      <div className="ph-field">
        <label>Observações</label>
        <input value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Opcional" />
      </div>
      <div className="ph-form-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-accent">Salvar</button>
      </div>
    </form>
  )
}

export default
function PaymentHubPage() {
  const [collectors, setCollectors] = useCloudTable<Collector>('collectors', 'lion-collectors')
  const [bills, setBills] = useCloudTable<Bill>('bills', 'lion-bills')
  const [selCollector, setSelCollector] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<BillStatus | 'all'>('all')
  const [phTab, setPhTab] = useState<'bills' | 'monthly'>('bills')
  const [monthOffset, setMonthOffset] = useState(0)
  const [modal, setModal] = useState<'new-collector' | 'edit-collector' | 'new-bill' | 'edit-bill' | 'barcode' | null>(null)
  const [editingCollector, setEditingCollector] = useState<Collector | null>(null)
  const [editingBill, setEditingBill] = useState<Bill | null>(null)
  const [barcodeText, setBarcodeText] = useState('')
  const [copied, setCopied] = useState(false)


  const createCollectorInline = (name: string): string => {
    const id = Date.now().toString()
    const newColl: Collector = { id, name, category: 'Outros', color: '#6366f1', createdAt: new Date().toISOString() }
    setCollectors(prev => [...prev, newColl])
    return id
  }

  const saveCollector = (form: typeof COLL_INIT) => {
    if (editingCollector) {
      setCollectors(prev => prev.map(c => c.id === editingCollector.id ? { ...c, ...form } : c))
    } else {
      setCollectors(prev => [...prev, { ...form, id: Date.now().toString(), createdAt: new Date().toISOString() }])
    }
    setModal(null); setEditingCollector(null)
  }

  const deleteCollector = (id: string) => {
    if (!confirm('Remover cobrador e todas as suas contas?')) return
    setCollectors(prev => prev.filter(c => c.id !== id))
    setBills(prev => prev.filter(b => b.collectorId !== id))
    if (selCollector === id) setSelCollector(null)
  }

  const saveBill = (form: typeof BILL_INIT) => {
    const now = new Date().toISOString()
    if (editingBill) {
      setBills(prev => prev.map(b => b.id === editingBill.id
        ? { ...b, ...form, amount: parseFloat(form.amount), updatedAt: now }
        : b))
    } else {
      const bill: Bill = { id: Date.now().toString(), ...form, amount: parseFloat(form.amount), createdAt: now, updatedAt: now }
      setBills(prev => [...prev, bill])
    }
    setModal(null); setEditingBill(null)
  }

  const deleteBill = (id: string) => {
    if (!confirm('Remover esta conta?')) return
    setBills(prev => prev.filter(b => b.id !== id))
  }

  const billCategoryToTx = (billCat: string): string => {
    const map: Record<string, string> = {
      'Energia': 'Moradia', 'Água': 'Moradia', 'Condomínio': 'Moradia', 'Aluguel': 'Moradia',
      'Internet': 'Moradia', 'Telefonia': 'Moradia',
      'Cartão': 'Outros', 'Streaming': 'Lazer',
      'Educação': 'Educação', 'Saúde': 'Saúde', 'Imposto': 'Impostos',
    }
    return map[billCat] || 'Outros'
  }

  const addTxFromBill = (bill: Bill) => {
    const coll = getCollector(bill.collectorId)
    const txId = `bill-${bill.id}`
    const tx: Transaction = {
      id: txId,
      type: 'despesa',
      category: billCategoryToTx(coll?.category || ''),
      description: `${coll?.name || 'Conta'}${bill.description ? ' — ' + bill.description : ''}`,
      amount: bill.amount,
      date: bill.dueDate.slice(0, 7),
    }
    try {
      const txs: Transaction[] = JSON.parse(localStorage.getItem('lion-txs') || '[]')
      if (!txs.some(t => t.id === txId)) {
        txs.unshift(tx)
        localStorage.setItem('lion-txs', JSON.stringify(txs))
        CLOUD_BUS.dispatchEvent(new Event('lion-txs'))
      }
    } catch { /* ignore */ }
  }

  const removeTxFromBill = (billId: string) => {
    const txId = `bill-${billId}`
    try {
      const txs: Transaction[] = JSON.parse(localStorage.getItem('lion-txs') || '[]')
      const filtered = txs.filter(t => t.id !== txId)
      if (filtered.length !== txs.length) {
        localStorage.setItem('lion-txs', JSON.stringify(filtered))
        CLOUD_BUS.dispatchEvent(new Event('lion-txs'))
      }
    } catch { /* ignore */ }
  }

  const markPaid = (id: string) => {
    const now = new Date().toISOString()
    const bill = bills.find(b => b.id === id)
    setBills(prev => {
      let next = prev.map(b => b.id === id ? { ...b, status: 'pago' as BillStatus, paidAt: now, updatedAt: now } : b)
      if (bill && bill.recurrence === 'mensal') {
        const d = new Date(bill.dueDate + 'T12:00:00')
        d.setMonth(d.getMonth() + 1)
        const nextDue = d.toISOString().slice(0, 10)
        const alreadyExists = next.some(b => b.collectorId === bill.collectorId && b.dueDate === nextDue && b.status !== 'cancelado')
        if (!alreadyExists) {
          const newBill: Bill = {
            id: Date.now().toString(),
            collectorId: bill.collectorId,
            description: bill.description,
            amount: bill.amount,
            dueDate: nextDue,
            status: 'em_aberto',
            recurrence: 'mensal',
            paymentLink: bill.paymentLink,
            barcode: bill.barcode,
            notes: bill.notes,
            createdAt: now,
            updatedAt: now,
          }
          next = [...next, newBill]
        }
      }
      return next
    })
    if (bill) addTxFromBill(bill)
  }

  const markOpen = (id: string) => {
    setBills(prev => prev.map(b => b.id === id ? { ...b, status: 'em_aberto', paidAt: undefined, updatedAt: new Date().toISOString() } : b))
    removeTxFromBill(id)
  }

  const copyBarcode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  // Filtered + effective status
  const visibleBills = bills
    .filter(b => !selCollector || b.collectorId === selCollector)
    .filter(b => filterStatus === 'all' || effectiveStatus(b) === filterStatus)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  // Summary (all bills, no collector filter)
  const today = new Date()
  const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  const totalAberto   = bills.filter(b => effectiveStatus(b) === 'em_aberto').reduce((s, b) => s + b.amount, 0)
  const totalVencido  = bills.filter(b => effectiveStatus(b) === 'vencido').reduce((s, b) => s + b.amount, 0)
  const isPagoMes = (b: Bill) => b.status === 'pago' && (b.paidAt?.startsWith(thisMonth) || (!b.paidAt && (b.dueDate?.startsWith(thisMonth) || !b.dueDate)))
  const totalPagoMes  = bills.filter(isPagoMes).reduce((s, b) => s + b.amount, 0)
  const totalMensal   = bills.filter(b => b.recurrence === 'mensal' && b.status !== 'cancelado').reduce((s, b) => s + b.amount, 0)

  const countVencido  = bills.filter(b => effectiveStatus(b) === 'vencido').length
  const countAberto   = bills.filter(b => effectiveStatus(b) === 'em_aberto').length

  const getCollector = (id: string) => collectors.find(c => c.id === id)

  const statusColors: Record<BillStatus, string> = {
    em_aberto: 'var(--blue)', pago: 'var(--green)', vencido: 'var(--red)', cancelado: 'var(--text)',
  }

  return (
    <div className="ph-page">
      {/* Summary */}
      <div className="ph-summary">
        <div className="ph-summary-card">
          <div className="ph-summary-icon" style={{ background: 'rgba(59,130,246,.15)', color: 'var(--blue)' }}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="8"/><path d="M10 6v4l3 3" strokeLinecap="round"/></svg>
          </div>
          <div>
            <div className="ph-summary-label">Em aberto</div>
            <div className="ph-summary-value">{fmtCurrency(totalAberto)}</div>
            <div className="ph-summary-sub">{countAberto} conta{countAberto !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div className="ph-summary-card">
          <div className="ph-summary-icon" style={{ background: 'rgba(239,68,68,.15)', color: 'var(--red)' }}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 6v4M10 14h.01" strokeLinecap="round"/><circle cx="10" cy="10" r="8"/></svg>
          </div>
          <div>
            <div className="ph-summary-label">Vencidas</div>
            <div className="ph-summary-value" style={{ color: countVencido > 0 ? 'var(--red)' : undefined }}>{fmtCurrency(totalVencido)}</div>
            <div className="ph-summary-sub">{countVencido} conta{countVencido !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div className="ph-summary-card">
          <div className="ph-summary-icon" style={{ background: 'rgba(16,185,129,.15)', color: 'var(--green)' }}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div className="ph-summary-label">Pago este mês</div>
            <div className="ph-summary-value" style={{ color: 'var(--green)' }}>{fmtCurrency(totalPagoMes)}</div>
            <div className="ph-summary-sub">{bills.filter(isPagoMes).length} quitada{bills.filter(isPagoMes).length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div className="ph-summary-card">
          <div className="ph-summary-icon" style={{ background: 'rgba(245,158,11,.15)', color: 'var(--amber)' }}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h12v12H4z" rx="2"/><path d="M8 9h4M8 12h2" strokeLinecap="round"/></svg>
          </div>
          <div>
            <div className="ph-summary-label">Total mensal</div>
            <div className="ph-summary-value">{fmtCurrency(totalMensal)}</div>
            <div className="ph-summary-sub">contas recorrentes</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ph-tabs">
        <button className={`ph-tab${phTab === 'bills' ? ' ph-tab-active' : ''}`} onClick={() => setPhTab('bills')}>Contas</button>
        <button className={`ph-tab${phTab === 'monthly' ? ' ph-tab-active' : ''}`} onClick={() => setPhTab('monthly')}>Resumo Mensal</button>
      </div>

      {/* Monthly Summary */}
      {phTab === 'monthly' && (() => {
        const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
        const viewMonth = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`
        const viewLabel = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        const isCurrentMonth = monthOffset === 0

        const monthBills = bills.filter(b => {
          if (b.status === 'cancelado') return false
          if (b.dueDate.startsWith(viewMonth)) return true
          if (b.recurrence === 'mensal' && b.status !== 'pago') {
            const billStart = b.dueDate.slice(0, 7)
            return billStart <= viewMonth
          }
          return false
        }).sort((a, b) => {
          const dayA = parseInt(a.dueDate.slice(8) || '1')
          const dayB = parseInt(b.dueDate.slice(8) || '1')
          return dayA - dayB
        })

        const totalMes = monthBills.reduce((s, b) => s + b.amount, 0)
        const pagoMes = monthBills.filter(b => b.status === 'pago').reduce((s, b) => s + b.amount, 0)
        const abertoMes = monthBills.filter(b => effectiveStatus(b) === 'em_aberto' || effectiveStatus(b) === 'vencido').reduce((s, b) => s + b.amount, 0)
        const vencidoMes = monthBills.filter(b => effectiveStatus(b) === 'vencido').reduce((s, b) => s + b.amount, 0)

        return (
          <div className="ph-monthly">
            <div className="ph-monthly-nav">
              <button className="ph-monthly-arrow" onClick={() => setMonthOffset(p => p - 1)}>
                <svg viewBox="0 0 16 16" fill="none"><path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <div className="ph-monthly-title">
                <span className="ph-monthly-label">{viewLabel}</span>
                {!isCurrentMonth && <button className="ph-monthly-today" onClick={() => setMonthOffset(0)}>Hoje</button>}
              </div>
              <button className="ph-monthly-arrow" onClick={() => setMonthOffset(p => p + 1)}>
                <svg viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>

            <div className="ph-monthly-stats">
              <div className="ph-monthly-stat">
                <span className="ph-monthly-stat-label">Total do mês</span>
                <span className="ph-monthly-stat-value">{fmtCurrency(totalMes)}</span>
              </div>
              <div className="ph-monthly-stat">
                <span className="ph-monthly-stat-label">Pago</span>
                <span className="ph-monthly-stat-value" style={{ color: 'var(--green)' }}>{fmtCurrency(pagoMes)}</span>
              </div>
              <div className="ph-monthly-stat">
                <span className="ph-monthly-stat-label">A pagar</span>
                <span className="ph-monthly-stat-value" style={{ color: vencidoMes > 0 ? 'var(--red)' : 'var(--blue)' }}>{fmtCurrency(abertoMes)}</span>
              </div>
              <div className="ph-monthly-stat">
                <span className="ph-monthly-stat-label">Progresso</span>
                <div className="ph-monthly-progress-wrap">
                  <div className="ph-monthly-progress-bar">
                    <div className="ph-monthly-progress-fill" style={{ width: totalMes > 0 ? `${Math.round(pagoMes / totalMes * 100)}%` : '0%' }} />
                  </div>
                  <span className="ph-monthly-progress-pct">{totalMes > 0 ? Math.round(pagoMes / totalMes * 100) : 0}%</span>
                </div>
              </div>
            </div>

            {monthBills.length === 0 ? (
              <div className="ph-bills-empty">
                <svg viewBox="0 0 48 48" fill="none">
                  <rect x="8" y="12" width="32" height="28" rx="4" stroke="currentColor" strokeWidth="1.5" opacity=".3"/>
                  <path d="M8 20h32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".3"/>
                </svg>
                <span>Nenhuma conta para {viewLabel}</span>
              </div>
            ) : (
              <div className="ph-monthly-list">
                {monthBills.map(bill => {
                  const coll = getCollector(bill.collectorId)
                  const status = effectiveStatus(bill)
                  const isPaid = status === 'pago'
                  const isVencido = status === 'vencido'
                  const dueDay = bill.dueDate.slice(8) || '01'
                  return (
                    <div key={bill.id} className={`ph-bill-card${isPaid ? ' ph-bill-paid' : ''}${isVencido ? ' ph-bill-overdue' : ''}`}>
                      <div className="ph-monthly-day">
                        <span className="ph-monthly-day-num">{parseInt(dueDay)}</span>
                        <span className="ph-monthly-day-label">{new Date(viewDate.getFullYear(), viewDate.getMonth(), parseInt(dueDay)).toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
                      </div>
                      <div className="ph-bill-left">
                        {coll && <div className="ph-bill-avatar" style={{ background: coll.color + '22', color: coll.color }}>{coll.name.slice(0,2).toUpperCase()}</div>}
                      </div>
                      <div className="ph-bill-body">
                        <div className="ph-bill-top">
                          <span className="ph-bill-collector">{coll?.name ?? '—'}</span>
                          <span className={`ph-bill-status ph-bill-status-${status}`}>{BILL_STATUS_LABEL[status]}</span>
                        </div>
                        {bill.description && <div className="ph-bill-desc">{bill.description}</div>}
                      </div>
                      <div className="ph-bill-right">
                        <div className="ph-bill-amount" style={{ color: isVencido ? 'var(--red)' : isPaid ? 'var(--green)' : 'var(--text3)' }}>
                          {fmtCurrency(bill.amount)}
                        </div>
                        <div className="ph-bill-actions">
                          {!isPaid && status !== 'cancelado' && (
                            <button className="ph-icon-btn ph-icon-btn-pay" title="Marcar como pago" onClick={() => markPaid(bill.id)}>
                              <svg viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </button>
                          )}
                          {isPaid && (
                            <button className="ph-icon-btn" title="Reabrir" onClick={() => markOpen(bill.id)}>
                              <svg viewBox="0 0 14 14" fill="none"><path d="M2 7a5 5 0 1 1 5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M2 4v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                            </button>
                          )}
                          <button className="ph-icon-btn" title="Editar" onClick={() => { setEditingBill(bill); setModal('edit-bill') }}>
                            <svg viewBox="0 0 14 14" fill="none"><path d="M2 10l7-7 2 2-7 7H2v-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {/* Layout */}
      {phTab === 'bills' && <div className="ph-layout">
        {/* Collectors */}
        <aside className="ph-collectors">
          <div className="ph-collectors-header">
            <span className="ph-collectors-title">Cobradores</span>
            <button className="ph-add-btn" onClick={() => { setEditingCollector(null); setModal('new-collector') }} title="Novo cobrador">
              <svg viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>
          <button className={`ph-collector-item${!selCollector ? ' ph-collector-active' : ''}`} onClick={() => setSelCollector(null)}>
            <div className="ph-collector-avatar" style={{ background: 'var(--bg4)' }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="3" width="14" height="10" rx="2"/><path d="M1 7h14" strokeLinecap="round"/></svg>
            </div>
            <div className="ph-collector-info">
              <span className="ph-collector-name">Todas</span>
              <span className="ph-collector-meta">{bills.length} conta{bills.length !== 1 ? 's' : ''}</span>
            </div>
          </button>
          {collectors.map(c => {
            const cBills = bills.filter(b => b.collectorId === c.id)
            const cTotal = cBills.filter(b => effectiveStatus(b) === 'em_aberto' || effectiveStatus(b) === 'vencido').reduce((s, b) => s + b.amount, 0)
            const hasOverdue = cBills.some(b => effectiveStatus(b) === 'vencido')
            return (
              <div key={c.id} className={`ph-collector-item${selCollector === c.id ? ' ph-collector-active' : ''}`}
                onClick={() => setSelCollector(selCollector === c.id ? null : c.id)}>
                <div className="ph-collector-avatar" style={{ background: c.color + '28', color: c.color }}>
                  {c.name.slice(0, 2).toUpperCase()}
                  {hasOverdue && <span className="ph-collector-overdue-dot" />}
                </div>
                <div className="ph-collector-info">
                  <span className="ph-collector-name">{c.name}</span>
                  <span className="ph-collector-meta">{c.category} · {cBills.length} conta{cBills.length !== 1 ? 's' : ''}</span>
                  {cTotal > 0 && <span className="ph-collector-total" style={{ color: hasOverdue ? 'var(--red)' : 'var(--text)' }}>{fmtCurrency(cTotal)}</span>}
                </div>
                <div className="ph-collector-actions">
                  <button className="ph-icon-btn" onClick={e => { e.stopPropagation(); setEditingCollector(c); setModal('edit-collector') }} title="Editar">
                    <svg viewBox="0 0 14 14" fill="none"><path d="M2 10l7-7 2 2-7 7H2v-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                  </button>
                  <button className="ph-icon-btn ph-icon-btn-del" onClick={e => { e.stopPropagation(); deleteCollector(c.id) }} title="Remover">
                    <svg viewBox="0 0 14 14" fill="none"><path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  </button>
                </div>
              </div>
            )
          })}
          {collectors.length === 0 && (
            <div className="ph-empty-hint">Adicione um cobrador para começar</div>
          )}
        </aside>

        {/* Bills */}
        <div className="ph-bills">
          <div className="ph-bills-header">
            <div className="ph-status-filters">
              {(['all', 'em_aberto', 'vencido', 'pago', 'cancelado'] as const).map(s => (
                <button key={s} className={`ph-status-btn${filterStatus === s ? ' ph-status-active' : ''}`}
                  onClick={() => setFilterStatus(s)}
                  style={filterStatus === s && s !== 'all' ? { borderColor: statusColors[s as BillStatus], color: statusColors[s as BillStatus] } : {}}>
                  {s === 'all' ? 'Todas' : BILL_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <button className="btn-accent ph-new-bill-btn" onClick={() => {
              setEditingBill(null)
              setModal('new-bill')
            }}>
              <svg viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Nova conta
            </button>
          </div>

          {visibleBills.length === 0 ? (
            <div className="ph-bills-empty">
              <svg viewBox="0 0 48 48" fill="none">
                <rect x="8" y="12" width="32" height="28" rx="4" stroke="currentColor" strokeWidth="1.5" opacity=".3"/>
                <path d="M8 20h32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".3"/>
                <path d="M18 30h12M18 34h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".3"/>
              </svg>
              <span>Nenhuma conta encontrada</span>
              <button className="btn-accent" onClick={() => { setEditingBill(null); setModal('new-bill') }}>Adicionar conta</button>
            </div>
          ) : (
            <div className="ph-bills-list">
              {visibleBills.map(bill => {
                const coll = getCollector(bill.collectorId)
                const status = effectiveStatus(bill)
                const isPaid = status === 'pago'
                const isVencido = status === 'vencido'
                return (
                  <div key={bill.id} className={`ph-bill-card${isPaid ? ' ph-bill-paid' : ''}${isVencido ? ' ph-bill-overdue' : ''}`}>
                    <div className="ph-bill-left">
                      {coll && <div className="ph-bill-avatar" style={{ background: coll.color + '22', color: coll.color }}>{coll.name.slice(0,2).toUpperCase()}</div>}
                    </div>
                    <div className="ph-bill-body">
                      <div className="ph-bill-top">
                        <span className="ph-bill-collector">{coll?.name ?? '—'}</span>
                        <span className={`ph-bill-status ph-bill-status-${status}`}>{BILL_STATUS_LABEL[status]}</span>
                      </div>
                      {bill.description && <div className="ph-bill-desc">{bill.description}</div>}
                      <div className="ph-bill-meta">
                        <span className="ph-bill-due" style={{ color: isVencido ? 'var(--red)' : undefined }}>
                          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="2" width="10" height="9" rx="1.5"/><path d="M1 5h10M4 1v2M8 1v2" strokeLinecap="round"/></svg>
                          {fmtDate(bill.dueDate)}
                          {isVencido && ' · Vencida'}
                          {isPaid && bill.paidAt && ` · Pago em ${fmtDate(bill.paidAt.slice(0,10))}`}
                        </span>
                        <span className="ph-bill-recurrence">{BILL_RECURRENCE_LABEL[bill.recurrence]}</span>
                        {coll && <span className="ph-bill-cat">{coll.category}</span>}
                      </div>
                    </div>
                    <div className="ph-bill-right">
                      <div className="ph-bill-amount" style={{ color: isVencido ? 'var(--red)' : isPaid ? 'var(--green)' : 'var(--text3)' }}>
                        {fmtCurrency(bill.amount)}
                      </div>
                      <div className="ph-bill-actions">
                        {bill.barcode && (
                          <button className="ph-icon-btn" title="Ver código" onClick={() => { setBarcodeText(bill.barcode!); setModal('barcode') }}>
                            <svg viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="2" height="10" fill="currentColor" rx=".5"/><rect x="4" y="2" width="1" height="10" fill="currentColor" rx=".5"/><rect x="6" y="2" width="2" height="10" fill="currentColor" rx=".5"/><rect x="9" y="2" width="1" height="10" fill="currentColor" rx=".5"/><rect x="11" y="2" width="2" height="10" fill="currentColor" rx=".5"/></svg>
                          </button>
                        )}
                        {bill.paymentLink && (
                          <a className="ph-icon-btn" href={bill.paymentLink} target="_blank" rel="noreferrer" title="Abrir link de pagamento">
                            <svg viewBox="0 0 14 14" fill="none"><path d="M6 3H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M9 2h3v3M12 2l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                          </a>
                        )}
                        {!isPaid && status !== 'cancelado' && (
                          <button className="ph-icon-btn ph-icon-btn-pay" title="Marcar como pago" onClick={() => markPaid(bill.id)}>
                            <svg viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                        )}
                        {isPaid && (
                          <button className="ph-icon-btn" title="Reabrir" onClick={() => markOpen(bill.id)}>
                            <svg viewBox="0 0 14 14" fill="none"><path d="M2 7a5 5 0 1 1 5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M2 4v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                          </button>
                        )}
                        <button className="ph-icon-btn" title="Editar" onClick={() => {
                          setEditingBill(bill)
                          setModal('edit-bill')
                        }}>
                          <svg viewBox="0 0 14 14" fill="none"><path d="M2 10l7-7 2 2-7 7H2v-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                        </button>
                        <button className="ph-icon-btn ph-icon-btn-del" title="Remover" onClick={() => deleteBill(bill.id)}>
                          <svg viewBox="0 0 14 14" fill="none"><path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>}

      {/* Modals */}
      {(modal === 'new-collector' || modal === 'edit-collector') && (
        <Modal title={modal === 'edit-collector' ? 'Editar cobrador' : 'Novo cobrador'} onClose={() => { setModal(null); setEditingCollector(null) }}>
          <CollectorForm
            initial={editingCollector ? { name: editingCollector.name, category: editingCollector.category, color: editingCollector.color } : { ...COLL_INIT }}
            onSave={saveCollector} onCancel={() => { setModal(null); setEditingCollector(null) }}
          />
        </Modal>
      )}
      {(modal === 'new-bill' || modal === 'edit-bill') && (
        <Modal title={modal === 'edit-bill' ? 'Editar conta' : 'Nova conta'} onClose={() => { setModal(null); setEditingBill(null) }}>
          <BillForm
            initial={editingBill
              ? { collectorId: editingBill.collectorId, description: editingBill.description, amount: String(editingBill.amount), dueDate: editingBill.dueDate, status: editingBill.status, recurrence: editingBill.recurrence, paymentLink: editingBill.paymentLink || '', barcode: editingBill.barcode || '', notes: editingBill.notes || '' }
              : { ...BILL_INIT, collectorId: selCollector || '' }}
            collectors={collectors} onSave={saveBill} onCancel={() => { setModal(null); setEditingBill(null) }}
            onCreateCollector={createCollectorInline}
          />
        </Modal>
      )}
      {modal === 'barcode' && (
        <Modal title="Código de barras / PIX" onClose={() => { setModal(null); setBarcodeText('') }}>
          <div className="ph-barcode-modal">
            <div className="ph-barcode-text">{barcodeText}</div>
            <button className="btn-accent" onClick={() => copyBarcode(barcodeText)}>
              {copied ? '✓ Copiado!' : 'Copiar código'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
