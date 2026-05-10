import { useState, useEffect } from 'react'
import type { Transaction, Goal } from '../types'
import { CLOUD_BUS } from '../context'

export default
function PatrimonySection() {
  const [collapsed, setCollapsed] = useState(false)
  const [txs, setTxs] = useState<Transaction[]>(() => {
    try { return JSON.parse(localStorage.getItem('lion-txs') || '[]') } catch { return [] }
  })
  const [goals, setGoals] = useState<Goal[]>(() => {
    try { return JSON.parse(localStorage.getItem('lion-goals') || '[]') } catch { return [] }
  })

  useEffect(() => {
    const handleTxs = () => {
      try { setTxs(JSON.parse(localStorage.getItem('lion-txs') || '[]')) } catch { /* ignore */ }
    }
    const handleGoals = () => {
      try { setGoals(JSON.parse(localStorage.getItem('lion-goals') || '[]')) } catch { /* ignore */ }
    }
    CLOUD_BUS.addEventListener('lion-txs', handleTxs)
    CLOUD_BUS.addEventListener('lion-goals', handleGoals)
    return () => {
      CLOUD_BUS.removeEventListener('lion-txs', handleTxs)
      CLOUD_BUS.removeEventListener('lion-goals', handleGoals)
    }
  }, [])

  const totalGoals = goals.reduce((s, g) => s + (g.current || 0), 0)

  // build month → net map
  const monthMap: Record<string, number> = {}
  for (const tx of txs) {
    const m = tx.date.slice(0, 7)
    monthMap[m] = (monthMap[m] || 0) + (tx.type === 'receita' ? tx.amount : -tx.amount)
  }

  const sortedMonths = Object.keys(monthMap).sort()

  // extend to current month
  const nowMonth = new Date().toISOString().slice(0, 7)
  if (sortedMonths.length > 0 && sortedMonths[sortedMonths.length - 1] < nowMonth) {
    sortedMonths.push(nowMonth)
    monthMap[nowMonth] = monthMap[nowMonth] || 0
  }

  // cumulative balance
  const points: { month: string; balance: number }[] = []
  let running = 0
  for (const m of sortedMonths) {
    running += monthMap[m] || 0
    points.push({ month: m, balance: running })
  }

  const fmt = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  const fmtMonth = (m: string) => {
    const [y, mo] = m.split('-')
    const names = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    return `${names[parseInt(mo) - 1]}/${y.slice(2)}`
  }

  const W = 520, H = 180, PAD = { t: 16, r: 16, b: 36, l: 60 }
  const cw = W - PAD.l - PAD.r
  const ch = H - PAD.t - PAD.b

  const balances = points.map(p => p.balance)
  const minB = Math.min(0, ...balances)
  const maxB = Math.max(0, ...balances)
  const span = maxB - minB || 1

  const px = (i: number) => PAD.l + (i / Math.max(points.length - 1, 1)) * cw
  const py = (b: number) => PAD.t + ch - ((b - minB) / span) * ch

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${px(i).toFixed(1)},${py(p.balance).toFixed(1)}`).join(' ')
  const fillPath = points.length > 0
    ? `${linePath} L${px(points.length - 1).toFixed(1)},${py(0).toFixed(1)} L${px(0).toFixed(1)},${py(0).toFixed(1)} Z`
    : ''

  const zeroY = py(0)
  const lastBalance = points.length > 0 ? points[points.length - 1].balance : 0
  const isPositive = lastBalance >= 0

  // y-axis labels (3 ticks)
  const ticks = [minB, (minB + maxB) / 2, maxB]

  // which month labels to show (max ~6)
  const step = Math.ceil(points.length / 6)
  const shownMonths = points.filter((_, i) => i % step === 0 || i === points.length - 1)

  if (points.length === 0) {
    return (
      <section className="pat-section">
        <div className="goals-header">
          <div>
            <h2 className="section-title">Evolução do Patrimônio</h2>
            <span className="goals-sub">Baseado nas transações registradas</span>
          </div>
        </div>
        <div className="goals-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg>
          <p>Nenhum dado ainda.</p>
          <span>Registre transações no painel financeiro para ver o gráfico.</span>
        </div>
      </section>
    )
  }

  return (
    <section className="pat-section">
      <div className="goals-header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button className="section-collapse-btn" onClick={() => setCollapsed(v => !v)} title={collapsed ? 'Expandir' : 'Recolher'}>
            <svg viewBox="0 0 16 16" fill="none" style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition:'transform .2s' }}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
          <div>
            <h2 className="section-title">Evolução do Patrimônio</h2>
            <span className="goals-sub">{points.length} meses · saldo acumulado</span>
          </div>
        </div>
        <div className="pat-summary">
          <div className="pat-stat">
            <span className="pat-stat-label">Saldo atual</span>
            <span className={`pat-stat-val ${isPositive ? 'pat-pos' : 'pat-neg'}`}>{fmt(lastBalance)}</span>
          </div>
          {totalGoals > 0 && (
            <div className="pat-stat">
              <span className="pat-stat-label">Em metas</span>
              <span className="pat-stat-val pat-goals">{fmt(totalGoals)}</span>
            </div>
          )}
          {totalGoals > 0 && (
            <div className="pat-stat">
              <span className="pat-stat-label">Total estimado</span>
              <span className="pat-stat-val pat-pos">{fmt(lastBalance + totalGoals)}</span>
            </div>
          )}
        </div>
      </div>

      {!collapsed && <div className="pat-chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="pat-svg" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="patGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isPositive ? 'var(--green)' : 'var(--red)'} stopOpacity="0.3"/>
              <stop offset="100%" stopColor={isPositive ? 'var(--green)' : 'var(--red)'} stopOpacity="0.02"/>
            </linearGradient>
          </defs>

          {/* grid lines */}
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.l} y1={py(t)} x2={W - PAD.r} y2={py(t)}
                stroke="rgba(255,255,255,.06)" strokeWidth="1" strokeDasharray="4 4"/>
              <text x={PAD.l - 6} y={py(t) + 4} textAnchor="end"
                fill="rgba(148,163,184,.6)" fontSize="9">
                {t === 0 ? '0' : t >= 1000 || t <= -1000 ? `${(t/1000).toFixed(0)}k` : t.toFixed(0)}
              </text>
            </g>
          ))}

          {/* zero line */}
          {minB < 0 && maxB > 0 && (
            <line x1={PAD.l} y1={zeroY} x2={W - PAD.r} y2={zeroY}
              stroke="rgba(255,255,255,.15)" strokeWidth="1"/>
          )}

          {/* area fill */}
          {fillPath && <path d={fillPath} fill="url(#patGrad)"/>}

          {/* line */}
          <path d={linePath} fill="none"
            stroke={isPositive ? 'var(--green)' : 'var(--red)'} strokeWidth="2" strokeLinejoin="round"/>

          {/* dots on last point */}
          {points.length > 0 && (
            <circle cx={px(points.length - 1)} cy={py(points[points.length - 1].balance)} r="4"
              fill={isPositive ? 'var(--green)' : 'var(--red)'}/>
          )}

          {/* x-axis labels */}
          {shownMonths.map(p => {
            const i = points.indexOf(p)
            return (
              <text key={p.month} x={px(i)} y={H - 6} textAnchor="middle"
                fill="rgba(148,163,184,.6)" fontSize="9">
                {fmtMonth(p.month)}
              </text>
            )
          })}
        </svg>
      </div>}
    </section>
  )
}
