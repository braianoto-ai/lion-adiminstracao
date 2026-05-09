import { useState, useEffect } from 'react'
import { useCloudTable } from '../hooks'
import { FOLDER_COLORS } from '../constants'
import { defaultFolders } from '../utils'
import type { Folder, Note } from '../types'

export default 
function Notepad({ onClose, npTarget, onTargetHandled }: { onClose: () => void; npTarget?: { folderId: string; noteId: string } | null; onTargetHandled?: () => void }) {
  const [folders, setFolders] = useCloudTable<Folder>('folders', 'np-folders')
  useEffect(() => {
    if (folders.length === 0) setFolders(defaultFolders())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [folderId, setFolderId] = useState<string | null>(null)
  const [noteId, setNoteId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ title: string; content: string } | null>(null)
  const [view, setView] = useState<'folders' | 'notes' | 'edit'>('folders')
  const [newFolder, setNewFolder] = useState(false)
  const [nfName, setNfName] = useState('')
  const [nfColor, setNfColor] = useState(FOLDER_COLORS[0])
  const [editFolderId, setEditFolderId] = useState<string | null>(null)

  useEffect(() => {
    if (!npTarget) return
    const f = folders.find(x => x.id === npTarget.folderId)
    const n = f?.notes.find(x => x.id === npTarget.noteId)
    if (f && n) {
      setFolderId(f.id); setNoteId(n.id); setDraft({ title: n.title, content: n.content }); setView('edit')
    }
    onTargetHandled?.()
  }, [npTarget])

  const folder = folders.find(f => f.id === folderId)
  const note = folder?.notes.find(n => n.id === noteId)

  const addFolder = () => {
    if (!nfName.trim()) return
    const f: Folder = { id: Date.now().toString(), name: nfName.trim(), color: nfColor, notes: [] }
    setFolders([...folders, f]); setNfName(''); setNewFolder(false); setNfColor(FOLDER_COLORS[0])
  }

  const delFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setFolders(folders.filter(f => f.id !== id))
    if (folderId === id) { setFolderId(null); setView('folders') }
  }

  const addNote = () => {
    if (!folderId) return
    const n: Note = { id: Date.now().toString(), title: 'Nova Nota', content: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
    setFolders(folders.map(f => f.id === folderId ? { ...f, notes: [...f.notes, n] } : f))
    setNoteId(n.id); setDraft({ title: n.title, content: n.content }); setView('edit')
  }

  const persistDraft = () => {
    if (!folderId || !noteId || !draft) return
    setFolders(prev => prev.map(f => f.id === folderId
      ? { ...f, notes: f.notes.map(n => n.id === noteId ? { ...n, ...draft, updatedAt: new Date().toISOString() } : n) }
      : f))
  }

  const saveNote = () => {
    persistDraft()
    setView('notes')
  }

  const goBack = () => {
    if (view === 'edit') { persistDraft(); setView('notes') }
    else { setView('folders') }
  }

  const delNote = (nid: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!folderId) return
    setFolders(folders.map(f => f.id === folderId ? { ...f, notes: f.notes.filter(n => n.id !== nid) } : f))
    if (noteId === nid) { setNoteId(null); setView('notes') }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  return (
    <div className="np-wrap">
      <div className="panel-header">
        <div className="panel-header-left">
          {view !== 'folders' && (
            <button className="back-btn" onClick={goBack}>
              <svg viewBox="0 0 16 16" fill="none"><path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          )}
          <div className="panel-icon np-icon-header">
            <svg viewBox="0 0 20 20" fill="none">
              <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M7 7h6M7 10.5h6M7 14h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M3 5h1M16 5h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".4"/>
            </svg>
          </div>
          <span>
            {view === 'folders' ? 'Bloco de Notas'
              : view === 'notes' ? folder?.name ?? 'Notas'
              : note?.title ?? 'Editar'}
          </span>
        </div>
        <button className="panel-close" onClick={onClose}>
          <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      {view === 'folders' && (
        <div className="np-body">
          <div className="np-folders">
            {folders.map(f => (
              <div
                key={f.id}
                className="np-folder"
                style={{ '--fc': f.color } as React.CSSProperties}
                onClick={() => { setFolderId(f.id); setView('notes') }}
              >
                <div className="np-folder-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
                  </svg>
                </div>
                <div className="np-folder-body">
                  {editFolderId === f.id ? (
                    <input
                      className="np-folder-rename"
                      defaultValue={f.name}
                      autoFocus
                      onClick={e => e.stopPropagation()}
                      onBlur={e => {
                        const val = e.target.value.trim()
                        if (val) setFolders(folders.map(x => x.id === f.id ? { ...x, name: val } : x))
                        setEditFolderId(null)
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        if (e.key === 'Escape') setEditFolderId(null)
                      }}
                    />
                  ) : (
                    <span className="np-folder-name" onDoubleClick={e => { e.stopPropagation(); setEditFolderId(f.id) }}>{f.name}</span>
                  )}
                  <span className="np-folder-count">{f.notes.length} nota{f.notes.length !== 1 ? 's' : ''}</span>
                </div>
                <button className="np-folder-del" onClick={e => delFolder(f.id, e)}>
                  <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              </div>
            ))}
          </div>

          {newFolder ? (
            <div className="np-new-folder">
              <input
                className="np-input"
                placeholder="Nome da pasta..."
                value={nfName}
                onChange={e => setNfName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addFolder()}
                autoFocus
              />
              <div className="np-colors">
                {FOLDER_COLORS.map(c => (
                  <button key={c} className={`np-color${nfColor === c ? ' active' : ''}`} style={{ background: c }} onClick={() => setNfColor(c)} />
                ))}
              </div>
              <div className="np-form-row">
                <button className="btn-ghost" onClick={() => setNewFolder(false)}>Cancelar</button>
                <button className="btn-accent" onClick={addFolder}>Criar Pasta</button>
              </div>
            </div>
          ) : (
            <button className="np-add" onClick={() => setNewFolder(true)}>
              <svg viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Nova Pasta
            </button>
          )}
        </div>
      )}

      {view === 'notes' && folder && (
        <div className="np-body">
          {folder.notes.length === 0
            ? <div className="np-empty"><p>Nenhuma nota nesta pasta</p></div>
            : <div className="np-notes">
                {folder.notes.map(n => (
                  <div key={n.id} className="np-note" onClick={() => { setNoteId(n.id); setDraft({ title: n.title, content: n.content }); setView('edit') }}>
                    <div className="np-note-top">
                      <span className="np-note-title">{n.title}</span>
                      <button className="np-note-del" onClick={e => delNote(n.id, e)}>
                        <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                    <span className="np-note-preview">{n.content ? n.content.substring(0, 70) + (n.content.length > 70 ? '…' : '') : 'Sem conteúdo'}</span>
                    <span className="np-note-date">{formatDate(n.updatedAt)}</span>
                  </div>
                ))}
              </div>
          }
          <button className="np-add" onClick={addNote}>
            <svg viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Nova Nota
          </button>
        </div>
      )}

      {view === 'edit' && draft && (
        <>
          <div className="np-body np-edit">
            <input
              className="np-title-input"
              value={draft.title}
              onChange={e => setDraft({ ...draft, title: e.target.value })}
              placeholder="Título da nota..."
            />
            <textarea
              className="np-content-input"
              value={draft.content}
              onChange={e => setDraft({ ...draft, content: e.target.value })}
              placeholder="Escreva sua nota aqui..."
            />
          </div>
          <div className="np-edit-footer">
            <button className="btn-accent full" onClick={saveNote}>
              <svg viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Salvar Nota
            </button>
          </div>
        </>
      )}
    </div>
  )
}
