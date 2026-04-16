import { useState, useEffect } from 'react'
import './App.css'
import { supabase } from './lib/supabase'
import LoginPage from './LoginPage'
import type { User } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Note {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

interface Folder {
  id: string
  name: string
  color: string
  notes: Note[]
}

type ModalType = 'imovel' | 'carro' | 'produto' | null

// ─── Calculator ───────────────────────────────────────────────────────────────

function Calculator({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState('0')
  const [prev, setPrev] = useState<string | null>(null)
  const [op, setOp] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(false)

  const input = (n: string) => {
    if (waiting) { setDisplay(n); setWaiting(false) }
    else setDisplay(display === '0' ? n : display + n)
  }

  const decimal = () => {
    if (waiting) { setDisplay('0.'); setWaiting(false); return }
    if (!display.includes('.')) setDisplay(display + '.')
  }

  const calc = (a: number, o: string, b: number) => {
    if (o === '+') return a + b
    if (o === '−') return a - b
    if (o === '×') return a * b
    if (o === '÷') return b !== 0 ? a / b : 0
    return b
  }

  const operator = (o: string) => {
    const cur = parseFloat(display)
    if (prev !== null && !waiting) {
      const res = calc(parseFloat(prev), op!, cur)
      const str = parseFloat(res.toFixed(10)).toString()
      setDisplay(str); setPrev(str)
    } else { setPrev(display) }
    setOp(o); setWaiting(true)
  }

  const equals = () => {
    if (prev === null || op === null) return
    const res = calc(parseFloat(prev), op, parseFloat(display))
    const str = parseFloat(res.toFixed(10)).toString()
    setDisplay(str); setPrev(null); setOp(null); setWaiting(true)
  }

  const clear = () => { setDisplay('0'); setPrev(null); setOp(null); setWaiting(false) }
  const sign = () => setDisplay(String(parseFloat(display) * -1))
  const pct = () => setDisplay(String(parseFloat(display) / 100))
  const back = () => display.length > 1 ? setDisplay(display.slice(0, -1)) : setDisplay('0')

  const Btn = ({ label, variant = 'num', wide = false, action }: {
    label: string; variant?: 'num' | 'fn' | 'op' | 'eq'; wide?: boolean; action: () => void
  }) => (
    <button className={`cb cb-${variant}${wide ? ' cb-wide' : ''}`} onClick={action}>{label}</button>
  )

  return (
    <div className="calc-wrap">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-icon calc-icon-header">
            <svg viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="5" y="5" width="10" height="3" rx="1" fill="currentColor" opacity=".6"/>
              <circle cx="6.5" cy="11.5" r="1" fill="currentColor"/>
              <circle cx="10" cy="11.5" r="1" fill="currentColor"/>
              <circle cx="13.5" cy="11.5" r="1" fill="currentColor"/>
              <circle cx="6.5" cy="15" r="1" fill="currentColor"/>
              <circle cx="10" cy="15" r="1" fill="currentColor"/>
              <circle cx="13.5" cy="15" r="1" fill="currentColor"/>
            </svg>
          </div>
          <span>Calculadora</span>
        </div>
        <button className="panel-close" onClick={onClose}>
          <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>
      <div className="calc-display">
        <div className="calc-expr">{prev && op ? `${prev} ${op}` : ''}</div>
        <div className="calc-val">{display.length > 12 ? parseFloat(parseFloat(display).toExponential(4)).toString() : display}</div>
      </div>
      <div className="calc-grid">
        <Btn label="AC" variant="fn" action={clear} />
        <Btn label="+/−" variant="fn" action={sign} />
        <Btn label="%" variant="fn" action={pct} />
        <Btn label="÷" variant="op" action={() => operator('÷')} />

        <Btn label="7" action={() => input('7')} />
        <Btn label="8" action={() => input('8')} />
        <Btn label="9" action={() => input('9')} />
        <Btn label="×" variant="op" action={() => operator('×')} />

        <Btn label="4" action={() => input('4')} />
        <Btn label="5" action={() => input('5')} />
        <Btn label="6" action={() => input('6')} />
        <Btn label="−" variant="op" action={() => operator('−')} />

        <Btn label="1" action={() => input('1')} />
        <Btn label="2" action={() => input('2')} />
        <Btn label="3" action={() => input('3')} />
        <Btn label="+" variant="op" action={() => operator('+')} />

        <Btn label="⌫" action={back} />
        <Btn label="0" action={() => input('0')} />
        <Btn label="." action={decimal} />
        <Btn label="=" variant="eq" action={equals} />
      </div>
    </div>
  )
}

// ─── Notepad ──────────────────────────────────────────────────────────────────

const FOLDER_COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16']

function Notepad({ onClose }: { onClose: () => void }) {
  const [folders, setFolders] = useState<Folder[]>(() => {
    try { return JSON.parse(localStorage.getItem('np-folders') || 'null') || defaultFolders() } catch { return defaultFolders() }
  })
  const [folderId, setFolderId] = useState<string | null>(null)
  const [noteId, setNoteId] = useState<string | null>(null)
  const [draft, setDraft] = useState<{ title: string; content: string } | null>(null)
  const [view, setView] = useState<'folders' | 'notes' | 'edit'>('folders')
  const [newFolder, setNewFolder] = useState(false)
  const [nfName, setNfName] = useState('')
  const [nfColor, setNfColor] = useState(FOLDER_COLORS[0])
  const [editFolderId, setEditFolderId] = useState<string | null>(null)

  useEffect(() => { localStorage.setItem('np-folders', JSON.stringify(folders)) }, [folders])

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

  const saveNote = () => {
    if (!folderId || !noteId || !draft) return
    setFolders(folders.map(f => f.id === folderId
      ? { ...f, notes: f.notes.map(n => n.id === noteId ? { ...n, ...draft, updatedAt: new Date().toISOString() } : n) }
      : f))
    setView('notes')
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
            <button className="back-btn" onClick={() => view === 'edit' ? setView('notes') : setView('folders')}>
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
          <button className="btn-accent full" onClick={saveNote}>
            <svg viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Salvar Nota
          </button>
        </div>
      )}
    </div>
  )
}

