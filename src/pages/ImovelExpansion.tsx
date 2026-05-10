import { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { DOC_CATEGORIES, BUCKET } from '../constants'
import type { Imovel, DocMeta } from '../types'

const ICON_FOR_CAT: Record<string, React.ReactElement> = {
  Escritura: <svg viewBox="0 0 16 16" fill="none"><path d="M4 2a1 1 0 0 1 1-1h5l3 3v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2z" stroke="currentColor" strokeWidth="1.3"/><path d="M10 1v3h3" stroke="currentColor" strokeWidth="1.3"/><path d="M6 8h4M6 11h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  IPTU:      <svg viewBox="0 0 16 16" fill="none"><path d="M2 7l6-5 6 5v7H2V7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M6 14V9h4v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
  Contrato:  <svg viewBox="0 0 16 16" fill="none"><path d="M4 2a1 1 0 0 1 1-1h5l3 3v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2z" stroke="currentColor" strokeWidth="1.3"/><path d="M10 1v3h3" stroke="currentColor" strokeWidth="1.3"/><path d="M6 6h4M6 8.5h4M6 11h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  Seguro:    <svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5L2 4v4c0 3.5 2.5 5.8 6 6.5 3.5-.7 6-3 6-6.5V4L8 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M5.5 8l2 2 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Planta:    <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M2 6h12M6 6v8M6 2v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  Comprovante:<svg viewBox="0 0 16 16" fill="none"><path d="M3 1h10v14l-2-1.5-2 1.5-2-1.5-2 1.5L3 15V1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M6 6h4M6 8.5h3M6 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
  Laudo:     <svg viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  Outros:    <svg viewBox="0 0 16 16" fill="none"><path d="M4 2a1 1 0 0 1 1-1h5l3 3v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2z" stroke="currentColor" strokeWidth="1.3"/><path d="M10 1v3h3" stroke="currentColor" strokeWidth="1.3"/></svg>,
}

interface Props {
  imovel: Imovel
  docs: DocMeta[]
  setDocs: React.Dispatch<React.SetStateAction<DocMeta[]>>
  setImoveis: React.Dispatch<React.SetStateAction<Imovel[]>>
}

export default function ImovelExpansion({ imovel, docs, setDocs, setImoveis }: Props) {
  const [tab, setTab] = useState<'docs' | 'condo'>('docs')
  const [filterCat, setFilterCat] = useState('Todos')
  const [showUpload, setShowUpload] = useState(false)
  const [form, setForm] = useState({ name: '', category: DOC_CATEGORIES[0], notes: '' })
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [editingCondo, setEditingCondo] = useState(false)
  const [condoForm, setCondoForm] = useState({
    value: String(imovel.condominioValue || ''),
    dueDay: String(imovel.condominioDueDay || 10),
  })

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const myDocs = useMemo(
    () => docs.filter(d => d.assetId === imovel.id || (!d.assetId && d.asset === imovel.descricao)),
    [docs, imovel.id, imovel.descricao]
  )
  const categories = ['Todos', ...DOC_CATEGORIES]
  const filtered = useMemo(
    () => filterCat === 'Todos' ? myDocs : myDocs.filter(d => d.category === filterCat),
    [myDocs, filterCat]
  )
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !form.name.trim()) return
    setUploading(true); setError('')

    if (!supabase) {
      setError('Supabase não configurado.')
      setUploading(false); return
    }

    const path = `${Date.now()}_${file.name.replace(/\s/g, '_')}`
    let { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
    if (upErr && (upErr.message.includes('Bucket not found') || upErr.message.includes('bucket') || (upErr as { statusCode?: string }).statusCode === '404' || (upErr as { statusCode?: string }).statusCode === '400')) {
      const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, { public: false })
      if (bucketErr && !bucketErr.message.includes('already exists')) {
        setError('Erro ao criar bucket: ' + bucketErr.message); setUploading(false); return
      }
      const retry = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
      upErr = retry.error
    }
    if (upErr) { setError('Erro no upload: ' + upErr.message); setUploading(false); return }

    const doc: DocMeta = {
      id: Date.now().toString(), name: form.name, category: form.category,
      asset: imovel.descricao, assetId: imovel.id, notes: form.notes, fileUrl: path,
      fileName: file.name, createdAt: new Date().toISOString(),
    }
    setDocs(prev => [doc, ...prev])
    setForm({ name: '', category: DOC_CATEGORIES[0], notes: '' })
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

  // Condomínio
  const now = new Date()
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return d.toISOString().slice(0, 7)
  })
  const fmtMonth = (m: string) => new Date(m + '-02').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
  const fmtCurr = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  function getMonthStatus(month: string): 'pago' | 'atrasado' | 'pendente' {
    if (imovel.condominioPayments?.[month] === 'pago') return 'pago'
    if (!imovel.condominioValue) return 'pendente'
    const [y, m] = month.split('-').map(Number)
    const due = new Date(y, m - 1, imovel.condominioDueDay || 10)
    return due < new Date() ? 'atrasado' : 'pendente'
  }

  function togglePayment(month: string) {
    setImoveis(prev => prev.map(im => {
      if (im.id !== imovel.id) return im
      const payments = { ...(im.condominioPayments || {}) }
      payments[month] = payments[month] === 'pago' ? 'pendente' : 'pago'
      return { ...im, condominioPayments: payments }
    }))
  }

  function saveCondo() {
    const val = parseFloat(condoForm.value) || 0
    const day = parseInt(condoForm.dueDay) || 10
    setImoveis(prev => prev.map(im =>
      im.id === imovel.id ? { ...im, condominioValue: val, condominioDueDay: day } : im
    ))
    setEditingCondo(false)
  }

  const paidCount = last6Months.filter(m => imovel.condominioPayments?.[m] === 'pago').length

  return (
    <div className="patr-expansion">
      <div className="patr-expansion-tabs">
        <button className={`fin-tab${tab === 'docs' ? ' fin-tab-active' : ''}`} onClick={() => setTab('docs')}>
          <svg viewBox="0 0 14 14" fill="none" style={{ width: 13, height: 13 }}><path d="M3 2a1 1 0 0 1 1-1h4l3 3v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2z" stroke="currentColor" strokeWidth="1.2"/><path d="M8 1v3h3" stroke="currentColor" strokeWidth="1.2"/></svg>
          Documentos ({myDocs.length})
        </button>
        <button className={`fin-tab${tab === 'condo' ? ' fin-tab-active' : ''}`} onClick={() => setTab('condo')}>
          <svg viewBox="0 0 14 14" fill="none" style={{ width: 13, height: 13 }}><path d="M2 6l5-4 5 4v7H2V6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M5 13V9h4v4" stroke="currentColor" strokeWidth="1.2"/></svg>
          Condomínio
        </button>
      </div>

      {tab === 'docs' && (
        <div className="patr-expansion-body">
          <div className="patr-expansion-toolbar">
            <div className="docs-cat-filter" style={{ flex: 1 }}>
              {categories.map(c => (
                <button key={c} className={`fin-chip docs-cat-chip${filterCat === c ? ' fin-chip-active' : ''}`} onClick={() => setFilterCat(c)}>{c}</button>
              ))}
            </div>
            <button className={`patr-upload-toggle${showUpload ? ' active' : ''}`} onClick={() => setShowUpload(v => !v)}>
              {showUpload ? '✕ Cancelar' : '+ Upload'}
            </button>
          </div>

          {showUpload && (
            <form className="patr-upload-form" onSubmit={upload}>
              <div className="patr-upload-row">
                <div className="fin-field" style={{ flex: 2 }}>
                  <label>Arquivo *</label>
                  <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} required className="docs-file-input" />
                </div>
                <div className="fin-field" style={{ flex: 2 }}>
                  <label>Nome *</label>
                  <input type="text" placeholder="Ex: Escritura" value={form.name} onChange={e => f('name', e.target.value)} required />
                </div>
                <div className="fin-field" style={{ flex: 1 }}>
                  <label>Categoria</label>
                  <select value={form.category} onChange={e => f('category', e.target.value)}>
                    {DOC_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="patr-upload-row">
                <div className="fin-field" style={{ flex: 1 }}>
                  <label>Observações</label>
                  <input type="text" placeholder="Notas opcionais" value={form.notes} onChange={e => f('notes', e.target.value)} />
                </div>
                <button type="submit" className="btn-accent patr-upload-submit" disabled={uploading || !supabase}>
                  {uploading ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
              {error && <div className="docs-error">{error}</div>}
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
                  <div className="doc-icon-emoji">{ICON_FOR_CAT[doc.category] || ICON_FOR_CAT.Outros}</div>
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

      {tab === 'condo' && (
        <div className="patr-expansion-body">
          <div className="patr-condo-header">
            {editingCondo ? (
              <div className="patr-condo-edit">
                <div className="fin-field">
                  <label>Valor mensal (R$)</label>
                  <input type="number" step="0.01" min="0" placeholder="0,00" value={condoForm.value} onChange={e => setCondoForm(p => ({ ...p, value: e.target.value }))} />
                </div>
                <div className="fin-field">
                  <label>Dia de vencimento</label>
                  <input type="number" min="1" max="31" value={condoForm.dueDay} onChange={e => setCondoForm(p => ({ ...p, dueDay: e.target.value }))} />
                </div>
                <button className="btn-accent" onClick={saveCondo} style={{ alignSelf: 'flex-end', height: 34 }}>Salvar</button>
                <button className="btn-ghost" onClick={() => setEditingCondo(false)} style={{ alignSelf: 'flex-end', height: 34 }}>Cancelar</button>
              </div>
            ) : (
              <div className="patr-condo-info">
                <div className="patr-condo-val">
                  {imovel.condominioValue ? fmtCurr(imovel.condominioValue) : 'Não definido'}
                  <span className="patr-condo-sub">/mês · vence dia {imovel.condominioDueDay || 10}</span>
                </div>
                <button className="patr-icon-btn" onClick={() => { setCondoForm({ value: String(imovel.condominioValue || ''), dueDay: String(imovel.condominioDueDay || 10) }); setEditingCondo(true) }} title="Editar">
                  <svg viewBox="0 0 14 14" fill="none"><path d="M2 10l7-7 2 2-7 7H2v-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                </button>
              </div>
            )}
          </div>

          {imovel.condominioValue ? (
            <>
              <div className="rental-history-header">
                <span>Histórico de pagamentos</span>
                <span className="rental-history-sub">{paidCount}/{last6Months.length} pagos nos últimos 6 meses</span>
              </div>
              <div className="rental-months">
                {last6Months.map(month => {
                  const status = getMonthStatus(month)
                  return (
                    <button key={month} className={`rental-month-btn month-${status}`} onClick={() => togglePayment(month)}>
                      <span className="rental-month-label">{fmtMonth(month)}</span>
                      <span className="rental-month-status">
                        {status === 'pago' ? '✓' : status === 'atrasado' ? '⚠' : '○'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          ) : (
            <div className="patr-expansion-empty">
              <span>Defina o valor do condomínio para acompanhar os pagamentos.</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
