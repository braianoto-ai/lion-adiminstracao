import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { BUCKET } from '../constants'
import type { Vehicle, DocMeta, Bill } from '../types'

const VEH_DOC_CATS = ['CRLV', 'Seguro', 'DUT', 'Nota Fiscal', 'IPVA', 'Multa', 'Laudo', 'Outros']

const DOC_ICON: Record<string, React.ReactElement> = {
  CRLV:        <svg viewBox="0 0 16 16" fill="none"><path d="M4 2a1 1 0 0 1 1-1h5l3 3v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2z" stroke="currentColor" strokeWidth="1.3"/><path d="M10 1v3h3" stroke="currentColor" strokeWidth="1.3"/><path d="M6 8h4M6 11h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  Seguro:      <svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5L2 4v4c0 3.5 2.5 5.8 6 6.5 3.5-.7 6-3 6-6.5V4L8 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M5.5 8l2 2 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  DUT:         <svg viewBox="0 0 16 16" fill="none"><path d="M4 2a1 1 0 0 1 1-1h5l3 3v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2z" stroke="currentColor" strokeWidth="1.3"/><path d="M10 1v3h3" stroke="currentColor" strokeWidth="1.3"/><path d="M6 6h4M6 8.5h4M6 11h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  'Nota Fiscal':<svg viewBox="0 0 16 16" fill="none"><path d="M3 1h10v14l-2-1.5-2 1.5-2-1.5-2 1.5L3 15V1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M6 6h4M6 8.5h3M6 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  IPVA:        <svg viewBox="0 0 16 16" fill="none"><path d="M2 7l6-5 6 5v7H2V7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M6 14V9h4v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  Multa:       <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  Laudo:       <svg viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  Outros:      <svg viewBox="0 0 16 16" fill="none"><path d="M4 2a1 1 0 0 1 1-1h5l3 3v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2z" stroke="currentColor" strokeWidth="1.3"/><path d="M10 1v3h3" stroke="currentColor" strokeWidth="1.3"/></svg>,
}

interface Props {
  vehicle: Vehicle
  docs: DocMeta[]
  setDocs: React.Dispatch<React.SetStateAction<DocMeta[]>>
  bills: Bill[]
  setBills: React.Dispatch<React.SetStateAction<Bill[]>>
}

const BILL_INIT = { description: '', amount: '', dueDate: '', recurrence: 'unica' as const }