function defaultFolders(): Folder[] {
  return [
    { id: '1', name: 'Imóveis', color: '#3b82f6', notes: [] },
    { id: '2', name: 'Veículos', color: '#f59e0b', notes: [] },
    { id: '3', name: 'Produtos', color: '#10b981', notes: [] },
  ]
}

// ─── New Item Modal ───────────────────────────────────────────────────────────

interface FieldDef {
  key: string
  label: string
  type: string
  placeholder?: string
  options?: string[]
}

const MODAL_CONFIG: Record<string, { title: string; icon: React.ReactNode; color: string; fields: FieldDef[] }> = {
  imovel: {
    title: 'Novo Imóvel',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
    color: 'blue',
    fields: [
      { key: 'descricao', label: 'Descrição', type: 'text', placeholder: 'Ex: Apartamento Jardins' },
      { key: 'tipo', label: 'Tipo', type: 'select', options: ['Residencial', 'Comercial', 'Rural', 'Terreno', 'Galpão'] },
      { key: 'valor', label: 'Valor de Compra (R$)', type: 'number', placeholder: '0,00' },
      { key: 'valorAtual', label: 'Valor Atual (R$)', type: 'number', placeholder: '0,00' },
      { key: 'endereco', label: 'Endereço', type: 'text', placeholder: 'Rua, número, cidade' },
      { key: 'area', label: 'Área (m²)', type: 'number', placeholder: '0' },
    ],
  },
  carro: {
    title: 'Novo Veículo',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="1" y="9" width="22" height="11" rx="2"/>
        <path d="M6 9V7a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
        <circle cx="6" cy="20" r="2"/><circle cx="18" cy="20" r="2"/>
      </svg>
    ),
    color: 'amber',
    fields: [
      { key: 'marca', label: 'Marca', type: 'text', placeholder: 'Ex: BMW, Toyota, Fiat' },
      { key: 'modelo', label: 'Modelo', type: 'text', placeholder: 'Ex: X5, Corolla, Pulse' },
      { key: 'ano', label: 'Ano', type: 'number', placeholder: '2024' },
      { key: 'placa', label: 'Placa', type: 'text', placeholder: 'ABC-1234' },
      { key: 'valor', label: 'Valor de Compra (R$)', type: 'number', placeholder: '0,00' },
      { key: 'valorAtual', label: 'Valor Atual (R$)', type: 'number', placeholder: '0,00' },
      { key: 'km', label: 'Quilometragem', type: 'number', placeholder: '0' },
    ],
  },
  produto: {
    title: 'Novo Produto',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
        <line x1="12" y1="22.08" x2="12" y2="12"/>
      </svg>
    ),
    color: 'green',
    fields: [
      { key: 'nome', label: 'Nome do Produto', type: 'text', placeholder: 'Ex: MacBook Pro 14"' },
      { key: 'categoria', label: 'Categoria', type: 'text', placeholder: 'Ex: Eletrônico, Móvel' },
      { key: 'valor', label: 'Valor Unitário (R$)', type: 'number', placeholder: '0,00' },
      { key: 'quantidade', label: 'Quantidade', type: 'number', placeholder: '1' },
      { key: 'fornecedor', label: 'Fornecedor', type: 'text', placeholder: 'Nome do fornecedor' },
      { key: 'descricao', label: 'Descrição', type: 'text', placeholder: 'Detalhes adicionais' },
    ],
  },
}

