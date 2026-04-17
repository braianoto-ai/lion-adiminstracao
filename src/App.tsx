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

// ─── Finance Panel ────────────────────────────────────────────────────────────

type TxType = 'receita' | 'despesa'

interface Transaction {
  id: string
  type: TxType
  category: string
  description: string
  amount: number
  date: string
}

const TX_CATEGORIES = {
  receita: ['Salário', 'Aluguel recebido', 'Dividendos', 'Freelance', 'Vendas', 'Outros'],
  despesa: ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Impostos', 'Outros'],
}

function FinancePanel({ onClose }: { onClose: () => void }) {
  const [txs, setTxs] = useState<Transaction[]>(() => {
    try { return JSON.parse(localStorage.getItem('lion-txs') || '[]') } catch { return [] }
  })
  const [view, setView] = useState<'overview' | 'list' | 'add'>('overview')
  const [filter, setFilter] = useState<'all' | TxType>('all')
  const [form, setForm] = useState({
    type: 'receita' as TxType,
    category: TX_CATEGORIES.receita[0],
    description: '',
    amount: '',
    date: new Date().toISOString().slice(0, 7),
  })

  useEffect(() => { localStorage.setItem('lion-txs', JSON.stringify(txs)) }, [txs])

  function addTx(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || !form.description.trim()) return
    const tx: Transaction = {
      id: Date.now().toString(),
      type: form.type,
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount),
      date: form.date,
    }
    setTxs([tx, ...txs])
    setForm(f => ({ ...f, description: '', amount: '' }))
    setView('overview')
  }

  function delTx(id: string) { setTxs(txs.filter(t => t.id !== id)) }

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

  const totalReceitas = txs.reduce((s, t) => t.type === 'receita' ? s + t.amount : s, 0)
  const totalDespesas = txs.reduce((s, t) => t.type === 'despesa' ? s + t.amount : s, 0)
  const saldo = totalReceitas - totalDespesas

  const maxVal = Math.max(...monthData.flatMap(m => [m.receitas, m.despesas]), 1)
  const fmtCurr = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const filtered = filter === 'all' ? txs : txs.filter(t => t.type === filter)

  const chartH = 100
  const barW = 14
  const gap = 3
  const groupW = barW * 2 + gap + 14

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
          <button className={`fin-tab fin-tab-add${view === 'add' ? ' fin-tab-active' : ''}`} onClick={() => setView('add')}>+ Novo</button>
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
                      <span className="fin-item-desc">{tx.description}</span>
                      <span className="fin-item-meta">{tx.category} · {new Date(tx.date + '-02').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</span>
                    </div>
                    <span className={`fin-item-amt ${tx.type === 'receita' ? 'fin-amt-green' : 'fin-amt-red'}`}>
                      {tx.type === 'receita' ? '+' : '-'}{fmtCurr(tx.amount)}
                    </span>
                    <button className="fin-del" onClick={() => delTx(tx.id)}>
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
            <div className="fin-type-toggle">
              <button type="button" className={`fin-type-btn${form.type === 'receita' ? ' fin-type-green' : ''}`}
                onClick={() => setForm(f => ({ ...f, type: 'receita', category: TX_CATEGORIES.receita[0] }))}>↑ Receita</button>
              <button type="button" className={`fin-type-btn${form.type === 'despesa' ? ' fin-type-red' : ''}`}
                onClick={() => setForm(f => ({ ...f, type: 'despesa', category: TX_CATEGORIES.despesa[0] }))}>↓ Despesa</button>
            </div>
            <div className="fin-field">
              <label>Descrição</label>
              <input type="text" placeholder="Ex: Salário julho" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
            </div>
            <div className="fin-row">
              <div className="fin-field">
                <label>Valor (R$)</label>
                <input type="number" step="0.01" min="0.01" placeholder="0,00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="fin-field">
                <label>Mês</label>
                <input type="month" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
            </div>
            <div className="fin-field">
              <label>Categoria</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {TX_CATEGORIES[form.type].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <button type="submit" className={`fin-submit ${form.type === 'receita' ? 'fin-submit-green' : 'fin-submit-red'}`}>
              Adicionar {form.type === 'receita' ? 'Receita' : 'Despesa'}
            </button>
          </form>
        </div>
      )}
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

const GOAL_CATEGORIES: Record<string, { label: string; color: string }> = {
  imovel:    { label: 'Imóvel',     color: 'blue'   },
  veiculo:   { label: 'Veículo',    color: 'amber'  },
  reserva:   { label: 'Reserva',    color: 'green'  },
  viagem:    { label: 'Viagem',     color: 'purple' },
  educacao:  { label: 'Educação',   color: 'blue'   },
  outros:    { label: 'Outros',     color: 'purple' },
}

const GOAL_FORM_INIT = { name: '', category: 'reserva', target: '', current: '', deadline: '' }

