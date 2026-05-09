import { useState } from 'react'
import { useCloudTable } from '../hooks'
import { RENTAL_FORM_INIT } from '../constants'
import type { Rental } from '../types'

export default 
function RentalsSection() {
  const [rentals, setRentals] = useCloudTable<Rental>('rentals', 'lion-rentals')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(RENTAL_FORM_INIT)
  const [editId, setEditId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)


  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  function saveRental(e: React.FormEvent) {
    e.preventDefault()
    if (!form.property.trim() || !form.tenant.trim() || !form.value) return
    const r: Rental = {
      id: editId || Date.now().toString(),
      property: form.property,
      tenant: form.tenant,
      phone: form.phone,
      value: parseFloat(form.value),
      dueDay: parseInt(form.dueDay) || 5,
      startDate: form.startDate,
      notes: form.notes,
      payments: editId ? (rentals.find(x => x.id === editId)?.payments ?? {}) : {},
    }
    setRentals(prev => editId ? prev.map(x => x.id === editId ? r : x) : [...prev, r])
    setForm(RENTAL_FORM_INIT); setShowForm(false); setEditId(null)
  }

  function startEdit(r: Rental) {
    setForm({ property: r.property, tenant: r.tenant, phone: r.phone, value: String(r.value), dueDay: String(r.dueDay), startDate: r.startDate, notes: r.notes })
    setEditId(r.id); setShowForm(true)
  }

  function delRental(id: string) { setRentals(prev => prev.filter(r => r.id !== id)) }

  function togglePayment(id: string, month: string) {
    setRentals(prev => prev.map(r => {
      if (r.id !== id) return r
      const cur = r.payments[month]
      return { ...r, payments: { ...r.payments, [month]: cur === 'pago' ? 'pendente' : 'pago' } }
    }))
  }

  function getMonthStatus(r: Rental, month: string): 'pago' | 'atrasado' | 'pendente' {
    if (r.payments[month] === 'pago') return 'pago'
    const [y, m] = month.split('-').map(Number)
    const due = new Date(y, m - 1, r.dueDay)
    return due < new Date() ? 'atrasado' : 'pendente'
  }

  const now = new Date()
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return d.toISOString().slice(0, 7)
  })

  const fmtCurr = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmtMonth = (m: string) => new Date(m + '-02').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })

  const totalMonthly = rentals.reduce((s, r) => s + r.value, 0)
  const curMonth = now.toISOString().slice(0, 7)
  const paidThisMonth = rentals.filter(r => r.payments[curMonth] === 'pago').length
  const overdueCount = rentals.filter(r => getMonthStatus(r, curMonth) === 'atrasado').length

  return (
    <section className="rentals-section">
      <div className="goals-header">
        <div>
          <h2 className="section-title">Controle de Aluguéis</h2>
          <span className="goals-sub">
            {rentals.length} imóvel{rentals.length !== 1 ? 'is' : ''} · {fmtCurr(totalMonthly)}/mês
            {overdueCount > 0 && <span className="rentals-overdue-badge">{overdueCount} atrasado{overdueCount > 1 ? 's' : ''}</span>}
          </span>
        </div>
        <button className="goals-add-btn" onClick={() => { setShowForm(v => !v); setEditId(null); setForm(RENTAL_FORM_INIT) }}>
          {showForm && !editId ? '✕ Cancelar' : '+ Novo Aluguel'}
        </button>
      </div>

      {showForm && (
        <form className="goal-form" onSubmit={saveRental}>
          <div className="goal-form-grid rentals-form-grid">
            <div className="fin-field goal-span2">
              <label>Imóvel</label>
              <input type="text" placeholder="Ex: Ap. Jardins - Rua das Flores 123" value={form.property} onChange={e => f('property', e.target.value)} required />
            </div>
            <div className="fin-field">
              <label>Inquilino</label>
              <input type="text" placeholder="Nome completo" value={form.tenant} onChange={e => f('tenant', e.target.value)} required />
            </div>
            <div className="fin-field">
              <label>Telefone</label>
              <input type="text" placeholder="(11) 99999-9999" value={form.phone} onChange={e => f('phone', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Valor do aluguel (R$)</label>
              <input type="number" step="0.01" min="1" placeholder="0,00" value={form.value} onChange={e => f('value', e.target.value)} required />
            </div>
            <div className="fin-field">
              <label>Dia do vencimento</label>
              <input type="number" min="1" max="31" value={form.dueDay} onChange={e => f('dueDay', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Início do contrato</label>
              <input type="month" value={form.startDate} onChange={e => f('startDate', e.target.value)} />
            </div>
            <div className="fin-field goal-span2">
              <label>Observações</label>
              <input type="text" placeholder="Ex: Reajuste anual pelo IGP-M" value={form.notes} onChange={e => f('notes', e.target.value)} />
            </div>
          </div>
          <div className="goal-form-actions">
            <button type="button" className="btn-ghost" onClick={() => { setShowForm(false); setEditId(null); setForm(RENTAL_FORM_INIT) }}>Cancelar</button>
            <button type="submit" className="btn-accent">{editId ? 'Salvar alterações' : 'Cadastrar'}</button>
          </div>
        </form>
      )}

      {rentals.length === 0 && !showForm ? (
        <div className="goals-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <p>Nenhum aluguel cadastrado ainda.</p>
          <span>Cadastre seus imóveis alugados para acompanhar os pagamentos.</span>
        </div>
      ) : (<>
        <div className="rentals-list">
          {rentals.map(r => {
            const thisStatus = getMonthStatus(r, curMonth)
            const isExpanded = expandedId === r.id
            const paidCount = last6Months.filter(m => r.payments[m] === 'pago').length
            return (
              <div key={r.id} className={`rental-card${isExpanded ? ' rental-expanded' : ''}`}>
                <div className="rental-card-main" onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                  <div className="rental-left">
                    <div className={`rental-status-dot dot-${thisStatus}`} />
                    <div>
                      <div className="rental-property">{r.property}</div>
                      <div className="rental-meta">
                        {r.tenant}{r.phone ? ` · ${r.phone}` : ''} · vence dia {r.dueDay}
                      </div>
                    </div>
                  </div>
                  <div className="rental-right">
                    <span className="rental-value">{fmtCurr(r.value)}</span>
                    <span className={`rental-status-badge badge-${thisStatus}`}>
                      {thisStatus === 'pago' ? '✓ Pago' : thisStatus === 'atrasado' ? '⚠ Atrasado' : '○ Pendente'}
                    </span>
                    <div className="rental-actions">
                      <button className="goal-action-btn" onClick={e => { e.stopPropagation(); startEdit(r) }}>
                        <svg viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                      </button>
                      <button className="goal-action-btn goal-del-btn" onClick={e => { e.stopPropagation(); delRental(r.id) }}>
                        <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                    <svg className={`rental-chevron${isExpanded ? ' expanded' : ''}`} viewBox="0 0 16 16" fill="none">
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className="rental-history">
                    <div className="rental-history-header">
                      <span>Histórico de pagamentos</span>
                      <span className="rental-history-sub">{paidCount}/{last6Months.length} pagos nos últimos 6 meses</span>
                    </div>
                    <div className="rental-months">
                      {last6Months.map(month => {
                        const status = getMonthStatus(r, month)
                        return (
                          <button key={month} className={`rental-month-btn month-${status}`} onClick={() => togglePayment(r.id, month)}>
                            <span className="rental-month-label">{fmtMonth(month)}</span>
                            <span className="rental-month-status">
                              {status === 'pago' ? '✓' : status === 'atrasado' ? '⚠' : '○'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    {r.notes && <p className="rental-notes">{r.notes}</p>}
                  </div>
                )}
              </div>
            )
          })}

        </div>
        <div className="rentals-summary">
          <span>Total recebido este mês:</span>
          <strong>{fmtCurr(rentals.filter(r => r.payments[curMonth] === 'pago').reduce((s, r) => s + r.value, 0))}</strong>
          <span className="rentals-summary-sep">·</span>
          <span>{paidThisMonth}/{rentals.length} pagos</span>
        </div>
      </>)}
    </section>
  )
}
