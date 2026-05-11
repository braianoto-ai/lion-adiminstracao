import { useState, useMemo } from 'react'
import { useCloudTable } from '../hooks'
import { IMOVEL_INIT, IMOVEL_TIPOS, PRODUTO_CATS, PRODUTO_INIT } from '../constants'
import type { Imovel, Produto, Vehicle, DocMeta, Bill } from '../types'
import ImovelExpansion from './ImovelExpansion'
import VehicleExpansion from './VehicleExpansion'

export default 
function PatrimonioPage() {
  const [imoveis, setImoveis] = useCloudTable<Imovel>('imoveis', 'lion-imoveis')
  const [produtos, setProdutos] = useCloudTable<Produto>('produtos', 'lion-produtos')
  const [vehicles, setVehicles] = useCloudTable<Vehicle>('vehicles', 'lion-vehicles')
  const [docs, setDocs] = useCloudTable<DocMeta>('documents', 'lion-docs-meta')
  const [bills, setBills] = useCloudTable<Bill>('bills', 'lion-bills')

  const [tab, setTab] = useState<'imoveis' | 'veiculos' | 'produtos'>('imoveis')
  const [expandedImovelId, setExpandedImovelId] = useState<string | null>(null)
  const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null)
  const [showImovelForm, setShowImovelForm] = useState(false)
  const [editImovelId, setEditImovelId] = useState<string | null>(null)
  const [imovelForm, setImovelForm] = useState({ ...IMOVEL_INIT })
  const [showProdForm, setShowProdForm] = useState(false)
  const [editProdId, setEditProdId] = useState<string | null>(null)
  const [prodForm, setProdForm] = useState({ ...PRODUTO_INIT })

  const VEH_INIT = { name: '', plate: '', year: '', valorCompra: '', valorAtual: '', currentKm: '', ipvaExpiry: '', insuranceExpiry: '', notes: '' }
  const [showVehForm, setShowVehForm] = useState(false)
  const [editVehId, setEditVehId] = useState<string | null>(null)
  const [vehForm, setVehForm] = useState(VEH_INIT)
  const fv = (k: string, v: string) => setVehForm(f => ({ ...f, [k]: v }))

  const fmtR = (v: string | number) => parseFloat(String(v) || '0').toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  const fmtKm = (k: number) => k > 0 ? `${k.toLocaleString('pt-BR')} km` : ''

  const totalImoveis = useMemo(
    () => imoveis.reduce((s, i) => s + (parseFloat(i.valorAtual || i.valor || '0') || 0), 0),
    [imoveis]
  )
  const totalProdutos = useMemo(
    () => produtos.reduce((s, p) => s + (parseFloat(p.valor || '0') || 0) * (parseInt(p.quantidade || '1') || 1), 0),
    [produtos]
  )
  const totalVeiculos = useMemo(
    () => vehicles.reduce((s, v) => {
      if (v.valorAtual != null) return s + v.valorAtual
      const m = v.notes?.match(/Atual:\s*R\$\s*([\d.,]+)/)
      return m ? s + (parseFloat(m[1].replace(/\./g, '').replace(',', '.')) || 0) : s
    }, 0),
    [vehicles]
  )
  const totalGeral = totalImoveis + totalProdutos + totalVeiculos

  const docCountMap = useMemo(
    () => Object.fromEntries(
      imoveis.map(im => [
        im.id,
        docs.filter(d => d.assetId === im.id || (!d.assetId && d.asset === im.descricao)).length,
      ])
    ),
    [imoveis, docs]
  )

  const fi = (k: string, v: string) => setImovelForm(f => ({ ...f, [k]: v }))
  const fp = (k: string, v: string) => setProdForm(f => ({ ...f, [k]: v }))

  const saveImovel = () => {
    if (!imovelForm.descricao.trim()) return
    if (editImovelId) {
      setImoveis(prev => prev.map(i => i.id === editImovelId ? { ...i, ...imovelForm } : i))
      setEditImovelId(null)
    } else {
      const item: Imovel = { id: Date.now().toString(), ...imovelForm, createdAt: new Date().toISOString() }
      setImoveis(prev => [item, ...prev])
    }
    setImovelForm({ ...IMOVEL_INIT })
    setShowImovelForm(false)
  }

  const saveProduto = () => {
    if (!prodForm.nome.trim()) return
    if (editProdId) {
      setProdutos(prev => prev.map(p => p.id === editProdId ? { ...p, ...prodForm } : p))
      setEditProdId(null)
    } else {
      const item: Produto = { id: Date.now().toString(), ...prodForm, createdAt: new Date().toISOString() }
      setProdutos(prev => [item, ...prev])
    }
    setProdForm({ ...PRODUTO_INIT })
    setShowProdForm(false)
  }

  const startEditImovel = (i: Imovel) => {
    setEditImovelId(i.id)
    setImovelForm({ descricao: i.descricao, tipo: i.tipo, valor: i.valor, valorAtual: i.valorAtual, endereco: i.endereco, area: i.area })
    setShowImovelForm(true)
    setTab('imoveis')
  }

  const saveVehicle = () => {
    if (!vehForm.name.trim()) return
    const v: Vehicle = {
      id: editVehId || Date.now().toString(),
      name: vehForm.name, plate: vehForm.plate.toUpperCase(), year: vehForm.year,
      currentKm: parseFloat(vehForm.currentKm) || 0,
      nextRevisionKm: 0, nextRevisionDate: '', notes: vehForm.notes,
      ipvaExpiry: vehForm.ipvaExpiry, insuranceExpiry: vehForm.insuranceExpiry,
      valorCompra: parseFloat(vehForm.valorCompra) || undefined,
      valorAtual: parseFloat(vehForm.valorAtual) || undefined,
    }
    setVehicles(prev => editVehId ? prev.map(x => x.id === editVehId ? v : x) : [v, ...prev])
    setVehForm(VEH_INIT); setShowVehForm(false); setEditVehId(null)
  }

  const startEditVehicle = (v: Vehicle) => {
    const legacyCompra = v.notes?.match(/Compra:\s*R\$\s*([\d.,]+)/)?.[1]?.replace(/\./g, '').replace(',', '.')
    const legacyAtual  = v.notes?.match(/Atual:\s*R\$\s*([\d.,]+)/)?.[1]?.replace(/\./g, '').replace(',', '.')
    setEditVehId(v.id)
    setVehForm({
      name: v.name, plate: v.plate, year: v.year,
      valorCompra: String(v.valorCompra ?? legacyCompra ?? ''),
      valorAtual:  String(v.valorAtual  ?? legacyAtual  ?? ''),
      currentKm: String(v.currentKm || ''),
      ipvaExpiry: v.ipvaExpiry || '', insuranceExpiry: v.insuranceExpiry || '',
      notes: v.notes || '',
    })
    setShowVehForm(true)
    setTab('veiculos')
  }

  const startEditProd = (p: Produto) => {
    setEditProdId(p.id)
    setProdForm({ nome: p.nome, categoria: p.categoria, valor: p.valor, quantidade: p.quantidade, fornecedor: p.fornecedor, descricao: p.descricao })
    setShowProdForm(true)
    setTab('produtos')
  }

  return (
    <div className="patr-page">
      {/* Summary */}
      <div className="patr-summary">
        <div className="patr-summary-card">
          <div className="metric-ico mi-blue"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l7-6 7 6v9H3V9z" strokeLinejoin="round"/><path d="M7 18V12h6v6" strokeLinecap="round"/></svg></div>
          <div className="patr-summary-label">Imóveis</div>
          <div className="patr-summary-val">{fmtR(totalImoveis)}</div>
          <div className="patr-summary-sub">{imoveis.length} imóvel{imoveis.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="patr-summary-card">
          <div className="metric-ico mi-amber"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 17h10M6 13h8l1-4H5l1 4zM10 3v2M14 5l-1 1M6 5l1 1" strokeLinecap="round" strokeLinejoin="round"/><rect x="8" y="9" width="4" height="4" rx="1"/></svg></div>
          <div className="patr-summary-label">Veículos</div>
          <div className="patr-summary-val">{fmtR(totalVeiculos)}</div>
          <div className="patr-summary-sub">{vehicles.length} veículo{vehicles.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="patr-summary-card">
          <div className="metric-ico mi-green"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7h14M3 7l2-3h10l2 3M3 7v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
          <div className="patr-summary-label">Bens / Produtos</div>
          <div className="patr-summary-val">{fmtR(totalProdutos)}</div>
          <div className="patr-summary-sub">{produtos.length} item{produtos.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="patr-summary-card patr-summary-total">
          <div className="metric-ico mi-purple"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 2v16M6 6h5.5a2.5 2.5 0 0 1 0 5H6m0 0h6a2.5 2.5 0 0 1 0 5H6" strokeLinecap="round"/></svg></div>
          <div className="patr-summary-label">Patrimônio Total</div>
          <div className="patr-summary-val patr-summary-val-accent">{fmtR(totalGeral)}</div>
          <div className="patr-summary-sub">{imoveis.length + vehicles.length + produtos.length} ativos</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="patr-tabs">
        <button className={`patr-tab${tab === 'imoveis' ? ' patr-tab-active' : ''}`} onClick={() => setTab('imoveis')}>
          <svg viewBox="0 0 16 16" fill="none"><path d="M2 7l6-5 6 5v7H2V7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M6 14V9h4v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          Imóveis ({imoveis.length})
        </button>
        <button className={`patr-tab${tab === 'veiculos' ? ' patr-tab-active' : ''}`} onClick={() => setTab('veiculos')}>
          <svg viewBox="0 0 16 16" fill="none"><rect x="1" y="6" width="14" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4 6V5a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v1" stroke="currentColor" strokeWidth="1.3"/><circle cx="4.5" cy="13" r="1.2" fill="currentColor" stroke="none"/><circle cx="11.5" cy="13" r="1.2" fill="currentColor" stroke="none"/></svg>
          Veículos ({vehicles.length})
        </button>
        <button className={`patr-tab${tab === 'produtos' ? ' patr-tab-active' : ''}`} onClick={() => setTab('produtos')}>
          <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="7" width="12" height="8" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          Bens / Produtos ({produtos.length})
        </button>
      </div>

      {/* Imóveis */}
      {tab === 'imoveis' && (
        <div className="patr-section">
          {showImovelForm ? (
            <div className="patr-form">
              <div className="patr-form-title">{editImovelId ? 'Editar Imóvel' : 'Novo Imóvel'}</div>
              <div className="patr-fields">
                <div className="patr-field patr-span2">
                  <label>Descrição</label>
                  <input placeholder="Ex: Apartamento Jardins" value={imovelForm.descricao} onChange={e => fi('descricao', e.target.value)} />
                </div>
                <div className="patr-field">
                  <label>Tipo</label>
                  <select value={imovelForm.tipo} onChange={e => fi('tipo', e.target.value)}>
                    {IMOVEL_TIPOS.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="patr-field">
                  <label>Área (m²)</label>
                  <input type="number" placeholder="0" value={imovelForm.area} onChange={e => fi('area', e.target.value)} />
                </div>
                <div className="patr-field">
                  <label>Valor de Compra (R$)</label>
                  <input type="number" placeholder="0,00" value={imovelForm.valor} onChange={e => fi('valor', e.target.value)} />
                </div>
                <div className="patr-field">
                  <label>Valor Atual (R$)</label>
                  <input type="number" placeholder="0,00" value={imovelForm.valorAtual} onChange={e => fi('valorAtual', e.target.value)} />
                </div>
                <div className="patr-field patr-span2">
                  <label>Endereço</label>
                  <input placeholder="Rua, número, cidade" value={imovelForm.endereco} onChange={e => fi('endereco', e.target.value)} />
                </div>
              </div>
              <div className="patr-form-actions">
                <button className="btn-ghost" onClick={() => { setShowImovelForm(false); setEditImovelId(null); setImovelForm({ ...IMOVEL_INIT }) }}>Cancelar</button>
                <button className="btn-accent" onClick={saveImovel}>{editImovelId ? 'Salvar' : 'Adicionar'}</button>
              </div>
            </div>
          ) : (
            <button className="patr-add-btn" onClick={() => setShowImovelForm(true)}>
              <svg viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Adicionar Imóvel
            </button>
          )}
          {imoveis.length === 0 && !showImovelForm ? (
            <div className="patr-empty">
              <svg viewBox="0 0 48 48" fill="none"><path d="M6 22l18-16 18 16v22H6V22z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/><path d="M18 44V30h12v14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              <span>Nenhum imóvel cadastrado</span>
            </div>
          ) : (
            <div className="patr-list">
              {imoveis.map(im => {
                const gain = (parseFloat(im.valorAtual || '0') || 0) - (parseFloat(im.valor || '0') || 0)
                const isExpanded = expandedImovelId === im.id
                const docCount = docCountMap[im.id] ?? 0
                return (
                  <div key={im.id} className={`patr-card patr-card-expandable${isExpanded ? ' patr-card-expanded' : ''}`}>
                    <div className="patr-card-main" onClick={() => setExpandedImovelId(isExpanded ? null : im.id)}>
                      <div className="patr-card-icon patr-card-icon-blue">
                        <svg viewBox="0 0 20 20" fill="none"><path d="M3 9l7-6 7 6v9H3V9z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M7 18V12h6v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                      </div>
                      <div className="patr-card-body">
                        <div className="patr-card-title">
                          {im.descricao}
                          {docCount > 0 && <span className="patr-badge" style={{ marginLeft: 8, fontSize: 'calc(.65rem * var(--fs))' }}>{docCount} doc{docCount > 1 ? 's' : ''}</span>}
                          {(im.condominioValue || 0) > 0 && <span className="patr-badge" style={{ marginLeft: 4, fontSize: 'calc(.65rem * var(--fs))' }}>Condo</span>}
                        </div>
                        <div className="patr-card-meta">
                          {im.tipo && <span className="patr-badge">{im.tipo}</span>}
                          {im.area && <span>{im.area} m²</span>}
                          {im.endereco && <span className="patr-card-addr">{im.endereco}</span>}
                        </div>
                        <div className="patr-card-values">
                          <span>Compra: {fmtR(im.valor)}</span>
                          {im.valorAtual && <span>Atual: {fmtR(im.valorAtual)}</span>}
                          {gain !== 0 && <span className={gain > 0 ? 'patr-gain-pos' : 'patr-gain-neg'}>{gain > 0 ? '+' : ''}{fmtR(gain)}</span>}
                        </div>
                      </div>
                      <div className="patr-card-actions">
                        <button className="patr-icon-btn" onClick={e => { e.stopPropagation(); startEditImovel(im) }} title="Editar">
                          <svg viewBox="0 0 14 14" fill="none"><path d="M2 10l7-7 2 2-7 7H2v-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                        </button>
                        <button className="patr-icon-btn patr-icon-btn-del" onClick={e => { e.stopPropagation(); setImoveis(prev => prev.filter(x => x.id !== im.id)) }} title="Excluir">
                          <svg viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                        </button>
                      </div>
                      <svg className={`patr-chevron${isExpanded ? ' expanded' : ''}`} viewBox="0 0 16 16" fill="none">
                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    {isExpanded && (
                      <ImovelExpansion imovel={im} docs={docs} setDocs={setDocs} setImoveis={setImoveis} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Veículos */}
      {tab === 'veiculos' && (
        <div className="patr-section">
          {showVehForm ? (
            <div className="patr-form">
              <div className="patr-form-title">{editVehId ? 'Editar Veículo' : 'Novo Veículo'}</div>
              <div className="patr-fields">
                <div className="patr-field patr-span2">
                  <label>Nome / Modelo *</label>
                  <input placeholder="Ex: VW Jetta 2017" value={vehForm.name} onChange={e => fv('name', e.target.value)} />
                </div>
                <div className="patr-field">
                  <label>Placa</label>
                  <input placeholder="ABC-1234" value={vehForm.plate} onChange={e => fv('plate', e.target.value.toUpperCase())} />
                </div>
                <div className="patr-field">
                  <label>Ano</label>
                  <input type="number" placeholder="2020" value={vehForm.year} onChange={e => fv('year', e.target.value)} />
                </div>
                <div className="patr-field">
                  <label>Valor de Compra (R$)</label>
                  <input type="number" placeholder="0,00" value={vehForm.valorCompra} onChange={e => fv('valorCompra', e.target.value)} />
                </div>
                <div className="patr-field">
                  <label>Valor Atual (R$)</label>
                  <input type="number" placeholder="0,00" value={vehForm.valorAtual} onChange={e => fv('valorAtual', e.target.value)} />
                </div>
                <div className="patr-field">
                  <label>KM Atual</label>
                  <input type="number" placeholder="0" value={vehForm.currentKm} onChange={e => fv('currentKm', e.target.value)} />
                </div>
                <div className="patr-field">
                  <label>Vencimento IPVA</label>
                  <input type="date" value={vehForm.ipvaExpiry} onChange={e => fv('ipvaExpiry', e.target.value)} />
                </div>
                <div className="patr-field">
                  <label>Vencimento Seguro</label>
                  <input type="date" value={vehForm.insuranceExpiry} onChange={e => fv('insuranceExpiry', e.target.value)} />
                </div>
                <div className="patr-field patr-span2">
                  <label>Observações</label>
                  <input placeholder="Notas adicionais" value={vehForm.notes} onChange={e => fv('notes', e.target.value)} />
                </div>
              </div>
              <div className="patr-form-actions">
                <button className="btn-ghost" onClick={() => { setShowVehForm(false); setEditVehId(null); setVehForm(VEH_INIT) }}>Cancelar</button>
                <button className="btn-accent" onClick={saveVehicle}>{editVehId ? 'Salvar' : 'Adicionar'}</button>
              </div>
            </div>
          ) : (
            <button className="patr-add-btn" onClick={() => setShowVehForm(true)}>
              <svg viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Adicionar Veículo
            </button>
          )}
          {vehicles.length === 0 && !showVehForm ? (
            <div className="patr-empty">
              <svg viewBox="0 0 48 48" fill="none"><rect x="3" y="18" width="42" height="21" rx="4" stroke="currentColor" strokeWidth="2"/><path d="M12 18V15a9 9 0 0 1 9-9h6a9 9 0 0 1 9 9v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="13" cy="39" r="4" fill="currentColor" opacity=".3" stroke="none"/><circle cx="35" cy="39" r="4" fill="currentColor" opacity=".3" stroke="none"/></svg>
              <span>Nenhum veículo cadastrado</span>
            </div>
          ) : (
            <div className="patr-list">
              {vehicles.map(v => {
                const legacyCompra = v.notes?.match(/Compra:\s*R\$\s*([\d.,]+)/)?.[1]?.replace(/\./g, '').replace(',', '.')
                const legacyAtual  = v.notes?.match(/Atual:\s*R\$\s*([\d.,]+)/)?.[1]?.replace(/\./g, '').replace(',', '.')
                const valorCompra = v.valorCompra ?? (legacyCompra ? parseFloat(legacyCompra) : 0)
                const valorAtual  = v.valorAtual  ?? (legacyAtual  ? parseFloat(legacyAtual)  : 0)
                const gain = valorAtual > 0 && valorCompra > 0 ? valorAtual - valorCompra : 0
                const isExpanded = expandedVehicleId === v.id
                const vehDocCount = docs.filter(d => d.assetId === v.id).length
                const vehBillCount = bills.filter(b => b.vehicleId === v.id && b.status !== 'pago').length
                return (
                  <div key={v.id} className={`patr-card patr-card-expandable${isExpanded ? ' patr-card-expanded' : ''}`}>
                    <div className="patr-card-main" onClick={() => setExpandedVehicleId(isExpanded ? null : v.id)}>
                      <div className="patr-card-icon" style={{ background: 'rgba(245,158,11,.15)', color: 'var(--amber)' }}>
                        <svg viewBox="0 0 20 20" fill="none"><rect x="1" y="8" width="18" height="8" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M4 8V7a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" stroke="currentColor" strokeWidth="1.4"/><circle cx="5" cy="16" r="2" fill="currentColor"/><circle cx="15" cy="16" r="2" fill="currentColor"/></svg>
                      </div>
                      <div className="patr-card-body">
                        <div className="patr-card-title">
                          {v.name}{v.plate && <span className="patr-badge" style={{ marginLeft: 8 }}>{v.plate}</span>}
                          {vehDocCount > 0 && <span className="patr-badge" style={{ marginLeft: 4, fontSize: 'calc(.65rem * var(--fs))' }}>{vehDocCount} doc{vehDocCount > 1 ? 's' : ''}</span>}
                          {vehBillCount > 0 && <span className="patr-badge" style={{ marginLeft: 4, fontSize: 'calc(.65rem * var(--fs))', background: 'rgba(245,158,11,.15)', color: 'var(--amber)' }}>{vehBillCount} pendente{vehBillCount > 1 ? 's' : ''}</span>}
                        </div>
                        <div className="patr-card-meta">
                          {v.year && <span>{v.year}</span>}
                          {fmtKm(v.currentKm) && <span>{fmtKm(v.currentKm)}</span>}
                          {v.ipvaExpiry && <span>IPVA: {v.ipvaExpiry.split('-').reverse().join('/')}</span>}
                          {v.insuranceExpiry && <span>Seguro: {v.insuranceExpiry.split('-').reverse().join('/')}</span>}
                        </div>
                        <div className="patr-card-values">
                          {valorCompra > 0 && <span>Compra: {fmtR(valorCompra)}</span>}
                          {valorAtual  > 0 && <span>Atual: {fmtR(valorAtual)}</span>}
                          {gain !== 0 && <span className={gain > 0 ? 'patr-gain-pos' : 'patr-gain-neg'}>{gain > 0 ? '+' : ''}{fmtR(gain)}</span>}
                        </div>
                      </div>
                      <div className="patr-card-actions">
                        <button className="patr-icon-btn" onClick={e => { e.stopPropagation(); startEditVehicle(v) }} title="Editar">
                          <svg viewBox="0 0 14 14" fill="none"><path d="M2 10l7-7 2 2-7 7H2v-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                        </button>
                        <button className="patr-icon-btn patr-icon-btn-del" onClick={e => { e.stopPropagation(); setVehicles(prev => prev.filter(x => x.id !== v.id)) }} title="Excluir">
                          <svg viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                        </button>
                      </div>
                      <svg className={`patr-chevron${isExpanded ? ' expanded' : ''}`} viewBox="0 0 16 16" fill="none">
                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    {isExpanded && (
                      <VehicleExpansion vehicle={v} docs={docs} setDocs={setDocs} bills={bills} setBills={setBills} />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Produtos */}
      {tab === 'produtos' && (
        <div className="patr-section">
          {showProdForm ? (
            <div className="patr-form">
              <div className="patr-form-title">{editProdId ? 'Editar Bem' : 'Novo Bem / Produto'}</div>
              <div className="patr-fields">
                <div className="patr-field patr-span2">
                  <label>Nome</label>
                  <input placeholder="Ex: MacBook Pro 14" value={prodForm.nome} onChange={e => fp('nome', e.target.value)} />
                </div>
                <div className="patr-field">
                  <label>Categoria</label>
                  <select value={prodForm.categoria} onChange={e => fp('categoria', e.target.value)}>
                    {PRODUTO_CATS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="patr-field">
                  <label>Quantidade</label>
                  <input type="number" placeholder="1" value={prodForm.quantidade} onChange={e => fp('quantidade', e.target.value)} />
                </div>
                <div className="patr-field">
                  <label>Valor Unitário (R$)</label>
                  <input type="number" placeholder="0,00" value={prodForm.valor} onChange={e => fp('valor', e.target.value)} />
                </div>
                <div className="patr-field">
                  <label>Fornecedor</label>
                  <input placeholder="Nome do fornecedor" value={prodForm.fornecedor} onChange={e => fp('fornecedor', e.target.value)} />
                </div>
                <div className="patr-field patr-span2">
                  <label>Descrição</label>
                  <input placeholder="Detalhes adicionais" value={prodForm.descricao} onChange={e => fp('descricao', e.target.value)} />
                </div>
              </div>
              <div className="patr-form-actions">
                <button className="btn-ghost" onClick={() => { setShowProdForm(false); setEditProdId(null); setProdForm({ ...PRODUTO_INIT }) }}>Cancelar</button>
                <button className="btn-accent" onClick={saveProduto}>{editProdId ? 'Salvar' : 'Adicionar'}</button>
              </div>
            </div>
          ) : (
            <button className="patr-add-btn" onClick={() => setShowProdForm(true)}>
              <svg viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Adicionar Bem / Produto
            </button>
          )}
          {produtos.length === 0 && !showProdForm ? (
            <div className="patr-empty">
              <svg viewBox="0 0 48 48" fill="none"><rect x="8" y="20" width="32" height="22" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M16 20V14a8 8 0 0 1 16 0v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              <span>Nenhum bem cadastrado</span>
            </div>
          ) : (
            <div className="patr-list">
              {produtos.map(p => {
                const total = (parseFloat(p.valor || '0') || 0) * (parseInt(p.quantidade || '1') || 1)
                return (
                  <div key={p.id} className="patr-card">
                    <div className="patr-card-icon patr-card-icon-green">
                      <svg viewBox="0 0 20 20" fill="none"><rect x="4" y="10" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.4"/><path d="M7 10V7a3 3 0 0 1 6 0v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                    </div>
                    <div className="patr-card-body">
                      <div className="patr-card-title">{p.nome}</div>
                      <div className="patr-card-meta">
                        {p.categoria && <span className="patr-badge">{p.categoria}</span>}
                        {parseInt(p.quantidade || '1') > 1 && <span>Qtd: {p.quantidade}</span>}
                        {p.fornecedor && <span>{p.fornecedor}</span>}
                        {p.descricao && <span className="patr-card-addr">{p.descricao}</span>}
                      </div>
                      <div className="patr-card-values">
                        <span>Unitário: {fmtR(p.valor)}</span>
                        {parseInt(p.quantidade || '1') > 1 && <span>Total: {fmtR(total)}</span>}
                      </div>
                    </div>
                    <div className="patr-card-actions">
                      <button className="patr-icon-btn" onClick={() => startEditProd(p)} title="Editar">
                        <svg viewBox="0 0 14 14" fill="none"><path d="M2 10l7-7 2 2-7 7H2v-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                      </button>
                      <button className="patr-icon-btn patr-icon-btn-del" onClick={() => setProdutos(prev => prev.filter(x => x.id !== p.id))} title="Excluir">
                        <svg viewBox="0 0 14 14" fill="none"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
