import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useCloudTable } from '../hooks'
import { DOC_CATEGORIES, BUCKET } from '../constants'
import { fmtDate } from '../utils'
import type { DocMeta } from '../types'

export default 
function DocumentsPanel({ onClose }: { onClose: () => void }) {
  const [docs, setDocs] = useCloudTable<DocMeta>('documents', 'lion-docs-meta')
  const [view, setView] = useState<'list' | 'upload'>('list')
  const [form, setForm] = useState({ name: '', category: DOC_CATEGORIES[0], asset: '', notes: '' })
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [filterCat, setFilterCat] = useState('Todos')


  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  async function upload(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !form.name.trim()) return
    setUploading(true); setError('')

    if (!supabase) {
      setError('Supabase não configurado. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
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
      asset: form.asset, notes: form.notes, fileUrl: path,
      fileName: file.name, createdAt: new Date().toISOString(),
    }
    setDocs(prev => [doc, ...prev])
    setForm({ name: '', category: DOC_CATEGORIES[0], asset: '', notes: '' })
    setFile(null); setView('list')
    setUploading(false)
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

  const categories = ['Todos', ...DOC_CATEGORIES]
  const filtered = filterCat === 'Todos' ? docs : docs.filter(d => d.category === filterCat)
  const fmtDate = (s: string) => new Date(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })

  const iconForCat: Record<string, React.ReactElement> = {
    Escritura: <svg viewBox="0 0 16 16" fill="none"><path d="M4 2a1 1 0 0 1 1-1h5l3 3v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2z" stroke="currentColor" strokeWidth="1.3"/><path d="M10 1v3h3" stroke="currentColor" strokeWidth="1.3"/><path d="M6 8h4M6 11h2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
    IPTU:      <svg viewBox="0 0 16 16" fill="none"><path d="M2 7l6-5 6 5v7H2V7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M6 14V9h4v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>,
    Contrato:  <svg viewBox="0 0 16 16" fill="none"><path d="M4 2a1 1 0 0 1 1-1h5l3 3v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2z" stroke="currentColor" strokeWidth="1.3"/><path d="M10 1v3h3" stroke="currentColor" strokeWidth="1.3"/><path d="M6 6h4M6 8.5h4M6 11h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
    Seguro:    <svg viewBox="0 0 16 16" fill="none"><path d="M8 1.5L2 4v4c0 3.5 2.5 5.8 6 6.5 3.5-.7 6-3 6-6.5V4L8 1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M5.5 8l2 2 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    Planta:    <svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.3"/><path d="M2 6h12M6 6v8M6 2v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
    Comprovante:<svg viewBox="0 0 16 16" fill="none"><path d="M3 1h10v14l-2-1.5-2 1.5-2-1.5-2 1.5L3 15V1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M6 6h4M6 8.5h3M6 11h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>,
    Laudo:     <svg viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>,
    Outros:    <svg viewBox="0 0 16 16" fill="none"><path d="M4 2a1 1 0 0 1 1-1h5l3 3v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2z" stroke="currentColor" strokeWidth="1.3"/><path d="M10 1v3h3" stroke="currentColor" strokeWidth="1.3"/></svg>,
  }

  return (
    <div className="docs-wrap">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-icon docs-icon-header">
            <svg viewBox="0 0 20 20" fill="none">
              <path d="M4 4a2 2 0 0 1 2-2h5l5 5v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4z" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M11 2v5h5" stroke="currentColor" strokeWidth="1.4"/>
            </svg>
          </div>
          <span>Documentos</span>
        </div>
        <div className="fin-tabs">
          <button className={`fin-tab${view === 'list' ? ' fin-tab-active' : ''}`} onClick={() => setView('list')}>Arquivos ({docs.length})</button>
          <button className={`fin-tab fin-tab-add${view === 'upload' ? ' fin-tab-active' : ''}`} onClick={() => setView('upload')}>+ Upload</button>
        </div>
        <button className="panel-close" onClick={onClose}>
          <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      {view === 'list' && (
        <div className="fin-body">
          {docs.length > 0 && (
            <div className="docs-cat-filter">
              {categories.map(c => (
                <button key={c} className={`fin-chip docs-cat-chip${filterCat === c ? ' fin-chip-active' : ''}`} onClick={() => setFilterCat(c)}>{c}</button>
              ))}
            </div>
          )}

          {filtered.length === 0
            ? <div className="fin-empty" style={{ flexDirection: 'column', gap: 6 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" style={{ width: 32, height: 32, opacity: .3 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                <span>Nenhum documento ainda.</span>
              </div>
            : <div className="docs-list">
                {filtered.map(doc => (
                  <div key={doc.id} className="doc-item">
                    <div className="doc-icon-emoji">{iconForCat[doc.category] || <svg viewBox="0 0 16 16" fill="none"><path d="M4 2a1 1 0 0 1 1-1h5l3 3v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V2z" stroke="currentColor" strokeWidth="1.3"/><path d="M10 1v3h3" stroke="currentColor" strokeWidth="1.3"/></svg>}</div>
                    <div className="doc-item-body">
                      <span className="doc-item-name">{doc.name}</span>
                      <div className="doc-item-meta">
                        <span className="doc-cat-badge">{doc.category}</span>
                        {doc.asset && <span>· {doc.asset}</span>}
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
          }
        </div>
      )}

      {view === 'upload' && (
        <div className="fin-body">
          {!supabase && (
            <div className="docs-no-supabase">
              ⚠️ Supabase não configurado. Adicione <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> nas variáveis de ambiente.
            </div>
          )}
          <form className="fin-form" onSubmit={upload}>
            <div className="fin-field">
              <label>Arquivo *</label>
              <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} required className="docs-file-input" />
            </div>
            <div className="fin-field">
              <label>Nome do documento *</label>
              <input type="text" placeholder="Ex: Escritura - Casa da Praia" value={form.name} onChange={e => f('name', e.target.value)} required />
            </div>
            <div className="fin-row">
              <div className="fin-field">
                <label>Categoria</label>
                <select value={form.category} onChange={e => f('category', e.target.value)}>
                  {DOC_CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="fin-field">
                <label>Imóvel / Ativo</label>
                <input type="text" placeholder="Ex: Casa da Praia" value={form.asset} onChange={e => f('asset', e.target.value)} />
              </div>
            </div>
            <div className="fin-field">
              <label>Observações</label>
              <input type="text" placeholder="Notas opcionais" value={form.notes} onChange={e => f('notes', e.target.value)} />
            </div>
            {error && <div className="docs-error">{error}</div>}
            <button type="submit" className="fin-submit fin-submit-green" disabled={uploading || !supabase}>
              {uploading ? 'Enviando...' : 'Enviar documento'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
