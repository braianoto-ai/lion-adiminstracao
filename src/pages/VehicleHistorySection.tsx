import { useState } from 'react'
import { useCloudTable } from '../hooks'
import { REVISION_TYPES, VEH_FORM_INIT, REV_FORM_INIT } from '../constants'
import type { Vehicle, Revision } from '../types'

export default 
function VehicleHistorySection() {
  const [vehicles, setVehicles] = useCloudTable<Vehicle>('vehicles', 'lion-vehicles')
  const [revisions, setRevisions] = useCloudTable<Revision>('revisions', 'lion-revisions')
  const [showVehForm, setShowVehForm] = useState(false)
  const [showRevForm, setShowRevForm] = useState(false)
  const [vehForm, setVehForm] = useState(VEH_FORM_INIT)
  const [revForm, setRevForm] = useState(REV_FORM_INIT)
  const [editVehId, setEditVehId] = useState<string | null>(null)
  const [expandedVehId, setExpandedVehId] = useState<string | null>(null)


  const fv = (k: string, v: string) => setVehForm(p => ({ ...p, [k]: v }))
  const fr = (k: string, v: string) => setRevForm(p => ({ ...p, [k]: v }))

  function saveVehicle(e: React.FormEvent) {
    e.preventDefault()
    if (!vehForm.name.trim()) return
    const v: Vehicle = {
      id: editVehId || Date.now().toString(),
      name: vehForm.name, plate: vehForm.plate, year: vehForm.year,
      currentKm: parseFloat(vehForm.currentKm) || 0,
      nextRevisionKm: parseFloat(vehForm.nextRevisionKm) || 0,
      nextRevisionDate: vehForm.nextRevisionDate, notes: vehForm.notes,
      ipvaExpiry: vehForm.ipvaExpiry, insuranceExpiry: vehForm.insuranceExpiry,
    }
    setVehicles(prev => editVehId ? prev.map(x => x.id === editVehId ? v : x) : [...prev, v])
    setVehForm(VEH_FORM_INIT); setShowVehForm(false); setEditVehId(null)
  }

  function saveRevision(e: React.FormEvent) {
    e.preventDefault()
    if (!revForm.vehicleId || !revForm.date || !revForm.km) return
    const r: Revision = {
      id: Date.now().toString(), vehicleId: revForm.vehicleId,
      date: revForm.date, km: parseFloat(revForm.km),
      type: revForm.type, description: revForm.description,
      cost: revForm.cost, shop: revForm.shop,
    }
    setRevisions(prev => [r, ...prev])
    // update vehicle currentKm if this revision km is higher
    setVehicles(prev => prev.map(v => v.id === revForm.vehicleId && parseFloat(revForm.km) > v.currentKm
      ? { ...v, currentKm: parseFloat(revForm.km) } : v))
    setRevForm(REV_FORM_INIT); setShowRevForm(false)
  }

  function startEditVeh(v: Vehicle) {
    setVehForm({ name: v.name, plate: v.plate, year: v.year, currentKm: String(v.currentKm), nextRevisionKm: String(v.nextRevisionKm), nextRevisionDate: v.nextRevisionDate, notes: v.notes, ipvaExpiry: v.ipvaExpiry || '', insuranceExpiry: v.insuranceExpiry || '' })
    setEditVehId(v.id); setShowVehForm(true); setShowRevForm(false)
  }

  function delVehicle(id: string) {
    setVehicles(prev => prev.filter(v => v.id !== id))
    setRevisions(prev => prev.filter(r => r.vehicleId !== id))
  }

  function getAlert(v: Vehicle): { text: string; cls: string } | null {
    const kmLeft = v.nextRevisionKm > 0 ? v.nextRevisionKm - v.currentKm : null
    const daysLeft = v.nextRevisionDate ? Math.ceil((new Date(v.nextRevisionDate).getTime() - Date.now()) / 86400000) : null

    if (kmLeft !== null && kmLeft <= 0) return { text: 'Revisão atrasada (km)', cls: 'veh-alert-red' }
    if (daysLeft !== null && daysLeft < 0) return { text: 'Revisão atrasada (data)', cls: 'veh-alert-red' }
    if (kmLeft !== null && kmLeft <= 1000) return { text: `Revisão em ${kmLeft.toLocaleString('pt-BR')} km`, cls: 'veh-alert-amber' }
    if (daysLeft !== null && daysLeft <= 14) return { text: `Revisão em ${daysLeft}d`, cls: 'veh-alert-amber' }
    if (kmLeft !== null) return { text: `${kmLeft.toLocaleString('pt-BR')} km p/ revisão`, cls: 'veh-alert-ok' }
    if (daysLeft !== null) return { text: `Revisão em ${daysLeft}d`, cls: 'veh-alert-ok' }
    return null
  }

  function getDocAlerts(v: Vehicle): { text: string; cls: string }[] {
    const now = Date.now()
    const alerts: { text: string; cls: string }[] = []
    if (v.ipvaExpiry) {
      const days = Math.ceil((new Date(v.ipvaExpiry + 'T12:00:00').getTime() - now) / 86400000)
      if (days < 0) alerts.push({ text: 'IPVA vencido', cls: 'veh-alert-red' })
      else if (days <= 30) alerts.push({ text: `IPVA vence em ${days}d`, cls: 'veh-alert-amber' })
    }
    if (v.insuranceExpiry) {
      const days = Math.ceil((new Date(v.insuranceExpiry + 'T12:00:00').getTime() - now) / 86400000)
      if (days < 0) alerts.push({ text: 'Seguro vencido', cls: 'veh-alert-red' })
      else if (days <= 30) alerts.push({ text: `Seguro vence em ${days}d`, cls: 'veh-alert-amber' })
    }
    return alerts
  }

  const fmtDate = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const fmtKm = (n: number) => n.toLocaleString('pt-BR') + ' km'
  const fmtCurr = (v: string) => v ? parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''

  const alertCount = vehicles.filter(v => {
    const a = getAlert(v)
    const da = getDocAlerts(v)
    return (a && (a.cls === 'veh-alert-red' || a.cls === 'veh-alert-amber')) || da.length > 0
  }).length

  const [collapsed, setCollapsed] = useState(false)

  return (
    <section className="veh-section" id="veh-section">
      <div className="goals-header">
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button className="section-collapse-btn" onClick={() => setCollapsed(v => !v)} title={collapsed ? 'Expandir' : 'Recolher'}>
            <svg viewBox="0 0 16 16" fill="none" style={{ transform: collapsed ? 'rotate(-90deg)' : 'none', transition:'transform .2s' }}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
          <div>
            <h2 className="section-title">Histórico de Veículos</h2>
            <span className="goals-sub">
              {vehicles.length} veículo{vehicles.length !== 1 ? 's' : ''}
              {alertCount > 0 && <span className="rentals-overdue-badge">{alertCount} alerta{alertCount > 1 ? 's' : ''}</span>}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {vehicles.length > 0 && (
            <button className="goals-add-btn" style={{ background: 'rgba(59,130,246,.12)', color: 'var(--blue-l)', borderColor: 'rgba(59,130,246,.2)' }}
              onClick={() => { setShowRevForm(v => !v); setShowVehForm(false) }}>
              {showRevForm ? '✕' : '+ Revisão'}
            </button>
          )}
          <button className="goals-add-btn" onClick={() => { setShowVehForm(v => !v); setEditVehId(null); setVehForm(VEH_FORM_INIT); setShowRevForm(false) }}>
            {showVehForm && !editVehId ? '✕ Cancelar' : '+ Veículo'}
          </button>
        </div>
      </div>

      {!collapsed && (<>
      {showVehForm && (
        <form className="goal-form" onSubmit={saveVehicle}>
          <div className="goal-form-grid">
            <div className="fin-field goal-span2">
              <label>Nome / Modelo</label>
              <input type="text" placeholder="Ex: BMW X5 2022" value={vehForm.name} onChange={e => fv('name', e.target.value)} required />
            </div>
            <div className="fin-field">
              <label>Placa</label>
              <input type="text" placeholder="ABC-1234" value={vehForm.plate} onChange={e => fv('plate', e.target.value.toUpperCase())} />
            </div>
            <div className="fin-field">
              <label>Ano</label>
              <input type="text" placeholder="2022" value={vehForm.year} onChange={e => fv('year', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>KM atual</label>
              <input type="number" min="0" placeholder="Ex: 45000" value={vehForm.currentKm} onChange={e => fv('currentKm', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Próxima revisão (km)</label>
              <input type="number" min="0" placeholder="Ex: 50000" value={vehForm.nextRevisionKm} onChange={e => fv('nextRevisionKm', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Próxima revisão (data)</label>
              <input type="date" value={vehForm.nextRevisionDate} onChange={e => fv('nextRevisionDate', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Vencimento IPVA</label>
              <input type="date" value={vehForm.ipvaExpiry} onChange={e => fv('ipvaExpiry', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Vencimento Seguro</label>
              <input type="date" value={vehForm.insuranceExpiry} onChange={e => fv('insuranceExpiry', e.target.value)} />
            </div>
          </div>
          <div className="goal-form-actions">
            <button type="button" className="btn-ghost" onClick={() => { setShowVehForm(false); setEditVehId(null) }}>Cancelar</button>
            <button type="submit" className="btn-accent">{editVehId ? 'Salvar' : 'Cadastrar veículo'}</button>
          </div>
        </form>
      )}

      {showRevForm && (
        <form className="goal-form" onSubmit={saveRevision}>
          <div className="goal-form-grid">
            <div className="fin-field">
              <label>Veículo *</label>
              <select value={revForm.vehicleId} onChange={e => fr('vehicleId', e.target.value)} required>
                <option value="">Selecione...</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name}{v.plate ? ` (${v.plate})` : ''}</option>)}
              </select>
            </div>
            <div className="fin-field">
              <label>Tipo</label>
              <select value={revForm.type} onChange={e => fr('type', e.target.value)}>
                {REVISION_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="fin-field">
              <label>Data *</label>
              <input type="date" value={revForm.date} onChange={e => fr('date', e.target.value)} required />
            </div>
            <div className="fin-field">
              <label>KM na revisão *</label>
              <input type="number" min="0" placeholder="Ex: 48500" value={revForm.km} onChange={e => fr('km', e.target.value)} required />
            </div>
            <div className="fin-field">
              <label>Custo (R$)</label>
              <input type="number" step="0.01" placeholder="0,00" value={revForm.cost} onChange={e => fr('cost', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Oficina</label>
              <input type="text" placeholder="Nome da oficina" value={revForm.shop} onChange={e => fr('shop', e.target.value)} />
            </div>
            <div className="fin-field goal-span2">
              <label>Descrição</label>
              <input type="text" placeholder="Serviços realizados" value={revForm.description} onChange={e => fr('description', e.target.value)} />
            </div>
          </div>
          <div className="goal-form-actions">
            <button type="button" className="btn-ghost" onClick={() => setShowRevForm(false)}>Cancelar</button>
            <button type="submit" className="btn-accent">Registrar revisão</button>
          </div>
        </form>
      )}

      {vehicles.length === 0 && !showVehForm ? (
        <div className="goals-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="1" y="9" width="22" height="11" rx="2"/><path d="M6 9V7a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="6" cy="20" r="2"/><circle cx="18" cy="20" r="2"/></svg>
          <p>Nenhum veículo cadastrado.</p>
          <span>Cadastre veículos para acompanhar revisões e quilometragem.</span>
        </div>
      ) : (
        <div className="veh-list">
          {vehicles.map(v => {
            const alert = getAlert(v)
            const docAlerts = getDocAlerts(v)
            const vehRevisions = revisions.filter(r => r.vehicleId === v.id).sort((a, b) => b.date.localeCompare(a.date))
            const isExpanded = expandedVehId === v.id
            const totalCost = vehRevisions.reduce((s, r) => s + (parseFloat(r.cost) || 0), 0)
            return (
              <div key={v.id} className={`veh-card${isExpanded ? ' veh-expanded' : ''}`}>
                <div className="veh-card-main" onClick={() => setExpandedVehId(isExpanded ? null : v.id)}>
                  <div className="veh-icon"><svg viewBox="0 0 24 24" fill="none">
  {/* body */}
  <path d="M12 2C10 5 9 8 9 12h6c0-4-1-7-3-10z" fill="currentColor" fillOpacity=".25" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
  {/* window */}
  <circle cx="12" cy="9" r="1.5" fill="currentColor" fillOpacity=".5" stroke="currentColor" strokeWidth="1"/>
  {/* fins */}
  <path d="M9 12l-3 4h3" fill="currentColor" fillOpacity=".2" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
  <path d="M15 12l3 4h-3" fill="currentColor" fillOpacity=".2" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
  {/* nozzle */}
  <path d="M10 16h4v1.5h-4z" fill="currentColor" fillOpacity=".3" stroke="currentColor" strokeWidth="1"/>
  {/* flame */}
  <path d="M11 17.5c0 1.5-.8 2.5-.8 2.5s1-.5 1.8-.5 1.8.5 1.8.5-.8-1-.8-2.5" fill="var(--amber)" fillOpacity=".9" stroke="none"/>
  <path d="M12 17.5v3" stroke="var(--amber)" strokeWidth="1.2" strokeLinecap="round" opacity=".6"/>
</svg></div>
                  <div className="veh-info">
                    <div className="veh-name">{v.name}{v.plate && <span className="veh-plate">{v.plate}</span>}</div>
                    <div className="veh-meta">{v.year && `${v.year} · `}{fmtKm(v.currentKm)} · {vehRevisions.length} revisão{vehRevisions.length !== 1 ? 'ões' : ''}</div>
                    {docAlerts.length > 0 && (
                      <div className="veh-doc-alerts">
                        {docAlerts.map((da, i) => <span key={i} className={`veh-alert ${da.cls}`}>{da.text}</span>)}
                      </div>
                    )}
                  </div>
                  <div className="veh-right">
                    {alert && <span className={`veh-alert ${alert.cls}`}>{alert.text}</span>}
                    <div className="goal-actions">
                      <button className="goal-action-btn" onClick={e => { e.stopPropagation(); startEditVeh(v) }}>
                        <svg viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                      </button>
                      <button className="goal-action-btn goal-del-btn" onClick={e => { e.stopPropagation(); delVehicle(v.id) }}>
                        <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                    <svg className={`rental-chevron${isExpanded ? ' expanded' : ''}`} viewBox="0 0 16 16" fill="none">
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className="veh-history">
                    {(v.ipvaExpiry || v.insuranceExpiry) && (
                      <div className="veh-docs-row">
                        {v.ipvaExpiry && (
                          <div className="veh-doc-item">
                            <span className="veh-doc-label">IPVA</span>
                            <span className="veh-doc-val">{fmtDate(v.ipvaExpiry)}</span>
                          </div>
                        )}
                        {v.insuranceExpiry && (
                          <div className="veh-doc-item">
                            <span className="veh-doc-label">Seguro</span>
                            <span className="veh-doc-val">{fmtDate(v.insuranceExpiry)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="rental-history-header">
                      <span>{vehRevisions.length} revisões registradas</span>
                      {totalCost > 0 && <span className="rental-history-sub">Total gasto: {fmtCurr(String(totalCost))}</span>}
                    </div>
                    {vehRevisions.length === 0
                      ? <p className="veh-no-revisions">Nenhuma revisão registrada ainda.</p>
                      : <div className="veh-revisions">
                          {vehRevisions.map(r => (
                            <div key={r.id} className="veh-rev-item">
                              <div className="veh-rev-left">
                                <span className="veh-rev-type">{r.type}</span>
                                <span className="veh-rev-date">{fmtDate(r.date)} · {fmtKm(r.km)}</span>
                                {r.description && <span className="veh-rev-desc">{r.description}</span>}
                                {r.shop && <span className="veh-rev-shop"><svg viewBox="0 0 14 14" fill="none" style={{width:11,height:11,marginRight:3,verticalAlign:'middle'}}><path d="M8.5 2a3 3 0 0 1 .7 3.3L12 8.1a1.4 1.4 0 0 1-2 2L7.2 7.3A3 3 0 0 1 4 6.5l1.5 1.5 1.5-1.5L5.5 5A3 3 0 0 1 8.5 2z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/></svg>{r.shop}</span>}
                              </div>
                              <div className="veh-rev-right">
                                {r.cost && <span className="veh-rev-cost">{fmtCurr(r.cost)}</span>}
                                <button className="fin-del" style={{ opacity: 1 }} onClick={() => setRevisions(prev => prev.filter(x => x.id !== r.id))}>
                                  <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                    }
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      </>)}
    </section>
  )
}
