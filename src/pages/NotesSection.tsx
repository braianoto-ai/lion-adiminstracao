import { useState, useEffect } from 'react'
import type { Folder, FlatNote } from '../types'

export default function NotesSection({ onOpenNotepad }: { onOpenNotepad: () => void }) {
  const [folders, setFolders] = useState<Folder[]>(() => {
    try { return JSON.parse(localStorage.getItem('np-folders') || 'null') || [] } catch { return [] }
  })
  const [search, setSearch] = useState('')
  const [filterFolder, setFilterFolder] = useState<string>('all')
  const [selected, setSelected] = useState<FlatNote | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [draft, setDraft] = useState({ title: '', content: '' })

  const persist = (updated: Folder[]) => {
    setFolders(updated)
    localStorage.setItem('np-folders', JSON.stringify(updated))
  }

  useEffect(() => {
    const handler = () => {
      try { setFolders(JSON.parse(localStorage.getItem('np-folders') || 'null') || []) } catch { /* ignore */ }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const allNotes: FlatNote[] = folders
    .flatMap(f => f.notes.map(n => ({ ...n, folderName: f.name, folderColor: f.color, folderId: f.id })))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const filtered = allNotes.filter(n => {
    const matchFolder = filterFolder === 'all' || n.folderId === filterFolder
    const q = search.toLowerCase()
    const matchSearch = !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    return matchFolder && matchSearch
  })

  const saveEdit = () => {
    const now = new Date().toISOString()
    const updated = folders.map(f => f.id === selected!.folderId
      ? { ...f, notes: f.notes.map(n => n.id === selected!.id ? { ...n, title: draft.title, content: draft.content, updatedAt: now } : n) }
      : f)
    persist(updated)
    setSelected(s => s ? { ...s, title: draft.title, content: draft.content, updatedAt: now } : s)
    setEditMode(false)
  }

  const deleteNote = (note: FlatNote) => {
    const updated = folders.map(f => f.id === note.folderId ? { ...f, notes: f.notes.filter(n => n.id !== note.id) } : f)
    persist(updated)
    if (selected?.id === note.id) setSelected(null)
  }

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })

  return (
    <section className="section notes-section">
      <div className="section-header">
        <div>
          <h2 className="section-title">Banco de Notas</h2>
          <span className="goals-sub">{allNotes.length} nota{allNotes.length !== 1 ? 's' : ''}</span>
        </div>
        <button className="goals-add-btn" onClick={onOpenNotepad}>+ Nova Nota</button>
      </div>

      {/* search + folder filter */}
      <div className="notes-toolbar">
        <div className="notes-search-wrap">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="7" cy="7" r="4.5"/><path d="M11 11l3 3" strokeLinecap="round"/></svg>
          <input className="notes-search" placeholder="Buscar notas…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="notes-filter-select" value={filterFolder} onChange={e => setFilterFolder(e.target.value)}>
          <option value="all">Todas as pastas</option>
          {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
      </div>

      {allNotes.length === 0 ? (
        <div className="goals-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>
          <p>Nenhuma nota criada ainda.</p>
        </div>
      ) : (
        <div className="notes-db-layout">
          {/* list */}
          <div className="notes-list">
            {filtered.length === 0 ? (
              <div className="notes-empty-search">Nenhuma nota encontrada.</div>
            ) : filtered.map(n => (
              <button key={n.id} className={`notes-list-item${selected?.id === n.id ? ' notes-list-active' : ''}`}
                onClick={() => { setSelected(n); setDraft({ title: n.title, content: n.content }); setEditMode(false) }}>
                <div className="notes-list-top">
                  <span className="note-folder-dot" style={{ background: n.folderColor }} />
                  <span className="notes-list-title">{n.title || 'Sem título'}</span>
                  <span className="notes-list-date">{fmt(n.updatedAt)}</span>
                </div>
                <div className="notes-list-preview">{n.content ? n.content.substring(0, 60) + (n.content.length > 60 ? '…' : '') : 'Sem conteúdo'}</div>
              </button>
            ))}
          </div>

          {/* viewer / editor */}
          <div className="notes-viewer">
            {!selected ? (
              <div className="notes-viewer-empty">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="28" height="28" style={{ opacity: .25 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>Selecione uma nota para ler</span>
              </div>
            ) : editMode ? (
              <div className="notes-editor">
                <input className="notes-edit-title" value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="Título" />
                <textarea className="notes-edit-body" value={draft.content} onChange={e => setDraft(d => ({ ...d, content: e.target.value }))} placeholder="Conteúdo…" />
                <div className="notes-editor-actions">
                  <button className="btn-ghost" onClick={() => setEditMode(false)}>Cancelar</button>
                  <button className="btn-accent" onClick={saveEdit}>Salvar</button>
                </div>
              </div>
            ) : (
              <div className="notes-read">
                <div className="notes-read-header">
                  <div>
                    <div className="notes-read-folder">
                      <span className="note-folder-dot" style={{ background: selected.folderColor }} />
                      {selected.folderName}
                    </div>
                    <div className="notes-read-title">{selected.title || 'Sem título'}</div>
                    <div className="notes-read-date">{fmt(selected.updatedAt)}</div>
                  </div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button className="goal-action-btn" title="Editar" onClick={() => setEditMode(true)}>
                      <svg viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                    </button>
                    <button className="goal-action-btn goal-del-btn" title="Excluir" onClick={() => deleteNote(selected)}>
                      <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                </div>
                <div className="notes-read-content">{selected.content || <em style={{ color:'var(--text)' }}>Sem conteúdo</em>}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
