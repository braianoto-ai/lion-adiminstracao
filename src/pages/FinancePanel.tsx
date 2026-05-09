import { useState } from 'react'
import { useCloudTable } from '../hooks'
import { TX_CATEGORIES } from '../constants'
import type { Transaction, TxType, Goal } from '../types'


function parseNubankCSV(text: string): Omit<Transaction, 'id'>[] {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  // Detect header row
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

function parseBBOFX(text: string): Omit<Transaction, 'id'>[] {
  const results: Omit<Transaction, 'id'>[] = []
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || []
  // Also handle OFX without closing tags (SGML style)
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

function detectAndParse(text: string, fileName: string): Omit<Transaction, 'id'>[] {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.ofx') || lower.endsWith('.qfx') || text.includes('<OFX') || text.includes('<ofx')) {
    return parseBBOFX(text)
  }
  return parseNubankCSV(text)
}

export default function FinancePanel({ onClose }: { onClose: () => void }) {
  const [txs, setTxs] = useCloudTable<Transaction>('transactions', 'lion-txs')
  const [view, setView] = useState<'overview' | 'list' | 'add' | 'import'>('overview')
  const [filter, setFilter] = useState<'all' | TxType>('all')
  const [editId, setEditId] = useState<string | null>(null)
  const [recurring, setRecurring] = useState(false)
  const [recurringMonths, setRecurringMonths] = useState(12)
  const [form, setForm] = useState({
    type: 'receita' as TxType,
    category: TX_CATEGORIES.receita[0],
    description: '',
    amount: '',
    date: new Date().toISOString().slice(0, 7),
  })

  function openAdd() { setEditId(null); setRecurring(false); setForm({ type: 'receita', category: TX_CATEGORIES.receita[0], description: '', amount: '', date: new Date().toISOString().slice(0, 7) }); setView('add') }

  function openEdit(tx: Transaction) {
    setEditId(tx.id)
    setRecurring(false)
    setForm({ type: tx.type, category: tx.category, description: tx.description, amount: String(tx.amount), date: tx.date })
    setView('add')
  }

  function addTx(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || !form.description.trim()) return
    const amt = parseFloat(form.amount)

    if (editId) {
      setTxs(prev => prev.map(t => t.id === editId ? { ...t, ...form, amount: amt } : t))
      setEditId(null)
      setView('list')
      return
    }

    if (recurring) {
      const rid = `rec-${Date.now()}`
      const newTxs: Transaction[] = []
      const [y, m] = form.date.split('-').map(Number)
      for (let i = 0; i < recurringMonths; i++) {
        const d = new Date(y, m - 1 + i, 1)
        newTxs.push({
          id: `${Date.now()}-${i}`,
          type: form.type,
          category: form.category,
          description: form.description,
          amount: amt,
          date: d.toISOString().slice(0, 7),
          recurring: true,
          recurringId: rid,
        })
      }
      setTxs(prev => [...newTxs, ...prev])
    } else {
      setTxs(prev => [{ id: Date.now().toString(), type: form.type, category: form.category, description: form.description, amount: amt, date: form.date }, ...prev])
    }
    setForm(f => ({ ...f, description: '', amount: '' }))
    setView('overview')
  }

  function delTx(tx: Transaction) {
    if (tx.recurringId) {
      const others = txs.filter(t => t.recurringId === tx.recurringId).length
      if (others > 1 && window.confirm(`Excluir só este mês ou todas as ${others} ocorrências?`)) {
        setTxs(prev => prev.filter(t => t.recurringId !== tx.recurringId))
        return
      }
    }
    setTxs(prev => prev.filter(t => t.id !== tx.id))
  }

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - (5 - i))
    return d.toISOString().slice(0, 7)
  })

  const monthData = months.map(m => ({
    month: m,
    label: new Date(m + '-02').toLocaleDateString('pt-BR', { month: 'short' }),
    receitas: txs.filter(t => t.date === m && t.type === 'receita').reduce((s, t) => s + t.amount, 0),
    despesas: txs.filter(t => t.date === m && t.type === 'despesa').reduce((s, t) => s + t.amount, 0),
  }))

  const _now = new Date()
  const currentMonth = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`
  const txsAteMesAtual = txs.filter(t => t.date <= currentMonth)
  const totalReceitas = txsAteMesAtual.reduce((s, t) => t.type === 'receita' ? s + t.amount : s, 0)
  const totalDespesas = txsAteMesAtual.reduce((s, t) => t.type === 'despesa' ? s + t.amount : s, 0)
  const saldo = totalReceitas - totalDespesas

  const maxVal = Math.max(...monthData.flatMap(m => [m.receitas, m.despesas]), 1)
  const fmtCurr = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const filtered = filter === 'all' ? txs : txs.filter(t => t.type === filter)

  const chartH = 100
  const barW = 14
  const gap = 3
  const groupW = barW * 2 + gap + 14

  // ── Pie chart data ──
  const PIE_COLORS = ['#ef4444','#f59e0b','#3b82f6','#10b981','#8b5cf6','#ec4899','#06b6d4','#84cc16']
  const catTotals = TX_CATEGORIES.despesa.map((cat, i) => ({
    cat,
    val: txsAteMesAtual.filter(t => t.type === 'despesa' && t.category === cat).reduce((s, t) => s + t.amount, 0),
    color: PIE_COLORS[i % PIE_COLORS.length],
  })).filter(c => c.val > 0).sort((a, b) => b.val - a.val)

  function donutSlices(data: typeof catTotals, cx: number, cy: number, r: number, ir: number) {
    const total = data.reduce((s, d) => s + d.val, 0)
    if (total === 0) return []
    let angle = -Math.PI / 2
    return data.map(d => {
      const sweep = (d.val / total) * Math.PI * 2
      const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle)
      const x2 = cx + r * Math.cos(angle + sweep), y2 = cy + r * Math.sin(angle + sweep)
      const ix1 = cx + ir * Math.cos(angle + sweep), iy1 = cy + ir * Math.sin(angle + sweep)
      const ix2 = cx + ir * Math.cos(angle), iy2 = cy + ir * Math.sin(angle)
      const large = sweep > Math.PI ? 1 : 0
      const path = `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${ix1},${iy1} A${ir},${ir} 0 ${large} 0 ${ix2},${iy2} Z`
      angle += sweep
      return { ...d, path, pct: Math.round((d.val / total) * 100) }
    })
  }

  const slices = donutSlices(catTotals, 72, 72, 58, 34)

  return (
    <div className="fin-wrap">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-icon fin-icon-header">
            <svg viewBox="0 0 20 20" fill="none">
              <path d="M10 2v16M14 6H8a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span>Finanças</span>
        </div>
        <div className="fin-tabs">
          <button className={`fin-tab${view === 'overview' ? ' fin-tab-active' : ''}`} onClick={() => setView('overview')}>Resumo</button>
          <button className={`fin-tab${view === 'list' ? ' fin-tab-active' : ''}`} onClick={() => setView('list')}>Lançamentos</button>
          <button className={`fin-tab fin-tab-add${view === 'add' ? ' fin-tab-active' : ''}`} onClick={openAdd}>+ Novo</button>
          <button className={`fin-tab${view === 'import' ? ' fin-tab-active' : ''}`} onClick={() => setView('import')}>
            <svg viewBox="0 0 14 14" fill="none" style={{width:12,height:12,marginRight:4,verticalAlign:'middle'}}><path d="M7 2v7M4 6l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 10v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            Importar
          </button>
        </div>
        <button className="panel-close" onClick={onClose}>
          <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      {view === 'overview' && (
        <div className="fin-body">
          <div className="fin-summary">
            <div className="fin-stat fin-stat-green">
              <span className="fin-stat-label">Receitas</span>
              <span className="fin-stat-value">{fmtCurr(totalReceitas)}</span>
            </div>
            <div className="fin-stat fin-stat-red">
              <span className="fin-stat-label">Despesas</span>
              <span className="fin-stat-value">{fmtCurr(totalDespesas)}</span>
            </div>
            <div className={`fin-stat ${saldo >= 0 ? 'fin-stat-purple' : 'fin-stat-red'}`}>
              <span className="fin-stat-label">Saldo</span>
              <span className="fin-stat-value">{fmtCurr(saldo)}</span>
            </div>
          </div>

          <div className="fin-chart-section">
            <div className="fin-chart-title">Últimos 6 meses</div>
            <svg width="100%" viewBox={`0 0 300 ${chartH + 28}`} className="fin-chart">
              {monthData.map((m, i) => {
                const x = 10 + i * groupW
                const rH = Math.max((m.receitas / maxVal) * chartH, m.receitas > 0 ? 3 : 2)
                const dH = Math.max((m.despesas / maxVal) * chartH, m.despesas > 0 ? 3 : 2)
                return (
                  <g key={m.month}>
                    <rect x={x} y={chartH - rH} width={barW} height={rH} rx="3" fill="var(--green)" opacity={m.receitas === 0 ? 0.15 : 0.85} />
                    <rect x={x + barW + gap} y={chartH - dH} width={barW} height={dH} rx="3" fill="var(--red)" opacity={m.despesas === 0 ? 0.15 : 0.85} />
                    <text x={x + barW + gap / 2} y={chartH + 20} textAnchor="middle" fontSize="9" fill="var(--text)">{m.label}</text>
                  </g>
                )
              })}
            </svg>
            <div className="fin-legend">
              <span className="fin-leg-dot" style={{ background: 'var(--green)' }} />
              <span className="fin-leg-label">Receitas</span>
              <span className="fin-leg-dot" style={{ background: 'var(--red)' }} />
              <span className="fin-leg-label">Despesas</span>
            </div>
          </div>

          {catTotals.length > 0 && (
            <div className="fin-pie-section">
              <div className="fin-chart-title">Despesas por categoria</div>
              <div className="fin-pie-wrap">
                <svg viewBox="0 0 144 144" className="fin-pie-svg">
                  {slices.map((s, i) => (
                    <path key={i} d={s.path} fill={s.color} opacity=".9">
                      <title>{s.cat}: {fmtCurr(s.val)} ({s.pct}%)</title>
                    </path>
                  ))}
                  <circle cx="72" cy="72" r="26" fill="var(--bg2)" />
                  <text x="72" y="68" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text3)">{fmtCurr(totalDespesas).replace('R$\u00a0','').split(',')[0]}</text>
                  <text x="72" y="82" textAnchor="middle" fontSize="8" fill="var(--text)">total</text>
                </svg>
                <div className="fin-pie-legend">
                  {slices.slice(0, 6).map((s, i) => (
                    <div key={i} className="fin-pie-row">
                      <span className="fin-pie-dot" style={{ background: s.color }} />
                      <span className="fin-pie-cat">{s.cat}</span>
                      <span className="fin-pie-pct">{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'list' && (
        <div className="fin-body">
          <div className="fin-filters">
            <button className={`fin-chip${filter === 'all' ? ' fin-chip-active' : ''}`} onClick={() => setFilter('all')}>Todos ({txs.length})</button>
            <button className={`fin-chip fin-chip-green${filter === 'receita' ? ' fin-chip-active' : ''}`} onClick={() => setFilter('receita')}>Receitas</button>
            <button className={`fin-chip fin-chip-red${filter === 'despesa' ? ' fin-chip-active' : ''}`} onClick={() => setFilter('despesa')}>Despesas</button>
          </div>
          {filtered.length === 0
            ? <div className="fin-empty">Nenhum lançamento ainda.</div>
            : <div className="fin-list">
                {filtered.map(tx => (
                  <div key={tx.id} className="fin-item">
                    <div className={`fin-dot ${tx.type === 'receita' ? 'fin-dot-green' : 'fin-dot-red'}`} />
                    <div className="fin-item-body">
                      <span className="fin-item-desc">
                        {tx.description}
                        {tx.recurring && <span className="fin-recurring-badge" title="Recorrente">
                          <svg viewBox="0 0 12 12" fill="none"><path d="M2 6a4 4 0 0 1 7-2.6M10 6a4 4 0 0 1-7 2.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M8.5 2l.5 1.4-1.4.5M3.5 10l-.5-1.4 1.4-.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>}
                      </span>
                      <span className="fin-item-meta">{tx.category} · {new Date(tx.date + '-02').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</span>
                    </div>
                    <span className={`fin-item-amt ${tx.type === 'receita' ? 'fin-amt-green' : 'fin-amt-red'}`}>
                      {tx.type === 'receita' ? '+' : '-'}{fmtCurr(tx.amount)}
                    </span>
                    <button className="fin-edit-btn" onClick={() => openEdit(tx)} title="Editar">
                      <svg viewBox="0 0 14 14" fill="none"><path d="M2 10l7-7 2 2-7 7H2v-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                    </button>
                    <button className="fin-del" onClick={() => delTx(tx)}>
                      <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                ))}
              </div>
          }
        </div>
      )}

      {view === 'add' && (
        <div className="fin-body">
          <form className="fin-form" onSubmit={addTx}>
            {editId && <div className="fin-edit-title">Editando lançamento</div>}
            <div className="fin-type-toggle">
              <button type="button" className={`fin-type-btn${form.type === 'receita' ? ' fin-type-green' : ''}`}
                onClick={() => setForm(f => ({ ...f, type: 'receita', category: TX_CATEGORIES.receita[0] }))}>↑ Receita</button>
              <button type="button" className={`fin-type-btn${form.type === 'despesa' ? ' fin-type-red' : ''}`}
                onClick={() => setForm(f => ({ ...f, type: 'despesa', category: TX_CATEGORIES.despesa[0] }))}>↓ Despesa</button>
            </div>
            <div className="fin-field">
              <label>Descrição</label>
              <input type="text" placeholder="Ex: Salário, Aluguel, Netflix..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
            </div>
            <div className="fin-row">
              <div className="fin-field">
                <label>Valor (R$)</label>
                <input type="number" step="0.01" min="0.01" placeholder="0,00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="fin-field">
                <label>Mês inicial</label>
                <input type="month" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
            </div>
            <div className="fin-field">
              <label>Categoria</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {TX_CATEGORIES[form.type].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            {!editId && (
              <div className="fin-recurring-row">
                <label className="fin-recurring-toggle">
                  <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} />
                  <span className="fin-recurring-label">
                    <svg viewBox="0 0 14 14" fill="none"><path d="M2 7a5 5 0 0 1 8.7-3.3M12 7a5 5 0 0 1-8.7 3.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M10 2.5l1 2-2 .5M4 11.5l-1-2 2-.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Repetir todo mês
                  </span>
                </label>
                {recurring && (
                  <div className="fin-recurring-months">
                    <label>por</label>
                    <select value={recurringMonths} onChange={e => setRecurringMonths(Number(e.target.value))}>
                      {[3,6,12,24,36].map(n => <option key={n} value={n}>{n} meses</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
            <div className="fin-form-actions">
              <button type="button" className="btn-ghost" onClick={() => { setView(editId ? 'list' : 'overview'); setEditId(null) }}>Cancelar</button>
              <button type="submit" className={`fin-submit ${form.type === 'receita' ? 'fin-submit-green' : 'fin-submit-red'}`}>
                {editId ? 'Salvar' : recurring ? `Criar ${recurringMonths}x` : `Adicionar ${form.type === 'receita' ? 'Receita' : 'Despesa'}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {view === 'import' && <ImportView txs={txs} setTxs={setTxs} onDone={() => setView('list')} />}
    </div>
  )
}