function GoalsSection() {
  const [goals, setGoals] = useState<Goal[]>(() => {
    try { return JSON.parse(localStorage.getItem('lion-goals') || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(GOAL_FORM_INIT)
  const [editId, setEditId] = useState<string | null>(null)

  useEffect(() => { localStorage.setItem('lion-goals', JSON.stringify(goals)) }, [goals])

  function saveGoal(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.target) return
    const g: Goal = {
      id: editId || Date.now().toString(),
      name: form.name,
      category: form.category,
      target: parseFloat(form.target),
      current: parseFloat(form.current || '0'),
      deadline: form.deadline,
    }
    setGoals(prev => editId ? prev.map(x => x.id === editId ? g : x) : [...prev, g])
    setForm(GOAL_FORM_INIT)
    setShowForm(false)
    setEditId(null)
  }

  function startEdit(g: Goal) {
    setForm({ name: g.name, category: g.category, target: String(g.target), current: String(g.current), deadline: g.deadline })
    setEditId(g.id)
    setShowForm(true)
  }

  function delGoal(id: string) { setGoals(prev => prev.filter(g => g.id !== id)) }

  const fmtCurr = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  function progressColor(pct: number) {
    if (pct >= 100) return 'goal-bar-done'
    if (pct >= 66)  return 'goal-bar-green'
    if (pct >= 33)  return 'goal-bar-amber'
    return 'goal-bar-red'
  }

  return (
    <section className="goals-section">
      <div className="goals-header">
        <div>
          <h2 className="section-title">Metas de Patrimônio</h2>
          <span className="goals-sub">{goals.length} meta{goals.length !== 1 ? 's' : ''} ativas</span>
        </div>
        <button className="goals-add-btn" onClick={() => { setShowForm(v => !v); setEditId(null); setForm(GOAL_FORM_INIT) }}>
          {showForm && !editId ? '✕ Cancelar' : '+ Nova Meta'}
        </button>
      </div>

      {showForm && (
        <form className="goal-form" onSubmit={saveGoal}>
          <div className="goal-form-grid">
            <div className="fin-field goal-span2">
              <label>Nome da meta</label>
              <input type="text" placeholder="Ex: Entrada apartamento" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="fin-field">
              <label>Categoria</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {Object.entries(GOAL_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div className="fin-field">
              <label>Prazo (opcional)</label>
              <input type="month" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            </div>
            <div className="fin-field">
              <label>Valor alvo (R$)</label>
              <input type="number" step="0.01" min="1" placeholder="0,00" value={form.target} onChange={e => setForm(f => ({ ...f, target: e.target.value }))} required />
            </div>
            <div className="fin-field">
              <label>Valor atual (R$)</label>
              <input type="number" step="0.01" min="0" placeholder="0,00" value={form.current} onChange={e => setForm(f => ({ ...f, current: e.target.value }))} />
            </div>
          </div>
          <div className="goal-form-actions">
            <button type="button" className="btn-ghost" onClick={() => { setShowForm(false); setEditId(null); setForm(GOAL_FORM_INIT) }}>Cancelar</button>
            <button type="submit" className="btn-accent">{editId ? 'Salvar alterações' : 'Criar meta'}</button>
          </div>
        </form>
      )}

      {goals.length === 0 && !showForm ? (
        <div className="goals-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
          <p>Nenhuma meta cadastrada ainda.</p>
          <span>Defina objetivos financeiros e acompanhe seu progresso.</span>
        </div>
      ) : (
        <div className="goals-grid">
          {goals.map(g => {
            const pct = Math.min((g.current / g.target) * 100, 100)
            const cat = GOAL_CATEGORIES[g.category] || GOAL_CATEGORIES.outros
            const daysLeft = g.deadline
              ? Math.ceil((new Date(g.deadline + '-28').getTime() - Date.now()) / 86400000)
              : null
            return (
              <div key={g.id} className={`goal-card goal-card-${cat.color}`}>
                <div className="goal-card-top">
                  <div>
                    <span className={`goal-badge goal-badge-${cat.color}`}>{cat.label}</span>
                    <h3 className="goal-name">{g.name}</h3>
                  </div>
                  <div className="goal-actions">
                    <button className="goal-action-btn" onClick={() => startEdit(g)} title="Editar">
                      <svg viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                    </button>
                    <button className="goal-action-btn goal-del-btn" onClick={() => delGoal(g.id)} title="Remover">
                      <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                </div>

                <div className="goal-values">
                  <span className="goal-current">{fmtCurr(g.current)}</span>
                  <span className="goal-sep">/</span>
                  <span className="goal-target">{fmtCurr(g.target)}</span>
                </div>

                <div className="goal-bar-track">
                  <div className={`goal-bar-fill ${progressColor(pct)}`} style={{ width: `${pct}%` }} />
                </div>

                <div className="goal-footer">
                  <span className={`goal-pct ${pct >= 100 ? 'goal-pct-done' : ''}`}>
                    {pct >= 100 ? '✓ Concluída!' : `${pct.toFixed(1)}%`}
                  </span>
                  {daysLeft !== null && (
                    <span className={`goal-deadline ${daysLeft < 30 ? 'goal-deadline-warn' : ''}`}>
                      {daysLeft > 0 ? `${daysLeft}d restantes` : 'Prazo vencido'}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ─── Financing Simulator ─────────────────────────────────────────────────────

function FinancingSimulator({ onClose }: { onClose: () => void }) {
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
                  {preview.map((row, i) =>
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

// ─── Patrimony Chart Section ──────────────────────────────────────────────────

function PatrimonySection() {
  const txs: Transaction[] = (() => {
    try { return JSON.parse(localStorage.getItem('lion-txs') || '[]') } catch { return [] }
  })()
  const goals: Goal[] = (() => {
    try { return JSON.parse(localStorage.getItem('lion-goals') || '[]') } catch { return [] }
  })()

  const [, forceRender] = useState(0)
  useEffect(() => {
    const handler = () => forceRender(n => n + 1)
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
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
        <div>
          <h2 className="section-title">Evolução do Patrimônio</h2>
          <span className="goals-sub">{points.length} meses · saldo acumulado</span>
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

      <div className="pat-chart-wrap">
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
      </div>
    </section>
  )
}

// ─── Rentals Section ─────────────────────────────────────────────────────────

interface Rental {
  id: string
  property: string
  tenant: string
  phone: string
  value: number
  dueDay: number
  startDate: string
  notes: string
  payments: Record<string, 'pago' | 'pendente' | 'atrasado'>
}

const RENTAL_FORM_INIT = { property: '', tenant: '', phone: '', value: '', dueDay: '5', startDate: '', notes: '' }

function RentalsSection() {
  const [rentals, setRentals] = useState<Rental[]>(() => {
    try { return JSON.parse(localStorage.getItem('lion-rentals') || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(RENTAL_FORM_INIT)
  const [editId, setEditId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => { localStorage.setItem('lion-rentals', JSON.stringify(rentals)) }, [rentals])

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  function saveRental(e: React.FormEvent) {
    e.preventDefault()
    if (!form.property.trim() || !form.tenant.trim() || !form.value) return
    const r: Rental = {
      id: editId || Date.now().toString(),
      property: form.property,
      tenant: form.tenant,
      phone: form.phone,
      value: parseFloat(form.value),
      dueDay: parseInt(form.dueDay) || 5,
      startDate: form.startDate,
      notes: form.notes,
      payments: editId ? (rentals.find(x => x.id === editId)?.payments ?? {}) : {},
    }
    setRentals(prev => editId ? prev.map(x => x.id === editId ? r : x) : [...prev, r])
    setForm(RENTAL_FORM_INIT); setShowForm(false); setEditId(null)
  }

  function startEdit(r: Rental) {
    setForm({ property: r.property, tenant: r.tenant, phone: r.phone, value: String(r.value), dueDay: String(r.dueDay), startDate: r.startDate, notes: r.notes })
    setEditId(r.id); setShowForm(true)
  }

  function delRental(id: string) { setRentals(prev => prev.filter(r => r.id !== id)) }

  function togglePayment(id: string, month: string) {
    setRentals(prev => prev.map(r => {
      if (r.id !== id) return r
      const cur = r.payments[month]
      return { ...r, payments: { ...r.payments, [month]: cur === 'pago' ? 'pendente' : 'pago' } }
    }))
  }

  function getMonthStatus(r: Rental, month: string): 'pago' | 'atrasado' | 'pendente' {
    if (r.payments[month] === 'pago') return 'pago'
    const [y, m] = month.split('-').map(Number)
    const due = new Date(y, m - 1, r.dueDay)
    return due < new Date() ? 'atrasado' : 'pendente'
  }

  const now = new Date()
  const last6Months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return d.toISOString().slice(0, 7)
  })

  const fmtCurr = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const fmtMonth = (m: string) => new Date(m + '-02').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })

  const totalMonthly = rentals.reduce((s, r) => s + r.value, 0)
  const curMonth = now.toISOString().slice(0, 7)
  const paidThisMonth = rentals.filter(r => r.payments[curMonth] === 'pago').length
  const overdueCount = rentals.filter(r => getMonthStatus(r, curMonth) === 'atrasado').length

  return (
    <section className="rentals-section">
      <div className="goals-header">
        <div>
          <h2 className="section-title">Controle de Aluguéis</h2>
          <span className="goals-sub">
            {rentals.length} imóvel{rentals.length !== 1 ? 'is' : ''} · {fmtCurr(totalMonthly)}/mês
            {overdueCount > 0 && <span className="rentals-overdue-badge">{overdueCount} atrasado{overdueCount > 1 ? 's' : ''}</span>}
          </span>
        </div>
        <button className="goals-add-btn" onClick={() => { setShowForm(v => !v); setEditId(null); setForm(RENTAL_FORM_INIT) }}>
          {showForm && !editId ? '✕ Cancelar' : '+ Novo Aluguel'}
        </button>
      </div>

      {showForm && (
        <form className="goal-form" onSubmit={saveRental}>
          <div className="goal-form-grid rentals-form-grid">
            <div className="fin-field goal-span2">
              <label>Imóvel</label>
              <input type="text" placeholder="Ex: Ap. Jardins - Rua das Flores 123" value={form.property} onChange={e => f('property', e.target.value)} required />
            </div>
            <div className="fin-field">
              <label>Inquilino</label>
              <input type="text" placeholder="Nome completo" value={form.tenant} onChange={e => f('tenant', e.target.value)} required />
            </div>
            <div className="fin-field">
              <label>Telefone</label>
              <input type="text" placeholder="(11) 99999-9999" value={form.phone} onChange={e => f('phone', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Valor do aluguel (R$)</label>
              <input type="number" step="0.01" min="1" placeholder="0,00" value={form.value} onChange={e => f('value', e.target.value)} required />
            </div>
            <div className="fin-field">
              <label>Dia do vencimento</label>
              <input type="number" min="1" max="31" value={form.dueDay} onChange={e => f('dueDay', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Início do contrato</label>
              <input type="month" value={form.startDate} onChange={e => f('startDate', e.target.value)} />
            </div>
            <div className="fin-field goal-span2">
              <label>Observações</label>
              <input type="text" placeholder="Ex: Reajuste anual pelo IGP-M" value={form.notes} onChange={e => f('notes', e.target.value)} />
            </div>
          </div>
          <div className="goal-form-actions">
            <button type="button" className="btn-ghost" onClick={() => { setShowForm(false); setEditId(null); setForm(RENTAL_FORM_INIT) }}>Cancelar</button>
            <button type="submit" className="btn-accent">{editId ? 'Salvar alterações' : 'Cadastrar'}</button>
          </div>
        </form>
      )}

      {rentals.length === 0 && !showForm ? (
        <div className="goals-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <p>Nenhum aluguel cadastrado ainda.</p>
          <span>Cadastre seus imóveis alugados para acompanhar os pagamentos.</span>
        </div>
      ) : (
        <div className="rentals-list">
          {rentals.map(r => {
            const thisStatus = getMonthStatus(r, curMonth)
            const isExpanded = expandedId === r.id
            const paidCount = last6Months.filter(m => r.payments[m] === 'pago').length
            return (
              <div key={r.id} className={`rental-card${isExpanded ? ' rental-expanded' : ''}`}>
                <div className="rental-card-main" onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                  <div className="rental-left">
                    <div className={`rental-status-dot dot-${thisStatus}`} />
                    <div>
                      <div className="rental-property">{r.property}</div>
                      <div className="rental-meta">
                        {r.tenant}{r.phone ? ` · ${r.phone}` : ''} · vence dia {r.dueDay}
                      </div>
                    </div>
                  </div>
                  <div className="rental-right">
                    <span className="rental-value">{fmtCurr(r.value)}</span>
                    <span className={`rental-status-badge badge-${thisStatus}`}>
                      {thisStatus === 'pago' ? '✓ Pago' : thisStatus === 'atrasado' ? '⚠ Atrasado' : '○ Pendente'}
                    </span>
                    <div className="rental-actions">
                      <button className="goal-action-btn" onClick={e => { e.stopPropagation(); startEdit(r) }}>
                        <svg viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                      </button>
                      <button className="goal-action-btn goal-del-btn" onClick={e => { e.stopPropagation(); delRental(r.id) }}>
                        <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </button>
                    </div>
                    <svg className={`rental-chevron${isExpanded ? ' expanded' : ''}`} viewBox="0 0 16 16" fill="none">
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>

                {isExpanded && (
                  <div className="rental-history">
                    <div className="rental-history-header">
                      <span>Histórico de pagamentos</span>
                      <span className="rental-history-sub">{paidCount}/{last6Months.length} pagos nos últimos 6 meses</span>
                    </div>
                    <div className="rental-months">
                      {last6Months.map(month => {
                        const status = getMonthStatus(r, month)
                        return (
                          <button key={month} className={`rental-month-btn month-${status}`} onClick={() => togglePayment(r.id, month)}>
                            <span className="rental-month-label">{fmtMonth(month)}</span>
                            <span className="rental-month-status">
                              {status === 'pago' ? '✓' : status === 'atrasado' ? '⚠' : '○'}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                    {r.notes && <p className="rental-notes">{r.notes}</p>}
                  </div>
                )}
              </div>
            )
          })}

          <div className="rentals-summary">
            <span>Total recebido este mês:</span>
            <strong>{fmtCurr(rentals.filter(r => r.payments[curMonth] === 'pago').reduce((s, r) => s + r.value, 0))}</strong>
            <span className="rentals-summary-sep">·</span>
            <span>{paidThisMonth}/{rentals.length} pagos</span>
          </div>
        </div>
      )}
    </section>
  )
}

// ─── Maintenance Section ──────────────────────────────────────────────────────

interface Maintenance {
  id: string
  asset: string
  type: string
  description: string
  scheduledDate: string
  doneDate: string
  status: 'pendente' | 'feito' | 'atrasado'
  cost: string
  notes: string
}

const MAINT_TYPES = ['Revisão geral', 'Elétrica', 'Hidráulica', 'Pintura', 'Telhado', 'Jardim', 'Limpeza', 'IPTU/taxas', 'Seguro', 'Troca de óleo', 'Pneus', 'Outros']
const MAINT_FORM_INIT = { asset: '', type: MAINT_TYPES[0], description: '', scheduledDate: '', doneDate: '', cost: '', notes: '' }

function MaintenanceSection() {
  const [items, setItems] = useState<Maintenance[]>(() => {
    try { return JSON.parse(localStorage.getItem('lion-maintenance') || '[]') } catch { return [] }
  })
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(MAINT_FORM_INIT)
  const [editId, setEditId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'todos' | 'pendente' | 'atrasado' | 'feito'>('todos')

  useEffect(() => { localStorage.setItem('lion-maintenance', JSON.stringify(items)) }, [items])

  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  function computeStatus(m: Maintenance): Maintenance['status'] {
    if (m.status === 'feito') return 'feito'
    if (!m.scheduledDate) return 'pendente'
    return new Date(m.scheduledDate) < new Date(new Date().toDateString()) ? 'atrasado' : 'pendente'
  }

  function saveItem(e: React.FormEvent) {
    e.preventDefault()
    if (!form.asset.trim() || !form.scheduledDate) return
    const base: Maintenance = {
      id: editId || Date.now().toString(),
      asset: form.asset, type: form.type, description: form.description,
      scheduledDate: form.scheduledDate, doneDate: form.doneDate,
      status: form.doneDate ? 'feito' : 'pendente',
      cost: form.cost, notes: form.notes,
    }
    const item = { ...base, status: computeStatus(base) }
    setItems(prev => editId ? prev.map(x => x.id === editId ? item : x) : [...prev, item])
    setForm(MAINT_FORM_INIT); setShowForm(false); setEditId(null)
  }

  function markDone(id: string) {
    setItems(prev => prev.map(m => m.id === id ? { ...m, status: 'feito', doneDate: new Date().toISOString().slice(0, 10) } : m))
  }

  function delItem(id: string) { setItems(prev => prev.filter(m => m.id !== id)) }

  function startEdit(m: Maintenance) {
    setForm({ asset: m.asset, type: m.type, description: m.description, scheduledDate: m.scheduledDate, doneDate: m.doneDate, cost: m.cost, notes: m.notes })
    setEditId(m.id); setShowForm(true)
  }

  const withStatus = items.map(m => ({ ...m, status: computeStatus(m) }))
  const overdueCount = withStatus.filter(m => m.status === 'atrasado').length
  const soonCount = withStatus.filter(m => {
    if (m.status !== 'pendente' || !m.scheduledDate) return false
    const diff = (new Date(m.scheduledDate).getTime() - Date.now()) / 86400000
    return diff >= 0 && diff <= 7
  }).length

  const filtered = filter === 'todos' ? withStatus : withStatus.filter(m => m.status === filter)
  const sorted = [...filtered].sort((a, b) => {
    if (a.status === 'atrasado' && b.status !== 'atrasado') return -1
    if (b.status === 'atrasado' && a.status !== 'atrasado') return 1
    return (a.scheduledDate || '').localeCompare(b.scheduledDate || '')
  })

  const fmtDate = (d: string) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
  const fmtCurr = (v: string) => v ? parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''

  function daysLabel(m: Maintenance) {
    if (!m.scheduledDate || m.status === 'feito') return null
    const diff = Math.ceil((new Date(m.scheduledDate).getTime() - Date.now()) / 86400000)
    if (diff < 0) return { text: `${Math.abs(diff)}d atrasado`, cls: 'maint-days-late' }
    if (diff === 0) return { text: 'Hoje!', cls: 'maint-days-today' }
    if (diff <= 7) return { text: `em ${diff}d`, cls: 'maint-days-soon' }
    return { text: `em ${diff}d`, cls: 'maint-days-ok' }
  }

  return (
    <section className="maint-section">
      <div className="goals-header">
        <div>
          <h2 className="section-title">Agenda de Manutenções</h2>
          <span className="goals-sub">
            {items.length} item{items.length !== 1 ? 'ns' : ''}
            {overdueCount > 0 && <span className="rentals-overdue-badge">{overdueCount} atrasado{overdueCount > 1 ? 's' : ''}</span>}
            {soonCount > 0 && <span className="maint-soon-badge">{soonCount} esta semana</span>}
          </span>
        </div>
        <button className="goals-add-btn" onClick={() => { setShowForm(v => !v); setEditId(null); setForm(MAINT_FORM_INIT) }}>
          {showForm && !editId ? '✕ Cancelar' : '+ Nova Manutenção'}
        </button>
      </div>

      {showForm && (
        <form className="goal-form" onSubmit={saveItem}>
          <div className="goal-form-grid">
            <div className="fin-field goal-span2">
              <label>Imóvel / Veículo</label>
              <input type="text" placeholder="Ex: Casa da Praia / BMW X5" value={form.asset} onChange={e => f('asset', e.target.value)} required />
            </div>
            <div className="fin-field">
              <label>Tipo</label>
              <select value={form.type} onChange={e => f('type', e.target.value)}>
                {MAINT_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="fin-field">
              <label>Descrição</label>
              <input type="text" placeholder="Detalhes adicionais" value={form.description} onChange={e => f('description', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Data prevista</label>
              <input type="date" value={form.scheduledDate} onChange={e => f('scheduledDate', e.target.value)} required />
            </div>
            <div className="fin-field">
              <label>Custo estimado (R$)</label>
              <input type="number" step="0.01" placeholder="0,00" value={form.cost} onChange={e => f('cost', e.target.value)} />
            </div>
            <div className="fin-field goal-span2">
              <label>Observações</label>
              <input type="text" placeholder="Ex: Contatar técnico João - (11) 99999-9999" value={form.notes} onChange={e => f('notes', e.target.value)} />
            </div>
          </div>
          <div className="goal-form-actions">
            <button type="button" className="btn-ghost" onClick={() => { setShowForm(false); setEditId(null); setForm(MAINT_FORM_INIT) }}>Cancelar</button>
            <button type="submit" className="btn-accent">{editId ? 'Salvar' : 'Agendar'}</button>
          </div>
        </form>
      )}

      {items.length > 0 && (
        <div className="fin-filters" style={{ marginBottom: 12 }}>
          {(['todos', 'atrasado', 'pendente', 'feito'] as const).map(s => (
            <button key={s} className={`fin-chip${filter === s ? ' fin-chip-active' : ''}${s === 'atrasado' ? ' fin-chip-red' : s === 'feito' ? ' fin-chip-green' : ''}`}
              onClick={() => setFilter(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)} ({s === 'todos' ? withStatus.length : withStatus.filter(m => m.status === s).length})
            </button>
          ))}
        </div>
      )}

      {items.length === 0 && !showForm ? (
        <div className="goals-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>
          <p>Nenhuma manutenção agendada.</p>
          <span>Agende manutenções para imóveis e veículos e receba alertas.</span>
        </div>
      ) : (
        <div className="maint-list">
          {sorted.map(m => {
            const days = daysLabel(m)
            return (
              <div key={m.id} className={`maint-item maint-${m.status}`}>
                <div className={`maint-icon-col maint-icon-${m.status}`}>
                  {m.status === 'feito'
                    ? <svg viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                    : m.status === 'atrasado'
                    ? <svg viewBox="0 0 16 16" fill="none"><path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/></svg>
                    : <svg viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4"/><path d="M8 5v3.5L10.5 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                  }
                </div>
                <div className="maint-body">
                  <div className="maint-top">
                    <span className="maint-asset">{m.asset}</span>
                    <span className="maint-type-badge">{m.type}</span>
                  </div>
                  {m.description && <span className="maint-desc">{m.description}</span>}
                  <div className="maint-meta">
                    <span>{m.status === 'feito' ? `Feito em ${fmtDate(m.doneDate)}` : `Previsto: ${fmtDate(m.scheduledDate)}`}</span>
                    {m.cost && <span>· {fmtCurr(m.cost)}</span>}
                    {m.notes && <span className="maint-notes-inline">· {m.notes}</span>}
                  </div>
                </div>
                <div className="maint-right">
                  {days && <span className={`maint-days ${days.cls}`}>{days.text}</span>}
                  <div className="goal-actions">
                    {m.status !== 'feito' && (
                      <button className="goal-action-btn maint-done-btn" onClick={() => markDone(m.id)} title="Marcar como feito">
                        <svg viewBox="0 0 16 16" fill="none"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                      </button>
                    )}
                    <button className="goal-action-btn" onClick={() => startEdit(m)}>
                      <svg viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                    </button>
                    <button className="goal-action-btn goal-del-btn" onClick={() => delItem(m.id)}>
                      <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

// ─── Documents Panel ─────────────────────────────────────────────────────────

interface DocMeta {
  id: string
  name: string
  category: string
  asset: string
  notes: string
  fileUrl: string
  fileName: string
  createdAt: string
}

const DOC_CATEGORIES = ['Escritura', 'IPTU', 'Contrato', 'Seguro', 'Planta', 'Comprovante', 'Laudo', 'Outros']
const BUCKET = 'lion-docs'

function DocumentsPanel({ onClose }: { onClose: () => void }) {
  const [docs, setDocs] = useState<DocMeta[]>(() => {
    try { return JSON.parse(localStorage.getItem('lion-docs-meta') || '[]') } catch { return [] }
  })
  const [view, setView] = useState<'list' | 'upload'>('list')
  const [form, setForm] = useState({ name: '', category: DOC_CATEGORIES[0], asset: '', notes: '' })
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [filterCat, setFilterCat] = useState('Todos')

  useEffect(() => { localStorage.setItem('lion-docs-meta', JSON.stringify(docs)) }, [docs])

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
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false })
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

  const iconForCat: Record<string, string> = {
    Escritura: '📜', IPTU: '🏛️', Contrato: '📋', Seguro: '🛡️',
    Planta: '📐', Comprovante: '🧾', Laudo: '🔍', Outros: '📄',
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
                    <div className="doc-icon-emoji">{iconForCat[doc.category] || '📄'}</div>
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

// ─── Vehicle History Section ──────────────────────────────────────────────────

interface Vehicle {
  id: string
  name: string
  plate: string
  year: string
  currentKm: number
  nextRevisionKm: number
  nextRevisionDate: string
  notes: string
  ipvaExpiry: string
  insuranceExpiry: string
}

interface Revision {
  id: string
  vehicleId: string
  date: string
  km: number
  type: string
  description: string
  cost: string
  shop: string
}

const REVISION_TYPES = ['Revisão geral', 'Troca de óleo', 'Pneus', 'Freios', 'Correia dentada', 'Filtros', 'Suspensão', 'Elétrica', 'Outros']
const VEH_FORM_INIT = { name: '', plate: '', year: '', currentKm: '', nextRevisionKm: '', nextRevisionDate: '', notes: '', ipvaExpiry: '', insuranceExpiry: '' }
const REV_FORM_INIT = { vehicleId: '', date: new Date().toISOString().slice(0, 10), km: '', type: REVISION_TYPES[0], description: '', cost: '', shop: '' }

function VehicleHistorySection() {
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    try { return JSON.parse(localStorage.getItem('lion-vehicles') || '[]') } catch { return [] }
  })
  const [revisions, setRevisions] = useState<Revision[]>(() => {
    try { return JSON.parse(localStorage.getItem('lion-revisions') || '[]') } catch { return [] }
  })
  const [showVehForm, setShowVehForm] = useState(false)
  const [showRevForm, setShowRevForm] = useState(false)
  const [vehForm, setVehForm] = useState(VEH_FORM_INIT)
  const [revForm, setRevForm] = useState(REV_FORM_INIT)
  const [editVehId, setEditVehId] = useState<string | null>(null)
  const [expandedVehId, setExpandedVehId] = useState<string | null>(null)

  useEffect(() => { localStorage.setItem('lion-vehicles', JSON.stringify(vehicles)) }, [vehicles])
  useEffect(() => { localStorage.setItem('lion-revisions', JSON.stringify(revisions)) }, [revisions])

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

  return (
    <section className="veh-section">
      <div className="goals-header">
        <div>
          <h2 className="section-title">Histórico de Veículos</h2>
          <span className="goals-sub">
            {vehicles.length} veículo{vehicles.length !== 1 ? 's' : ''}
            {alertCount > 0 && <span className="rentals-overdue-badge">{alertCount} alerta{alertCount > 1 ? 's' : ''}</span>}
          </span>
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
                  <div className="veh-icon">🚗</div>
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
                                {r.shop && <span className="veh-rev-shop">🔧 {r.shop}</span>}
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
    </section>
  )
}

// ─── Alerts Panel ────────────────────────────────────────────────────────────

interface AppAlert {
  id: string
  severity: 'danger' | 'warning'
  category: string
  title: string
  detail: string
}

function buildAlerts(): AppAlert[] {
  const alerts: AppAlert[] = []
  const now = Date.now()

  const vehicles: Vehicle[] = (() => { try { return JSON.parse(localStorage.getItem('lion-vehicles') || '[]') } catch { return [] } })()
  for (const v of vehicles) {
    const kmLeft = v.nextRevisionKm > 0 ? v.nextRevisionKm - v.currentKm : null
    const daysRev = v.nextRevisionDate ? Math.ceil((new Date(v.nextRevisionDate + 'T12:00:00').getTime() - now) / 86400000) : null
    if (kmLeft !== null && kmLeft <= 0) alerts.push({ id: `veh-km-${v.id}`, severity: 'danger', category: 'Veículo', title: `${v.name} — revisão atrasada`, detail: `Passou ${Math.abs(kmLeft).toLocaleString('pt-BR')} km do limite` })
    else if (kmLeft !== null && kmLeft <= 1000) alerts.push({ id: `veh-km-${v.id}`, severity: 'warning', category: 'Veículo', title: `${v.name} — revisão próxima`, detail: `Faltam ${kmLeft.toLocaleString('pt-BR')} km` })
    if (daysRev !== null && daysRev < 0) alerts.push({ id: `veh-dt-${v.id}`, severity: 'danger', category: 'Veículo', title: `${v.name} — revisão atrasada`, detail: `Venceu há ${Math.abs(daysRev)} dia${Math.abs(daysRev) !== 1 ? 's' : ''}` })
    else if (daysRev !== null && daysRev <= 14) alerts.push({ id: `veh-dt-${v.id}`, severity: 'warning', category: 'Veículo', title: `${v.name} — revisão em breve`, detail: `Daqui a ${daysRev} dia${daysRev !== 1 ? 's' : ''}` })
    if (v.ipvaExpiry) {
      const d = Math.ceil((new Date(v.ipvaExpiry + 'T12:00:00').getTime() - now) / 86400000)
      if (d < 0) alerts.push({ id: `veh-ipva-${v.id}`, severity: 'danger', category: 'Veículo', title: `${v.name} — IPVA vencido`, detail: `Venceu há ${Math.abs(d)} dia${Math.abs(d) !== 1 ? 's' : ''}` })
      else if (d <= 30) alerts.push({ id: `veh-ipva-${v.id}`, severity: 'warning', category: 'Veículo', title: `${v.name} — IPVA vence em ${d}d`, detail: new Date(v.ipvaExpiry + 'T12:00:00').toLocaleDateString('pt-BR') })
    }
    if (v.insuranceExpiry) {
      const d = Math.ceil((new Date(v.insuranceExpiry + 'T12:00:00').getTime() - now) / 86400000)
      if (d < 0) alerts.push({ id: `veh-ins-${v.id}`, severity: 'danger', category: 'Veículo', title: `${v.name} — Seguro vencido`, detail: `Venceu há ${Math.abs(d)} dia${Math.abs(d) !== 1 ? 's' : ''}` })
      else if (d <= 30) alerts.push({ id: `veh-ins-${v.id}`, severity: 'warning', category: 'Veículo', title: `${v.name} — Seguro vence em ${d}d`, detail: new Date(v.insuranceExpiry + 'T12:00:00').toLocaleDateString('pt-BR') })
    }
  }

  const maints: Maintenance[] = (() => { try { return JSON.parse(localStorage.getItem('lion-maintenance') || '[]') } catch { return [] } })()
  for (const m of maints.filter(x => x.status !== 'feito')) {
    if (!m.scheduledDate) continue
    const d = Math.ceil((new Date(m.scheduledDate + 'T12:00:00').getTime() - now) / 86400000)
    if (d < 0) alerts.push({ id: `maint-${m.id}`, severity: 'danger', category: 'Manutenção', title: `${m.asset} — ${m.type} atrasado`, detail: `Venceu há ${Math.abs(d)} dia${Math.abs(d) !== 1 ? 's' : ''}` })
    else if (d <= 7) alerts.push({ id: `maint-${m.id}`, severity: 'warning', category: 'Manutenção', title: `${m.asset} — ${m.type} em breve`, detail: `Daqui a ${d} dia${d !== 1 ? 's' : ''}` })
  }

  const rentals: Rental[] = (() => { try { return JSON.parse(localStorage.getItem('lion-rentals') || '[]') } catch { return [] } })()
  const curMonth = new Date().toISOString().slice(0, 7)
  for (const r of rentals) {
    const status = r.payments?.[curMonth]
    if (status === 'atrasado') alerts.push({ id: `rent-${r.id}`, severity: 'danger', category: 'Aluguel', title: `${r.property} — aluguel atrasado`, detail: `${r.tenant} · ${r.value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` })
    else if (!status || status === 'pendente') {
      const today = new Date().getDate()
      if (today >= r.dueDay) alerts.push({ id: `rent-${r.id}`, severity: 'warning', category: 'Aluguel', title: `${r.property} — aluguel pendente`, detail: `Vencimento dia ${r.dueDay}` })
    }
  }

  const goals: Goal[] = (() => { try { return JSON.parse(localStorage.getItem('lion-goals') || '[]') } catch { return [] } })()
  for (const g of goals) {
    if (!g.deadline) continue
    const d = Math.ceil((new Date(g.deadline + 'T12:00:00').getTime() - now) / 86400000)
    if (d < 0 && g.current < g.target) alerts.push({ id: `goal-${g.id}`, severity: 'danger', category: 'Meta', title: `${g.name} — prazo vencido`, detail: `${((g.current / g.target) * 100).toFixed(0)}% atingido` })
    else if (d <= 30 && g.current < g.target) alerts.push({ id: `goal-${g.id}`, severity: 'warning', category: 'Meta', title: `${g.name} — prazo em ${d}d`, detail: `${((g.current / g.target) * 100).toFixed(0)}% atingido` })
  }

  alerts.sort((a, b) => (a.severity === 'danger' ? 0 : 1) - (b.severity === 'danger' ? 0 : 1))
  return alerts
}

function AlertsPanel({ onClose }: { onClose: () => void }) {
  const [alerts, setAlerts] = useState<AppAlert[]>(() => buildAlerts())

  useEffect(() => {
    const refresh = () => setAlerts(buildAlerts())
    window.addEventListener('storage', refresh)
    const id = setInterval(refresh, 60000)
    return () => { window.removeEventListener('storage', refresh); clearInterval(id) }
  }, [])

  const categories = [...new Set(alerts.map(a => a.category))]

  return (
    <div className="alerts-wrap">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-icon alerts-icon-header">
            <svg viewBox="0 0 20 20" fill="none">
              <path d="M10 2a6 6 0 0 0-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 0 0-6-6z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
              <path d="M8.5 16.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="panel-title">Alertas</div>
            <div className="panel-sub">{alerts.length} pendente{alerts.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <button className="panel-close" onClick={onClose}>
          <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      <div className="alerts-body">
        {alerts.length === 0 ? (
          <div className="alerts-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <p>Tudo em dia!</p>
            <span>Nenhum alerta no momento.</span>
          </div>
        ) : (
          categories.map(cat => (
            <div key={cat} className="alerts-group">
              <div className="alerts-group-label">{cat}</div>
              {alerts.filter(a => a.category === cat).map(a => (
                <div key={a.id} className={`alert-item alert-${a.severity}`}>
                  <div className={`alert-dot alert-dot-${a.severity}`}/>
                  <div className="alert-content">
                    <div className="alert-title">{a.title}</div>
                    <div className="alert-detail">{a.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Share Panel ─────────────────────────────────────────────────────────────

const SHARE_KEYS = ['lion-txs', 'lion-goals', 'lion-rentals', 'lion-maintenance', 'lion-docs-meta', 'lion-vehicles', 'lion-revisions']

function SharePanel({ onClose, onImport }: { onClose: () => void; onImport: (owner: string) => void }) {
  const [tab, setTab] = useState<'export' | 'import'>('export')
  const [ownerName, setOwnerName] = useState('')
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')
  const [importSuccess, setImportSuccess] = useState(false)

  function exportData() {
    const snapshot: Record<string, unknown> = { _owner: ownerName || 'Usuário', _exportedAt: new Date().toISOString() }
    for (const k of SHARE_KEYS) {
      try { snapshot[k] = JSON.parse(localStorage.getItem(k) || 'null') } catch { snapshot[k] = null }
    }
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lion-dashboard-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true); setImportError(''); setImportSuccess(false)
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string)
        for (const k of SHARE_KEYS) {
          if (data[k] !== undefined && data[k] !== null) {
            localStorage.setItem(k, JSON.stringify(data[k]))
          }
        }
        onImport(data._owner || 'Outro usuário')
        setImportSuccess(true)
      } catch {
        setImportError('Arquivo inválido ou corrompido.')
      } finally {
        setImporting(false)
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="share-wrap">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-icon share-icon-header">
            <svg viewBox="0 0 20 20" fill="none">
              <circle cx="15" cy="4" r="2" stroke="currentColor" strokeWidth="1.4"/>
              <circle cx="15" cy="16" r="2" stroke="currentColor" strokeWidth="1.4"/>
              <circle cx="5" cy="10" r="2" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M13 5l-6 4M13 15l-6-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <div className="panel-title">Compartilhar</div>
            <div className="panel-sub">Exportar ou importar dados</div>
          </div>
        </div>
        <button className="panel-close" onClick={onClose}>
          <svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>

      <div className="share-tabs">
        <button className={`share-tab${tab === 'export' ? ' share-tab-active' : ''}`} onClick={() => setTab('export')}>Exportar</button>
        <button className={`share-tab${tab === 'import' ? ' share-tab-active' : ''}`} onClick={() => setTab('import')}>Importar</button>
      </div>

      <div className="share-body">
        {tab === 'export' && (
          <div className="share-section">
            <p className="share-desc">Baixe um arquivo JSON com todos os seus dados do dashboard para compartilhar com outra pessoa ou fazer backup.</p>
            <div className="fin-field" style={{ marginBottom: 16 }}>
              <label>Seu nome (opcional)</label>
              <input type="text" placeholder="Ex: João Silva" value={ownerName} onChange={e => setOwnerName(e.target.value)} />
            </div>
            <div className="share-includes">
              <div className="share-includes-label">Inclui:</div>
              {['Transações financeiras', 'Metas', 'Aluguéis', 'Manutenções', 'Documentos', 'Veículos', 'Revisões'].map(s => (
                <div key={s} className="share-include-item">
                  <svg viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/><path d="M4 6l1.5 1.5L8 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  {s}
                </div>
              ))}
            </div>
            <button className="btn-accent" style={{ width: '100%', marginTop: 16 }} onClick={exportData}>
              Baixar arquivo JSON
            </button>
          </div>
        )}

        {tab === 'import' && (
          <div className="share-section">
            <p className="share-desc">Carregue um arquivo exportado por outra pessoa para visualizar os dados dela. Seus dados locais serão substituídos.</p>
            <div className="share-warning">
              ⚠️ Isso substituirá seus dados atuais. Exporte primeiro se quiser fazer backup.
            </div>
            {importSuccess ? (
              <div className="share-success">
                ✓ Dados importados com sucesso! Feche este painel para visualizar.
              </div>
            ) : (
              <>
                {importError && <div className="share-error">{importError}</div>}
                <label className="share-file-btn">
                  {importing ? 'Carregando…' : 'Selecionar arquivo JSON'}
                  <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleFile} disabled={importing} />
                </label>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Activity data ────────────────────────────────────────────────────────────

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  blue: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  amber: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="9" width="22" height="11" rx="2"/>
      <path d="M6 9V7a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
      <circle cx="6" cy="20" r="2"/><circle cx="18" cy="20" r="2"/>
    </svg>
  ),
  green: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  ),
  purple: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  ),
}

const ACTIVITY = [
  { icon: 'blue',   title: 'Ap. Jardins adicionado',  sub: 'Imóvel · R$ 850.000',   time: '2h atrás', color: 'blue' },
  { icon: 'amber',  title: 'BMW X5 atualizado',        sub: 'Veículo · R$ 290.000',  time: '5h atrás', color: 'amber' },
  { icon: 'green',  title: 'Novo lote de produtos',    sub: '45 itens · R$ 12.500',  time: '1d atrás', color: 'green' },
  { icon: 'blue',   title: 'Casa Alphaville avaliada', sub: 'Imóvel · R$ 1.100.000', time: '2d atrás', color: 'blue' },
]

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [showCalc, setShowCalc] = useState(false)
  const [showNp, setShowNp] = useState(false)
  const [showFin, setShowFin] = useState(false)
  const [showSim, setShowSim] = useState(false)
  const [showDocs, setShowDocs] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)
  const [alertCount, setAlertCount] = useState(() => buildAlerts().length)
  const [showShare, setShowShare] = useState(false)
  const [viewMode, setViewMode] = useState(false)
  const [viewOwner, setViewOwner] = useState('')
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

  const closeAll = () => { setShowCalc(false); setShowNp(false); setShowFin(false); setShowSim(false); setShowDocs(false); setShowAlerts(false); setShowShare(false) }
  const toggleCalc   = () => { const v = !showCalc;   closeAll(); setShowCalc(v) }
  const toggleNp     = () => { const v = !showNp;     closeAll(); setShowNp(v) }
  const toggleFin    = () => { const v = !showFin;    closeAll(); setShowFin(v) }
  const toggleSim    = () => { const v = !showSim;    closeAll(); setShowSim(v) }
  const toggleDocs   = () => { const v = !showDocs;   closeAll(); setShowDocs(v) }
  const toggleAlerts = () => { const v = !showAlerts; closeAll(); setShowAlerts(v); if (!v) setAlertCount(buildAlerts().length) }
  const toggleShare  = () => { const v = !showShare;  closeAll(); setShowShare(v) }

  useEffect(() => {
    const refresh = () => setAlertCount(buildAlerts().length)
    window.addEventListener('storage', refresh)
    const id = setInterval(refresh, 60000)
    return () => { window.removeEventListener('storage', refresh); clearInterval(id) }
  }, [])

  if (!authReady) return null
  if (supabase && !user) return <LoginPage />

  return (
    <div className={`app${viewMode ? ' view-mode' : ''}`}>
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
          <button className={`share-header-btn${showShare ? ' share-header-active' : ''}`} onClick={toggleShare} title="Compartilhar">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="15" cy="4" r="2"/><circle cx="15" cy="16" r="2"/><circle cx="5" cy="10" r="2"/>
              <path d="M13 5l-6 4M13 15l-6-4" strokeLinecap="round"/>
            </svg>
          </button>
          <button className="pdf-btn" onClick={() => window.print()} title="Exportar PDF">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M5 3h7l3 3v11H5V3z" strokeLinejoin="round"/>
              <path d="M12 3v3h3" strokeLinejoin="round"/>
              <path d="M7 11h6M7 14h4" strokeLinecap="round"/>
            </svg>
            <span>PDF</span>
          </button>
          <button className={`bell-btn${showAlerts ? ' bell-active' : ''}`} onClick={toggleAlerts} title="Alertas">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 2a6 6 0 0 0-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 0 0-6-6z" strokeLinejoin="round"/>
              <path d="M8.5 16.5a1.5 1.5 0 0 0 3 0" strokeLinecap="round"/>
            </svg>
            {alertCount > 0 && <span className="bell-badge">{alertCount > 9 ? '9+' : alertCount}</span>}
          </button>
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

      {viewMode && (
        <div className="view-mode-banner">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/>
            <circle cx="8" cy="8" r="2"/>
          </svg>
          Modo visualização — dados de <strong>{viewOwner}</strong>
          <button onClick={() => { setViewMode(false); setViewOwner('') }}>Sair</button>
        </div>
      )}

      <main className="main">
        {/* ── Print header (hidden on screen) ── */}
        <div className="print-only print-report-header">
          <div className="print-report-brand">Lion Admin — Relatório Financeiro</div>
          <div className="print-report-date">Gerado em {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
        </div>

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

        <GoalsSection />
        <PatrimonySection />
        <RentalsSection />
        <MaintenanceSection />
        <VehicleHistorySection />

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
                  <div className={`act-icon act-icon-${a.color}`}>{ACTIVITY_ICONS[a.icon]}</div>
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
        <button className={`float-btn float-docs${showDocs ? ' float-active' : ''}`} onClick={toggleDocs} title="Documentos">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>
          </svg>
        </button>
        <button className={`float-btn float-sim${showSim ? ' float-active' : ''}`} onClick={toggleSim} title="Simulador">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 9l9-7 9 7v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <path d="M9 22V12h6v10"/>
          </svg>
        </button>
        <button className={`float-btn float-fin${showFin ? ' float-active' : ''}`} onClick={toggleFin} title="Finanças">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round"/>
          </svg>
        </button>
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
      <div className={`float-panel panel-share${showShare ? ' panel-open' : ''}`}>
        <SharePanel onClose={() => setShowShare(false)} onImport={(owner) => { setViewMode(true); setViewOwner(owner); setShowShare(false) }} />
      </div>
      <div className={`float-panel panel-alerts${showAlerts ? ' panel-open' : ''}`}>
        <AlertsPanel onClose={() => setShowAlerts(false)} />
      </div>
      <div className={`float-panel panel-docs${showDocs ? ' panel-open' : ''}`}>
        <DocumentsPanel onClose={() => setShowDocs(false)} />
      </div>
      <div className={`float-panel panel-sim${showSim ? ' panel-open' : ''}`}>
        <FinancingSimulator onClose={() => setShowSim(false)} />
      </div>
      <div className={`float-panel panel-fin${showFin ? ' panel-open' : ''}`}>
        <FinancePanel onClose={() => setShowFin(false)} />
      </div>
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