export default function VehicleExpansion({ vehicle, docs, setDocs, bills, setBills }: Props) {
  const [tab, setTab] = useState<'docs' | 'parcelas'>('docs')

  // — Docs
  const [filterCat, setFilterCat] = useState('Todos')
  const [showUpload, setShowUpload] = useState(false)
  const [docForm, setDocForm] = useState({ name: '', category: VEH_DOC_CATS[0], notes: '' })
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  // — Bills
  const [showBillForm, setShowBillForm] = useState(false)
  const [billForm, setBillForm] = useState({ ...BILL_INIT })

  const fd = (k: string, v: string) => setDocForm(p => ({ ...p, [k]: v }))
  const fb = (k: string, v: string) => setBillForm(p => ({ ...p, [k]: v }))

  const myDocs = useMemo(
    () => docs.filter(d => d.assetId === vehicle.id),
    [docs, vehicle.id]
  )
  const myBills = useMemo(
    () => bills.filter(b => (b as Bill & { vehicleId?: string }).vehicleId === vehicle.id)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [bills, vehicle.id]
  )
  const filtered = useMemo(
    () => filterCat === 'Todos' ? myDocs : myDocs.filter(d => d.category === filterCat),
    [myDocs, filterCat]
  )

  const fmtDate = (s: string) => new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
  const fmtR = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmtDay = (d: string) => { const [, m, dd] = d.split('-'); return `${dd}/${m}` }

  async function uploadDoc(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !docForm.name.trim()) return
    setUploading(true); setUploadError('')

    if (!supabase) { setUploadError('Supabase não configurado.'); setUploading(false); return }

    const path = `${Date.now()}_${file.name.replace(/\s/g, '_')}`
    let { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
    if (upErr && ((upErr as { statusCode?: string }).statusCode === '404' || (upErr as { statusCode?: string }).statusCode === '400' || upErr.message.includes('bucket'))) {
      const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, { public: false })
      if (bucketErr && !bucketErr.message.includes('already exists')) {
        setUploadError('Erro ao criar bucket: ' + bucketErr.message); setUploading(false); return
      }
      const retry = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
      upErr = retry.error
    }
    if (upErr) { setUploadError('Erro no upload: ' + upErr.message); setUploading(false); return }

    const doc: DocMeta = {
      id: Date.now().toString(), name: docForm.name, category: docForm.category,
      asset: vehicle.name, assetId: vehicle.id, notes: docForm.notes,
      fileUrl: path, fileName: file.name, createdAt: new Date().toISOString(),
    }
    setDocs(prev => [doc, ...prev])
    setDocForm({ name: '', category: VEH_DOC_CATS[0], notes: '' })
    setFile(null); setShowUpload(false); setUploading(false)
  }

  async function openDoc(doc: DocMeta) {
    if (!supabase) return
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.fileUrl, 120)
    if (error) { alert('Erro: ' + error.message); return }
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  async function deleteDoc(doc: DocMeta) {
    if (!confirm('Remover este documento?')) return
    if (supabase) await supabase.storage.from(BUCKET).remove([doc.fileUrl])
    setDocs(prev => prev.filter(d => d.id !== doc.id))
  }

  function saveBill(e: React.FormEvent) {
    e.preventDefault()
    if (!billForm.description.trim() || !billForm.amount || !billForm.dueDate) return
    const now = new Date().toISOString()
    const bill: Bill & { vehicleId: string } = {
      id: Date.now().toString(),
      collectorId: '',
      description: billForm.description,
      amount: parseFloat(billForm.amount),
      dueDate: billForm.dueDate,
      status: 'em_aberto',
      recurrence: billForm.recurrence as Bill['recurrence'],
      vehicleId: vehicle.id,
      createdAt: now,
      updatedAt: now,
    }
    setBills(prev => [bill as Bill, ...prev])
    setBillForm({ ...BILL_INIT })
    setShowBillForm(false)
  }

  function toggleBillStatus(bill: Bill) {
    setBills(prev => prev.map(b =>
      b.id === bill.id
        ? { ...b, status: b.status === 'pago' ? 'em_aberto' : 'pago', paidAt: b.status !== 'pago' ? new Date().toISOString() : undefined, updatedAt: new Date().toISOString() }
        : b
    ))
  }

  function deleteBill(id: string) {
    setBills(prev => prev.filter(b => b.id !== id))
  }

  return (
    <div className="patr-expansion">
      <div className="patr-expansion-tabs">
        <button className={`fin-tab${tab === 'docs' ? ' fin-tab-active' : ''}`} onClick={() => setTab('docs')}>
          <svg viewBox="0 0 14 14" fill="none" style={{ width: 13, height: 13 }}><path d="M3 2a1 1 0 0 1 1-1h4l3 3v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2z" stroke="currentColor" strokeWidth="1.2"/><path d="M8 1v3h3" stroke="currentColor" strokeWidth="1.2"/></svg>
          Documentos ({myDocs.length})
        </button>
        <button className={`fin-tab${tab === 'parcelas' ? ' fin-tab-active' : ''}`} onClick={() => setTab('parcelas')}>
          <svg viewBox="0 0 14 14" fill="none" style={{ width: 13, height: 13 }}><rect x="1" y="3" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M1 6h12" stroke="currentColor" strokeWidth="1.2"/><path d="M4 9h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          Parcelas / Seguro ({myBills.length})
        </button>
      </div>

      {tab === 'docs' && (
        <div className="patr-expansion-body">
          <div className="patr-expansion-toolbar">
            <div className="docs-cat-filter" style={{ flex: 1 }}>
              {['Todos', ...VEH_DOC_CATS].map(c => (
                <button key={c} className={`fin-chip docs-cat-chip${filterCat === c ? ' fin-chip-active' : ''}`} onClick={() => setFilterCat(c)}>{c}</button>
              ))}
            </div>
            <button className={`patr-upload-toggle${showUpload ? ' active' : ''}`} onClick={() => setShowUpload(v => !v)}>
              {showUpload ? '✕ Cancelar' : '+ Upload'}
            </button>
          </div>

          {showUpload && (
            <form className="patr-upload-form" onSubmit={uploadDoc}>
              <div className="patr-upload-row">
                <div className="fin-field" style={{ flex: 2 }}>
                  <label>Arquivo *</label>
                  <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} required className="docs-file-input" />
                </div>
                <div className="fin-field" style={{ flex: 2 }}>
                  <label>Nome *</label>
                  <input type="text" placeholder="Ex: CRLV 2025" value={docForm.name} onChange={e => fd('name', e.target.value)} required />
                </div>
                <div className="fin-field" style={{ flex: 1 }}>
                  <label>Categoria</label>
                  <select value={docForm.category} onChange={e => fd('category', e.target.value)}>
                    {VEH_DOC_CATS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="patr-upload-row">
                <div className="fin-field" style={{ flex: 1 }}>
                  <label>Observações</label>
                  <input type="text" placeholder="Notas opcionais" value={docForm.notes} onChange={e => fd('notes', e.target.value)} />
                </div>
                <button type="submit" className="btn-accent patr-upload-submit" disabled={uploading || !supabase}>
                  {uploading ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
              {uploadError && <div className="docs-error">{uploadError}</div>}
            </form>
          )}

          {filtered.length === 0 ? (
            <div className="patr-expansion-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ width: 28, height: 28, opacity: .3 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              <span>Nenhum documento vinculado.</span>
            </div>
          ) : (
            <div className="docs-list">
              {filtered.map(doc => (
                <div key={doc.id} className="doc-item">
                  <div className="doc-icon-emoji">{DOC_ICON[doc.category] || DOC_ICON.Outros}</div>
                  <div className="doc-item-body">
                    <span className="doc-item-name">{doc.name}</span>
                    <div className="doc-item-meta">
                      <span className="doc-cat-badge">{doc.category}</span>
                      <span>· {fmtDate(doc.createdAt)}</span>
                    </div>
                    {doc.notes && <span className="doc-item-notes">{doc.notes}</span>}
                  </div>
                  <div className="doc-item-actions">
                    <button className="doc-open-btn" onClick={() => openDoc(doc)} title="Abrir">
                      <svg viewBox="0 0 16 16" fill="none"><path d="M7 3H3a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><path d="M10 2h4v4M14 2l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                    </button>
                    <button className="fin-del" style={{ opacity: 1 }} onClick={() => deleteDoc(doc)}>
                      <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'parcelas' && (
        <div className="patr-expansion-body">
          <div className="patr-expansion-toolbar">
            <span style={{ fontSize: 'calc(.78rem * var(--fs))', color: 'var(--text)', opacity: .7 }}>
              {myBills.filter(b => b.status !== 'pago').length} pendente{myBills.filter(b => b.status !== 'pago').length !== 1 ? 's' : ''}
            </span>
            <button className={`patr-upload-toggle${showBillForm ? ' active' : ''}`} onClick={() => setShowBillForm(v => !v)}>
              {showBillForm ? '✕ Cancelar' : '+ Parcela'}
            </button>
          </div>

          {showBillForm && (
            <form className="patr-upload-form" onSubmit={saveBill}>
              <div className="patr-upload-row">
                <div className="fin-field" style={{ flex: 3 }}>
                  <label>Descrição *</label>
                  <input type="text" placeholder="Ex: Parcela seguro 1/12" value={billForm.description} onChange={e => fb('description', e.target.value)} required />
                </div>
                <div className="fin-field" style={{ flex: 1.5 }}>
                  <label>Valor (R$) *</label>
                  <input type="number" step="0.01" min="0" placeholder="0,00" value={billForm.amount} onChange={e => fb('amount', e.target.value)} required />
                </div>
                <div className="fin-field" style={{ flex: 1.5 }}>
                  <label>Vencimento *</label>
                  <input type="date" value={billForm.dueDate} onChange={e => fb('dueDate', e.target.value)} required />
                </div>
                <div className="fin-field" style={{ flex: 1.2 }}>
                  <label>Recorrência</label>
                  <select value={billForm.recurrence} onChange={e => fb('recurrence', e.target.value)}>
                    <option value="unica">Única</option>
                    <option value="mensal">Mensal</option>
                    <option value="anual">Anual</option>
                  </select>
                </div>
                <button type="submit" className="btn-accent patr-upload-submit">Adicionar</button>
              </div>
            </form>
          )}

          {myBills.length === 0 ? (
            <div className="patr-expansion-empty">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ width: 28, height: 28, opacity: .3 }}>
                <rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>
              </svg>
              <span>Nenhuma parcela vinculada a este veículo.</span>
            </div>
          ) : (
            <div className="docs-list">
              {myBills.map(bill => (
                <div key={bill.id} className="doc-item">
                  <button
                    className="dash-bill-dot"
                    style={{ background: bill.status === 'pago' ? 'rgba(16,185,129,.2)' : new Date(bill.dueDate) < new Date() ? 'rgba(239,68,68,.2)' : 'rgba(245,158,11,.2)', border: 'none', cursor: 'pointer', width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: bill.status === 'pago' ? 'var(--green)' : new Date(bill.dueDate) < new Date() ? 'var(--red)' : 'var(--amber)', fontSize: 12, fontWeight: 700 }}
                    onClick={() => toggleBillStatus(bill)}
                    title={bill.status === 'pago' ? 'Marcar como pendente' : 'Marcar como pago'}
                  >
                    {bill.status === 'pago' ? '✓' : '○'}
                  </button>
                  <div className="doc-item-body">
                    <span className="doc-item-name" style={{ textDecoration: bill.status === 'pago' ? 'line-through' : 'none', opacity: bill.status === 'pago' ? .5 : 1 }}>{bill.description}</span>
                    <div className="doc-item-meta">
                      <span>Vence {fmtDay(bill.dueDate)}</span>
                      {bill.recurrence !== 'unica' && <span className="doc-cat-badge">{bill.recurrence}</span>}
                      {bill.status === 'pago' && <span style={{ color: 'var(--green)' }}>· Pago</span>}
                      {bill.status !== 'pago' && new Date(bill.dueDate) < new Date() && <span style={{ color: 'var(--red)', fontWeight: 600 }}>· Vencida</span>}
                    </div>
                  </div>
                  <div className="doc-item-body" style={{ alignItems: 'flex-end', flex: 'none' }}>
                    <span style={{ fontWeight: 600, fontSize: 'calc(.88rem * var(--fs))' }}>{fmtR(bill.amount)}</span>
                  </div>
                  <div className="doc-item-actions">
                    <button className="fin-del" style={{ opacity: 1 }} onClick={() => deleteBill(bill.id)}>
                      <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