function ImportView({ txs, setTxs, onDone }: { txs: Transaction[]; setTxs: React.Dispatch<React.SetStateAction<Transaction[]>>; onDone: () => void }) {
  const [parsed, setParsed] = useState<Omit<Transaction, 'id'>[]>([])
  const [fileName, setFileName] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [done, setDone] = useState(false)
  const fmtCurr = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFileName(f.name)
    setDone(false)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const rows = detectAndParse(text, f.name)
      // mark duplicates: same date+description+amount already in txs
      const existingKeys = new Set(txs.map(t => `${t.date}|${t.description}|${t.amount}`))
      const newRows = rows.filter(r => !existingKeys.has(`${r.date}|${r.description}|${r.amount}`))
      setParsed(newRows)
      setSelected(new Set(newRows.map((_, i) => i)))
    }
    reader.readAsText(f, 'UTF-8')
  }

  const toggleAll = () => {
    if (selected.size === parsed.length) setSelected(new Set())
    else setSelected(new Set(parsed.map((_, i) => i)))
  }

  const doImport = () => {
    const toImport = parsed
      .filter((_, i) => selected.has(i))
      .map(r => ({ ...r, id: `imp-${Date.now()}-${Math.random().toString(36).slice(2)}` }))
    setTxs(prev => [...toImport, ...prev])
    setDone(true)
    setTimeout(onDone, 1200)
  }

  if (done) return (
    <div className="fin-body">
      <div className="import-success">
        <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/><path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Importado com sucesso!
      </div>
    </div>
  )

  return (
    <div className="fin-body">
      <div className="import-wrap">
        <div className="import-instructions">
          <div className="import-bank">
            <div className="import-bank-name">
              <svg viewBox="0 0 16 16" fill="none"><rect x="1" y="6" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1l7 5H1l7-5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
              Nubank
            </div>
            <div className="import-bank-steps">App → Perfil → Exportar transações → CSV</div>
          </div>
          <div className="import-bank">
            <div className="import-bank-name">
              <svg viewBox="0 0 16 16" fill="none"><rect x="1" y="6" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1l7 5H1l7-5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
              Banco do Brasil
            </div>
            <div className="import-bank-steps">Internet Banking → Extrato → Exportar → OFX</div>
          </div>
        </div>

        <label className="import-drop">
          <input type="file" accept=".csv,.ofx,.qfx" onChange={onFile} style={{ display: 'none' }} />
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v12M8 7l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <span>{fileName ? fileName : 'Clique para selecionar arquivo (.csv ou .ofx)'}</span>
        </label>

        {parsed.length > 0 && (
          <>
            <div className="import-preview-header">
              <span>{parsed.length} transação{parsed.length !== 1 ? 'ões' : ''} encontrada{parsed.length !== 1 ? 's' : ''} (duplicatas já removidas)</span>
              <button className="import-sel-all" onClick={toggleAll}>
                {selected.size === parsed.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            </div>
            <div className="import-table-wrap">
              <table className="import-table">
                <thead><tr><th></th><th>Data</th><th>Descrição</th><th>Tipo</th><th>Valor</th></tr></thead>
                <tbody>
                  {parsed.map((r, i) => (
                    <tr key={i} className={selected.has(i) ? 'import-row-sel' : 'import-row-skip'}>
                      <td><input type="checkbox" checked={selected.has(i)} onChange={() => {
                        const s = new Set(selected)
                        s.has(i) ? s.delete(i) : s.add(i)
                        setSelected(s)
                      }} /></td>
                      <td>{r.date}</td>
                      <td className="import-desc">{r.description}</td>
                      <td><span className={`import-type-badge ${r.type === 'receita' ? 'import-type-green' : 'import-type-red'}`}>{r.type === 'receita' ? '↑' : '↓'}</span></td>
                      <td className={r.type === 'receita' ? 'import-val-green' : 'import-val-red'}>{fmtCurr(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn-accent import-confirm-btn" onClick={doImport} disabled={selected.size === 0}>
              Importar {selected.size} transaç{selected.size === 1 ? 'ão' : 'ões'}
            </button>
          </>
        )}

        {fileName && parsed.length === 0 && (
          <div className="import-empty">Nenhuma transação nova encontrada. O arquivo pode estar vazio ou todas já foram importadas.</div>
        )}
      </div>
    </div>
  )
}

// ─── Goals Section ────────────────────────────────────────────────────────────

interface Goal {
  id: string
  name: string
  category: string
  target: number
  current: number
  deadline: string
}

// ─── Financing Simulator ─────────────────────────────────────────────────────

export function FinancingSimulator({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ price: '', entry: '20', rate: '0.8', months: '360' })
  const [system, setSystem] = useState<'price' | 'sac'>('price')

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const price    = parseFloat(form.price)   || 0
  const entryPct = parseFloat(form.entry)   || 0
  const rate     = parseFloat(form.rate)    / 100
  const n        = parseInt(form.months)    || 0
  const financed = price * (1 - entryPct / 100)

  let firstInstall = 0, lastInstall = 0, totalPaid = 0

  if (financed > 0 && rate > 0 && n > 0) {
    if (system === 'price') {
      const pmt = financed * (rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1)
      firstInstall = lastInstall = pmt
      totalPaid = pmt * n
    } else {
      const amort = financed / n
      firstInstall = amort + financed * rate
      lastInstall  = amort + amort * rate
      totalPaid    = n * amort + (financed * rate * (n + 1)) / 2
    }
  }

  const totalInterest = totalPaid - financed
  const fmtCurr = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  function buildSchedule() {
    if (financed <= 0 || rate <= 0 || n <= 0) return []
    const rows: { month: number; installment: number; interest: number; amort: number; balance: number }[] = []
    let balance = financed
    const amortSAC = financed / n
    for (let i = 1; i <= n; i++) {
      const interest = balance * rate
      const amort = system === 'sac' ? amortSAC : (financed * (rate * Math.pow(1+rate,n)) / (Math.pow(1+rate,n)-1)) - interest
      const installment = interest + amort
      balance -= amort
      rows.push({ month: i, installment, interest, amort, balance: Math.max(balance, 0) })
    }
    return rows
  }

  const schedule = buildSchedule()
  const preview = schedule.length > 6
    ? [...schedule.slice(0, 3), null, ...schedule.slice(-2)]
    : schedule

  return (
    <div className="sim-wrap">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-icon sim-icon-header">
            <svg viewBox="0 0 20 20" fill="none">
              <path d="M3 9l9-7 9 7v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M8 18v-6h4v6" stroke="currentColor" strokeWidth="1.4"/>
            </svg>
          </div>
          <span>Simulador de Financiamento</span>
        </div>
        <button className="panel-close" onClick={onClose}>
          <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      <div className="sim-body">
        {/* System toggle */}
        <div className="sim-toggle">
          <button className={`sim-toggle-btn${system === 'price' ? ' sim-toggle-active' : ''}`} onClick={() => setSystem('price')}>PRICE</button>
          <button className={`sim-toggle-btn${system === 'sac' ? ' sim-toggle-active' : ''}`} onClick={() => setSystem('sac')}>SAC</button>
        </div>

        {/* Inputs */}
        <div className="sim-inputs">
          <div className="fin-field">
            <label>Valor do imóvel (R$)</label>
            <input type="number" placeholder="Ex: 500000" value={form.price} onChange={e => f('price', e.target.value)} />
          </div>
          <div className="sim-row">
            <div className="fin-field">
              <label>Entrada (%)</label>
              <input type="number" min="0" max="100" step="1" value={form.entry} onChange={e => f('entry', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Juros mensal (%)</label>
              <input type="number" min="0.01" step="0.01" value={form.rate} onChange={e => f('rate', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Prazo (meses)</label>
              <input type="number" min="1" max="420" value={form.months} onChange={e => f('months', e.target.value)} />
            </div>
          </div>
        </div>

        {financed > 0 && rate > 0 && n > 0 ? (
          <>
            {/* Results */}
            <div className="sim-results">
              <div className="sim-result-card sim-card-blue">
                <span className="sim-result-label">{system === 'price' ? 'Parcela fixa' : '1ª parcela'}</span>
                <span className="sim-result-value">{fmtCurr(firstInstall)}</span>
              </div>
              {system === 'sac' && (
                <div className="sim-result-card sim-card-green">
                  <span className="sim-result-label">Última parcela</span>
                  <span className="sim-result-value">{fmtCurr(lastInstall)}</span>
                </div>
              )}
              <div className="sim-result-card sim-card-amber">
                <span className="sim-result-label">Total de juros</span>
                <span className="sim-result-value">{fmtCurr(totalInterest)}</span>
              </div>
              <div className="sim-result-card sim-card-purple">
                <span className="sim-result-label">Custo total</span>
                <span className="sim-result-value">{fmtCurr(totalPaid + price * entryPct / 100)}</span>
              </div>
            </div>

            <div className="sim-financed">
              Valor financiado: <strong>{fmtCurr(financed)}</strong>
              {' '}· Entrada: <strong>{fmtCurr(price * entryPct / 100)}</strong>
              {' '}· {n} meses ({(n/12).toFixed(0)} anos)
            </div>

            {/* Schedule preview */}
            <div className="sim-table-wrap">
              <table className="sim-table">
                <thead>
                  <tr><th>Mês</th><th>Parcela</th><th>Juros</th><th>Amort.</th><th>Saldo</th></tr>
                </thead>
                <tbody>
                  {preview.map((row) =>
                    row === null
                      ? <tr key="ellipsis" className="sim-ellipsis"><td colSpan={5}>⋯</td></tr>
                      : <tr key={row.month} className={row.month === n ? 'sim-last-row' : ''}>
                          <td>{row.month}</td>
                          <td>{fmtCurr(row.installment)}</td>
                          <td className="sim-td-interest">{fmtCurr(row.interest)}</td>
                          <td>{fmtCurr(row.amort)}</td>
                          <td>{fmtCurr(row.balance)}</td>
                        </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="sim-empty">Preencha os campos para simular.</div>
        )}
      </div>
    </div>
  )
}