function NewItemModal({ type, onClose }: { type: ModalType; onClose: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({})
  if (!type) return null
  const cfg = MODAL_CONFIG[type]

  return (
    <div className="overlay" onClick={onClose}>
      <div className={`modal modal-${cfg.color}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className={`modal-icon-wrap icon-${cfg.color}`}>{cfg.icon}</div>
          <h2 className="modal-title">{cfg.title}</h2>
          <button className="panel-close" onClick={onClose}>
            <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-fields">
            {cfg.fields.map(f => (
              <div key={f.key} className="field">
                <label className="field-label">{f.label}</label>
                {f.type === 'select' ? (
                  <select className="field-select" value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })}>
                    <option value="">Selecione...</option>
                    {f.options?.map((o: string) => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input className="field-input" type={f.type} placeholder={f.placeholder} value={form[f.key] || ''} onChange={e => setForm({ ...form, [f.key]: e.target.value })} />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className={`btn-modal btn-${cfg.color}`} onClick={onClose}>
            <svg viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Activity data ────────────────────────────────────────────────────────────

const ACTIVITY = [
  { emoji: '🏠', title: 'Ap. Jardins adicionado', sub: 'Imóvel · R$ 850.000', time: '2h atrás', color: 'blue' },
  { emoji: '🚗', title: 'BMW X5 atualizado', sub: 'Veículo · R$ 290.000', time: '5h atrás', color: 'amber' },
  { emoji: '📦', title: 'Novo lote de produtos', sub: '45 itens · R$ 12.500', time: '1d atrás', color: 'green' },
  { emoji: '🏠', title: 'Casa Alphaville avaliada', sub: 'Imóvel · R$ 1.100.000', time: '2d atrás', color: 'blue' },
]

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [showCalc, setShowCalc] = useState(false)
  const [showNp, setShowNp] = useState(false)
  const [modal, setModal] = useState<ModalType>(null)
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    if (!supabase) { setAuthReady(true); return }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    await supabase?.auth.signOut()
  }

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? ''
  const initials = displayName
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s: string) => s[0].toUpperCase())
    .join('')

  const toggleCalc = () => { setShowCalc(v => !v); setShowNp(false) }
  const toggleNp = () => { setShowNp(v => !v); setShowCalc(false) }

  if (!authReady) return null
  if (supabase && !user) return <LoginPage />

  return (
    <div className="app">
      {/* ── Header ── */}
      <header className="header">
        <div className="header-brand">
          <div className="brand-mark">
            <svg viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="10" fill="url(#bg)"/>
              <path d="M8 22L13 10l5 8 4-5 4 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="bg" x1="0" y1="0" x2="32" y2="32">
                  <stop stopColor="#7c3aed"/>
                  <stop offset="1" stopColor="#4f46e5"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <div className="brand-name">Lion Admin</div>
            <div className="brand-sub">Gestão Financeira</div>
          </div>
        </div>
        <div className="header-right">
          <div className="header-date">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <div className="header-user">
            <div className="header-avatar">{initials || '?'}</div>
            <span className="header-username">{displayName}</span>
            <button className="logout-btn" onClick={handleLogout} title="Sair">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M13 15l3-5-3-5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 10H7" strokeLinecap="round"/>
                <path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        {/* ── Summary Cards ── */}
        <section className="cards">
          {[
            {
              label: 'Patrimônio Total', value: 'R$ 2.847.500', change: '+12,4%', pos: true, color: 'purple',
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            },
            {
              label: 'Imóveis', value: 'R$ 1.950.000', change: '3 ativos', pos: true, color: 'blue',
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            },
            {
              label: 'Veículos', value: 'R$ 387.500', change: '2 veículos', pos: false, color: 'amber',
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="9" width="22" height="11" rx="2"/><path d="M6 9V7a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="6" cy="20" r="2"/><circle cx="18" cy="20" r="2"/></svg>
            },
            {
              label: 'Produtos', value: 'R$ 510.000', change: '+8,2%', pos: true, color: 'green',
              icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
            },
          ].map(c => (
            <div key={c.label} className={`card card-${c.color}`}>
              <div className={`card-icon-wrap ci-${c.color}`}>{c.icon}</div>
              <div className="card-body">
                <span className="card-label">{c.label}</span>
                <span className="card-value">{c.value}</span>
                <span className={`card-change${c.pos ? ' pos' : ''}`}>{c.pos ? '↑ ' : ''}{c.change}</span>
              </div>
            </div>
          ))}
        </section>

        <div className="content-grid">
          {/* ── Quick Actions ── */}
          <section className="section">
            <div className="section-header">
              <h2 className="section-title">Adicionar Ativo</h2>
            </div>
            <div className="actions">
              <button className="action action-blue" onClick={() => setModal('imovel')}>
                <div className="action-icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                </div>
                <div className="action-body">
                  <span className="action-title">Novo Imóvel</span>
                  <span className="action-sub">Casas, aptos, terrenos</span>
                </div>
                <svg className="action-arrow" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>

              <button className="action action-amber" onClick={() => setModal('carro')}>
                <div className="action-icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="1" y="9" width="22" height="11" rx="2"/>
                    <path d="M6 9V7a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                    <circle cx="6" cy="20" r="2"/><circle cx="18" cy="20" r="2"/>
                  </svg>
                </div>
                <div className="action-body">
                  <span className="action-title">Novo Carro</span>
                  <span className="action-sub">Veículos e frota</span>
                </div>
                <svg className="action-arrow" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>

              <button className="action action-green" onClick={() => setModal('produto')}>
                <div className="action-icon-wrap">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                    <line x1="12" y1="22.08" x2="12" y2="12"/>
                  </svg>
                </div>
                <div className="action-body">
                  <span className="action-title">Novo Produto</span>
                  <span className="action-sub">Estoque e inventário</span>
                </div>
                <svg className="action-arrow" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            </div>
          </section>

          {/* ── Recent Activity ── */}
          <section className="section">
            <div className="section-header">
              <h2 className="section-title">Atividade Recente</h2>
              <button className="see-all">Ver todas</button>
            </div>
            <div className="activity">
              {ACTIVITY.map((a, i) => (
                <div key={i} className={`act-item act-${a.color}`}>
                  <div className="act-emoji">{a.emoji}</div>
                  <div className="act-body">
                    <span className="act-title">{a.title}</span>
                    <span className="act-sub">{a.sub}</span>
                  </div>
                  <span className="act-time">{a.time}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>

      {/* ── Floating Buttons ── */}
      <div className="floats">
        <button className={`float-btn float-np${showNp ? ' float-active' : ''}`} onClick={toggleNp} title="Bloco de Notas">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="8" y1="13" x2="16" y2="13"/>
            <line x1="8" y1="17" x2="13" y2="17"/>
          </svg>
        </button>
        <button className={`float-btn float-calc${showCalc ? ' float-active' : ''}`} onClick={toggleCalc} title="Calculadora">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="4" y="2" width="16" height="20" rx="3"/>
            <rect x="7" y="5" width="10" height="4" rx="1" fill="currentColor" opacity=".3" stroke="none"/>
            <circle cx="8.5" cy="13" r=".8" fill="currentColor" stroke="none"/>
            <circle cx="12" cy="13" r=".8" fill="currentColor" stroke="none"/>
            <circle cx="15.5" cy="13" r=".8" fill="currentColor" stroke="none"/>
            <circle cx="8.5" cy="17" r=".8" fill="currentColor" stroke="none"/>
            <circle cx="12" cy="17" r=".8" fill="currentColor" stroke="none"/>
            <circle cx="15.5" cy="17" r=".8" fill="currentColor" stroke="none"/>
          </svg>
        </button>
      </div>

      {/* ── Panels ── */}
      <div className={`float-panel panel-np${showNp ? ' panel-open' : ''}`}>
        <Notepad onClose={() => setShowNp(false)} />
      </div>
      <div className={`float-panel panel-calc${showCalc ? ' panel-open' : ''}`}>
        <Calculator onClose={() => setShowCalc(false)} />
      </div>

      {/* ── Modals ── */}
      {modal && <NewItemModal type={modal} onClose={() => setModal(null)} />}
    </div>
  )
}
