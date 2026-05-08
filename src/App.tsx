import { useState, useEffect, useRef, useCallback, useContext, createContext, useMemo } from 'react'
import './App.css'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { supabase } from './lib/supabase'
import LoginPage from './LoginPage'
import type { User } from '@supabase/supabase-js'
import emailjs from '@emailjs/browser'

// ─── Cloud sync ───────────────────────────────────────────────────────────────

const UserCtx = createContext<string | undefined>(undefined)

const DATA_KEYS = [
  'lion-txs','lion-goals','lion-rentals','lion-maintenance',
  'lion-vehicles','lion-revisions','lion-calendar','lion-trips',
  'lion-family','lion-collectors','lion-bills','np-folders',
  'lion-docs-meta','lion-imoveis','lion-produtos',
  'lion-terra','lion-talhoes',
]

const CLOUD_BUS = new EventTarget()

function useCloudTable<T extends { id: string }>(
  tableName: string,
  lsKey: string,
): [T[], React.Dispatch<React.SetStateAction<T[]>>] {
  const userId = useContext(UserCtx)
  const userIdRef = useRef(userId)
  useEffect(() => { userIdRef.current = userId }, [userId])

  const [data, _setData] = useState<T[]>(() => {
    try { return JSON.parse(localStorage.getItem(lsKey) || '[]') } catch { return [] }
  })

  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data }, [data])

  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!supabase) return
    if (!userId) {
      _setData([])
      localStorage.removeItem(lsKey)
      return
    }
    supabase.from(tableName).select('id, data').eq('user_id', userId)
      .then(({ data: rows }) => {
        if (rows) {
          const remote = rows.map(r => ({ ...(r.data as object), id: r.id })) as T[]
          const local: T[] = (() => { try { return JSON.parse(localStorage.getItem(lsKey) || '[]') } catch { return [] } })()
          const remoteIds = new Set(remote.map(i => i.id))
          const pending = local.filter(i => !remoteIds.has(i.id))
          const merged = [...remote, ...pending]
          _setData(merged)
          localStorage.setItem(lsKey, JSON.stringify(merged))
        }
      })
  }, [userId, tableName, lsKey])

  // Listen for cross-instance updates (same lsKey, different component)
  useEffect(() => {
    const handler = () => {
      try {
        const fresh = JSON.parse(localStorage.getItem(lsKey) || '[]') as T[]
        _setData(fresh)
      } catch { /* ignore */ }
    }
    CLOUD_BUS.addEventListener(lsKey, handler)
    return () => CLOUD_BUS.removeEventListener(lsKey, handler)
  }, [lsKey])

  const setData: React.Dispatch<React.SetStateAction<T[]>> = useCallback((action) => {
    // Compute next synchronously using ref — side effects run immediately,
    // not inside the React updater (which can be dropped if component unmounts)
    const next = typeof action === 'function' ? (action as (p: T[]) => T[])(dataRef.current) : action
    dataRef.current = next
    localStorage.setItem(lsKey, JSON.stringify(next))
    CLOUD_BUS.dispatchEvent(new Event(lsKey))
    _setData(next)
    if (supabase && userIdRef.current) {
      if (syncTimer.current) clearTimeout(syncTimer.current)
      syncTimer.current = setTimeout(async () => {
        const uid = userIdRef.current
        if (!uid || !supabase) return
        if (next.length > 0) {
          await supabase.from(tableName).upsert(
            next.map(item => ({ id: item.id, user_id: uid, data: item })),
            { onConflict: 'id' }
          )
          const keepIds = next.map(i => i.id)
          await supabase.from(tableName).delete()
            .eq('user_id', uid)
            .not('id', 'in', `(${keepIds.join(',')})`)
        } else {
          await supabase.from(tableName).delete().eq('user_id', uid)
        }
      }, 2000)
    }
  }, [tableName, lsKey])

  return [data, setData]
}

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
type SidebarPage = 'dashboard' | 'family' | 'calendar' | 'trips' | 'goals' | 'payment-hub' | 'settings' | 'appearance' | 'patrimonio' | 'financas' | 'terra'

interface Imovel {
  id: string
  descricao: string
  tipo: string
  valor: string
  valorAtual: string
  endereco: string
  area: string
  createdAt: string
}

interface Produto {
  id: string
  nome: string
  categoria: string
  valor: string
  quantidade: string
  fornecedor: string
  descricao: string
  createdAt: string
}

// ─── Terra types ─────────────────────────────────────────────────────────────

interface TerraFazenda {
  id: string
  nome: string
  municipio: string
  uf: string
  matricula: string
  carNumero: string
  itrNumero: string
  ccir: string
  areaTotal: number
  areaUtil: number
  areaReservaLegal: number
  areaApp: number
  areaPastagem: number
  areaLavoura: number
  areaReflorestamento: number
  areaBenfeitorias: number
  latitude: number
  longitude: number
  perimetro: [number, number][]
  tipoSolo: string
  bioma: string
  relevo: string
  fonteAgua: string
  valorVenal: string
  valorMercado: string
  geoReferenciado: boolean
  licencaAmbiental: boolean
  notas: string
  createdAt: string
}

type TalhaoUso = 'lavoura' | 'pastagem' | 'reserva_legal' | 'app' | 'reflorestamento' | 'benfeitorias' | 'sede' | 'outro'

interface TerraTalhao {
  id: string
  fazendaId: string
  nome: string
  uso: TalhaoUso
  areaHa: number
  cultura: string
  safra: string
  poligono: [number, number][]
  cor: string
  notas: string
  createdAt: string
}

const TERRA_BIOMAS = ['Mata Atlântica', 'Cerrado', 'Amazônia', 'Caatinga', 'Pampa', 'Pantanal']
const TERRA_RELEVOS = ['Plano', 'Suave Ondulado', 'Ondulado', 'Forte Ondulado', 'Montanhoso']
const TERRA_SOLOS = ['Latossolo Vermelho', 'Latossolo Amarelo', 'Argissolo', 'Neossolo', 'Cambissolo', 'Gleissolo', 'Nitossolo', 'Outro']
const TERRA_UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']
const TALHAO_USOS: { value: TalhaoUso; label: string; cor: string }[] = [
  { value: 'lavoura', label: 'Lavoura', cor: '#f59e0b' },
  { value: 'pastagem', label: 'Pastagem', cor: '#22c55e' },
  { value: 'reserva_legal', label: 'Reserva Legal', cor: '#166534' },
  { value: 'app', label: 'APP', cor: '#0d9488' },
  { value: 'reflorestamento', label: 'Reflorestamento', cor: '#65a30d' },
  { value: 'benfeitorias', label: 'Benfeitorias', cor: '#8b5cf6' },
  { value: 'sede', label: 'Sede/Moradia', cor: '#ef4444' },
  { value: 'outro', label: 'Outro', cor: '#6b7280' },
]
const TERRA_CULTURAS = ['Soja','Milho','Café','Cana-de-Açúcar','Trigo','Algodão','Feijão','Arroz','Mandioca','Eucalipto','Pinus','Pastagem (Braquiária)','Pastagem (Tifton)','Outra']

type BillStatus = 'em_aberto' | 'pago' | 'vencido' | 'cancelado'
type BillRecurrence = 'mensal' | 'unica' | 'anual' | 'semanal'

interface Collector {
  id: string
  name: string
  category: string
  color: string
  createdAt: string
}

interface Bill {
  id: string
  collectorId: string
  description: string
  amount: number
  dueDate: string
  status: BillStatus
  recurrence: BillRecurrence
  paymentLink?: string
  barcode?: string
  paidAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

const BILL_CATEGORIES = ['Energia','Água','Internet','Telefonia','Condomínio','Aluguel','Cartão','Streaming','Educação','Saúde','Imposto','Outros']
const BILL_COLORS = ['#7c3aed','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16','#a855f7','#f97316']

interface FamilyMember {
  id: string
  name: string
  role: string
  color: string
}

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

function NewItemModal({ type, onClose, onNavigate }: { type: ModalType; onClose: () => void; onNavigate?: (page: SidebarPage) => void }) {
  const [form, setForm] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [, setVehicles] = useCloudTable<Vehicle>('vehicles', 'lion-vehicles')
  const [, setImoveis] = useCloudTable<Imovel>('imoveis', 'lion-imoveis')
  const [, setProdutos] = useCloudTable<Produto>('produtos', 'lion-produtos')
  if (!type) return null
  const cfg = MODAL_CONFIG[type]

  const handleSave = () => {
    const id = Date.now().toString()

    if (type === 'carro') {
      if (!form.marca?.trim() || !form.modelo?.trim()) { setError('Marca e modelo são obrigatórios.'); return }
      const v: Vehicle = {
        id,
        name: `${form.marca.trim()} ${form.modelo.trim()}`,
        plate: form.placa?.trim() || '',
        year: form.ano?.trim() || new Date().getFullYear().toString(),
        currentKm: parseInt(form.km) || 0,
        nextRevisionKm: 0,
        nextRevisionDate: '',
        notes: [form.valor && `Compra: R$ ${form.valor}`, form.valorAtual && `Atual: R$ ${form.valorAtual}`].filter(Boolean).join(' | '),
        ipvaExpiry: '',
        insuranceExpiry: '',
      }
      setVehicles(prev => [v, ...prev])
    }

    if (type === 'imovel') {
      if (!form.descricao?.trim()) { setError('Descrição é obrigatória.'); return }
      const item: Imovel = { id, descricao: form.descricao.trim(), tipo: form.tipo || '', valor: form.valor || '0', valorAtual: form.valorAtual || '0', endereco: form.endereco || '', area: form.area || '0', createdAt: new Date().toISOString() }
      setImoveis(prev => [item, ...prev])
    }

    if (type === 'produto') {
      if (!form.nome?.trim()) { setError('Nome é obrigatório.'); return }
      const item: Produto = { id, nome: form.nome.trim(), categoria: form.categoria || '', valor: form.valor || '0', quantidade: form.quantidade || '1', fornecedor: form.fornecedor || '', descricao: form.descricao || '', createdAt: new Date().toISOString() }
      setProdutos(prev => [item, ...prev])
    }

    onClose()
    if (type === 'carro' || type === 'imovel' || type === 'produto') {
      onNavigate?.('patrimonio')
    }
  }

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
                  <select className="field-select" value={form[f.key] || ''} onChange={e => { setForm({ ...form, [f.key]: e.target.value }); setError('') }}>
                    <option value="">Selecione...</option>
                    {f.options?.map((o: string) => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input className="field-input" type={f.type} placeholder={f.placeholder} value={form[f.key] || ''} onChange={e => { setForm({ ...form, [f.key]: e.target.value }); setError('') }} />
                )}
              </div>
            ))}
          </div>
          {error && <p className="modal-error">{error}</p>}
        </div>
        <div className="modal-footer">
          <button className="btn-ghost" onClick={onClose}>Cancelar</button>
          <button className={`btn-modal btn-${cfg.color}`} onClick={handleSave}>
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
  recurring?: boolean
  recurringId?: string
}

const TX_CATEGORIES = {
  receita: ['Salário', 'Aluguel recebido', 'Dividendos', 'Freelance', 'Vendas', 'Outros'],
  despesa: ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Impostos', 'Outros'],
}

// ─── Bank import parsers ──────────────────────────────────────────────────────

function parseNubankCSV(text: string): Omit<Transaction, 'id'>[] {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  // Detect header row
  const header = lines[0].toLowerCase()
  const startIdx = (header.includes('data') || header.includes('date') || header.includes('title')) ? 1 : 0
  const results: Omit<Transaction, 'id'>[] = []
  for (let i = startIdx; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim())
    if (cols.length < 3) continue
    const [rawDate, title, rawAmount] = cols
    const dateMatch = rawDate.match(/(\d{4})[\/\-](\d{2})[\/\-](\d{2})/)
      || rawDate.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/)
    if (!dateMatch) continue
    let yyyy: string, mm: string
    if (rawDate.match(/^\d{4}/)) { yyyy = dateMatch[1]; mm = dateMatch[2] }
    else { yyyy = dateMatch[3]; mm = dateMatch[2] }
    const amount = parseFloat(rawAmount.replace(',', '.').replace(/[^\d.\-]/g, ''))
    if (isNaN(amount) || amount === 0) continue
    results.push({
      type: amount < 0 ? 'despesa' : 'receita',
      category: 'Outros',
      description: title,
      amount: Math.abs(amount),
      date: `${yyyy}-${mm}`,
    })
  }
  return results
}

function parseBBOFX(text: string): Omit<Transaction, 'id'>[] {
  const results: Omit<Transaction, 'id'>[] = []
  const blocks = text.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || []
  // Also handle OFX without closing tags (SGML style)
  const sgmlBlocks = text.split(/<STMTTRN>/i).slice(1)
  const toProcess = blocks.length > 0 ? blocks : sgmlBlocks
  for (const block of toProcess) {
    const getVal = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>[\\s]*([^<\\n\\r]+)`, 'i'))
      return m ? m[1].trim() : ''
    }
    const rawDate = getVal('DTPOSTED') || getVal('DTUSER')
    const rawAmount = getVal('TRNAMT')
    const memo = getVal('MEMO') || getVal('NAME') || getVal('FITID')
    if (!rawDate || !rawAmount) continue
    const yyyy = rawDate.slice(0, 4)
    const mm = rawDate.slice(4, 6)
    if (!yyyy || !mm || yyyy.length !== 4) continue
    const amount = parseFloat(rawAmount.replace(',', '.'))
    if (isNaN(amount) || amount === 0) continue
    results.push({
      type: amount < 0 ? 'despesa' : 'receita',
      category: 'Outros',
      description: memo,
      amount: Math.abs(amount),
      date: `${yyyy}-${mm}`,
    })
  }
  return results
}

function detectAndParse(text: string, fileName: string): Omit<Transaction, 'id'>[] {
  const lower = fileName.toLowerCase()
  if (lower.endsWith('.ofx') || lower.endsWith('.qfx') || text.includes('<OFX') || text.includes('<ofx')) {
    return parseBBOFX(text)
  }
  return parseNubankCSV(text)
}

function FinancePanel({ onClose }: { onClose: () => void }) {
  const [txs, setTxs] = useCloudTable<Transaction>('transactions', 'lion-txs')
  const [view, setView] = useState<'overview' | 'list' | 'add' | 'import'>('overview')
  const [filter, setFilter] = useState<'all' | TxType>('all')
  const [editId, setEditId] = useState<string | null>(null)
  const [recurring, setRecurring] = useState(false)
  const [recurringMonths, setRecurringMonths] = useState(12)
  const [form, setForm] = useState({
    type: 'receita' as TxType,
    category: TX_CATEGORIES.receita[0],
    description: '',
    amount: '',
    date: new Date().toISOString().slice(0, 7),
  })

  function openAdd() { setEditId(null); setRecurring(false); setForm({ type: 'receita', category: TX_CATEGORIES.receita[0], description: '', amount: '', date: new Date().toISOString().slice(0, 7) }); setView('add') }

  function openEdit(tx: Transaction) {
    setEditId(tx.id)
    setRecurring(false)
    setForm({ type: tx.type, category: tx.category, description: tx.description, amount: String(tx.amount), date: tx.date })
    setView('add')
  }

  function addTx(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || !form.description.trim()) return
    const amt = parseFloat(form.amount)

    if (editId) {
      setTxs(prev => prev.map(t => t.id === editId ? { ...t, ...form, amount: amt } : t))
      setEditId(null)
      setView('list')
      return
    }

    if (recurring) {
      const rid = `rec-${Date.now()}`
      const newTxs: Transaction[] = []
      const [y, m] = form.date.split('-').map(Number)
      for (let i = 0; i < recurringMonths; i++) {
        const d = new Date(y, m - 1 + i, 1)
        newTxs.push({
          id: `${Date.now()}-${i}`,
          type: form.type,
          category: form.category,
          description: form.description,
          amount: amt,
          date: d.toISOString().slice(0, 7),
          recurring: true,
          recurringId: rid,
        })
      }
      setTxs(prev => [...newTxs, ...prev])
    } else {
      setTxs(prev => [{ id: Date.now().toString(), type: form.type, category: form.category, description: form.description, amount: amt, date: form.date }, ...prev])
    }
    setForm(f => ({ ...f, description: '', amount: '' }))
    setView('overview')
  }

  function delTx(tx: Transaction) {
    if (tx.recurringId) {
      const others = txs.filter(t => t.recurringId === tx.recurringId).length
      if (others > 1 && window.confirm(`Excluir só este mês ou todas as ${others} ocorrências?`)) {
        setTxs(prev => prev.filter(t => t.recurringId !== tx.recurringId))
        return
      }
    }
    setTxs(prev => prev.filter(t => t.id !== tx.id))
  }

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

  const _now = new Date()
  const currentMonth = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}`
  const txsAteMesAtual = txs.filter(t => t.date <= currentMonth)
  const totalReceitas = txsAteMesAtual.reduce((s, t) => t.type === 'receita' ? s + t.amount : s, 0)
  const totalDespesas = txsAteMesAtual.reduce((s, t) => t.type === 'despesa' ? s + t.amount : s, 0)
  const saldo = totalReceitas - totalDespesas

  const maxVal = Math.max(...monthData.flatMap(m => [m.receitas, m.despesas]), 1)
  const fmtCurr = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const filtered = filter === 'all' ? txs : txs.filter(t => t.type === filter)

  const chartH = 100
  const barW = 14
  const gap = 3
  const groupW = barW * 2 + gap + 14

  // ── Pie chart data ──
  const PIE_COLORS = ['#ef4444','#f59e0b','#3b82f6','#10b981','#8b5cf6','#ec4899','#06b6d4','#84cc16']
  const catTotals = TX_CATEGORIES.despesa.map((cat, i) => ({
    cat,
    val: txsAteMesAtual.filter(t => t.type === 'despesa' && t.category === cat).reduce((s, t) => s + t.amount, 0),
    color: PIE_COLORS[i % PIE_COLORS.length],
  })).filter(c => c.val > 0).sort((a, b) => b.val - a.val)

  function donutSlices(data: typeof catTotals, cx: number, cy: number, r: number, ir: number) {
    const total = data.reduce((s, d) => s + d.val, 0)
    if (total === 0) return []
    let angle = -Math.PI / 2
    return data.map(d => {
      const sweep = (d.val / total) * Math.PI * 2
      const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle)
      const x2 = cx + r * Math.cos(angle + sweep), y2 = cy + r * Math.sin(angle + sweep)
      const ix1 = cx + ir * Math.cos(angle + sweep), iy1 = cy + ir * Math.sin(angle + sweep)
      const ix2 = cx + ir * Math.cos(angle), iy2 = cy + ir * Math.sin(angle)
      const large = sweep > Math.PI ? 1 : 0
      const path = `M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${ix1},${iy1} A${ir},${ir} 0 ${large} 0 ${ix2},${iy2} Z`
      angle += sweep
      return { ...d, path, pct: Math.round((d.val / total) * 100) }
    })
  }

  const slices = donutSlices(catTotals, 72, 72, 58, 34)

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
          <button className={`fin-tab fin-tab-add${view === 'add' ? ' fin-tab-active' : ''}`} onClick={openAdd}>+ Novo</button>
          <button className={`fin-tab${view === 'import' ? ' fin-tab-active' : ''}`} onClick={() => setView('import')}>
            <svg viewBox="0 0 14 14" fill="none" style={{width:12,height:12,marginRight:4,verticalAlign:'middle'}}><path d="M7 2v7M4 6l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 10v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            Importar
          </button>
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

          {catTotals.length > 0 && (
            <div className="fin-pie-section">
              <div className="fin-chart-title">Despesas por categoria</div>
              <div className="fin-pie-wrap">
                <svg viewBox="0 0 144 144" className="fin-pie-svg">
                  {slices.map((s, i) => (
                    <path key={i} d={s.path} fill={s.color} opacity=".9">
                      <title>{s.cat}: {fmtCurr(s.val)} ({s.pct}%)</title>
                    </path>
                  ))}
                  <circle cx="72" cy="72" r="26" fill="var(--bg2)" />
                  <text x="72" y="68" textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--text3)">{fmtCurr(totalDespesas).replace('R$\u00a0','').split(',')[0]}</text>
                  <text x="72" y="82" textAnchor="middle" fontSize="8" fill="var(--text)">total</text>
                </svg>
                <div className="fin-pie-legend">
                  {slices.slice(0, 6).map((s, i) => (
                    <div key={i} className="fin-pie-row">
                      <span className="fin-pie-dot" style={{ background: s.color }} />
                      <span className="fin-pie-cat">{s.cat}</span>
                      <span className="fin-pie-pct">{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
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
                      <span className="fin-item-desc">
                        {tx.description}
                        {tx.recurring && <span className="fin-recurring-badge" title="Recorrente">
                          <svg viewBox="0 0 12 12" fill="none"><path d="M2 6a4 4 0 0 1 7-2.6M10 6a4 4 0 0 1-7 2.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M8.5 2l.5 1.4-1.4.5M3.5 10l-.5-1.4 1.4-.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>}
                      </span>
                      <span className="fin-item-meta">{tx.category} · {new Date(tx.date + '-02').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}</span>
                    </div>
                    <span className={`fin-item-amt ${tx.type === 'receita' ? 'fin-amt-green' : 'fin-amt-red'}`}>
                      {tx.type === 'receita' ? '+' : '-'}{fmtCurr(tx.amount)}
                    </span>
                    <button className="fin-edit-btn" onClick={() => openEdit(tx)} title="Editar">
                      <svg viewBox="0 0 14 14" fill="none"><path d="M2 10l7-7 2 2-7 7H2v-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                    </button>
                    <button className="fin-del" onClick={() => delTx(tx)}>
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
            {editId && <div className="fin-edit-title">Editando lançamento</div>}
            <div className="fin-type-toggle">
              <button type="button" className={`fin-type-btn${form.type === 'receita' ? ' fin-type-green' : ''}`}
                onClick={() => setForm(f => ({ ...f, type: 'receita', category: TX_CATEGORIES.receita[0] }))}>↑ Receita</button>
              <button type="button" className={`fin-type-btn${form.type === 'despesa' ? ' fin-type-red' : ''}`}
                onClick={() => setForm(f => ({ ...f, type: 'despesa', category: TX_CATEGORIES.despesa[0] }))}>↓ Despesa</button>
            </div>
            <div className="fin-field">
              <label>Descrição</label>
              <input type="text" placeholder="Ex: Salário, Aluguel, Netflix..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} required />
            </div>
            <div className="fin-row">
              <div className="fin-field">
                <label>Valor (R$)</label>
                <input type="number" step="0.01" min="0.01" placeholder="0,00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
              </div>
              <div className="fin-field">
                <label>Mês inicial</label>
                <input type="month" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
            </div>
            <div className="fin-field">
              <label>Categoria</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                {TX_CATEGORIES[form.type].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            {!editId && (
              <div className="fin-recurring-row">
                <label className="fin-recurring-toggle">
                  <input type="checkbox" checked={recurring} onChange={e => setRecurring(e.target.checked)} />
                  <span className="fin-recurring-label">
                    <svg viewBox="0 0 14 14" fill="none"><path d="M2 7a5 5 0 0 1 8.7-3.3M12 7a5 5 0 0 1-8.7 3.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M10 2.5l1 2-2 .5M4 11.5l-1-2 2-.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Repetir todo mês
                  </span>
                </label>
                {recurring && (
                  <div className="fin-recurring-months">
                    <label>por</label>
                    <select value={recurringMonths} onChange={e => setRecurringMonths(Number(e.target.value))}>
                      {[3,6,12,24,36].map(n => <option key={n} value={n}>{n} meses</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
            <div className="fin-form-actions">
              <button type="button" className="btn-ghost" onClick={() => { setView(editId ? 'list' : 'overview'); setEditId(null) }}>Cancelar</button>
              <button type="submit" className={`fin-submit ${form.type === 'receita' ? 'fin-submit-green' : 'fin-submit-red'}`}>
                {editId ? 'Salvar' : recurring ? `Criar ${recurringMonths}x` : `Adicionar ${form.type === 'receita' ? 'Receita' : 'Despesa'}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {view === 'import' && <ImportView txs={txs} setTxs={setTxs} onDone={() => setView('list')} />}
    </div>
  )
}

function ImportView({ txs, setTxs, onDone }: { txs: Transaction[]; setTxs: React.Dispatch<React.SetStateAction<Transaction[]>>; onDone: () => void }) {
  const [parsed, setParsed] = useState<Omit<Transaction, 'id'>[]>([])
  const [fileName, setFileName] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [done, setDone] = useState(false)
  const fmtCurr = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFileName(f.name)
    setDone(false)
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const rows = detectAndParse(text, f.name)
      // mark duplicates: same date+description+amount already in txs
      const existingKeys = new Set(txs.map(t => `${t.date}|${t.description}|${t.amount}`))
      const newRows = rows.filter(r => !existingKeys.has(`${r.date}|${r.description}|${r.amount}`))
      setParsed(newRows)
      setSelected(new Set(newRows.map((_, i) => i)))
    }
    reader.readAsText(f, 'UTF-8')
  }

  const toggleAll = () => {
    if (selected.size === parsed.length) setSelected(new Set())
    else setSelected(new Set(parsed.map((_, i) => i)))
  }

  const doImport = () => {
    const toImport = parsed
      .filter((_, i) => selected.has(i))
      .map(r => ({ ...r, id: `imp-${Date.now()}-${Math.random().toString(36).slice(2)}` }))
    setTxs(prev => [...toImport, ...prev])
    setDone(true)
    setTimeout(onDone, 1200)
  }

  if (done) return (
    <div className="fin-body">
      <div className="import-success">
        <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/><path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Importado com sucesso!
      </div>
    </div>
  )

  return (
    <div className="fin-body">
      <div className="import-wrap">
        <div className="import-instructions">
          <div className="import-bank">
            <div className="import-bank-name">
              <svg viewBox="0 0 16 16" fill="none"><rect x="1" y="6" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1l7 5H1l7-5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
              Nubank
            </div>
            <div className="import-bank-steps">App → Perfil → Exportar transações → CSV</div>
          </div>
          <div className="import-bank">
            <div className="import-bank-name">
              <svg viewBox="0 0 16 16" fill="none"><rect x="1" y="6" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M8 1l7 5H1l7-5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg>
              Banco do Brasil
            </div>
            <div className="import-bank-steps">Internet Banking → Extrato → Exportar → OFX</div>
          </div>
        </div>

        <label className="import-drop">
          <input type="file" accept=".csv,.ofx,.qfx" onChange={onFile} style={{ display: 'none' }} />
          <svg viewBox="0 0 24 24" fill="none"><path d="M12 3v12M8 7l4-4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <span>{fileName ? fileName : 'Clique para selecionar arquivo (.csv ou .ofx)'}</span>
        </label>

        {parsed.length > 0 && (
          <>
            <div className="import-preview-header">
              <span>{parsed.length} transação{parsed.length !== 1 ? 'ões' : ''} encontrada{parsed.length !== 1 ? 's' : ''} (duplicatas já removidas)</span>
              <button className="import-sel-all" onClick={toggleAll}>
                {selected.size === parsed.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            </div>
            <div className="import-table-wrap">
              <table className="import-table">
                <thead><tr><th></th><th>Data</th><th>Descrição</th><th>Tipo</th><th>Valor</th></tr></thead>
                <tbody>
                  {parsed.map((r, i) => (
                    <tr key={i} className={selected.has(i) ? 'import-row-sel' : 'import-row-skip'}>
                      <td><input type="checkbox" checked={selected.has(i)} onChange={() => {
                        const s = new Set(selected)
                        s.has(i) ? s.delete(i) : s.add(i)
                        setSelected(s)
                      }} /></td>
                      <td>{r.date}</td>
                      <td className="import-desc">{r.description}</td>
                      <td><span className={`import-type-badge ${r.type === 'receita' ? 'import-type-green' : 'import-type-red'}`}>{r.type === 'receita' ? '↑' : '↓'}</span></td>
                      <td className={r.type === 'receita' ? 'import-val-green' : 'import-val-red'}>{fmtCurr(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn-accent import-confirm-btn" onClick={doImport} disabled={selected.size === 0}>
              Importar {selected.size} transaç{selected.size === 1 ? 'ão' : 'ões'}
            </button>
          </>
        )}

        {fileName && parsed.length === 0 && (
          <div className="import-empty">Nenhuma transação nova encontrada. O arquivo pode estar vazio ou todas já foram importadas.</div>
        )}
      </div>
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
                  {preview.map((row) =>
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

  const [collapsed, setCollapsed] = useState(false)

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
  const [rentals, setRentals] = useCloudTable<Rental>('rentals', 'lion-rentals')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(RENTAL_FORM_INIT)
  const [editId, setEditId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)


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
      ) : (<>
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

        </div>
        <div className="rentals-summary">
          <span>Total recebido este mês:</span>
          <strong>{fmtCurr(rentals.filter(r => r.payments[curMonth] === 'pago').reduce((s, r) => s + r.value, 0))}</strong>
          <span className="rentals-summary-sep">·</span>
          <span>{paidThisMonth}/{rentals.length} pagos</span>
        </div>
      </>)}
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
  const [items, setItems] = useCloudTable<Maintenance>('maintenance_items', 'lion-maintenance')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(MAINT_FORM_INIT)
  const [editId, setEditId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'todos' | 'pendente' | 'atrasado' | 'feito'>('todos')


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

// ─── Notes Section ───────────────────────────────────────────────────────────

type FlatNote = Note & { folderName: string; folderColor: string; folderId: string }

function NotesSection({ onOpenNotepad }: { onOpenNotepad: () => void }) {
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

  const bills: Bill[] = (() => { try { return JSON.parse(localStorage.getItem('lion-bills') || '[]') } catch { return [] } })()
  const collectors: Collector[] = (() => { try { return JSON.parse(localStorage.getItem('lion-collectors') || '[]') } catch { return [] } })()
  for (const b of bills) {
    if (b.status === 'pago' || b.status === 'cancelado') continue
    const d = Math.ceil((new Date(b.dueDate + 'T23:59:59').getTime() - now) / 86400000)
    const coll = collectors.find(c => c.id === b.collectorId)
    const name = coll?.name || b.description || 'Conta'
    const valor = b.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    if (d < 0) alerts.push({ id: `bill-${b.id}`, severity: 'danger', category: 'Conta', title: `${name} — vencida`, detail: `${valor} · Venceu há ${Math.abs(d)} dia${Math.abs(d) !== 1 ? 's' : ''}` })
    else if (d <= 5) alerts.push({ id: `bill-${b.id}`, severity: 'warning', category: 'Conta', title: `${name} — vence em ${d}d`, detail: `${valor} · ${new Date(b.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}` })
  }

  alerts.sort((a, b) => (a.severity === 'danger' ? 0 : 1) - (b.severity === 'danger' ? 0 : 1))
  return alerts
}

const EMAILJS_CONFIG_KEY = 'lion-emailjs'
interface EmailJSConfig { serviceId: string; templateId: string; publicKey: string; toEmail: string }
const EMAILJS_INIT: EmailJSConfig = { serviceId: '', templateId: '', publicKey: '', toEmail: '' }

function AlertsPanel({ onClose }: { onClose: () => void }) {
  const [alerts, setAlerts] = useState<AppAlert[]>(() => buildAlerts())
  const [showEmail, setShowEmail] = useState(false)
  const [cfg, setCfg] = useState<EmailJSConfig>(() => {
    try { return JSON.parse(localStorage.getItem(EMAILJS_CONFIG_KEY) || 'null') || EMAILJS_INIT } catch { return EMAILJS_INIT }
  })
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<'ok' | 'err' | null>(null)

  useEffect(() => {
    const refresh = () => setAlerts(buildAlerts())
    window.addEventListener('storage', refresh)
    const id = setInterval(refresh, 60000)
    return () => { window.removeEventListener('storage', refresh); clearInterval(id) }
  }, [])

  const fc = (k: keyof EmailJSConfig, v: string) => setCfg(p => ({ ...p, [k]: v }))
  const saveConfig = () => { localStorage.setItem(EMAILJS_CONFIG_KEY, JSON.stringify(cfg)); setSendResult(null) }
  const isConfigured = cfg.serviceId && cfg.templateId && cfg.publicKey && cfg.toEmail

  async function sendEmail() {
    if (!isConfigured) return
    setSending(true); setSendResult(null)
    const lines = alerts.map(a => `[${a.severity === 'danger' ? '🔴' : '🟡'} ${a.category}] ${a.title} — ${a.detail}`)
    try {
      await emailjs.send(cfg.serviceId, cfg.templateId, {
        to_email: cfg.toEmail,
        alerts_text: lines.join('\n'),
        alert_count: String(alerts.length),
        danger_count: String(alerts.filter(a => a.severity === 'danger').length),
        date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
      }, cfg.publicKey)
      setSendResult('ok')
    } catch {
      setSendResult('err')
    } finally {
      setSending(false)
    }
  }

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
          <>
            {categories.map(cat => (
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
            ))}

            {/* Email section */}
            <div className="email-section">
              <button className="email-toggle-btn" onClick={() => { setShowEmail(v => !v); setSendResult(null) }}>
                <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <rect x="2" y="4" width="16" height="12" rx="2"/>
                  <path d="M2 7l8 5 8-5" strokeLinecap="round"/>
                </svg>
                {showEmail ? 'Fechar configuração' : 'Enviar por email'}
                <svg className={`rental-chevron${showEmail ? ' expanded' : ''}`} viewBox="0 0 16 16" fill="none" style={{ marginLeft: 'auto' }}>
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>

              {showEmail && (
                <div className="email-config">
                  <p className="email-setup-note">
                    Configure o <strong>EmailJS</strong> (emailjs.com — grátis até 200 emails/mês).<br/>
                    Variáveis do template: <code>{'{{alerts_text}}'}</code>, <code>{'{{alert_count}}'}</code>, <code>{'{{date}}'}</code>, <code>{'{{to_email}}'}</code>
                  </p>
                  <div className="fin-field">
                    <label>Service ID</label>
                    <input type="text" placeholder="service_xxxxxxx" value={cfg.serviceId} onChange={e => fc('serviceId', e.target.value)} />
                  </div>
                  <div className="fin-field">
                    <label>Template ID</label>
                    <input type="text" placeholder="template_xxxxxxx" value={cfg.templateId} onChange={e => fc('templateId', e.target.value)} />
                  </div>
                  <div className="fin-field">
                    <label>Public Key</label>
                    <input type="text" placeholder="xxxxxxxxxxxxxxxxxxxx" value={cfg.publicKey} onChange={e => fc('publicKey', e.target.value)} />
                  </div>
                  <div className="fin-field">
                    <label>Enviar para (email)</label>
                    <input type="email" placeholder="seu@email.com" value={cfg.toEmail} onChange={e => fc('toEmail', e.target.value)} />
                  </div>
                  <div className="email-actions">
                    <button className="btn-ghost" onClick={saveConfig}>Salvar</button>
                    <button className="btn-accent" onClick={sendEmail} disabled={!isConfigured || sending}>
                      {sending ? 'Enviando…' : `Enviar ${alerts.length} alerta${alerts.length !== 1 ? 's' : ''}`}
                    </button>
                  </div>
                  {sendResult === 'ok' && <div className="share-success">✓ Email enviado com sucesso!</div>}
                  {sendResult === 'err' && <div className="share-error">Erro ao enviar. Verifique as credenciais.</div>}
                </div>
              )}
            </div>
          </>
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

// ─── Dashboard data ───────────────────────────────────────────────────────────

function computeDashData() {
  const txs: Transaction[] = (() => { try { return JSON.parse(localStorage.getItem('lion-txs') || '[]') } catch { return [] } })()
  const goals: Goal[] = (() => { try { return JSON.parse(localStorage.getItem('lion-goals') || '[]') } catch { return [] } })()
  const rentals: Rental[] = (() => { try { return JSON.parse(localStorage.getItem('lion-rentals') || '[]') } catch { return [] } })()
  const alerts = buildAlerts()

  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const balance = txs.filter(t => t.date <= thisMonth).reduce((s, t) => s + (t.type === 'receita' ? t.amount : -t.amount), 0)
  const totalGoals = goals.reduce((s, g) => s + (g.current || 0), 0)
  const targetGoals = goals.reduce((s, g) => s + (g.target || 0), 0)
  const goalsProgress = targetGoals > 0 ? Math.round(totalGoals / targetGoals * 100) : 0
  const monthlyRent = rentals.reduce((s, r) => s + (r.value || 0), 0)
  const dangerCount = alerts.filter(a => a.severity === 'danger').length
  const warnCount = alerts.filter(a => a.severity === 'warning').length

  // month-over-month balance change
  const lastMonth = (() => { const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })()
  const thisMonthNet = txs.filter(t => t.date === thisMonth).reduce((s, t) => s + (t.type === 'receita' ? t.amount : -t.amount), 0)
  const lastMonthNet = txs.filter(t => t.date === lastMonth).reduce((s, t) => s + (t.type === 'receita' ? t.amount : -t.amount), 0)

  return { balance, totalGoals, targetGoals, goalsProgress, monthlyRent, dangerCount, warnCount, totalAlerts: alerts.length, txCount: txs.length, rentCount: rentals.length, goalsCount: goals.length, thisMonthNet, lastMonthNet }
}

// ─── Appearance constants ──────────────────────────────────────────────────────

const THEMES = [
  { id: 'dark',     label: 'Noite',    swatch: '#0c0e14', bg: '#13151e' },
  { id: 'charcoal', label: 'Carvão',   swatch: '#171717', bg: '#1f1f1f' },
  { id: 'slate',    label: 'Ardósia',  swatch: '#0e1520', bg: '#15202e' },
  { id: 'light',    label: 'Claro',    swatch: '#f0f2f5', bg: '#e8eaed' },
]

const FONT_SIZES = [
  { id: 'compact',     label: 'A−',  size: '13px', title: 'Compacto' },
  { id: 'normal',      label: 'A',   size: '14px', title: 'Normal' },
  { id: 'comfortable', label: 'A+',  size: '15px', title: 'Confortável' },
  { id: 'large',       label: 'A++', size: '16px', title: 'Grande' },
]

const ACCENT_COLORS = [
  { id: 'red',    label: 'Vermelho', color: '#c0392b', light: '#e74c3c' },
  { id: 'blue',   label: 'Azul',    color: '#1d4ed8', light: '#60a5fa' },
  { id: 'green',  label: 'Verde',   color: '#059669', light: '#34d399' },
  { id: 'purple', label: 'Roxo',    color: '#7c3aed', light: '#a78bfa' },
  { id: 'pink',   label: 'Rosa',    color: '#be185d', light: '#f472b6' },
  { id: 'amber',  label: 'Âmbar',   color: '#b45309', light: '#fbbf24' },
  { id: 'cyan',   label: 'Ciano',   color: '#0e7490', light: '#22d3ee' },
  { id: 'indigo', label: 'Índigo',  color: '#4338ca', light: '#818cf8' },
]



// ─── Activity data ────────────────────────────────────────────────────────────

const ICON_TX_IN = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
const ICON_TX_OUT = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
const ICON_GOAL = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/></svg>
const ICON_RENTAL = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
const ICON_VEHICLE = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="9" width="22" height="11" rx="2"/><path d="M6 9V7a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="6" cy="20" r="2"/><circle cx="18" cy="20" r="2"/></svg>
const ICON_MAINT = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>

function relTime(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'agora'
  if (mins < 60) return `${mins}min atrás`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h atrás`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d atrás`
  return `${Math.floor(days / 30)}mês atrás`
}

interface ActivityItem { id: string; icon: React.ReactNode; title: string; sub: string; time: string; color: string; ts: number }

function buildActivity(): ActivityItem[] {
  const items: ActivityItem[] = []

  const txs: Transaction[] = (() => { try { return JSON.parse(localStorage.getItem('lion-txs') || '[]') } catch { return [] } })()
  txs.forEach(t => {
    const ts = parseInt(t.id) || 0
    const sign = t.type === 'receita' ? '+' : '-'
    items.push({ id: `tx-${t.id}`, icon: t.type === 'receita' ? ICON_TX_IN : ICON_TX_OUT, title: t.description || t.category, sub: `${t.type === 'receita' ? 'Receita' : 'Despesa'} · ${sign} R$ ${t.amount.toLocaleString('pt-BR')} · ${t.category}`, time: relTime(ts), color: t.type === 'receita' ? 'green' : 'red', ts })
  })

  const goals: Goal[] = (() => { try { return JSON.parse(localStorage.getItem('lion-goals') || '[]') } catch { return [] } })()
  goals.forEach(g => {
    const ts = parseInt(g.id) || 0
    items.push({ id: `g-${g.id}`, icon: ICON_GOAL, title: g.name, sub: `Meta · R$ ${(g.current||0).toLocaleString('pt-BR')} / R$ ${(g.target||0).toLocaleString('pt-BR')}`, time: relTime(ts), color: 'blue', ts })
  })

  const rentals: Rental[] = (() => { try { return JSON.parse(localStorage.getItem('lion-rentals') || '[]') } catch { return [] } })()
  rentals.forEach(r => {
    const ts = parseInt(r.id) || 0
    items.push({ id: `r-${r.id}`, icon: ICON_RENTAL, title: r.property, sub: `Aluguel · ${r.tenant} · R$ ${(r.value||0).toLocaleString('pt-BR')}/mês`, time: relTime(ts), color: 'amber', ts })
  })

  const vehicles: Vehicle[] = (() => { try { return JSON.parse(localStorage.getItem('lion-vehicles') || '[]') } catch { return [] } })()
  vehicles.forEach(v => {
    const ts = parseInt(v.id) || 0
    items.push({ id: `v-${v.id}`, icon: ICON_VEHICLE, title: v.name, sub: `Veículo · ${v.plate} · ${v.year}`, time: relTime(ts), color: 'amber', ts })
  })

  const maint: Maintenance[] = (() => { try { return JSON.parse(localStorage.getItem('lion-maintenance') || '[]') } catch { return [] } })()
  maint.forEach(m => {
    const ts = parseInt(m.id) || 0
    items.push({ id: `m-${m.id}`, icon: ICON_MAINT, title: m.asset, sub: `Manutenção · ${m.description}`, time: relTime(ts), color: 'purple', ts })
  })

  return items.sort((a, b) => b.ts - a.ts).slice(0, 8)
}

// ─── Onboarding ───────────────────────────────────────────────────────────────

const OB_STEPS = [
  {
    icon: (
      <svg viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="14" fill="url(#obg)"/>
        <path d="M12 34L18 18l8 13 6-8 6 15" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <defs><linearGradient id="obg" x1="0" y1="0" x2="48" y2="48"><stop stopColor="#c0392b"/><stop offset="1" stopColor="#96281b"/></linearGradient></defs>
      </svg>
    ),
    title: 'Bem-vindo ao Lion Admin',
    body: 'Seu painel completo de gestão financeira e patrimonial. Em menos de 2 minutos você estará configurado e pronto para usar.',
    cta: 'Começar tour',
  },
  {
    icon: <svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="14" fill="rgba(59,130,246,.15)"/><path d="M24 8v32M31 14H19.5a5 5 0 0 0 0 10h9a5 5 0 0 1 0 10H16" stroke="var(--blue)" strokeWidth="2.5" strokeLinecap="round"/></svg>,
    title: 'Registre suas Finanças',
    body: 'Clique no botão "Finanças" (ou pressione F) para lançar receitas e despesas. Acompanhe seu saldo mensal e histórico de transações.',
    cta: 'Entendido',
  },
  {
    icon: <svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="14" fill="rgba(16,185,129,.15)"/><circle cx="24" cy="24" r="14" stroke="var(--green)" strokeWidth="2.5"/><circle cx="24" cy="24" r="8" stroke="var(--green)" strokeWidth="2"/><circle cx="24" cy="24" r="3" fill="var(--green)"/></svg>,
    title: 'Defina Metas Financeiras',
    body: 'Crie objetivos como reserva de emergência, viagem ou compra de imóvel. Acompanhe o progresso em tempo real com barras visuais.',
    cta: 'Entendido',
  },
  {
    icon: <svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="14" fill="rgba(245,158,11,.15)"/><path d="M8 20l16-14 16 14v20a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z" stroke="var(--amber)" strokeWidth="2.5"/><polyline points="18,43 18,28 30,28 30,43" stroke="var(--amber)" strokeWidth="2.5"/></svg>,
    title: 'Gerencie Imóveis e Aluguéis',
    body: 'Cadastre seus imóveis, controle recebimento de aluguéis, registre manutenções e armazene documentos importantes com segurança.',
    cta: 'Entendido',
  },
  {
    icon: <svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="14" fill="rgba(16,185,129,.15)"/><path d="M14 26l8 8 14-16" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    title: 'Tudo pronto!',
    body: 'Use os botões flutuantes à direita ou os atalhos de teclado (pressione ? para ver todos). Seus dados ficam salvos localmente no seu dispositivo.',
    cta: 'Ir para o painel',
  },
]

function OnboardingWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const last = step === OB_STEPS.length - 1
  const s = OB_STEPS[step]

  const next = () => last ? onDone() : setStep(s => s + 1)
  const prev = () => setStep(s => s - 1)

  return (
    <div className="ob-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains('ob-overlay')) onDone() }}>
      <div className="ob-card">
        <button className="ob-skip" onClick={onDone}>Pular</button>
        <div className="ob-icon">{s.icon}</div>
        <h2 className="ob-title">{s.title}</h2>
        <p className="ob-body">{s.body}</p>
        <div className="ob-dots">
          {OB_STEPS.map((_, i) => <span key={i} className={`ob-dot${i === step ? ' ob-dot-active' : ''}`}/>)}
        </div>
        <div className="ob-actions">
          {step > 0 && <button className="ob-back" onClick={prev}>Anterior</button>}
          <button className="ob-next" onClick={next}>{s.cta}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Search ───────────────────────────────────────────────────────────────────

interface SearchResult {
  id: string
  type: string
  label: string
  sub: string
  color: string
  section: string
}

function buildSearchIndex(q: string): SearchResult[] {
  if (q.trim().length < 2) return []
  const lq = q.toLowerCase()
  const results: SearchResult[] = []
  const push = (item: SearchResult) => { if (results.length < 12) results.push(item) }

  const txs: Transaction[] = (() => { try { return JSON.parse(localStorage.getItem('lion-txs') || '[]') } catch { return [] } })()
  txs.filter(t => t.description?.toLowerCase().includes(lq) || t.category?.toLowerCase().includes(lq)).forEach(t => {
    push({ id: t.id, type: 'Transação', label: t.description || t.category, sub: `${t.type === 'receita' ? '+' : '-'} R$ ${t.amount.toLocaleString('pt-BR')} · ${t.category}`, color: t.type === 'receita' ? 'green' : 'red', section: 'fin' })
  })

  const goals: Goal[] = (() => { try { return JSON.parse(localStorage.getItem('lion-goals') || '[]') } catch { return [] } })()
  goals.filter(g => g.name?.toLowerCase().includes(lq) || g.category?.toLowerCase().includes(lq)).forEach(g => {
    push({ id: g.id, type: 'Meta', label: g.name, sub: `R$ ${(g.current||0).toLocaleString('pt-BR')} / R$ ${(g.target||0).toLocaleString('pt-BR')}`, color: 'blue', section: 'goals' })
  })

  const rentals: Rental[] = (() => { try { return JSON.parse(localStorage.getItem('lion-rentals') || '[]') } catch { return [] } })()
  rentals.filter(r => r.property?.toLowerCase().includes(lq) || r.tenant?.toLowerCase().includes(lq)).forEach(r => {
    push({ id: r.id, type: 'Aluguel', label: r.property, sub: `${r.tenant} · R$ ${(r.value||0).toLocaleString('pt-BR')}/mês`, color: 'amber', section: 'rentals' })
  })

  const vehicles: Vehicle[] = (() => { try { return JSON.parse(localStorage.getItem('lion-vehicles') || '[]') } catch { return [] } })()
  vehicles.filter(v => v.name?.toLowerCase().includes(lq) || v.plate?.toLowerCase().includes(lq)).forEach(v => {
    push({ id: v.id, type: 'Veículo', label: v.name, sub: `${v.plate} · ${v.year} · ${(v.currentKm||0).toLocaleString('pt-BR')} km`, color: 'amber', section: 'vehicles' })
  })

  const maint: Maintenance[] = (() => { try { return JSON.parse(localStorage.getItem('lion-maintenance') || '[]') } catch { return [] } })()
  maint.filter(m => m.asset?.toLowerCase().includes(lq) || m.description?.toLowerCase().includes(lq)).forEach(m => {
    push({ id: m.id, type: 'Manutenção', label: m.asset, sub: `${m.description} · ${m.scheduledDate}`, color: 'purple', section: 'maint' })
  })

  const npFolders: Folder[] = (() => { try { return JSON.parse(localStorage.getItem('np-folders') || '[]') } catch { return [] } })()
  npFolders.forEach(folder => {
    folder.notes.filter(n => n.title?.toLowerCase().includes(lq) || n.content?.toLowerCase().includes(lq)).forEach(n => {
      push({ id: `${folder.id}:${n.id}`, type: 'Nota', label: n.title || 'Sem título', sub: `${folder.name} · ${n.content ? n.content.substring(0, 50) : 'Sem conteúdo'}`, color: 'blue', section: 'note' })
    })
  })

  return results
}

// ─── Calendar Page ───────────────────────────────────────────────────────────

interface CalEvent {
  id: string
  title: string
  date: string   // YYYY-MM-DD
  time: string
  category: 'financeiro' | 'pessoal' | 'viagem' | 'manutencao' | 'sistema'
  notes: string
  auto?: boolean
}

const CAL_COLORS: Record<CalEvent['category'], string> = {
  financeiro: '#3b82f6',
  pessoal:    '#8b5cf6',
  viagem:     '#f59e0b',
  manutencao: '#10b981',
  sistema:    '#94a3b8',
}
const CAL_LABELS: Record<CalEvent['category'], string> = {
  financeiro: 'Financeiro', pessoal: 'Pessoal', viagem: 'Viagem', manutencao: 'Manutenção', sistema: 'Sistema'
}

function buildAutoEvents(): CalEvent[] {
  const evs: CalEvent[] = []
  const now = new Date()

  // Vehicles: nextRevisionDate, ipvaExpiry, insuranceExpiry
  const vehicles: Vehicle[] = (() => { try { return JSON.parse(localStorage.getItem('lion-vehicles') || '[]') } catch { return [] } })()
  for (const v of vehicles) {
    if (v.nextRevisionDate) evs.push({ id: `veh-rev-${v.id}`, title: `Revisão: ${v.name}`, date: v.nextRevisionDate, time: '', category: 'manutencao', notes: '', auto: true })
    if (v.ipvaExpiry)       evs.push({ id: `veh-ipva-${v.id}`, title: `IPVA: ${v.name}`, date: v.ipvaExpiry, time: '', category: 'financeiro', notes: '', auto: true })
    if (v.insuranceExpiry)  evs.push({ id: `veh-seg-${v.id}`, title: `Seguro: ${v.name}`, date: v.insuranceExpiry, time: '', category: 'financeiro', notes: '', auto: true })
  }

  // Maintenance: scheduledDate
  const maint: Maintenance[] = (() => { try { return JSON.parse(localStorage.getItem('lion-maintenance') || '[]') } catch { return [] } })()
  for (const m of maint) {
    if (m.scheduledDate && m.status !== 'feito') evs.push({ id: `maint-${m.id}`, title: `${m.type}: ${m.asset}`, date: m.scheduledDate, time: '', category: 'manutencao', notes: m.notes, auto: true })
  }

  // Rentals: dueDay every month for next 3 months
  const rentals: Rental[] = (() => { try { return JSON.parse(localStorage.getItem('lion-rentals') || '[]') } catch { return [] } })()
  for (const r of rentals) {
    for (let m = 0; m < 3; m++) {
      const d = new Date(now.getFullYear(), now.getMonth() + m, r.dueDay)
      const dateStr = d.toISOString().slice(0, 10)
      evs.push({ id: `rent-${r.id}-${m}`, title: `Aluguel: ${r.property}`, date: dateStr, time: '', category: 'financeiro', notes: `Locatário: ${r.tenant}`, auto: true })
    }
  }

  return evs
}

const CAL_FORM_INIT: Omit<CalEvent, 'id' | 'auto'> = { title: '', date: '', time: '', category: 'pessoal', notes: '' }

function CalendarPage() {
  const [userEvents, setUserEvents] = useCloudTable<CalEvent>('calendar_events', 'lion-calendar')
  const [autoEvents] = useState<CalEvent[]>(() => buildAutoEvents())
  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...CAL_FORM_INIT })


  const allEvents = [...userEvents, ...autoEvents]
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  function saveEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !selectedDate) return
    const event: CalEvent = { ...form, date: selectedDate, id: Date.now().toString() }
    setUserEvents(prev => {
      const next = [...prev, event]
      localStorage.setItem('lion-calendar', JSON.stringify(next))
      return next
    })
    setForm({ ...CAL_FORM_INIT }); setShowForm(false)
  }

  function delEvent(id: string) { setUserEvents(prev => prev.filter(e => e.id !== id)) }

  // Build calendar grid
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startOffset = firstDay === 0 ? 6 : firstDay - 1 // Mon-start
  const today = new Date().toISOString().slice(0, 10)

  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const eventsOnDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return allEvents.filter(e => e.date === dateStr)
  }

  const selectedEvents = selectedDate ? allEvents.filter(e => e.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time)) : []

  const monthNames = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

  return (
    <div className="cal-page">
      <div className="cal-layout">
        {/* Calendar grid */}
        <div className="cal-main">
          <div className="cal-nav">
            <button className="cal-nav-btn" onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10 4L6 8l4 4"/></svg>
            </button>
            <h2 className="cal-month-title">{monthNames[month]} {year}</h2>
            <button className="cal-nav-btn" onClick={() => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M6 4l4 4-4 4"/></svg>
            </button>
            <button className="cal-today-btn" onClick={() => { const d = new Date(); d.setDate(1); setCurrentMonth(d); setSelectedDate(today) }}>Hoje</button>
          </div>

          <div className="cal-grid">
            {['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'].map(d => (
              <div key={d} className="cal-weekday">{d}</div>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} className="cal-cell cal-cell-empty" />
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const dayEvents = eventsOnDay(day)
              const isToday = dateStr === today
              const isSelected = dateStr === selectedDate
              return (
                <button key={dateStr} className={`cal-cell${isToday ? ' cal-today' : ''}${isSelected ? ' cal-selected' : ''}`}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}>
                  <span className="cal-day-num">{day}</span>
                  <div className="cal-dots">
                    {dayEvents.slice(0, 3).map(ev => (
                      <span key={ev.id} className="cal-dot" style={{ background: CAL_COLORS[ev.category] }} />
                    ))}
                    {dayEvents.length > 3 && <span className="cal-dot-more">+{dayEvents.length - 3}</span>}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="cal-legend">
            {Object.entries(CAL_COLORS).map(([k, c]) => (
              <div key={k} className="cal-legend-item">
                <span className="cal-dot" style={{ background: c }} />
                <span>{CAL_LABELS[k as CalEvent['category']]}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Day panel */}
        <div className="cal-sidebar">
          {!selectedDate ? (
            <div className="cal-no-day">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" width="32" height="32" style={{ opacity: .2 }}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round"/></svg>
              <span>Selecione um dia</span>
            </div>
          ) : (
            <>
              <div className="cal-day-header">
                <div>
                  <div className="cal-day-title">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                  <div className="cal-day-count">{selectedEvents.length} evento{selectedEvents.length !== 1 ? 's' : ''}</div>
                </div>
                <button className="goals-add-btn" onClick={() => { setShowForm(v => !v); setForm({ ...CAL_FORM_INIT, date: selectedDate }) }}>
                  {showForm ? '✕' : '+ Evento'}
                </button>
              </div>

              {showForm && (
                <form className="cal-form" onSubmit={saveEvent}>
                  <div className="cal-form-date-label">
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="3" width="14" height="11" rx="2"/><path d="M5 1v3M11 1v3M1 7h14" strokeLinecap="round"/></svg>
                    {selectedDate ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
                  </div>
                  <div className="fin-field">
                    <label>Título *</label>
                    <input type="text" value={form.title} onChange={e => f('title', e.target.value)} placeholder="Ex: Reunião de negócios" required autoFocus />
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                    <div className="fin-field">
                      <label>Horário</label>
                      <input type="time" value={form.time} onChange={e => f('time', e.target.value)} />
                    </div>
                    <div className="fin-field">
                      <label>Categoria</label>
                      <select value={form.category} onChange={e => f('category', e.target.value)}>
                        {Object.entries(CAL_LABELS).filter(([k]) => k !== 'sistema').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="fin-field">
                    <label>Notas</label>
                    <input type="text" value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Opcional" />
                  </div>
                  <div className="goal-form-actions">
                    <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
                    <button type="submit" className="btn-accent">Salvar</button>
                  </div>
                </form>
              )}

              {selectedEvents.length === 0 && !showForm ? (
                <div className="cal-empty-day">Nenhum evento neste dia.</div>
              ) : (
                <div className="cal-events-list">
                  {selectedEvents.map(ev => (
                    <div key={ev.id} className="cal-event-item" style={{ borderLeftColor: CAL_COLORS[ev.category] }}>
                      <div className="cal-event-top">
                        <span className="cal-event-cat" style={{ color: CAL_COLORS[ev.category] }}>{CAL_LABELS[ev.category]}</span>
                        {ev.time && <span className="cal-event-time">{ev.time}</span>}
                        {!ev.auto && <button className="goal-action-btn goal-del-btn" onClick={() => delEvent(ev.id)} style={{ marginLeft:'auto' }}>
                          <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </button>}
                        {ev.auto && <span className="cal-event-auto">automático</span>}
                      </div>
                      <div className="cal-event-title">{ev.title}</div>
                      {ev.notes && <div className="cal-event-notes">{ev.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Goals Page ──────────────────────────────────────────────────────────────

const GOAL_CATS = ['Reserva de emergência','Imóvel','Veículo','Viagem','Educação','Aposentadoria','Investimento','Outro']
const GOAL_COLORS: Record<string, string> = {
  'Reserva de emergência': 'var(--amber)',
  'Imóvel':                'var(--blue)',
  'Veículo':               'var(--purple-l)',
  'Viagem':                'var(--green)',
  'Educação':              '#8b5cf6',
  'Aposentadoria':         '#ec4899',
  'Investimento':          'var(--blue-l)',
  'Outro':                 'var(--text)',
}
const GOAL_FORM_INIT = { name: '', category: GOAL_CATS[0], target: '', current: '', deadline: '' }

function GoalsPage() {
  const [goals, setGoals] = useCloudTable<Goal>('goals', 'lion-goals')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [form, setForm]         = useState(GOAL_FORM_INIT)
  const [filterCat, setFilterCat] = useState('Todas')
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))


  function saveGoal(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.target) return
    const g: Goal = {
      id: editId || Date.now().toString(),
      name: form.name.trim(),
      category: form.category,
      target: parseFloat(form.target) || 0,
      current: parseFloat(form.current) || 0,
      deadline: form.deadline,
    }
    setGoals(prev => editId ? prev.map(x => x.id === editId ? g : x) : [...prev, g])
    setForm(GOAL_FORM_INIT); setShowForm(false); setEditId(null)
  }

  function startEdit(g: Goal) {
    setForm({ name: g.name, category: g.category, target: String(g.target), current: String(g.current), deadline: g.deadline })
    setEditId(g.id); setShowForm(true)
  }

  function delGoal(id: string) { setGoals(prev => prev.filter(g => g.id !== id)) }

  function addDeposit(id: string, amount: number) {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, current: Math.min(g.current + amount, g.target) } : g))
  }

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  const pct = (g: Goal) => g.target > 0 ? Math.min((g.current / g.target) * 100, 100) : 0

  const daysLeft = (deadline: string) => {
    if (!deadline) return null
    const diff = Math.ceil((new Date(deadline + 'T12:00:00').getTime() - Date.now()) / 86400000)
    if (diff < 0)  return { label: 'Vencida', color: 'var(--red)' }
    if (diff === 0) return { label: 'Hoje', color: 'var(--amber)' }
    if (diff <= 30) return { label: `${diff}d`, color: 'var(--amber)' }
    const months = Math.round(diff / 30)
    return { label: `${months}m`, color: 'var(--text)' }
  }

  const barColor = (g: Goal) => {
    const p = pct(g)
    if (p >= 100) return 'goal-bar-done'
    if (p >= 70)  return 'goal-bar-green'
    if (p >= 40)  return 'goal-bar-amber'
    return 'goal-bar-blue-solid'
  }

  const cats = ['Todas', ...GOAL_CATS.filter(c => goals.some(g => g.category === c))]
  const shown = filterCat === 'Todas' ? goals : goals.filter(g => g.category === filterCat)
  const totalSaved  = goals.reduce((s, g) => s + g.current, 0)
  const totalTarget = goals.reduce((s, g) => s + g.target, 0)
  const done        = goals.filter(g => g.current >= g.target).length

  return (
    <div className="goals-page">
      <div className="goals-page-header">
        <div>
          <h1 className="family-page-title">Metas Financeiras</h1>
          <p className="family-page-sub">{goals.length} meta{goals.length !== 1 ? 's' : ''} · {done} concluída{done !== 1 ? 's' : ''}</p>
        </div>
        <button className="goals-add-btn" onClick={() => { setShowForm(v => !v); setEditId(null); setForm(GOAL_FORM_INIT) }}>
          {showForm && !editId ? '✕ Cancelar' : '+ Nova Meta'}
        </button>
      </div>

      {goals.length > 0 && (
        <div className="goals-page-summary">
          <div className="goals-summary-item">
            <span className="goals-summary-label">Total guardado</span>
            <span className="goals-summary-val" style={{ color: 'var(--green)' }}>{fmt(totalSaved)}</span>
          </div>
          <div className="goals-summary-item">
            <span className="goals-summary-label">Total a atingir</span>
            <span className="goals-summary-val">{fmt(totalTarget)}</span>
          </div>
          <div className="goals-summary-item">
            <span className="goals-summary-label">Progresso geral</span>
            <span className="goals-summary-val" style={{ color: totalTarget > 0 && totalSaved >= totalTarget ? 'var(--green)' : 'var(--text3)' }}>
              {totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0}%
            </span>
          </div>
          <div className="goals-summary-item">
            <span className="goals-summary-label">Concluídas</span>
            <span className="goals-summary-val" style={{ color: 'var(--purple-l)' }}>{done}/{goals.length}</span>
          </div>
        </div>
      )}

      {showForm && (
        <form className="goals-page-form" onSubmit={saveGoal}>
          <div className="goals-page-form-grid">
            <div className="fin-field gp-span2">
              <label>Nome da meta *</label>
              <input type="text" placeholder="Ex: Casa própria, Viagem Europa…" value={form.name} onChange={e => f('name', e.target.value)} required />
            </div>
            <div className="fin-field">
              <label>Categoria</label>
              <select value={form.category} onChange={e => f('category', e.target.value)}>
                {GOAL_CATS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="fin-field">
              <label>Prazo</label>
              <input type="date" value={form.deadline} onChange={e => f('deadline', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Valor alvo (R$) *</label>
              <input type="number" placeholder="0" value={form.target} onChange={e => f('target', e.target.value)} required min="1" />
            </div>
            <div className="fin-field">
              <label>Valor atual (R$)</label>
              <input type="number" placeholder="0" value={form.current} onChange={e => f('current', e.target.value)} min="0" />
            </div>
          </div>
          <div className="goal-form-actions">
            <button type="button" className="btn-ghost" onClick={() => { setShowForm(false); setEditId(null) }}>Cancelar</button>
            <button type="submit" className="btn-accent">{editId ? 'Salvar alterações' : 'Criar meta'}</button>
          </div>
        </form>
      )}

      {goals.length === 0 && !showForm && (
        <div className="family-empty">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" width="48" height="48" style={{ opacity:.2 }}>
            <circle cx="24" cy="24" r="20"/><circle cx="24" cy="24" r="12"/><circle cx="24" cy="24" r="4"/>
            <line x1="24" y1="4" x2="24" y2="44" strokeLinecap="round"/>
            <line x1="4" y1="24" x2="44" y2="24" strokeLinecap="round"/>
          </svg>
          <p>Nenhuma meta cadastrada ainda.</p>
          <button className="btn-accent" style={{ marginTop: 8 }} onClick={() => setShowForm(true)}>+ Criar primeira meta</button>
        </div>
      )}

      {goals.length > 1 && (
        <div className="goals-page-filters">
          {cats.map(c => (
            <button key={c} className={`goals-filter-btn${filterCat === c ? ' active' : ''}`} onClick={() => setFilterCat(c)}>{c}</button>
          ))}
        </div>
      )}

      {shown.length > 0 && (
        <div className="goals-page-grid">
          {shown.map(g => {
            const p = pct(g)
            const dl = daysLeft(g.deadline)
            const color = GOAL_COLORS[g.category] || 'var(--text)'
            const isDone = p >= 100
            return (
              <div key={g.id} className={`goals-page-card${isDone ? ' gpc-done' : ''}`} style={{ '--gpc-color': color } as React.CSSProperties}>
                <div className="gpc-top">
                  <div className="gpc-cat-dot" style={{ background: color }} />
                  <span className="gpc-cat">{g.category}</span>
                  {dl && <span className="gpc-deadline" style={{ color: dl.color }}>{dl.label}</span>}
                  <div className="goal-actions" style={{ marginLeft: 'auto' }}>
                    <button className="goal-action-btn" onClick={() => startEdit(g)}>
                      <svg viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                    </button>
                    <button className="goal-action-btn goal-del-btn" onClick={() => delGoal(g.id)}>
                      <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                </div>

                <div className="gpc-name">{g.name}</div>

                <div className="gpc-amounts">
                  <span className="gpc-current">{fmt(g.current)}</span>
                  <span className="gpc-sep">/</span>
                  <span className="gpc-target">{fmt(g.target)}</span>
                </div>

                <div className="goal-bar-track">
                  <div className={`goal-bar-fill ${barColor(g)}`} style={{ width: `${p}%` }} />
                </div>

                <div className="gpc-footer">
                  <span className="gpc-pct" style={{ color: isDone ? 'var(--green)' : 'var(--text2)' }}>{Math.round(p)}%{isDone ? ' ✓' : ''}</span>
                  {!isDone && (
                    <GoalDepositBtn goalId={g.id} onDeposit={addDeposit} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function GoalDepositBtn({ goalId, onDeposit }: { goalId: string; onDeposit: (id: string, amount: number) => void }) {
  const [open, setOpen] = useState(false)
  const [val, setVal]   = useState('')
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const n = parseFloat(val)
    if (!n || n <= 0) return
    onDeposit(goalId, n); setVal(''); setOpen(false)
  }
  if (!open) return (
    <button className="gpc-deposit-btn" onClick={() => setOpen(true)}>+ Depositar</button>
  )
  return (
    <form className="gpc-deposit-form" onSubmit={submit}>
      <input autoFocus type="number" placeholder="R$ valor" value={val} onChange={e => setVal(e.target.value)} min="0.01" step="0.01" />
      <button type="submit" className="btn-accent" style={{ padding:'3px 10px', fontSize:11 }}>OK</button>
      <button type="button" className="btn-ghost" style={{ padding:'3px 8px', fontSize:11 }} onClick={() => setOpen(false)}>✕</button>
    </form>
  )
}

// ─── Trips Page ──────────────────────────────────────────────────────────────

interface Trip {
  id: string
  destination: string
  country: string
  departDate: string
  returnDate: string
  budget: string
  spent: string
  status: 'planejando' | 'confirmado' | 'em viagem' | 'concluído'
  notes: string
  checklist: { id: string; text: string; done: boolean }[]
}

const TRIP_STATUS_COLOR: Record<Trip['status'], string> = {
  'planejando':  '#94a3b8',
  'confirmado':  '#3b82f6',
  'em viagem':   '#10b981',
  'concluído':   '#6b7280',
}
const TRIP_FORM_INIT = { destination: '', country: '', departDate: '', returnDate: '', budget: '', spent: '0', status: 'planejando' as Trip['status'], notes: '' }

function TripsPage() {
  const [trips, setTrips] = useCloudTable<Trip>('trips', 'lion-trips')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(TRIP_FORM_INIT)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [newItem, setNewItem] = useState('')
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))


  function saveTrip(e: React.FormEvent) {
    e.preventDefault()
    if (!form.destination.trim() || !form.departDate) return
    const t: Trip = { ...form, id: editId || Date.now().toString(), checklist: editId ? (trips.find(x => x.id === editId)?.checklist ?? []) : [] }
    setTrips(prev => editId ? prev.map(x => x.id === editId ? t : x) : [...prev, t])
    setForm(TRIP_FORM_INIT); setShowForm(false); setEditId(null)
  }

  function startEdit(t: Trip) {
    setForm({ destination: t.destination, country: t.country, departDate: t.departDate, returnDate: t.returnDate, budget: t.budget, spent: t.spent, status: t.status, notes: t.notes })
    setEditId(t.id); setShowForm(true); setExpandedId(null)
  }

  function delTrip(id: string) { setTrips(prev => prev.filter(t => t.id !== id)) }

  function addCheckItem(id: string) {
    if (!newItem.trim()) return
    setTrips(prev => prev.map(t => t.id === id ? { ...t, checklist: [...t.checklist, { id: Date.now().toString(), text: newItem.trim(), done: false }] } : t))
    setNewItem('')
  }

  function toggleCheck(tripId: string, itemId: string) {
    setTrips(prev => prev.map(t => t.id === tripId ? { ...t, checklist: t.checklist.map(c => c.id === itemId ? { ...c, done: !c.done } : c) } : t))
  }

  function delCheck(tripId: string, itemId: string) {
    setTrips(prev => prev.map(t => t.id === tripId ? { ...t, checklist: t.checklist.filter(c => c.id !== itemId) } : t))
  }

  const daysUntil = (date: string) => {
    const diff = Math.ceil((new Date(date + 'T12:00:00').getTime() - Date.now()) / 86400000)
    if (diff < 0) return null
    if (diff === 0) return 'Hoje!'
    return `${diff} dia${diff !== 1 ? 's' : ''}`
  }

  const duration = (d1: string, d2: string) => {
    if (!d1 || !d2) return ''
    const days = Math.ceil((new Date(d2 + 'T12:00:00').getTime() - new Date(d1 + 'T12:00:00').getTime()) / 86400000)
    return `${days} dia${days !== 1 ? 's' : ''}`
  }

  const fmtDate = (s: string) => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : ''
  const fmtCurr = (v: string) => v ? parseFloat(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }) : 'R$ 0'

  const sorted = [...trips].sort((a, b) => a.departDate.localeCompare(b.departDate))
  const upcoming = sorted.filter(t => t.status !== 'concluído')
  const past     = sorted.filter(t => t.status === 'concluído')

  return (
    <div className="trips-page">
      <div className="trips-header">
        <div>
          <h1 className="family-page-title">Próximas Viagens</h1>
          <p className="family-page-sub">{upcoming.length} viagem{upcoming.length !== 1 ? 's' : ''} planejada{upcoming.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="goals-add-btn" onClick={() => { setShowForm(v => !v); setEditId(null); setForm(TRIP_FORM_INIT) }}>
          {showForm && !editId ? '✕ Cancelar' : '+ Nova Viagem'}
        </button>
      </div>

      {showForm && (
        <form className="trip-form" onSubmit={saveTrip}>
          <div className="trip-form-grid">
            <div className="fin-field trip-span2">
              <label>Destino *</label>
              <input type="text" placeholder="Ex: Paris, Nova York, Florianópolis" value={form.destination} onChange={e => f('destination', e.target.value)} required />
            </div>
            <div className="fin-field">
              <label>País / Estado</label>
              <input type="text" placeholder="Ex: França" value={form.country} onChange={e => f('country', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Status</label>
              <select value={form.status} onChange={e => f('status', e.target.value)}>
                {(['planejando','confirmado','em viagem','concluído'] as Trip['status'][]).map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
              </select>
            </div>
            <div className="fin-field">
              <label>Data de ida *</label>
              <input type="date" value={form.departDate} onChange={e => f('departDate', e.target.value)} required />
            </div>
            <div className="fin-field">
              <label>Data de volta</label>
              <input type="date" value={form.returnDate} onChange={e => f('returnDate', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Orçamento (R$)</label>
              <input type="number" placeholder="0" value={form.budget} onChange={e => f('budget', e.target.value)} />
            </div>
            <div className="fin-field">
              <label>Gasto até agora (R$)</label>
              <input type="number" placeholder="0" value={form.spent} onChange={e => f('spent', e.target.value)} />
            </div>
            <div className="fin-field trip-span2">
              <label>Notas</label>
              <input type="text" placeholder="Observações, hotel, passagem…" value={form.notes} onChange={e => f('notes', e.target.value)} />
            </div>
          </div>
          <div className="goal-form-actions">
            <button type="button" className="btn-ghost" onClick={() => { setShowForm(false); setEditId(null) }}>Cancelar</button>
            <button type="submit" className="btn-accent">{editId ? 'Salvar alterações' : 'Adicionar viagem'}</button>
          </div>
        </form>
      )}

      {trips.length === 0 && !showForm && (
        <div className="family-empty">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" width="48" height="48" style={{ opacity: .2 }}>
            <path d="M6 38l8-16 6 8 8-12 14 20H6z"/><circle cx="36" cy="12" r="6"/>
            <path d="M2 44h44" strokeLinecap="round"/>
          </svg>
          <p>Nenhuma viagem cadastrada.</p>
          <button className="btn-accent" style={{ marginTop: 8 }} onClick={() => setShowForm(true)}>+ Adicionar viagem</button>
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="trips-section">
          <div className="trips-grid">
            {upcoming.map(t => {
              const days = daysUntil(t.departDate)
              const dur  = duration(t.departDate, t.returnDate)
              const budgetNum = parseFloat(t.budget) || 0
              const spentNum  = parseFloat(t.spent)  || 0
              const pct = budgetNum > 0 ? Math.min((spentNum / budgetNum) * 100, 100) : 0
              const isExp = expandedId === t.id
              const doneCount = t.checklist.filter(c => c.done).length
              return (
                <div key={t.id} className="trip-card">
                  <div className="trip-card-top">
                    <div className="trip-dest-wrap">
                      <span className="trip-flag"><svg viewBox="0 0 20 20" fill="none"><path d="M3 13l2-5 3 2 3-8 3 2-2 5 3 1-1 3-4-1-1 3-2-1 1-3-4-1-.5 1.5-1.5-1.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/></svg></span>
                      <div>
                        <div className="trip-destination">{t.destination}</div>
                        {t.country && <div className="trip-country">{t.country}</div>}
                      </div>
                    </div>
                    <div className="trip-actions-wrap">
                      {days && <span className="trip-countdown" style={{ color: TRIP_STATUS_COLOR[t.status] }}>{days}</span>}
                      <div className="goal-actions">
                        <button className="goal-action-btn" onClick={() => startEdit(t)}><svg viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg></button>
                        <button className="goal-action-btn goal-del-btn" onClick={() => delTrip(t.id)}><svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button>
                      </div>
                    </div>
                  </div>

                  <div className="trip-meta">
                    <span className="trip-status-badge" style={{ background: TRIP_STATUS_COLOR[t.status] + '22', color: TRIP_STATUS_COLOR[t.status], borderColor: TRIP_STATUS_COLOR[t.status] + '44' }}>{t.status}</span>
                    <span className="trip-dates">{fmtDate(t.departDate)}{t.returnDate && ` → ${fmtDate(t.returnDate)}`}{dur && ` · ${dur}`}</span>
                  </div>

                  {budgetNum > 0 && (
                    <div className="trip-budget">
                      <div className="trip-budget-row">
                        <span>Orçamento</span>
                        <span>{fmtCurr(t.spent)} / {fmtCurr(t.budget)}</span>
                      </div>
                      <div className="goal-bar-track">
                        <div className={`goal-bar-fill ${pct > 90 ? 'bar-red' : pct > 70 ? 'bar-amber' : 'bar-blue'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}

                  <button className="trip-checklist-toggle" onClick={() => setExpandedId(isExp ? null : t.id)}>
                    <span>Checklist {t.checklist.length > 0 && `(${doneCount}/${t.checklist.length})`}</span>
                    <svg viewBox="0 0 16 16" fill="none" style={{ transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                  </button>

                  {isExp && (
                    <div className="trip-checklist">
                      {t.checklist.map(c => (
                        <div key={c.id} className="trip-check-item">
                          <button className={`trip-check-box${c.done ? ' checked' : ''}`} onClick={() => toggleCheck(t.id, c.id)}>
                            {c.done && <svg viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                          </button>
                          <span style={{ textDecoration: c.done ? 'line-through' : 'none', color: c.done ? 'var(--text)' : 'var(--text2)', fontSize: 12 }}>{c.text}</span>
                          <button className="goal-action-btn goal-del-btn" style={{ marginLeft:'auto', width:18, height:18 }} onClick={() => delCheck(t.id, c.id)}>
                            <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          </button>
                        </div>
                      ))}
                      <div className="trip-check-add">
                        <input placeholder="Adicionar item…" value={newItem} onChange={e => setNewItem(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCheckItem(t.id) } }} />
                        <button className="btn-accent" onClick={() => addCheckItem(t.id)} style={{ padding:'4px 10px', fontSize:11 }}>+</button>
                      </div>
                    </div>
                  )}

                  {t.notes && <div className="trip-notes">{t.notes}</div>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div className="trips-section">
          <div className="trips-section-title">Viagens concluídas</div>
          <div className="trips-grid">
            {past.map(t => (
              <div key={t.id} className="trip-card trip-card-past">
                <div className="trip-card-top">
                  <div className="trip-dest-wrap">
                    <span className="trip-flag" style={{ opacity:.5 }}>✈️</span>
                    <div>
                      <div className="trip-destination" style={{ opacity:.7 }}>{t.destination}</div>
                      {t.country && <div className="trip-country">{t.country}</div>}
                    </div>
                  </div>
                  <div className="goal-actions">
                    <button className="goal-action-btn goal-del-btn" onClick={() => delTrip(t.id)}><svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></button>
                  </div>
                </div>
                <div className="trip-meta">
                  <span className="trip-dates">{fmtDate(t.departDate)}{t.returnDate && ` → ${fmtDate(t.returnDate)}`}</span>
                  {parseFloat(t.spent) > 0 && <span className="trip-dates">Gasto: {fmtCurr(t.spent)}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Family Page ─────────────────────────────────────────────────────────────

const MEMBER_COLORS = ['#c0392b','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#84cc16']
const MEMBER_ROLES  = ['Responsável','Cônjuge','Filho(a)','Dependente','Sócio(a)','Outro']
const MEMBER_FORM_INIT = { name: '', role: MEMBER_ROLES[0], color: MEMBER_COLORS[0] }

function FamilyPage() {
  const [members, setMembers] = useCloudTable<FamilyMember>('family_members', 'lion-family')
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(MEMBER_FORM_INIT)
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))


  const initials = (name: string) => name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2)

  function saveMember(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    const m: FamilyMember = { id: editId || Date.now().toString(), name: form.name.trim(), role: form.role, color: form.color }
    setMembers(prev => editId ? prev.map(x => x.id === editId ? m : x) : [...prev, m])
    setForm(MEMBER_FORM_INIT); setShowForm(false); setEditId(null)
  }

  function startEdit(m: FamilyMember) {
    setForm({ name: m.name, role: m.role, color: m.color })
    setEditId(m.id); setShowForm(true)
  }

  function delMember(id: string) { setMembers(prev => prev.filter(m => m.id !== id)) }

  // spending per member from transactions
  const txs: Transaction[] = (() => { try { return JSON.parse(localStorage.getItem('lion-txs') || '[]') } catch { return [] } })()
  const spending = (id: string) => txs.filter(t => (t as Transaction & { memberId?: string }).memberId === id && t.type === 'despesa').reduce((s, t) => s + t.amount, 0)
  const income   = (id: string) => txs.filter(t => (t as Transaction & { memberId?: string }).memberId === id && t.type === 'receita').reduce((s, t) => s + t.amount, 0)
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  return (
    <div className="family-page">
      <div className="family-page-header">
        <div>
          <h1 className="family-page-title">Família</h1>
          <p className="family-page-sub">Gerencie os membros e acompanhe gastos por pessoa</p>
        </div>
        <button className="goals-add-btn" onClick={() => { setShowForm(v => !v); setEditId(null); setForm(MEMBER_FORM_INIT) }}>
          {showForm && !editId ? '✕ Cancelar' : '+ Membro'}
        </button>
      </div>

      {showForm && (
        <form className="family-form" onSubmit={saveMember}>
          <div className="family-form-grid">
            <div className="fin-field">
              <label>Nome *</label>
              <input type="text" placeholder="Ex: Maria Silva" value={form.name} onChange={e => f('name', e.target.value)} required />
            </div>
            <div className="fin-field">
              <label>Papel</label>
              <select value={form.role} onChange={e => f('role', e.target.value)}>
                {MEMBER_ROLES.map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div className="fin-field family-color-field">
              <label>Cor do avatar</label>
              <div className="family-colors">
                {MEMBER_COLORS.map(c => (
                  <button key={c} type="button" className={`family-color-dot${form.color === c ? ' selected' : ''}`}
                    style={{ background: c }} onClick={() => f('color', c)} />
                ))}
              </div>
            </div>
          </div>
          <div className="goal-form-actions">
            <button type="button" className="btn-ghost" onClick={() => { setShowForm(false); setEditId(null) }}>Cancelar</button>
            <button type="submit" className="btn-accent">{editId ? 'Salvar alterações' : 'Adicionar membro'}</button>
          </div>
        </form>
      )}

      {members.length === 0 && !showForm ? (
        <div className="family-empty">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.2" width="48" height="48" style={{ opacity: .25 }}>
            <path d="M24 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z"/>
            <path d="M8 42a16 16 0 0 1 32 0"/>
            <path d="M36 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM44 36a8 8 0 0 0-8-8"/>
            <path d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM4 36a8 8 0 0 1 8-8"/>
          </svg>
          <p>Nenhum membro cadastrado ainda.</p>
          <button className="btn-accent" style={{ marginTop: 8 }} onClick={() => setShowForm(true)}>+ Adicionar primeiro membro</button>
        </div>
      ) : (
        <div className="family-grid">
          {members.map(m => {
            const sp = spending(m.id)
            const inc = income(m.id)
            return (
              <div key={m.id} className="family-card">
                <div className="family-card-top">
                  <div className="family-avatar" style={{ background: m.color }}>{initials(m.name)}</div>
                  <div className="family-card-info">
                    <div className="family-card-name">{m.name}</div>
                    <div className="family-card-role">{m.role}</div>
                  </div>
                  <div className="goal-actions">
                    <button className="goal-action-btn" onClick={() => startEdit(m)} title="Editar">
                      <svg viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3l8-8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                    </button>
                    <button className="goal-action-btn goal-del-btn" onClick={() => delMember(m.id)} title="Remover">
                      <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    </button>
                  </div>
                </div>
                <div className="family-card-stats">
                  <div className="family-stat">
                    <span className="family-stat-label">Receitas</span>
                    <span className="family-stat-val" style={{ color: 'var(--green)' }}>{fmt(inc)}</span>
                  </div>
                  <div className="family-stat">
                    <span className="family-stat-label">Gastos</span>
                    <span className="family-stat-val" style={{ color: 'var(--red)' }}>{fmt(sp)}</span>
                  </div>
                  <div className="family-stat">
                    <span className="family-stat-label">Saldo</span>
                    <span className="family-stat-val" style={{ color: inc - sp >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(inc - sp)}</span>
                  </div>
                </div>
                <p className="family-card-hint">Associe transações a este membro no painel financeiro</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Appearance Page ──────────────────────────────────────────────────────────

interface AppearancePageProps {
  themeId: string; setThemeId: (v: string) => void
  fontSize: string; setFontSize: (v: string) => void
  accentId: string; setAccentId: (v: string) => void
  animations: boolean; setAnimations: (v: boolean) => void
  sidebarFixed: boolean; setSidebarFixed: (v: boolean) => void
}

function AppearancePage({ themeId, setThemeId, fontSize, setFontSize, accentId, setAccentId, animations, setAnimations, sidebarFixed, setSidebarFixed }: AppearancePageProps) {
  const currentAccent = ACCENT_COLORS.find(a => a.id === accentId) ?? ACCENT_COLORS[0]

  return (
    <div className="settings-page">
      <h2 className="settings-title">Aparência</h2>

      {/* Tema */}
      <section className="settings-card">
        <div className="settings-card-title">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="3"/><path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" strokeLinecap="round"/></svg>
          Tema
        </div>
        <div className="ap-theme-grid">
          {THEMES.map(t => (
            <button key={t.id} className={`ap-theme-card${themeId === t.id ? ' ap-theme-active' : ''}`} onClick={() => setThemeId(t.id)}>
              <div className="ap-theme-preview" style={{ background: t.swatch }}>
                <div className="ap-theme-sidebar" style={{ background: t.bg }} />
                <div className="ap-theme-content">
                  <div className="ap-theme-bar" style={{ background: currentAccent.color }} />
                  <div className="ap-theme-line" style={{ background: t.id === 'light' ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.12)' }} />
                  <div className="ap-theme-line ap-theme-line-short" style={{ background: t.id === 'light' ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.08)' }} />
                </div>
              </div>
              <div className="ap-theme-label">
                {t.label}
                {themeId === t.id && <svg viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Cor de destaque */}
      <section className="settings-card">
        <div className="settings-card-title">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="7"/><path d="M10 3v2M10 15v2M3 10h2M15 10h2" strokeLinecap="round"/></svg>
          Cor de Destaque
        </div>
        <p className="settings-hint">Afeta botões, destaques e elementos interativos em todo o app.</p>
        <div className="ap-accent-grid">
          {ACCENT_COLORS.map(a => (
            <button key={a.id} className={`ap-accent-btn${accentId === a.id ? ' ap-accent-active' : ''}`}
              style={{ '--accent-col': a.color } as React.CSSProperties}
              onClick={() => setAccentId(a.id)} title={a.label}>
              <div className="ap-accent-swatch" style={{ background: `linear-gradient(135deg, ${a.color}, ${a.light})` }} />
              <span className="ap-accent-label">{a.label}</span>
              {accentId === a.id && <svg className="ap-accent-check" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>}
            </button>
          ))}
        </div>
      </section>

      {/* Tamanho da fonte */}
      <section className="settings-card">
        <div className="settings-card-title">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 16l5-12 5 12M5.5 11h5M13 7h4M15 5v10" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Tamanho da Fonte
        </div>
        <div className="ap-font-grid">
          {FONT_SIZES.map(f => (
            <button key={f.id} className={`ap-font-card${fontSize === f.id ? ' ap-font-active' : ''}`} onClick={() => setFontSize(f.id)}>
              <span className="ap-font-sample" style={{ fontSize: f.size }}>Aa</span>
              <span className="ap-font-label">{f.title}</span>
              {fontSize === f.id && <svg className="ap-font-check" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>}
            </button>
          ))}
        </div>
      </section>

      {/* Toggles */}
      <section className="settings-card">
        <div className="settings-card-title">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="6" width="16" height="8" rx="4"/><circle cx={animations ? '14' : '6'} cy="10" r="3" fill="currentColor" stroke="none"/></svg>
          Preferências
        </div>
        <div className="ap-toggle-row" onClick={() => setAnimations(!animations)}>
          <div className="ap-toggle-info">
            <span className="ap-toggle-name">Animações</span>
            <span className="ap-toggle-desc">Transições e efeitos visuais ao interagir com o app</span>
          </div>
          <div className={`ap-toggle${animations ? ' ap-toggle-on' : ''}`}>
            <div className="ap-toggle-thumb" />
          </div>
        </div>
        <div className="ap-toggle-row" onClick={() => setSidebarFixed(!sidebarFixed)}>
          <div className="ap-toggle-info">
            <span className="ap-toggle-name">Barra lateral sempre visível</span>
            <span className="ap-toggle-desc">Mantém o menu lateral aberto no desktop sem precisar clicar</span>
          </div>
          <div className={`ap-toggle${sidebarFixed ? ' ap-toggle-on' : ''}`}>
            <div className="ap-toggle-thumb" />
          </div>
        </div>
      </section>
    </div>
  )
}

// ─── Settings Page ────────────────────────────────────────────────────────────

function SettingsPage({ user }: { user: User | null }) {
  const [logo, setLogo] = useState<string>(() => localStorage.getItem('lion-logo') || '')
  const [favicon, setFavicon] = useState<string>(() => localStorage.getItem('lion-favicon') || '')
  const [logoSaved, setLogoSaved] = useState(false)
  const [favSaved, setFavSaved] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Usuário'
  const initials = displayName.split(/\s|@/).filter(Boolean).slice(0, 2).map((s: string) => s[0].toUpperCase()).join('')
  const createdAt = user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'
  const provider = user?.app_metadata?.provider ?? 'email'

  const readFile = (file: File): Promise<string> => new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const data = await readFile(f)
    setLogo(data)
    localStorage.setItem('lion-logo', data)
    window.dispatchEvent(new Event('lion-logo-changed'))
    setLogoSaved(true); setTimeout(() => setLogoSaved(false), 2000)
  }

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const data = await readFile(f)
    setFavicon(data)
    localStorage.setItem('lion-favicon', data)
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]') || (() => {
      const l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); return l
    })()
    link.href = data
    setFavSaved(true); setTimeout(() => setFavSaved(false), 2000)
  }

  const removeLogo = () => {
    setLogo(''); localStorage.removeItem('lion-logo')
    window.dispatchEvent(new Event('lion-logo-changed'))
  }

  const removeFavicon = () => {
    setFavicon(''); localStorage.removeItem('lion-favicon')
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
    if (link) link.href = '/lion-adiminstracao/favicon.svg'
  }

  const sendResetEmail = async () => {
    if (!supabase || !user?.email) return
    setPwLoading(true); setPwMsg('')
    const { error } = await supabase.auth.resetPasswordForEmail(user.email)
    setPwLoading(false)
    setPwMsg(error ? 'Erro: ' + error.message : 'E-mail de redefinição enviado!')
    setTimeout(() => setPwMsg(''), 4000)
  }

  return (
    <div className="settings-page">
      <h2 className="settings-title">Configurações</h2>

      {/* Account */}
      <section className="settings-card">
        <div className="settings-card-title">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M4 18a6 6 0 0 1 12 0"/></svg>
          Conta
        </div>
        <div className="settings-account-row">
          <div className="settings-avatar">{initials || '?'}</div>
          <div className="settings-account-info">
            <div className="settings-account-name">{displayName.split('@')[0]}</div>
            <div className="settings-account-email">{user?.email || '—'}</div>
            <div className="settings-account-meta">
              <span className="settings-badge">{provider === 'google' ? 'Google' : 'E-mail'}</span>
              <span className="settings-account-date">Conta criada em {createdAt}</span>
            </div>
          </div>
        </div>
        {supabase && provider !== 'google' && (
          <div className="settings-pw-row">
            <span className="settings-field-label">Senha</span>
            <button className="settings-action-btn" onClick={sendResetEmail} disabled={pwLoading}>
              {pwLoading ? 'Enviando…' : 'Enviar e-mail de redefinição'}
            </button>
            {pwMsg && <span className={`settings-pw-msg${pwMsg.startsWith('Erro') ? ' settings-pw-err' : ''}`}>{pwMsg}</span>}
          </div>
        )}
      </section>

      {/* Logo */}
      <section className="settings-card">
        <div className="settings-card-title">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="16" height="10" rx="2"/><path d="M5 10h.01M8 10l2 2 3-4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Logo do Site
        </div>
        <p className="settings-hint">Aparece na barra superior. Formatos: PNG, JPG, SVG, WebP. Recomendado: 200×200px.</p>
        <div className="settings-img-row">
          <div className="settings-img-preview">
            {logo
              ? <img src={logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 6 }} />
              : <svg viewBox="0 0 32 32" fill="none" style={{ width: 32, height: 32, opacity: .3 }}><rect width="32" height="32" rx="10" fill="currentColor" opacity=".15"/><path d="M8 22L13 10l5 8 4-5 4 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            }
          </div>
          <div className="settings-img-actions">
            <label className="settings-upload-btn">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2v8M4 6l4-4 4 4" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 12h12" strokeLinecap="round"/></svg>
              {logoSaved ? 'Salvo!' : 'Enviar imagem'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
            </label>
            {logo && <button className="settings-remove-btn" onClick={removeLogo}>Remover</button>}
          </div>
        </div>
      </section>

      {/* Favicon */}
      <section className="settings-card">
        <div className="settings-card-title">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="16" height="16" rx="3"/><path d="M6 10l3 3 5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Favicon (ícone da aba)
        </div>
        <p className="settings-hint">Ícone exibido na aba do navegador. Formatos: PNG, ICO, SVG. Recomendado: 32×32px ou 64×64px.</p>
        <div className="settings-img-row">
          <div className="settings-img-preview settings-img-preview--sm">
            {favicon
              ? <img src={favicon} alt="Favicon" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : <svg viewBox="0 0 16 16" fill="none" style={{ width: 16, height: 16, opacity: .3 }}><rect width="16" height="16" rx="3" fill="currentColor"/></svg>
            }
          </div>
          <div className="settings-img-actions">
            <label className="settings-upload-btn">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2v8M4 6l4-4 4 4" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 12h12" strokeLinecap="round"/></svg>
              {favSaved ? 'Salvo!' : 'Enviar imagem'}
              <input type="file" accept="image/*,.ico" style={{ display: 'none' }} onChange={handleFaviconUpload} />
            </label>
            {favicon && <button className="settings-remove-btn" onClick={removeFavicon}>Remover</button>}
          </div>
        </div>
      </section>
    </div>
  )
}

// ─── Patrimônio Page ─────────────────────────────────────────────────────────

const IMOVEL_TIPOS = ['Residencial', 'Comercial', 'Rural', 'Terreno', 'Galpão']
const PRODUTO_CATS = ['Eletrônico', 'Móvel', 'Eletrodoméstico', 'Veículo', 'Arte', 'Joia', 'Equipamento', 'Outros']
const IMOVEL_INIT = { descricao: '', tipo: 'Residencial', valor: '', valorAtual: '', endereco: '', area: '' }
const PRODUTO_INIT = { nome: '', categoria: 'Eletrônico', valor: '', quantidade: '1', fornecedor: '', descricao: '' }

function PatrimonioPage() {
  const [imoveis, setImoveis] = useCloudTable<Imovel>('imoveis', 'lion-imoveis')
  const [produtos, setProdutos] = useCloudTable<Produto>('produtos', 'lion-produtos')
  const [vehicles, setVehicles] = useCloudTable<Vehicle>('vehicles', 'lion-vehicles')

  const [tab, setTab] = useState<'imoveis' | 'veiculos' | 'produtos'>('imoveis')
  const [showImovelForm, setShowImovelForm] = useState(false)
  const [editImovelId, setEditImovelId] = useState<string | null>(null)
  const [imovelForm, setImovelForm] = useState({ ...IMOVEL_INIT })
  const [showProdForm, setShowProdForm] = useState(false)
  const [editProdId, setEditProdId] = useState<string | null>(null)
  const [prodForm, setProdForm] = useState({ ...PRODUTO_INIT })

  const fmtR = (v: string | number) => parseFloat(String(v) || '0').toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
  const fmtKm = (k: number) => k > 0 ? `${k.toLocaleString('pt-BR')} km` : ''

  const totalImoveis = imoveis.reduce((s, i) => s + (parseFloat(i.valorAtual || i.valor || '0') || 0), 0)
  const totalProdutos = produtos.reduce((s, p) => s + (parseFloat(p.valor || '0') || 0) * (parseInt(p.quantidade || '1') || 1), 0)
  const totalVeiculos = vehicles.reduce((s, v) => {
    const notesVal = v.notes?.match(/Atual:\s*R\$\s*([\d.,]+)/)
    if (notesVal) return s + parseFloat(notesVal[1].replace(/\./g, '').replace(',', '.')) || 0
    return s
  }, 0)
  const totalGeral = totalImoveis + totalProdutos + totalVeiculos

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
          <div className="patr-summary-label">Imóveis</div>
          <div className="patr-summary-val">{fmtR(totalImoveis)}</div>
          <div className="patr-summary-sub">{imoveis.length} imóvel{imoveis.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="patr-summary-card">
          <div className="patr-summary-label">Veículos</div>
          <div className="patr-summary-val">{fmtR(totalVeiculos)}</div>
          <div className="patr-summary-sub">{vehicles.length} veículo{vehicles.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="patr-summary-card">
          <div className="patr-summary-label">Bens / Produtos</div>
          <div className="patr-summary-val">{fmtR(totalProdutos)}</div>
          <div className="patr-summary-sub">{produtos.length} item{produtos.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="patr-summary-card patr-summary-total">
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
                return (
                  <div key={im.id} className="patr-card">
                    <div className="patr-card-icon patr-card-icon-blue">
                      <svg viewBox="0 0 20 20" fill="none"><path d="M3 9l7-6 7 6v9H3V9z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M7 18V12h6v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                    </div>
                    <div className="patr-card-body">
                      <div className="patr-card-title">{im.descricao}</div>
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
                      <button className="patr-icon-btn" onClick={() => startEditImovel(im)} title="Editar">
                        <svg viewBox="0 0 14 14" fill="none"><path d="M2 10l7-7 2 2-7 7H2v-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                      </button>
                      <button className="patr-icon-btn patr-icon-btn-del" onClick={() => setImoveis(prev => prev.filter(x => x.id !== im.id))} title="Excluir">
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

      {/* Veículos */}
      {tab === 'veiculos' && (
        <div className="patr-section">
          {vehicles.length === 0 ? (
            <div className="patr-empty">
              <svg viewBox="0 0 48 48" fill="none"><rect x="3" y="18" width="42" height="21" rx="4" stroke="currentColor" strokeWidth="2"/><path d="M12 18V15a9 9 0 0 1 9-9h6a9 9 0 0 1 9 9v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="13" cy="39" r="4" fill="currentColor" opacity=".3" stroke="none"/><circle cx="35" cy="39" r="4" fill="currentColor" opacity=".3" stroke="none"/></svg>
              <span>Nenhum veículo. Adicione via Ações Rápidas no dashboard.</span>
            </div>
          ) : (
            <div className="patr-list">
              {vehicles.map(v => {
                const notesVal = v.notes?.match(/Atual:\s*R\$\s*([\d.,]+)/)
                const valorAtual = notesVal ? parseFloat(notesVal[1].replace(/\./g, '').replace(',', '.')) : 0
                const notesCompra = v.notes?.match(/Compra:\s*R\$\s*([\d.,]+)/)
                const valorCompra = notesCompra ? parseFloat(notesCompra[1].replace(/\./g, '').replace(',', '.')) : 0
                const gain = valorAtual > 0 && valorCompra > 0 ? valorAtual - valorCompra : 0
                return (
                  <div key={v.id} className="patr-card">
                    <div className="patr-card-icon" style={{ background: 'rgba(245,158,11,.15)', color: 'var(--amber)' }}>
                      <svg viewBox="0 0 20 20" fill="none"><rect x="1" y="8" width="18" height="8" rx="2" stroke="currentColor" strokeWidth="1.4"/><path d="M4 8V7a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1" stroke="currentColor" strokeWidth="1.4"/><circle cx="5" cy="16" r="2" fill="currentColor"/><circle cx="15" cy="16" r="2" fill="currentColor"/></svg>
                    </div>
                    <div className="patr-card-body">
                      <div className="patr-card-title">{v.name}{v.plate && <span className="patr-badge" style={{ marginLeft: 8 }}>{v.plate}</span>}</div>
                      <div className="patr-card-meta">
                        {v.year && <span>{v.year}</span>}
                        {fmtKm(v.currentKm) && <span>{fmtKm(v.currentKm)}</span>}
                      </div>
                      <div className="patr-card-values">
                        {valorCompra > 0 && <span>Compra: {fmtR(valorCompra)}</span>}
                        {valorAtual > 0 && <span>Atual: {fmtR(valorAtual)}</span>}
                        {gain !== 0 && <span className={gain > 0 ? 'patr-gain-pos' : 'patr-gain-neg'}>{gain > 0 ? '+' : ''}{fmtR(gain)}</span>}
                      </div>
                    </div>
                    <div className="patr-card-actions">
                      <button className="patr-icon-btn patr-icon-btn-del" onClick={() => setVehicles(prev => prev.filter(x => x.id !== v.id))} title="Excluir">
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

// ─── Payment Hub ──────────────────────────────────────────────────────────────

const BILL_STATUS_LABEL: Record<BillStatus, string> = {
  em_aberto: 'Em aberto', pago: 'Pago', vencido: 'Vencido', cancelado: 'Cancelado',
}
const BILL_RECURRENCE_LABEL: Record<BillRecurrence, string> = {
  mensal: 'Mensal', unica: 'Única', anual: 'Anual', semanal: 'Semanal',
}

function isOverdue(bill: Bill): boolean {
  if (bill.status !== 'em_aberto') return false
  return new Date(bill.dueDate + 'T23:59:59') < new Date()
}

function effectiveStatus(bill: Bill): BillStatus {
  return isOverdue(bill) ? 'vencido' : bill.status
}

const fmtCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const fmtDate = (s: string) => { if (!s) return '—'; const d = new Date(s + 'T12:00:00'); return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }) }

const COLL_INIT = { name: '', category: BILL_CATEGORIES[0], color: BILL_COLORS[0] }
const BILL_INIT = { collectorId: '', description: '', amount: '', dueDate: '', status: 'em_aberto' as BillStatus, recurrence: 'mensal' as BillRecurrence, paymentLink: '', barcode: '', notes: '' }

function CollectorForm({ initial, onSave, onCancel }: { initial: typeof COLL_INIT; onSave: (v: typeof COLL_INIT) => void; onCancel: () => void }) {
  const [form, setForm] = useState(initial)
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))
  return (
    <form className="ph-modal-form" onSubmit={e => { e.preventDefault(); if (!form.name.trim()) return; onSave(form) }}>
      <div className="ph-field">
        <label>Nome *</label>
        <input autoFocus value={form.name} onChange={e => f('name', e.target.value)} placeholder="Ex: CEMIG, Claro, Condomínio…" required />
      </div>
      <div className="ph-field">
        <label>Categoria</label>
        <select value={form.category} onChange={e => f('category', e.target.value)}>
          {BILL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="ph-field">
        <label>Cor</label>
        <div className="ph-color-picker">
          {BILL_COLORS.map(c => (
            <button key={c} type="button" className={`ph-color-dot${form.color === c ? ' ph-color-active' : ''}`}
              style={{ background: c }} onClick={() => f('color', c)} />
          ))}
        </div>
      </div>
      <div className="ph-form-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-accent">Salvar</button>
      </div>
    </form>
  )
}

function BillForm({ initial, collectors, onSave, onCancel, onCreateCollector }: {
  initial: typeof BILL_INIT; collectors: Collector[]
  onSave: (v: typeof BILL_INIT) => void; onCancel: () => void
  onCreateCollector?: (name: string) => string
}) {
  const [form, setForm] = useState(initial)
  const [newCollName, setNewCollName] = useState('')
  const [showNewColl, setShowNewColl] = useState(false)
  const f = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }))

  const handleAddCollector = () => {
    if (!newCollName.trim() || !onCreateCollector) return
    const id = onCreateCollector(newCollName.trim())
    f('collectorId', id)
    setNewCollName('')
    setShowNewColl(false)
  }

  return (
    <form className="ph-modal-form" onSubmit={e => { e.preventDefault(); if (!form.amount || !form.dueDate) return; onSave(form) }}>
      <div className="ph-field">
        <label>Cobrador</label>
        {!showNewColl ? (
          <div className="ph-coll-select-row">
            <select value={form.collectorId} onChange={e => f('collectorId', e.target.value)}>
              <option value="">Selecione…</option>
              {collectors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button type="button" className="ph-coll-add-btn" onClick={() => setShowNewColl(true)} title="Novo cobrador">
              <svg viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>
        ) : (
          <div className="ph-coll-select-row">
            <input value={newCollName} onChange={e => setNewCollName(e.target.value)} placeholder="Nome do cobrador" autoFocus
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCollector() } }} />
            <button type="button" className="ph-coll-add-btn ph-coll-confirm" onClick={handleAddCollector} title="Criar" disabled={!newCollName.trim()}>
              <svg viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button type="button" className="ph-coll-add-btn" onClick={() => { setShowNewColl(false); setNewCollName('') }} title="Cancelar">
              <svg viewBox="0 0 14 14" fill="none"><path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            </button>
          </div>
        )}
      </div>
      <div className="ph-field">
        <label>Descrição</label>
        <input value={form.description} onChange={e => f('description', e.target.value)} placeholder="Ex: Fatura março 2026" />
      </div>
      <div className="ph-form-row">
        <div className="ph-field">
          <label>Valor (R$) *</label>
          <input type="number" min="0.01" step="0.01" value={form.amount} onChange={e => f('amount', e.target.value)} placeholder="0,00" required />
        </div>
        <div className="ph-field">
          <label>Vencimento *</label>
          <input type="date" value={form.dueDate} onChange={e => f('dueDate', e.target.value)} required />
        </div>
      </div>
      <div className="ph-form-row">
        <div className="ph-field">
          <label>Recorrência</label>
          <select value={form.recurrence} onChange={e => f('recurrence', e.target.value)}>
            {(Object.entries(BILL_RECURRENCE_LABEL) as [BillRecurrence, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="ph-field">
          <label>Status</label>
          <select value={form.status} onChange={e => f('status', e.target.value as BillStatus)}>
            {(Object.entries(BILL_STATUS_LABEL) as [BillStatus, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="ph-field">
        <label>Link de pagamento</label>
        <input type="url" value={form.paymentLink} onChange={e => f('paymentLink', e.target.value)} placeholder="https://…" />
      </div>
      <div className="ph-field">
        <label>Código de barras / PIX</label>
        <input value={form.barcode} onChange={e => f('barcode', e.target.value)} placeholder="Cole o código aqui" />
      </div>
      <div className="ph-field">
        <label>Observações</label>
        <input value={form.notes} onChange={e => f('notes', e.target.value)} placeholder="Opcional" />
      </div>
      <div className="ph-form-actions">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancelar</button>
        <button type="submit" className="btn-accent">Salvar</button>
      </div>
    </form>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="ph-modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ph-modal">
        <div className="ph-modal-header">
          <span className="ph-modal-title">{title}</span>
          <button className="ph-modal-close" onClick={onClose}>
            <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Terra Page ──────────────────────────────────────────────────────────────

function TerraPage() {
  const [fazendas, setFazendas] = useCloudTable<TerraFazenda>('terra_fazendas', 'lion-terra')
  const [talhoes, setTalhoes] = useCloudTable<TerraTalhao>('terra_talhoes', 'lion-talhoes')
  const [tab, setTab] = useState<'visao' | 'mapa' | 'talhoes' | 'docs' | 'fazendas'>('visao')
  const [activeFazendaId, setActiveFazendaId] = useState<string | null>(null)
  const [showFazendaForm, setShowFazendaForm] = useState(false)
  const [editFazendaId, setEditFazendaId] = useState<string | null>(null)
  const [showTalhaoForm, setShowTalhaoForm] = useState(false)
  const [editTalhaoId, setEditTalhaoId] = useState<string | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<L.Map | null>(null)
  const layerGroup = useRef<L.LayerGroup | null>(null)
  const [mapSatellite, setMapSatellite] = useState(false)
  const tileRef = useRef<L.TileLayer | null>(null)
  const [drawMode, setDrawMode] = useState<'none' | 'perimetro' | 'talhao'>('none')
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([])
  const drawLayerRef = useRef<L.Polyline | null>(null)
  const [drawTalhaoId, setDrawTalhaoId] = useState<string | null>(null)

  const emptyFazenda: Omit<TerraFazenda, 'id' | 'createdAt'> = {
    nome: '', municipio: '', uf: 'PR', matricula: '', carNumero: '', itrNumero: '', ccir: '',
    areaTotal: 0, areaUtil: 0, areaReservaLegal: 0, areaApp: 0, areaPastagem: 0,
    areaLavoura: 0, areaReflorestamento: 0, areaBenfeitorias: 0,
    latitude: -23.55, longitude: -51.43, perimetro: [],
    tipoSolo: '', bioma: '', relevo: '', fonteAgua: '',
    valorVenal: '', valorMercado: '', geoReferenciado: false, licencaAmbiental: false, notas: '',
  }
  const [fazForm, setFazForm] = useState(emptyFazenda)

  const emptyTalhao: Omit<TerraTalhao, 'id' | 'createdAt'> = {
    fazendaId: '', nome: '', uso: 'lavoura', areaHa: 0, cultura: '', safra: '', poligono: [], cor: '', notas: '',
  }
  const [talForm, setTalForm] = useState(emptyTalhao)

  const fazenda = fazendas.find(f => f.id === activeFazendaId) || fazendas[0] || null
  useEffect(() => { if (fazendas.length && !activeFazendaId) setActiveFazendaId(fazendas[0].id) }, [fazendas, activeFazendaId])
  const fazTalhoes = useMemo(() => talhoes.filter(t => t.fazendaId === fazenda?.id), [talhoes, fazenda])

  const reservaMinPct = useMemo(() => {
    if (!fazenda) return 20
    if (fazenda.bioma === 'Amazônia') return 80
    if (fazenda.bioma === 'Cerrado') return 35
    return 20
  }, [fazenda])

  const reservaPct = fazenda && fazenda.areaTotal > 0 ? ((fazenda.areaReservaLegal / fazenda.areaTotal) * 100) : 0
  const grauUtil = fazenda && fazenda.areaTotal > 0 ? ((fazenda.areaUtil / fazenda.areaTotal) * 100) : 0
  const somaTalhoes = fazTalhoes.reduce((s, t) => s + t.areaHa, 0)

  const fmtHa = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ha'

  // ─── Fazenda CRUD
  const saveFazenda = () => {
    if (!fazForm.nome.trim()) return
    if (editFazendaId) {
      setFazendas(prev => prev.map(f => f.id === editFazendaId ? { ...f, ...fazForm } : f))
    } else {
      const nf: TerraFazenda = { ...fazForm, id: crypto.randomUUID(), createdAt: new Date().toISOString() } as TerraFazenda
      setFazendas(prev => [...prev, nf])
      setActiveFazendaId(nf.id)
    }
    setShowFazendaForm(false)
    setEditFazendaId(null)
    setFazForm(emptyFazenda)
  }
  const editFazenda = (f: TerraFazenda) => {
    setFazForm({ ...f })
    setEditFazendaId(f.id)
    setShowFazendaForm(true)
    setTab('fazendas')
  }
  const deleteFazenda = (id: string) => {
    setFazendas(prev => prev.filter(f => f.id !== id))
    setTalhoes(prev => prev.filter(t => t.fazendaId !== id))
    if (activeFazendaId === id) setActiveFazendaId(null)
  }

  // ─── Talhão CRUD
  const saveTalhao = () => {
    if (!talForm.nome.trim() || !fazenda) return
    const cor = talForm.cor || TALHAO_USOS.find(u => u.value === talForm.uso)?.cor || '#6b7280'
    if (editTalhaoId) {
      setTalhoes(prev => prev.map(t => t.id === editTalhaoId ? { ...t, ...talForm, cor } : t))
    } else {
      const nt: TerraTalhao = { ...talForm, cor, fazendaId: fazenda.id, id: crypto.randomUUID(), createdAt: new Date().toISOString() } as TerraTalhao
      setTalhoes(prev => [...prev, nt])
    }
    setShowTalhaoForm(false)
    setEditTalhaoId(null)
    setTalForm(emptyTalhao)
  }
  const editTalhao = (t: TerraTalhao) => {
    setTalForm({ ...t })
    setEditTalhaoId(t.id)
    setShowTalhaoForm(true)
  }
  const deleteTalhao = (id: string) => { setTalhoes(prev => prev.filter(t => t.id !== id)) }

  // ─── Map
  useEffect(() => {
    if (tab !== 'mapa' || !mapRef.current || leafletMap.current) return
    const center: [number, number] = fazenda ? [fazenda.latitude, fazenda.longitude] : [-15.78, -47.93]
    const map = L.map(mapRef.current).setView(center, fazenda ? 14 : 4)
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' })
    osm.addTo(map)
    tileRef.current = osm
    layerGroup.current = L.layerGroup().addTo(map)
    leafletMap.current = map
    return () => { map.remove(); leafletMap.current = null }
  }, [tab])

  useEffect(() => {
    if (!leafletMap.current || !tileRef.current) return
    leafletMap.current.removeLayer(tileRef.current)
    const url = mapSatellite
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
    const attr = mapSatellite ? '&copy; Esri' : '&copy; OpenStreetMap'
    tileRef.current = L.tileLayer(url, { attribution: attr }).addTo(leafletMap.current)
  }, [mapSatellite])

  useEffect(() => {
    if (!leafletMap.current || !layerGroup.current) return
    layerGroup.current.clearLayers()
    if (fazenda && fazenda.perimetro.length >= 3) {
      L.polygon(fazenda.perimetro, { color: '#dc2626', weight: 3, fillOpacity: 0.05 }).addTo(layerGroup.current)
    }
    fazTalhoes.forEach(t => {
      if (t.poligono.length >= 3) {
        const cor = t.cor || TALHAO_USOS.find(u => u.value === t.uso)?.cor || '#6b7280'
        L.polygon(t.poligono, { color: cor, weight: 2, fillColor: cor, fillOpacity: 0.35 })
          .bindPopup(`<strong>${t.nome}</strong><br/>${TALHAO_USOS.find(u => u.value === t.uso)?.label || t.uso}<br/>${fmtHa(t.areaHa)}${t.cultura ? '<br/>Cultura: ' + t.cultura : ''}`)
          .addTo(layerGroup.current!)
      }
    })
    if (fazenda) leafletMap.current.setView([fazenda.latitude, fazenda.longitude], 14)
  }, [fazenda, fazTalhoes, tab])

  // Draw mode: click handler
  useEffect(() => {
    const map = leafletMap.current
    if (!map) return
    if (drawMode === 'none') {
      map.getContainer().style.cursor = ''
      return
    }
    map.getContainer().style.cursor = 'crosshair'
    const onClick = (e: L.LeafletMouseEvent) => {
      const pt: [number, number] = [parseFloat(e.latlng.lat.toFixed(6)), parseFloat(e.latlng.lng.toFixed(6))]
      setDrawPoints(prev => {
        const next = [...prev, pt]
        if (drawLayerRef.current) map.removeLayer(drawLayerRef.current)
        drawLayerRef.current = L.polyline(next, { color: drawMode === 'perimetro' ? '#dc2626' : '#f59e0b', weight: 3, dashArray: '6 4' }).addTo(map)
        L.circleMarker(pt, { radius: 5, color: '#fff', fillColor: drawMode === 'perimetro' ? '#dc2626' : '#f59e0b', fillOpacity: 1, weight: 2 }).addTo(layerGroup.current!)
        return next
      })
    }
    map.on('click', onClick)
    return () => { map.off('click', onClick); map.getContainer().style.cursor = '' }
  }, [drawMode])

  const finishDraw = () => {
    if (drawPoints.length < 3) return
    if (drawMode === 'perimetro' && fazenda) {
      const center = drawPoints.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]] as [number, number], [0, 0] as [number, number])
      const lat = center[0] / drawPoints.length
      const lng = center[1] / drawPoints.length
      setFazendas(prev => prev.map(f => f.id === fazenda.id ? { ...f, perimetro: drawPoints, latitude: lat, longitude: lng } : f))
    } else if (drawMode === 'talhao' && drawTalhaoId) {
      setTalhoes(prev => prev.map(t => t.id === drawTalhaoId ? { ...t, poligono: drawPoints } : t))
    }
    cancelDraw()
  }
  const cancelDraw = () => {
    if (drawLayerRef.current && leafletMap.current) leafletMap.current.removeLayer(drawLayerRef.current)
    drawLayerRef.current = null
    setDrawMode('none')
    setDrawPoints([])
    setDrawTalhaoId(null)
  }
  const undoDrawPoint = () => {
    setDrawPoints(prev => {
      const next = prev.slice(0, -1)
      if (drawLayerRef.current && leafletMap.current) leafletMap.current.removeLayer(drawLayerRef.current)
      if (next.length > 0 && leafletMap.current) {
        drawLayerRef.current = L.polyline(next, { color: drawMode === 'perimetro' ? '#dc2626' : '#f59e0b', weight: 3, dashArray: '6 4' }).addTo(leafletMap.current)
      }
      return next
    })
  }

  // ─── Pie chart SVG (land use distribution)
  const pieData = useMemo(() => {
    if (!fazenda) return []
    const items: { label: string; value: number; cor: string }[] = [
      { label: 'Lavoura', value: fazenda.areaLavoura, cor: '#f59e0b' },
      { label: 'Pastagem', value: fazenda.areaPastagem, cor: '#22c55e' },
      { label: 'Reserva Legal', value: fazenda.areaReservaLegal, cor: '#166534' },
      { label: 'APP', value: fazenda.areaApp, cor: '#0d9488' },
      { label: 'Reflorestamento', value: fazenda.areaReflorestamento, cor: '#65a30d' },
      { label: 'Benfeitorias', value: fazenda.areaBenfeitorias, cor: '#8b5cf6' },
    ].filter(i => i.value > 0)
    return items
  }, [fazenda])

  const pieSlices = useMemo(() => {
    const total = pieData.reduce((s, i) => s + i.value, 0)
    if (!total) return []
    let cum = 0
    return pieData.map(item => {
      const start = cum / total
      cum += item.value
      const end = cum / total
      const startAngle = start * 2 * Math.PI - Math.PI / 2
      const endAngle = end * 2 * Math.PI - Math.PI / 2
      const large = end - start > 0.5 ? 1 : 0
      const r = 50
      const x1 = 60 + r * Math.cos(startAngle)
      const y1 = 60 + r * Math.sin(startAngle)
      const x2 = 60 + r * Math.cos(endAngle)
      const y2 = 60 + r * Math.sin(endAngle)
      return { ...item, d: `M60,60 L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`, pct: ((item.value / total) * 100).toFixed(1) }
    })
  }, [pieData])

  // ─── Render helpers
  const renderField = (label: string, children: React.ReactNode, span2 = false) => (
    <div className={`terra-field${span2 ? ' terra-span2' : ''}`}><label>{label}</label>{children}</div>
  )

  // ─── VISÃO GERAL
  const renderVisao = () => {
    if (!fazenda) return <div className="terra-empty"><p>Nenhuma fazenda cadastrada.</p><button className="terra-btn-primary" onClick={() => { setTab('fazendas'); setShowFazendaForm(true) }}>+ Adicionar Fazenda</button></div>
    return (
      <div className="terra-visao">
        <div className="terra-summary">
          <div className="terra-card-stat"><span className="terra-stat-label">Área Total</span><span className="terra-stat-value">{fmtHa(fazenda.areaTotal)}</span></div>
          <div className="terra-card-stat"><span className="terra-stat-label">Área Útil</span><span className="terra-stat-value">{fmtHa(fazenda.areaUtil)}</span><span className="terra-stat-sub">{grauUtil.toFixed(1)}% de utilização</span></div>
          <div className="terra-card-stat"><span className="terra-stat-label">Reserva + APP</span><span className="terra-stat-value">{fmtHa(fazenda.areaReservaLegal + fazenda.areaApp)}</span><span className={`terra-stat-sub ${reservaPct >= reservaMinPct ? 'terra-ok' : 'terra-warn'}`}>{reservaPct.toFixed(1)}% (mín. {reservaMinPct}%)</span></div>
          <div className="terra-card-stat"><span className="terra-stat-label">Talhões</span><span className="terra-stat-value">{fazTalhoes.length}</span><span className="terra-stat-sub">{fmtHa(somaTalhoes)} mapeados</span></div>
        </div>

        <div className="terra-visao-grid">
          <div className="terra-chart-card">
            <h4>Distribuição de Uso</h4>
            {pieSlices.length ? (
              <div className="terra-pie-wrap">
                <svg viewBox="0 0 120 120" width="160" height="160">
                  {pieSlices.map((s, i) => <path key={i} d={s.d} fill={s.cor} stroke="var(--bg)" strokeWidth="1.5" />)}
                </svg>
                <div className="terra-legend">
                  {pieSlices.map((s, i) => <div key={i} className="terra-legend-item"><span className="terra-legend-dot" style={{ background: s.cor }} />{s.label} — {s.pct}%</div>)}
                </div>
              </div>
            ) : <p className="terra-muted">Preencha as áreas da fazenda para ver a distribuição.</p>}
          </div>

          <div className="terra-chart-card">
            <h4>Reserva Legal</h4>
            <div className="terra-reserve-bar">
              <div className="terra-reserve-fill" style={{ width: `${Math.min(reservaPct, 100)}%`, background: reservaPct >= reservaMinPct ? '#22c55e' : '#ef4444' }} />
              <div className="terra-reserve-mark" style={{ left: `${reservaMinPct}%` }} title={`Mínimo: ${reservaMinPct}%`} />
            </div>
            <div className="terra-reserve-labels">
              <span>{reservaPct.toFixed(1)}% atual</span>
              <span>Mínimo: {reservaMinPct}%</span>
            </div>
            <div className="terra-info-row"><span>Bioma:</span> <strong>{fazenda.bioma || '—'}</strong></div>
            <div className="terra-info-row"><span>Solo:</span> <strong>{fazenda.tipoSolo || '—'}</strong></div>
            <div className="terra-info-row"><span>Relevo:</span> <strong>{fazenda.relevo || '—'}</strong></div>
          </div>
        </div>

        {(fazenda.valorVenal || fazenda.valorMercado) && (
          <div className="terra-valor-row">
            {fazenda.valorVenal && <div className="terra-card-stat"><span className="terra-stat-label">Valor Venal</span><span className="terra-stat-value">R$ {fazenda.valorVenal}</span></div>}
            {fazenda.valorMercado && <div className="terra-card-stat"><span className="terra-stat-label">Valor de Mercado</span><span className="terra-stat-value">R$ {fazenda.valorMercado}</span></div>}
          </div>
        )}
      </div>
    )
  }

  // ─── MAPA
  const renderMapa = () => (
    <div className="terra-mapa">
      <div className="terra-map-controls">
        <button className={`terra-map-toggle ${!mapSatellite ? 'active' : ''}`} onClick={() => setMapSatellite(false)}>Mapa</button>
        <button className={`terra-map-toggle ${mapSatellite ? 'active' : ''}`} onClick={() => setMapSatellite(true)}>Satélite</button>
        <div className="terra-map-spacer" />
        {drawMode === 'none' && fazenda && (
          <>
            <button className="terra-btn-draw" onClick={() => { setDrawMode('perimetro'); setDrawPoints([]) }}>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="2,14 8,2 14,14" strokeLinejoin="round"/></svg>
              Desenhar Perímetro
            </button>
            {fazTalhoes.length > 0 && (
              <select className="terra-draw-select" value="" onChange={e => { if (e.target.value) { setDrawTalhaoId(e.target.value); setDrawMode('talhao'); setDrawPoints([]) } }}>
                <option value="">Desenhar Talhão...</option>
                {fazTalhoes.filter(t => t.poligono.length < 3).map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            )}
          </>
        )}
        {drawMode !== 'none' && (
          <div className="terra-draw-bar">
            <span className="terra-draw-label">
              {drawMode === 'perimetro' ? 'Desenhando perímetro' : 'Desenhando talhão'} — clique no mapa para adicionar pontos ({drawPoints.length} pontos)
            </span>
            <button className="terra-btn-draw terra-btn-undo" onClick={undoDrawPoint} disabled={drawPoints.length === 0}>Desfazer</button>
            <button className="terra-btn-primary" onClick={finishDraw} disabled={drawPoints.length < 3}>Finalizar</button>
            <button className="terra-btn-secondary" onClick={cancelDraw}>Cancelar</button>
          </div>
        )}
      </div>
      <div ref={mapRef} className="terra-map-container" />
      {fazTalhoes.length > 0 && (
        <div className="terra-map-legend">
          {TALHAO_USOS.filter(u => fazTalhoes.some(t => t.uso === u.value)).map(u => (
            <span key={u.value} className="terra-legend-item"><span className="terra-legend-dot" style={{ background: u.cor }} />{u.label}</span>
          ))}
        </div>
      )}
      {!fazenda && <p className="terra-muted" style={{ marginTop: 12 }}>Cadastre uma fazenda com coordenadas para ver no mapa.</p>}
    </div>
  )

  // ─── TALHÕES
  const renderTalhoes = () => (
    <div className="terra-talhoes">
      <div className="terra-section-header">
        <h4>Talhões{fazenda ? ` — ${fazenda.nome}` : ''}</h4>
        <button className="terra-btn-primary" onClick={() => { setTalForm(emptyTalhao); setEditTalhaoId(null); setShowTalhaoForm(true) }} disabled={!fazenda}>+ Novo Talhão</button>
      </div>
      {fazenda && fazenda.areaTotal > 0 && somaTalhoes > fazenda.areaTotal && (
        <div className="terra-alert">Soma dos talhões ({fmtHa(somaTalhoes)}) excede a área total ({fmtHa(fazenda.areaTotal)})</div>
      )}
      {showTalhaoForm && (
        <div className="terra-form">
          <div className="terra-fields">
            {renderField('Nome', <input value={talForm.nome} onChange={e => setTalForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Talhão 3" />)}
            {renderField('Uso', <select value={talForm.uso} onChange={e => setTalForm(p => ({ ...p, uso: e.target.value as TalhaoUso }))}>{TALHAO_USOS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}</select>)}
            {renderField('Área (ha)', <input type="number" step="0.01" value={talForm.areaHa || ''} onChange={e => setTalForm(p => ({ ...p, areaHa: parseFloat(e.target.value) || 0 }))} />)}
            {talForm.uso === 'lavoura' && renderField('Cultura', <select value={talForm.cultura} onChange={e => setTalForm(p => ({ ...p, cultura: e.target.value }))}><option value="">Selecione</option>{TERRA_CULTURAS.map(c => <option key={c} value={c}>{c}</option>)}</select>)}
            {talForm.uso === 'lavoura' && renderField('Safra', <input value={talForm.safra} onChange={e => setTalForm(p => ({ ...p, safra: e.target.value }))} placeholder="Ex: 2025/26" />)}
            {renderField('Coordenadas (lat,lng por linha)', <textarea rows={3} value={talForm.poligono.map(p => p.join(',')).join('\n')} onChange={e => setTalForm(p => ({ ...p, poligono: e.target.value.split('\n').filter(l => l.includes(',')).map(l => { const [a, b] = l.split(',').map(Number); return [a, b] as [number, number] }) }))} placeholder="-23.55,-51.43&#10;-23.56,-51.44&#10;-23.55,-51.45" />, true)}
            {renderField('Notas', <textarea rows={2} value={talForm.notas} onChange={e => setTalForm(p => ({ ...p, notas: e.target.value }))} />, true)}
          </div>
          <div className="terra-form-actions">
            <button className="terra-btn-primary" onClick={saveTalhao}>Salvar</button>
            <button className="terra-btn-secondary" onClick={() => { setShowTalhaoForm(false); setEditTalhaoId(null); setTalForm(emptyTalhao) }}>Cancelar</button>
          </div>
        </div>
      )}
      <div className="terra-talhao-grid">
        {fazTalhoes.map(t => {
          const usoInfo = TALHAO_USOS.find(u => u.value === t.uso)
          return (
            <div key={t.id} className="terra-talhao-card">
              <div className="terra-talhao-header">
                <span className="terra-talhao-badge" style={{ background: usoInfo?.cor || '#6b7280' }}>{usoInfo?.label || t.uso}</span>
                <span className="terra-talhao-area">{fmtHa(t.areaHa)}</span>
              </div>
              <div className="terra-talhao-name">{t.nome}</div>
              {t.cultura && <div className="terra-talhao-detail">Cultura: {t.cultura}</div>}
              {t.safra && <div className="terra-talhao-detail">Safra: {t.safra}</div>}
              {t.notas && <div className="terra-talhao-detail terra-muted">{t.notas}</div>}
              <div className="terra-talhao-actions">
                <button onClick={() => editTalhao(t)}>Editar</button>
                <button onClick={() => deleteTalhao(t.id)}>Excluir</button>
              </div>
            </div>
          )
        })}
        {!fazTalhoes.length && <p className="terra-muted">Nenhum talhão cadastrado.</p>}
      </div>
    </div>
  )

  // ─── DOCUMENTOS
  const renderDocs = () => {
    if (!fazenda) return <p className="terra-muted">Cadastre uma fazenda primeiro.</p>
    const docs = [
      { label: 'CAR (Cadastro Ambiental Rural)', value: fazenda.carNumero, field: 'carNumero' as const },
      { label: 'ITR (Imposto Territorial Rural)', value: fazenda.itrNumero, field: 'itrNumero' as const },
      { label: 'CCIR', value: fazenda.ccir, field: 'ccir' as const },
      { label: 'Matrícula', value: fazenda.matricula, field: 'matricula' as const },
    ]
    return (
      <div className="terra-docs">
        <h4>Documentação — {fazenda.nome}</h4>
        <div className="terra-docs-list">
          {docs.map(d => (
            <div key={d.field} className="terra-doc-item">
              <span className={`terra-doc-status ${d.value ? 'terra-doc-ok' : 'terra-doc-missing'}`}>{d.value ? '✓' : '✗'}</span>
              <span className="terra-doc-label">{d.label}</span>
              <span className="terra-doc-value">{d.value || 'Não informado'}</span>
            </div>
          ))}
          <div className="terra-doc-item">
            <span className={`terra-doc-status ${fazenda.geoReferenciado ? 'terra-doc-ok' : 'terra-doc-missing'}`}>{fazenda.geoReferenciado ? '✓' : '✗'}</span>
            <span className="terra-doc-label">Georreferenciamento{fazenda.areaTotal > 100 ? ' (obrigatório)' : ''}</span>
            <span className="terra-doc-value">{fazenda.geoReferenciado ? 'Certificado' : 'Pendente'}</span>
          </div>
          <div className="terra-doc-item">
            <span className={`terra-doc-status ${fazenda.licencaAmbiental ? 'terra-doc-ok' : 'terra-doc-missing'}`}>{fazenda.licencaAmbiental ? '✓' : '✗'}</span>
            <span className="terra-doc-label">Licença Ambiental</span>
            <span className="terra-doc-value">{fazenda.licencaAmbiental ? 'Ativa' : 'Pendente'}</span>
          </div>
        </div>
      </div>
    )
  }

  // ─── FAZENDAS (CRUD)
  const renderFazendas = () => (
    <div className="terra-fazendas">
      <div className="terra-section-header">
        <h4>Fazendas</h4>
        <button className="terra-btn-primary" onClick={() => { setFazForm(emptyFazenda); setEditFazendaId(null); setShowFazendaForm(true) }}>+ Nova Fazenda</button>
      </div>
      {showFazendaForm && (
        <div className="terra-form">
          <div className="terra-fields">
            {renderField('Nome da Fazenda', <input value={fazForm.nome} onChange={e => setFazForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Fazenda Boa Vista" />)}
            {renderField('Município', <input value={fazForm.municipio} onChange={e => setFazForm(p => ({ ...p, municipio: e.target.value }))} />)}
            {renderField('UF', <select value={fazForm.uf} onChange={e => setFazForm(p => ({ ...p, uf: e.target.value }))}>{TERRA_UFS.map(u => <option key={u} value={u}>{u}</option>)}</select>)}
            {renderField('Bioma', <select value={fazForm.bioma} onChange={e => setFazForm(p => ({ ...p, bioma: e.target.value }))}><option value="">Selecione</option>{TERRA_BIOMAS.map(b => <option key={b} value={b}>{b}</option>)}</select>)}
            {renderField('Tipo de Solo', <select value={fazForm.tipoSolo} onChange={e => setFazForm(p => ({ ...p, tipoSolo: e.target.value }))}><option value="">Selecione</option>{TERRA_SOLOS.map(s => <option key={s} value={s}>{s}</option>)}</select>)}
            {renderField('Relevo', <select value={fazForm.relevo} onChange={e => setFazForm(p => ({ ...p, relevo: e.target.value }))}><option value="">Selecione</option>{TERRA_RELEVOS.map(r => <option key={r} value={r}>{r}</option>)}</select>)}
            {renderField('Fonte de Água', <input value={fazForm.fonteAgua} onChange={e => setFazForm(p => ({ ...p, fonteAgua: e.target.value }))} placeholder="Ex: Rio, Poço artesiano..." />)}
          </div>
          <h5 className="terra-form-subtitle">Áreas (hectares)</h5>
          <div className="terra-fields">
            {renderField('Área Total', <input type="number" step="0.01" value={fazForm.areaTotal || ''} onChange={e => setFazForm(p => ({ ...p, areaTotal: parseFloat(e.target.value) || 0 }))} />)}
            {renderField('Área Útil', <input type="number" step="0.01" value={fazForm.areaUtil || ''} onChange={e => setFazForm(p => ({ ...p, areaUtil: parseFloat(e.target.value) || 0 }))} />)}
            {renderField('Reserva Legal', <input type="number" step="0.01" value={fazForm.areaReservaLegal || ''} onChange={e => setFazForm(p => ({ ...p, areaReservaLegal: parseFloat(e.target.value) || 0 }))} />)}
            {renderField('APP', <input type="number" step="0.01" value={fazForm.areaApp || ''} onChange={e => setFazForm(p => ({ ...p, areaApp: parseFloat(e.target.value) || 0 }))} />)}
            {renderField('Pastagem', <input type="number" step="0.01" value={fazForm.areaPastagem || ''} onChange={e => setFazForm(p => ({ ...p, areaPastagem: parseFloat(e.target.value) || 0 }))} />)}
            {renderField('Lavoura', <input type="number" step="0.01" value={fazForm.areaLavoura || ''} onChange={e => setFazForm(p => ({ ...p, areaLavoura: parseFloat(e.target.value) || 0 }))} />)}
            {renderField('Reflorestamento', <input type="number" step="0.01" value={fazForm.areaReflorestamento || ''} onChange={e => setFazForm(p => ({ ...p, areaReflorestamento: parseFloat(e.target.value) || 0 }))} />)}
            {renderField('Benfeitorias', <input type="number" step="0.01" value={fazForm.areaBenfeitorias || ''} onChange={e => setFazForm(p => ({ ...p, areaBenfeitorias: parseFloat(e.target.value) || 0 }))} />)}
          </div>
          <h5 className="terra-form-subtitle">Localização</h5>
          <div className="terra-fields">
            {renderField('Latitude', <input type="number" step="0.000001" value={fazForm.latitude || ''} onChange={e => setFazForm(p => ({ ...p, latitude: parseFloat(e.target.value) || 0 }))} placeholder="-23.550520" />)}
            {renderField('Longitude', <input type="number" step="0.000001" value={fazForm.longitude || ''} onChange={e => setFazForm(p => ({ ...p, longitude: parseFloat(e.target.value) || 0 }))} placeholder="-51.433100" />)}
            {renderField('Perímetro (lat,lng por linha)', <textarea rows={4} value={fazForm.perimetro.map(p => p.join(',')).join('\n')} onChange={e => setFazForm(p => ({ ...p, perimetro: e.target.value.split('\n').filter(l => l.includes(',')).map(l => { const [a, b] = l.split(',').map(Number); return [a, b] as [number, number] }) }))} placeholder="-23.55,-51.43&#10;-23.56,-51.44&#10;-23.55,-51.45" />, true)}
          </div>
          <h5 className="terra-form-subtitle">Documentação</h5>
          <div className="terra-fields">
            {renderField('Matrícula', <input value={fazForm.matricula} onChange={e => setFazForm(p => ({ ...p, matricula: e.target.value }))} />)}
            {renderField('CAR', <input value={fazForm.carNumero} onChange={e => setFazForm(p => ({ ...p, carNumero: e.target.value }))} />)}
            {renderField('ITR', <input value={fazForm.itrNumero} onChange={e => setFazForm(p => ({ ...p, itrNumero: e.target.value }))} />)}
            {renderField('CCIR', <input value={fazForm.ccir} onChange={e => setFazForm(p => ({ ...p, ccir: e.target.value }))} />)}
          </div>
          <div className="terra-fields">
            <div className="terra-field terra-check-field"><label><input type="checkbox" checked={fazForm.geoReferenciado} onChange={e => setFazForm(p => ({ ...p, geoReferenciado: e.target.checked }))} /> Georreferenciamento certificado</label></div>
            <div className="terra-field terra-check-field"><label><input type="checkbox" checked={fazForm.licencaAmbiental} onChange={e => setFazForm(p => ({ ...p, licencaAmbiental: e.target.checked }))} /> Licença Ambiental ativa</label></div>
          </div>
          <h5 className="terra-form-subtitle">Valores</h5>
          <div className="terra-fields">
            {renderField('Valor Venal', <input value={fazForm.valorVenal} onChange={e => setFazForm(p => ({ ...p, valorVenal: e.target.value }))} placeholder="Ex: 5.000.000,00" />)}
            {renderField('Valor de Mercado', <input value={fazForm.valorMercado} onChange={e => setFazForm(p => ({ ...p, valorMercado: e.target.value }))} placeholder="Ex: 8.000.000,00" />)}
          </div>
          <div className="terra-fields">
            {renderField('Notas', <textarea rows={3} value={fazForm.notas} onChange={e => setFazForm(p => ({ ...p, notas: e.target.value }))} />, true)}
          </div>
          <div className="terra-form-actions">
            <button className="terra-btn-primary" onClick={saveFazenda}>Salvar</button>
            <button className="terra-btn-secondary" onClick={() => { setShowFazendaForm(false); setEditFazendaId(null); setFazForm(emptyFazenda) }}>Cancelar</button>
          </div>
        </div>
      )}
      <div className="terra-fazenda-list">
        {fazendas.map(f => (
          <div key={f.id} className={`terra-fazenda-card${f.id === activeFazendaId ? ' terra-fazenda-active' : ''}`} onClick={() => setActiveFazendaId(f.id)}>
            <div className="terra-fazenda-card-header">
              <strong>{f.nome}</strong>
              <span className="terra-fazenda-loc">{f.municipio}{f.uf ? ` — ${f.uf}` : ''}</span>
            </div>
            <div className="terra-fazenda-card-body">
              <span>{fmtHa(f.areaTotal)}</span>
              <span>{f.bioma || '—'}</span>
            </div>
            <div className="terra-talhao-actions">
              <button onClick={e => { e.stopPropagation(); editFazenda(f) }}>Editar</button>
              <button onClick={e => { e.stopPropagation(); deleteFazenda(f.id) }}>Excluir</button>
            </div>
          </div>
        ))}
        {!fazendas.length && <p className="terra-muted">Nenhuma fazenda cadastrada.</p>}
      </div>
    </div>
  )

  return (
    <div className="terra-page">
      {fazendas.length > 1 && (
        <div className="terra-fazenda-selector">
          <select value={activeFazendaId || ''} onChange={e => setActiveFazendaId(e.target.value)}>
            {fazendas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </div>
      )}
      <div className="terra-tabs">
        {(['visao', 'mapa', 'talhoes', 'docs', 'fazendas'] as const).map(t => (
          <button key={t} className={`terra-tab${tab === t ? ' terra-tab-active' : ''}`} onClick={() => setTab(t)}>
            {{ visao: 'Visão Geral', mapa: 'Mapa', talhoes: 'Talhões', docs: 'Documentos', fazendas: 'Fazendas' }[t]}
          </button>
        ))}
      </div>
      <div className="terra-tab-content">
        {tab === 'visao' && renderVisao()}
        {tab === 'mapa' && renderMapa()}
        {tab === 'talhoes' && renderTalhoes()}
        {tab === 'docs' && renderDocs()}
        {tab === 'fazendas' && renderFazendas()}
      </div>
    </div>
  )
}

function PaymentHubPage() {
  const [collectors, setCollectors] = useCloudTable<Collector>('collectors', 'lion-collectors')
  const [bills, setBills] = useCloudTable<Bill>('bills', 'lion-bills')
  const [selCollector, setSelCollector] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<BillStatus | 'all'>('all')
  const [phTab, setPhTab] = useState<'bills' | 'monthly'>('bills')
  const [monthOffset, setMonthOffset] = useState(0)
  const [modal, setModal] = useState<'new-collector' | 'edit-collector' | 'new-bill' | 'edit-bill' | 'barcode' | null>(null)
  const [editingCollector, setEditingCollector] = useState<Collector | null>(null)
  const [editingBill, setEditingBill] = useState<Bill | null>(null)
  const [barcodeText, setBarcodeText] = useState('')
  const [copied, setCopied] = useState(false)


  const createCollectorInline = (name: string): string => {
    const id = Date.now().toString()
    const newColl: Collector = { id, name, category: 'Outros', color: '#6366f1', createdAt: new Date().toISOString() }
    setCollectors(prev => [...prev, newColl])
    return id
  }

  const saveCollector = (form: typeof COLL_INIT) => {
    if (editingCollector) {
      setCollectors(prev => prev.map(c => c.id === editingCollector.id ? { ...c, ...form } : c))
    } else {
      setCollectors(prev => [...prev, { ...form, id: Date.now().toString(), createdAt: new Date().toISOString() }])
    }
    setModal(null); setEditingCollector(null)
  }

  const deleteCollector = (id: string) => {
    if (!confirm('Remover cobrador e todas as suas contas?')) return
    setCollectors(prev => prev.filter(c => c.id !== id))
    setBills(prev => prev.filter(b => b.collectorId !== id))
    if (selCollector === id) setSelCollector(null)
  }

  const saveBill = (form: typeof BILL_INIT) => {
    const now = new Date().toISOString()
    if (editingBill) {
      setBills(prev => prev.map(b => b.id === editingBill.id
        ? { ...b, ...form, amount: parseFloat(form.amount), updatedAt: now }
        : b))
    } else {
      const bill: Bill = { id: Date.now().toString(), ...form, amount: parseFloat(form.amount), createdAt: now, updatedAt: now }
      setBills(prev => [...prev, bill])
    }
    setModal(null); setEditingBill(null)
  }

  const deleteBill = (id: string) => {
    if (!confirm('Remover esta conta?')) return
    setBills(prev => prev.filter(b => b.id !== id))
  }

  const billCategoryToTx = (billCat: string): string => {
    const map: Record<string, string> = {
      'Energia': 'Moradia', 'Água': 'Moradia', 'Condomínio': 'Moradia', 'Aluguel': 'Moradia',
      'Internet': 'Moradia', 'Telefonia': 'Moradia',
      'Cartão': 'Outros', 'Streaming': 'Lazer',
      'Educação': 'Educação', 'Saúde': 'Saúde', 'Imposto': 'Impostos',
    }
    return map[billCat] || 'Outros'
  }

  const addTxFromBill = (bill: Bill) => {
    const coll = getCollector(bill.collectorId)
    const txId = `bill-${bill.id}`
    const tx: Transaction = {
      id: txId,
      type: 'despesa',
      category: billCategoryToTx(coll?.category || ''),
      description: `${coll?.name || 'Conta'}${bill.description ? ' — ' + bill.description : ''}`,
      amount: bill.amount,
      date: bill.dueDate.slice(0, 7),
    }
    try {
      const txs: Transaction[] = JSON.parse(localStorage.getItem('lion-txs') || '[]')
      if (!txs.some(t => t.id === txId)) {
        txs.unshift(tx)
        localStorage.setItem('lion-txs', JSON.stringify(txs))
        CLOUD_BUS.dispatchEvent(new Event('lion-txs'))
      }
    } catch { /* ignore */ }
  }

  const removeTxFromBill = (billId: string) => {
    const txId = `bill-${billId}`
    try {
      const txs: Transaction[] = JSON.parse(localStorage.getItem('lion-txs') || '[]')
      const filtered = txs.filter(t => t.id !== txId)
      if (filtered.length !== txs.length) {
        localStorage.setItem('lion-txs', JSON.stringify(filtered))
        CLOUD_BUS.dispatchEvent(new Event('lion-txs'))
      }
    } catch { /* ignore */ }
  }

  const markPaid = (id: string) => {
    const now = new Date().toISOString()
    const bill = bills.find(b => b.id === id)
    setBills(prev => {
      let next = prev.map(b => b.id === id ? { ...b, status: 'pago' as BillStatus, paidAt: now, updatedAt: now } : b)
      if (bill && bill.recurrence === 'mensal') {
        const d = new Date(bill.dueDate + 'T12:00:00')
        d.setMonth(d.getMonth() + 1)
        const nextDue = d.toISOString().slice(0, 10)
        const alreadyExists = next.some(b => b.collectorId === bill.collectorId && b.dueDate === nextDue && b.status !== 'cancelado')
        if (!alreadyExists) {
          const newBill: Bill = {
            id: Date.now().toString(),
            collectorId: bill.collectorId,
            description: bill.description,
            amount: bill.amount,
            dueDate: nextDue,
            status: 'em_aberto',
            recurrence: 'mensal',
            paymentLink: bill.paymentLink,
            barcode: bill.barcode,
            notes: bill.notes,
            createdAt: now,
            updatedAt: now,
          }
          next = [...next, newBill]
        }
      }
      return next
    })
    if (bill) addTxFromBill(bill)
  }

  const markOpen = (id: string) => {
    setBills(prev => prev.map(b => b.id === id ? { ...b, status: 'em_aberto', paidAt: undefined, updatedAt: new Date().toISOString() } : b))
    removeTxFromBill(id)
  }

  const copyBarcode = (code: string) => {
    navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }

  // Filtered + effective status
  const visibleBills = bills
    .filter(b => !selCollector || b.collectorId === selCollector)
    .filter(b => filterStatus === 'all' || effectiveStatus(b) === filterStatus)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  // Summary (all bills, no collector filter)
  const today = new Date()
  const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  const totalAberto   = bills.filter(b => effectiveStatus(b) === 'em_aberto').reduce((s, b) => s + b.amount, 0)
  const totalVencido  = bills.filter(b => effectiveStatus(b) === 'vencido').reduce((s, b) => s + b.amount, 0)
  const isPagoMes = (b: Bill) => b.status === 'pago' && (b.paidAt?.startsWith(thisMonth) || (!b.paidAt && (b.dueDate?.startsWith(thisMonth) || !b.dueDate)))
  const totalPagoMes  = bills.filter(isPagoMes).reduce((s, b) => s + b.amount, 0)
  const totalMensal   = bills.filter(b => b.recurrence === 'mensal' && b.status !== 'cancelado').reduce((s, b) => s + b.amount, 0)

  const countVencido  = bills.filter(b => effectiveStatus(b) === 'vencido').length
  const countAberto   = bills.filter(b => effectiveStatus(b) === 'em_aberto').length

  const getCollector = (id: string) => collectors.find(c => c.id === id)

  const statusColors: Record<BillStatus, string> = {
    em_aberto: 'var(--blue)', pago: 'var(--green)', vencido: 'var(--red)', cancelado: 'var(--text)',
  }

  return (
    <div className="ph-page">
      {/* Summary */}
      <div className="ph-summary">
        <div className="ph-summary-card">
          <div className="ph-summary-icon" style={{ background: 'rgba(59,130,246,.15)', color: 'var(--blue)' }}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="8"/><path d="M10 6v4l3 3" strokeLinecap="round"/></svg>
          </div>
          <div>
            <div className="ph-summary-label">Em aberto</div>
            <div className="ph-summary-value">{fmtCurrency(totalAberto)}</div>
            <div className="ph-summary-sub">{countAberto} conta{countAberto !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div className="ph-summary-card">
          <div className="ph-summary-icon" style={{ background: 'rgba(239,68,68,.15)', color: 'var(--red)' }}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 6v4M10 14h.01" strokeLinecap="round"/><circle cx="10" cy="10" r="8"/></svg>
          </div>
          <div>
            <div className="ph-summary-label">Vencidas</div>
            <div className="ph-summary-value" style={{ color: countVencido > 0 ? 'var(--red)' : undefined }}>{fmtCurrency(totalVencido)}</div>
            <div className="ph-summary-sub">{countVencido} conta{countVencido !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div className="ph-summary-card">
          <div className="ph-summary-icon" style={{ background: 'rgba(16,185,129,.15)', color: 'var(--green)' }}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div>
            <div className="ph-summary-label">Pago este mês</div>
            <div className="ph-summary-value" style={{ color: 'var(--green)' }}>{fmtCurrency(totalPagoMes)}</div>
            <div className="ph-summary-sub">{bills.filter(isPagoMes).length} quitada{bills.filter(isPagoMes).length !== 1 ? 's' : ''}</div>
          </div>
        </div>
        <div className="ph-summary-card">
          <div className="ph-summary-icon" style={{ background: 'rgba(245,158,11,.15)', color: 'var(--amber)' }}>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h12v12H4z" rx="2"/><path d="M8 9h4M8 12h2" strokeLinecap="round"/></svg>
          </div>
          <div>
            <div className="ph-summary-label">Total mensal</div>
            <div className="ph-summary-value">{fmtCurrency(totalMensal)}</div>
            <div className="ph-summary-sub">contas recorrentes</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ph-tabs">
        <button className={`ph-tab${phTab === 'bills' ? ' ph-tab-active' : ''}`} onClick={() => setPhTab('bills')}>Contas</button>
        <button className={`ph-tab${phTab === 'monthly' ? ' ph-tab-active' : ''}`} onClick={() => setPhTab('monthly')}>Resumo Mensal</button>
      </div>

      {/* Monthly Summary */}
      {phTab === 'monthly' && (() => {
        const viewDate = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
        const viewMonth = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`
        const viewLabel = viewDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        const isCurrentMonth = monthOffset === 0

        const monthBills = bills.filter(b => {
          if (b.status === 'cancelado') return false
          if (b.dueDate.startsWith(viewMonth)) return true
          if (b.recurrence === 'mensal' && b.status !== 'pago') {
            const billStart = b.dueDate.slice(0, 7)
            return billStart <= viewMonth
          }
          return false
        }).sort((a, b) => {
          const dayA = parseInt(a.dueDate.slice(8) || '1')
          const dayB = parseInt(b.dueDate.slice(8) || '1')
          return dayA - dayB
        })

        const totalMes = monthBills.reduce((s, b) => s + b.amount, 0)
        const pagoMes = monthBills.filter(b => b.status === 'pago').reduce((s, b) => s + b.amount, 0)
        const abertoMes = monthBills.filter(b => effectiveStatus(b) === 'em_aberto' || effectiveStatus(b) === 'vencido').reduce((s, b) => s + b.amount, 0)
        const vencidoMes = monthBills.filter(b => effectiveStatus(b) === 'vencido').reduce((s, b) => s + b.amount, 0)

        return (
          <div className="ph-monthly">
            <div className="ph-monthly-nav">
              <button className="ph-monthly-arrow" onClick={() => setMonthOffset(p => p - 1)}>
                <svg viewBox="0 0 16 16" fill="none"><path d="M10 3l-5 5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              <div className="ph-monthly-title">
                <span className="ph-monthly-label">{viewLabel}</span>
                {!isCurrentMonth && <button className="ph-monthly-today" onClick={() => setMonthOffset(0)}>Hoje</button>}
              </div>
              <button className="ph-monthly-arrow" onClick={() => setMonthOffset(p => p + 1)}>
                <svg viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>

            <div className="ph-monthly-stats">
              <div className="ph-monthly-stat">
                <span className="ph-monthly-stat-label">Total do mês</span>
                <span className="ph-monthly-stat-value">{fmtCurrency(totalMes)}</span>
              </div>
              <div className="ph-monthly-stat">
                <span className="ph-monthly-stat-label">Pago</span>
                <span className="ph-monthly-stat-value" style={{ color: 'var(--green)' }}>{fmtCurrency(pagoMes)}</span>
              </div>
              <div className="ph-monthly-stat">
                <span className="ph-monthly-stat-label">A pagar</span>
                <span className="ph-monthly-stat-value" style={{ color: vencidoMes > 0 ? 'var(--red)' : 'var(--blue)' }}>{fmtCurrency(abertoMes)}</span>
              </div>
              <div className="ph-monthly-stat">
                <span className="ph-monthly-stat-label">Progresso</span>
                <div className="ph-monthly-progress-wrap">
                  <div className="ph-monthly-progress-bar">
                    <div className="ph-monthly-progress-fill" style={{ width: totalMes > 0 ? `${Math.round(pagoMes / totalMes * 100)}%` : '0%' }} />
                  </div>
                  <span className="ph-monthly-progress-pct">{totalMes > 0 ? Math.round(pagoMes / totalMes * 100) : 0}%</span>
                </div>
              </div>
            </div>

            {monthBills.length === 0 ? (
              <div className="ph-bills-empty">
                <svg viewBox="0 0 48 48" fill="none">
                  <rect x="8" y="12" width="32" height="28" rx="4" stroke="currentColor" strokeWidth="1.5" opacity=".3"/>
                  <path d="M8 20h32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".3"/>
                </svg>
                <span>Nenhuma conta para {viewLabel}</span>
              </div>
            ) : (
              <div className="ph-monthly-list">
                {monthBills.map(bill => {
                  const coll = getCollector(bill.collectorId)
                  const status = effectiveStatus(bill)
                  const isPaid = status === 'pago'
                  const isVencido = status === 'vencido'
                  const dueDay = bill.dueDate.slice(8) || '01'
                  return (
                    <div key={bill.id} className={`ph-bill-card${isPaid ? ' ph-bill-paid' : ''}${isVencido ? ' ph-bill-overdue' : ''}`}>
                      <div className="ph-monthly-day">
                        <span className="ph-monthly-day-num">{parseInt(dueDay)}</span>
                        <span className="ph-monthly-day-label">{new Date(viewDate.getFullYear(), viewDate.getMonth(), parseInt(dueDay)).toLocaleDateString('pt-BR', { weekday: 'short' })}</span>
                      </div>
                      <div className="ph-bill-left">
                        {coll && <div className="ph-bill-avatar" style={{ background: coll.color + '22', color: coll.color }}>{coll.name.slice(0,2).toUpperCase()}</div>}
                      </div>
                      <div className="ph-bill-body">
                        <div className="ph-bill-top">
                          <span className="ph-bill-collector">{coll?.name ?? '—'}</span>
                          <span className={`ph-bill-status ph-bill-status-${status}`}>{BILL_STATUS_LABEL[status]}</span>
                        </div>
                        {bill.description && <div className="ph-bill-desc">{bill.description}</div>}
                      </div>
                      <div className="ph-bill-right">
                        <div className="ph-bill-amount" style={{ color: isVencido ? 'var(--red)' : isPaid ? 'var(--green)' : 'var(--text3)' }}>
                          {fmtCurrency(bill.amount)}
                        </div>
                        <div className="ph-bill-actions">
                          {!isPaid && status !== 'cancelado' && (
                            <button className="ph-icon-btn ph-icon-btn-pay" title="Marcar como pago" onClick={() => markPaid(bill.id)}>
                              <svg viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </button>
                          )}
                          {isPaid && (
                            <button className="ph-icon-btn" title="Reabrir" onClick={() => markOpen(bill.id)}>
                              <svg viewBox="0 0 14 14" fill="none"><path d="M2 7a5 5 0 1 1 5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M2 4v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                            </button>
                          )}
                          <button className="ph-icon-btn" title="Editar" onClick={() => { setEditingBill(bill); setModal('edit-bill') }}>
                            <svg viewBox="0 0 14 14" fill="none"><path d="M2 10l7-7 2 2-7 7H2v-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {/* Layout */}
      {phTab === 'bills' && <div className="ph-layout">
        {/* Collectors */}
        <aside className="ph-collectors">
          <div className="ph-collectors-header">
            <span className="ph-collectors-title">Cobradores</span>
            <button className="ph-add-btn" onClick={() => { setEditingCollector(null); setModal('new-collector') }} title="Novo cobrador">
              <svg viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>
          <button className={`ph-collector-item${!selCollector ? ' ph-collector-active' : ''}`} onClick={() => setSelCollector(null)}>
            <div className="ph-collector-avatar" style={{ background: 'var(--bg4)' }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="1" y="3" width="14" height="10" rx="2"/><path d="M1 7h14" strokeLinecap="round"/></svg>
            </div>
            <div className="ph-collector-info">
              <span className="ph-collector-name">Todas</span>
              <span className="ph-collector-meta">{bills.length} conta{bills.length !== 1 ? 's' : ''}</span>
            </div>
          </button>
          {collectors.map(c => {
            const cBills = bills.filter(b => b.collectorId === c.id)
            const cTotal = cBills.filter(b => effectiveStatus(b) === 'em_aberto' || effectiveStatus(b) === 'vencido').reduce((s, b) => s + b.amount, 0)
            const hasOverdue = cBills.some(b => effectiveStatus(b) === 'vencido')
            return (
              <div key={c.id} className={`ph-collector-item${selCollector === c.id ? ' ph-collector-active' : ''}`}
                onClick={() => setSelCollector(selCollector === c.id ? null : c.id)}>
                <div className="ph-collector-avatar" style={{ background: c.color + '28', color: c.color }}>
                  {c.name.slice(0, 2).toUpperCase()}
                  {hasOverdue && <span className="ph-collector-overdue-dot" />}
                </div>
                <div className="ph-collector-info">
                  <span className="ph-collector-name">{c.name}</span>
                  <span className="ph-collector-meta">{c.category} · {cBills.length} conta{cBills.length !== 1 ? 's' : ''}</span>
                  {cTotal > 0 && <span className="ph-collector-total" style={{ color: hasOverdue ? 'var(--red)' : 'var(--text)' }}>{fmtCurrency(cTotal)}</span>}
                </div>
                <div className="ph-collector-actions">
                  <button className="ph-icon-btn" onClick={e => { e.stopPropagation(); setEditingCollector(c); setModal('edit-collector') }} title="Editar">
                    <svg viewBox="0 0 14 14" fill="none"><path d="M2 10l7-7 2 2-7 7H2v-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                  </button>
                  <button className="ph-icon-btn ph-icon-btn-del" onClick={e => { e.stopPropagation(); deleteCollector(c.id) }} title="Remover">
                    <svg viewBox="0 0 14 14" fill="none"><path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  </button>
                </div>
              </div>
            )
          })}
          {collectors.length === 0 && (
            <div className="ph-empty-hint">Adicione um cobrador para começar</div>
          )}
        </aside>

        {/* Bills */}
        <div className="ph-bills">
          <div className="ph-bills-header">
            <div className="ph-status-filters">
              {(['all', 'em_aberto', 'vencido', 'pago', 'cancelado'] as const).map(s => (
                <button key={s} className={`ph-status-btn${filterStatus === s ? ' ph-status-active' : ''}`}
                  onClick={() => setFilterStatus(s)}
                  style={filterStatus === s && s !== 'all' ? { borderColor: statusColors[s as BillStatus], color: statusColors[s as BillStatus] } : {}}>
                  {s === 'all' ? 'Todas' : BILL_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
            <button className="btn-accent ph-new-bill-btn" onClick={() => {
              setEditingBill(null)
              setModal('new-bill')
            }}>
              <svg viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Nova conta
            </button>
          </div>

          {visibleBills.length === 0 ? (
            <div className="ph-bills-empty">
              <svg viewBox="0 0 48 48" fill="none">
                <rect x="8" y="12" width="32" height="28" rx="4" stroke="currentColor" strokeWidth="1.5" opacity=".3"/>
                <path d="M8 20h32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".3"/>
                <path d="M18 30h12M18 34h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".3"/>
              </svg>
              <span>Nenhuma conta encontrada</span>
              <button className="btn-accent" onClick={() => { setEditingBill(null); setModal('new-bill') }}>Adicionar conta</button>
            </div>
          ) : (
            <div className="ph-bills-list">
              {visibleBills.map(bill => {
                const coll = getCollector(bill.collectorId)
                const status = effectiveStatus(bill)
                const isPaid = status === 'pago'
                const isVencido = status === 'vencido'
                return (
                  <div key={bill.id} className={`ph-bill-card${isPaid ? ' ph-bill-paid' : ''}${isVencido ? ' ph-bill-overdue' : ''}`}>
                    <div className="ph-bill-left">
                      {coll && <div className="ph-bill-avatar" style={{ background: coll.color + '22', color: coll.color }}>{coll.name.slice(0,2).toUpperCase()}</div>}
                    </div>
                    <div className="ph-bill-body">
                      <div className="ph-bill-top">
                        <span className="ph-bill-collector">{coll?.name ?? '—'}</span>
                        <span className={`ph-bill-status ph-bill-status-${status}`}>{BILL_STATUS_LABEL[status]}</span>
                      </div>
                      {bill.description && <div className="ph-bill-desc">{bill.description}</div>}
                      <div className="ph-bill-meta">
                        <span className="ph-bill-due" style={{ color: isVencido ? 'var(--red)' : undefined }}>
                          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="1" y="2" width="10" height="9" rx="1.5"/><path d="M1 5h10M4 1v2M8 1v2" strokeLinecap="round"/></svg>
                          {fmtDate(bill.dueDate)}
                          {isVencido && ' · Vencida'}
                          {isPaid && bill.paidAt && ` · Pago em ${fmtDate(bill.paidAt.slice(0,10))}`}
                        </span>
                        <span className="ph-bill-recurrence">{BILL_RECURRENCE_LABEL[bill.recurrence]}</span>
                        {coll && <span className="ph-bill-cat">{coll.category}</span>}
                      </div>
                    </div>
                    <div className="ph-bill-right">
                      <div className="ph-bill-amount" style={{ color: isVencido ? 'var(--red)' : isPaid ? 'var(--green)' : 'var(--text3)' }}>
                        {fmtCurrency(bill.amount)}
                      </div>
                      <div className="ph-bill-actions">
                        {bill.barcode && (
                          <button className="ph-icon-btn" title="Ver código" onClick={() => { setBarcodeText(bill.barcode!); setModal('barcode') }}>
                            <svg viewBox="0 0 14 14" fill="none"><rect x="1" y="2" width="2" height="10" fill="currentColor" rx=".5"/><rect x="4" y="2" width="1" height="10" fill="currentColor" rx=".5"/><rect x="6" y="2" width="2" height="10" fill="currentColor" rx=".5"/><rect x="9" y="2" width="1" height="10" fill="currentColor" rx=".5"/><rect x="11" y="2" width="2" height="10" fill="currentColor" rx=".5"/></svg>
                          </button>
                        )}
                        {bill.paymentLink && (
                          <a className="ph-icon-btn" href={bill.paymentLink} target="_blank" rel="noreferrer" title="Abrir link de pagamento">
                            <svg viewBox="0 0 14 14" fill="none"><path d="M6 3H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M9 2h3v3M12 2l-5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                          </a>
                        )}
                        {!isPaid && status !== 'cancelado' && (
                          <button className="ph-icon-btn ph-icon-btn-pay" title="Marcar como pago" onClick={() => markPaid(bill.id)}>
                            <svg viewBox="0 0 14 14" fill="none"><path d="M2 7l4 4 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </button>
                        )}
                        {isPaid && (
                          <button className="ph-icon-btn" title="Reabrir" onClick={() => markOpen(bill.id)}>
                            <svg viewBox="0 0 14 14" fill="none"><path d="M2 7a5 5 0 1 1 5 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><path d="M2 4v3h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                          </button>
                        )}
                        <button className="ph-icon-btn" title="Editar" onClick={() => {
                          setEditingBill(bill)
                          setModal('edit-bill')
                        }}>
                          <svg viewBox="0 0 14 14" fill="none"><path d="M2 10l7-7 2 2-7 7H2v-2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>
                        </button>
                        <button className="ph-icon-btn ph-icon-btn-del" title="Remover" onClick={() => deleteBill(bill.id)}>
                          <svg viewBox="0 0 14 14" fill="none"><path d="M4 4l6 6M10 4l-6 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>}

      {/* Modals */}
      {(modal === 'new-collector' || modal === 'edit-collector') && (
        <Modal title={modal === 'edit-collector' ? 'Editar cobrador' : 'Novo cobrador'} onClose={() => { setModal(null); setEditingCollector(null) }}>
          <CollectorForm
            initial={editingCollector ? { name: editingCollector.name, category: editingCollector.category, color: editingCollector.color } : { ...COLL_INIT }}
            onSave={saveCollector} onCancel={() => { setModal(null); setEditingCollector(null) }}
          />
        </Modal>
      )}
      {(modal === 'new-bill' || modal === 'edit-bill') && (
        <Modal title={modal === 'edit-bill' ? 'Editar conta' : 'Nova conta'} onClose={() => { setModal(null); setEditingBill(null) }}>
          <BillForm
            initial={editingBill
              ? { collectorId: editingBill.collectorId, description: editingBill.description, amount: String(editingBill.amount), dueDate: editingBill.dueDate, status: editingBill.status, recurrence: editingBill.recurrence, paymentLink: editingBill.paymentLink || '', barcode: editingBill.barcode || '', notes: editingBill.notes || '' }
              : { ...BILL_INIT, collectorId: selCollector || '' }}
            collectors={collectors} onSave={saveBill} onCancel={() => { setModal(null); setEditingBill(null) }}
            onCreateCollector={createCollectorInline}
          />
        </Modal>
      )}
      {modal === 'barcode' && (
        <Modal title="Código de barras / PIX" onClose={() => { setModal(null); setBarcodeText('') }}>
          <div className="ph-barcode-modal">
            <div className="ph-barcode-text">{barcodeText}</div>
            <button className="btn-accent" onClick={() => copyBarcode(barcodeText)}>
              {copied ? '✓ Copiado!' : 'Copiar código'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [showCalc, setShowCalc] = useState(false)
  const [showNp, setShowNp] = useState(false)
  const [showFin, setShowFin] = useState(false)
  const [showSim, setShowSim] = useState(false)
  const [showDocs, setShowDocs] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)
  const [activityOpen, setActivityOpen] = useState(true)
  const [alertCount, setAlertCount] = useState(() => buildAlerts().length)
  const [showShare, setShowShare] = useState(false)
  const [viewMode, setViewMode] = useState(false)
  const [viewOwner, setViewOwner] = useState('')
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('lion-onboarded'))
  const finishOnboarding = () => { localStorage.setItem('lion-onboarded', '1'); setShowOnboarding(false) }

  interface FxRate { code: string; bid: string; pct: string }
  const [fxRates, setFxRates] = useState<FxRate[]>([])
  useEffect(() => {
    const CACHE_KEY = 'lion-fx-cache'
    const last8am = (() => { const d = new Date(); d.setHours(8,0,0,0); if (new Date() < d) d.setDate(d.getDate()-1); return d.getTime() })()
    const cached = localStorage.getItem(CACHE_KEY)
    if (cached) { try { const p = JSON.parse(cached); if (p.ts >= last8am) { setFxRates(p.rates); return } } catch { /* ignore */ } }
    fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,BTC-BRL,CNY-BRL')
      .then(r => r.json())
      .then(d => {
        const rates: FxRate[] = [
          { code: 'USD', bid: parseFloat(d.USDBRL.bid).toFixed(2), pct: d.USDBRL.pctChange },
          { code: 'EUR', bid: parseFloat(d.EURBRL.bid).toFixed(2), pct: d.EURBRL.pctChange },
          { code: 'BTC', bid: parseFloat(d.BTCBRL.bid).toLocaleString('pt-BR', { maximumFractionDigits: 0 }), pct: d.BTCBRL.pctChange },
          { code: 'CNY', bid: parseFloat(d.CNYBRL.bid).toFixed(3), pct: d.CNYBRL.pctChange },
        ]
        setFxRates(rates)
        localStorage.setItem(CACHE_KEY, JSON.stringify({ rates, ts: Date.now() }))
      })
      .catch(() => {})
  }, [])

  const [dashData, setDashData] = useState(() => computeDashData())
  const [activity, setActivity] = useState(() => buildActivity())
  const [themeId, setThemeId] = useState(() => localStorage.getItem('lion-theme') || 'dark')
  const [fontSize, setFontSize] = useState(() => localStorage.getItem('lion-font') || 'normal')
  const [accentId, setAccentId] = useState(() => localStorage.getItem('lion-accent') || 'red')
  const [animations, setAnimations] = useState(() => localStorage.getItem('lion-animations') !== 'off')
  const [sidebarFixed, setSidebarFixed] = useState(() => localStorage.getItem('lion-sidebar-fixed') === 'on')
  const [modal, setModal] = useState<ModalType>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const [sidebarPage, setSidebarPage] = useState<SidebarPage>('dashboard')
  const [customLogo, setCustomLogo] = useState<string>(() => localStorage.getItem('lion-logo') || '')

  useEffect(() => {
    const onLogoChange = () => setCustomLogo(localStorage.getItem('lion-logo') || '')
    window.addEventListener('lion-logo-changed', onLogoChange)
    return () => window.removeEventListener('lion-logo-changed', onLogoChange)
  }, [])

  useEffect(() => {
    const fav = localStorage.getItem('lion-favicon')
    if (fav) {
      const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]') || (() => {
        const l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); return l
      })()
      link.href = fav
    }
  }, [])
  const [searchQ, setSearchQ] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [npTarget, setNpTarget] = useState<{ folderId: string; noteId: string } | null>(null)
  const searchResults = searchOpen && searchQ.trim().length >= 2 ? buildSearchIndex(searchQ) : []

  useEffect(() => {
    const el = document.documentElement
    el.removeAttribute('data-theme')
    el.classList.remove('light')
    if (themeId !== 'dark') el.setAttribute('data-theme', themeId === 'light' ? 'light' : themeId)
    localStorage.setItem('lion-theme', themeId)
  }, [themeId])

  useEffect(() => {
    const el = document.documentElement
    el.removeAttribute('data-fs')
    if (fontSize !== 'normal') el.setAttribute('data-fs', fontSize)
    localStorage.setItem('lion-font', fontSize)
  }, [fontSize])

  useEffect(() => {
    const accent = ACCENT_COLORS.find(a => a.id === accentId) ?? ACCENT_COLORS[0]
    document.documentElement.style.setProperty('--purple', accent.color)
    document.documentElement.style.setProperty('--purple-l', accent.light)
    localStorage.setItem('lion-accent', accentId)
  }, [accentId])

  useEffect(() => {
    if (animations) document.documentElement.removeAttribute('data-no-anim')
    else document.documentElement.setAttribute('data-no-anim', '')
    localStorage.setItem('lion-animations', animations ? 'on' : 'off')
  }, [animations])

  useEffect(() => {
    localStorage.setItem('lion-sidebar-fixed', sidebarFixed ? 'on' : 'off')
  }, [sidebarFixed])

  useEffect(() => {
    const refresh = () => { setDashData(computeDashData()); setActivity(buildActivity()) }
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [])

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
    DATA_KEYS.forEach(k => localStorage.removeItem(k))
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

  const handleSearchSelect = (r: SearchResult) => {
    setSearchQ(''); setSearchOpen(false)
    closeAll()
    if (r.section === 'fin') { setShowFin(true); return }
    if (r.section === 'note') {
      const [folderId, noteId] = r.id.split(':')
      setNpTarget({ folderId, noteId })
      setShowNp(true)
      return
    }
    setTimeout(() => {
      const sectionMap: Record<string, string> = { goals: '.goals-section', rentals: '.rentals-section', vehicles: '.vehicles-section', maint: '.maintenance-section', pat: '.pat-section' }
      const el = document.querySelector(sectionMap[r.section] || `.${r.section}-section`)
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }
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

  const [kbHint, setKbHint] = useState<string | null>(null)
  const [showKbLegend, setShowKbLegend] = useState(false)


  useEffect(() => {
    let hintTimer: ReturnType<typeof setTimeout>
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const key = e.key.toLowerCase()
      const hints: Record<string, string> = { f: 'Finanças', n: 'Notas', c: 'Calculadora', s: 'Simulador', a: 'Alertas', d: 'Documentos', '?': 'Atalhos', escape: 'Fechar' }
      if (!hints[key] && key !== '?') return
      e.preventDefault()
      clearTimeout(hintTimer)
      if (key === '?') { setShowKbLegend(v => !v); return }
      setKbHint(hints[key])
      hintTimer = setTimeout(() => setKbHint(null), 1200)
      if (key === 'escape') { closeAll(); setShowKbLegend(false); return }
      if (key === 'f') toggleFin()
      if (key === 'n') toggleNp()
      if (key === 'c') toggleCalc()
      if (key === 's') toggleSim()
      if (key === 'a') toggleAlerts()
      if (key === 'd') toggleDocs()
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(hintTimer) }
  }, [showCalc, showNp, showFin, showSim, showDocs, showAlerts])

  if (!authReady) return null
  if (supabase && !user) return <LoginPage />

  return (
    <UserCtx.Provider value={user?.id}>
    <div className={`app${viewMode ? ' view-mode' : ''}${sidebarFixed ? ' sidebar-pinned' : ''}`}>
      {kbHint && <div className="kb-toast">{kbHint}</div>}
      {showOnboarding && <OnboardingWizard onDone={finishOnboarding} />}

      {/* ── Sidebar ── */}
      {showSidebar && <div className="sidebar-overlay" onClick={() => setShowSidebar(false)} />}
      <aside className={`sidebar${showSidebar ? ' sidebar-open' : ''}`}>
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials || '?'}</div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{displayName.split('@')[0]}</div>
            <div className="sidebar-user-email">{user?.email || ''}</div>
          </div>
          <button className="sidebar-close-btn" onClick={() => setShowSidebar(false)} title="Fechar">
            <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>
        <nav className="sidebar-nav">
          {([
            { icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="7" height="7" rx="1"/><rect x="11" y="2" width="7" height="7" rx="1"/><rect x="2" y="11" width="7" height="7" rx="1"/><rect x="11" y="11" width="7" height="7" rx="1"/></svg>, label: 'Dashboard', action: () => { setSidebarPage('dashboard'); setShowSidebar(false) }, active: sidebarPage === 'dashboard' },
            { icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="16" height="11" rx="2"/><path d="M2 9h16" strokeLinecap="round"/><path d="M5 13h3M11 13h4" strokeLinecap="round"/></svg>, label: 'Hub de Pagamentos', active: sidebarPage === 'payment-hub', action: () => { setSidebarPage('payment-hub'); setShowSidebar(false) } },
            { icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 2v16M6 6h5.5a2.5 2.5 0 0 1 0 5H6m0 0h6a2.5 2.5 0 0 1 0 5H6" strokeLinecap="round"/></svg>, label: 'Finanças', active: sidebarPage === 'financas', action: () => { setSidebarPage('financas'); setShowSidebar(false) } },
            { icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M4 18a6 6 0 0 1 12 0"/></svg>, label: 'Família', active: sidebarPage === 'family', action: () => { setSidebarPage('family'); setShowSidebar(false) } },
            { icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="4" width="16" height="14" rx="2"/><path d="M6 2v4M14 2v4M2 9h16" strokeLinecap="round"/></svg>, label: 'Calendário', active: sidebarPage === 'calendar', action: () => { setSidebarPage('calendar'); setShowSidebar(false) } },
            { icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l7-6 7 6v9H3V9z" strokeLinejoin="round"/><path d="M7 18V12h6v6" strokeLinecap="round"/><rect x="10" y="4" width="6" height="5" rx="1" fill="currentColor" opacity=".2" stroke="none"/></svg>, label: 'Patrimônio', active: sidebarPage === 'patrimonio', action: () => { setSidebarPage('patrimonio'); setShowSidebar(false) } },
            { icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 16l4-3 3 2 4-5 5 3" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 18h16" strokeLinecap="round"/><circle cx="16" cy="5" r="2" fill="currentColor" opacity=".3" stroke="none"/></svg>, label: 'Terra', active: sidebarPage === 'terra', action: () => { setSidebarPage('terra'); setShowSidebar(false) } },
            { icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="10" cy="10" r="7"/><path d="M10 7v3l2 2" strokeLinecap="round"/><circle cx="10" cy="3" r="1" fill="currentColor" stroke="none"/><circle cx="10" cy="17" r="1" fill="currentColor" stroke="none"/><circle cx="3" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="17" cy="10" r="1" fill="currentColor" stroke="none"/></svg>, label: 'Aparência', active: sidebarPage === 'appearance', action: () => { setSidebarPage('appearance'); setShowSidebar(false) } },
            { icon: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2h4M10 2v3M7 5h6a1 1 0 0 1 1 1v1H6V6a1 1 0 0 1 1-1zM5 7h10l-1 10H6L5 7z" strokeLinejoin="round"/></svg>, label: 'Configurações', active: sidebarPage === 'settings', action: () => { setSidebarPage('settings'); setShowSidebar(false) } },
          ] as { icon: React.ReactNode; label: string; active?: boolean; badge?: string; action: () => void }[]).map(item => (
            <button key={item.label} className={`sidebar-nav-item${item.active ? ' sidebar-nav-active' : ''}`} onClick={item.action}>
              <span className="sidebar-nav-icon">{item.icon}</span>
              <span className="sidebar-nav-label">{item.label}</span>
              {item.badge && <span className="sidebar-nav-badge">{item.badge}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="sidebar-nav-item" onClick={handleLogout}>
            <span className="sidebar-nav-icon"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 15l3-5-3-5" strokeLinecap="round" strokeLinejoin="round"/><path d="M16 10H7" strokeLinecap="round"/><path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" strokeLinecap="round"/></svg></span>
            <span className="sidebar-nav-label">Sair</span>
          </button>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="main-col">

      {/* ── Topbar ── */}
      <header className="topbar">
        <button className="hamburger-btn" onClick={() => setShowSidebar(v => !v)} title="Menu">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M3 5h14M3 10h14M3 15h14"/>
          </svg>
        </button>
        {/* Brand — visible on mobile only, sidebar has it on desktop */}
        <div className="topbar-brand">
          <div className="topbar-brand-mark">
            {customLogo
              ? <img src={customLogo} alt="Logo" style={{ width: 32, height: 32, objectFit: 'contain', borderRadius: 6 }} />
              : <svg viewBox="0 0 32 32" fill="none">
                  <rect width="32" height="32" rx="10" fill="url(#tbg)"/>
                  <path d="M8 22L13 10l5 8 4-5 4 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <defs><linearGradient id="tbg" x1="0" y1="0" x2="32" y2="32"><stop stopColor="#c0392b"/><stop offset="1" stopColor="#96281b"/></linearGradient></defs>
                </svg>
            }
          </div>
          <div className="topbar-brand-name">Lion Admin</div>
        </div>
        <div className="header-search-wrap topbar-search-wrap">
          <div className={`header-search${searchOpen ? ' search-active' : ''}`}>
            <svg className="search-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="9" cy="9" r="6"/><path d="M15 15l3 3" strokeLinecap="round"/>
            </svg>
            <input
              className="search-input"
              placeholder="Buscar transações, metas, imóveis…"
              value={searchQ}
              onChange={e => { setSearchQ(e.target.value); setSearchOpen(true) }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 180)}
            />
            {searchQ && (
              <button className="search-clear" onClick={() => { setSearchQ(''); setSearchOpen(false) }}>
                <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </button>
            )}
          </div>
          {searchOpen && searchResults.length > 0 && (
            <div className="search-dropdown">
              {searchResults.map(r => (
                <button key={r.id} className="search-result" onMouseDown={() => handleSearchSelect(r)}>
                  <span className={`search-result-dot dot-${r.color}`}/>
                  <div className="search-result-text">
                    <span className="search-result-label">{r.label}</span>
                    <span className="search-result-sub"><span className="search-result-type">{r.type}</span> · {r.sub}</span>
                  </div>
                  <svg className="search-result-arrow" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              ))}
            </div>
          )}
          {searchOpen && searchQ.trim().length >= 2 && searchResults.length === 0 && (
            <div className="search-dropdown search-empty">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="9" cy="9" r="6"/><path d="M15 15l3 3" strokeLinecap="round"/></svg>
              <span>Nenhum resultado para "<strong>{searchQ}</strong>"</span>
            </div>
          )}
        </div>

        <div className="header-right">
          <button className="theme-toggle-btn" onClick={() => setThemeId(t => t === 'light' ? 'charcoal' : 'light')} title={themeId === 'light' ? 'Modo escuro' : 'Modo claro'}>
            {themeId === 'light' ? (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17.293 13.293A8 8 0 0 1 6.707 2.707a8.001 8.001 0 1 0 10.586 10.586z"/>
              </svg>
            ) : (
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="10" cy="10" r="4"/>
                <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.93 4.93l1.41 1.41M13.66 13.66l1.41 1.41M4.93 15.07l1.41-1.41M13.66 6.34l1.41-1.41" strokeLinecap="round"/>
              </svg>
            )}
          </button>
          <button className={`bell-btn${showAlerts ? ' bell-active' : ''}`} onClick={toggleAlerts} title="Alertas">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 2a6 6 0 0 0-6 6v3l-1.5 2.5h15L16 11V8a6 6 0 0 0-6-6z" strokeLinejoin="round"/>
              <path d="M8.5 16.5a1.5 1.5 0 0 0 3 0" strokeLinecap="round"/>
            </svg>
            {alertCount > 0 && <span className="bell-badge">{alertCount > 9 ? '9+' : alertCount}</span>}
          </button>
        </div>
      </header>

      {/* ── View mode banner ── */}
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

      {/* ── Sub-pages (Família, Calendário, etc.) ── */}
      {sidebarPage !== 'dashboard' && (
        <div className={`page-content${sidebarPage === 'settings' ? ' page-content--settings' : ''}`}>
          <button className="page-back-btn" onClick={() => setSidebarPage('dashboard')}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M10 4L6 8l4 4"/></svg>
            Voltar ao Dashboard
          </button>
          {sidebarPage === 'family'     && <FamilyPage />}
          {sidebarPage === 'calendar'   && <CalendarPage />}
          {sidebarPage === 'trips'        && <TripsPage />}
          {sidebarPage === 'goals'        && <GoalsPage />}
          {sidebarPage === 'financas'       && <div className="fin-page-wrap"><FinancePanel onClose={() => setSidebarPage('dashboard')} /></div>}
          {sidebarPage === 'patrimonio'    && <PatrimonioPage />}
          {sidebarPage === 'terra'          && <TerraPage />}
          {sidebarPage === 'payment-hub'  && <PaymentHubPage />}
          {sidebarPage === 'appearance'   && <AppearancePage themeId={themeId} setThemeId={setThemeId} fontSize={fontSize} setFontSize={setFontSize} accentId={accentId} setAccentId={setAccentId} animations={animations} setAnimations={setAnimations} sidebarFixed={sidebarFixed} setSidebarFixed={setSidebarFixed} />}
          {sidebarPage === 'settings'     && <SettingsPage user={user} />}
        </div>
      )}

      {/* ── Dashboard bento ── */}
      {(() => {
        if (sidebarPage !== 'dashboard') return null
        const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

        // Sparkline: last 6 months cumulative saldo
        const txsRaw: Transaction[] = (() => { try { return JSON.parse(localStorage.getItem('lion-txs') || '[]') } catch { return [] } })()
        const sparkMonths: number[] = []
        let running = 0
        for (let i = 5; i >= 0; i--) {
          const d = new Date(); d.setMonth(d.getMonth() - i)
          const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
          running += txsRaw.filter(t => t.date === key).reduce((s,t) => s+(t.type==='receita'?t.amount:-t.amount),0)
          sparkMonths.push(running)
        }
        const sparkPath = sparkMonths.length >= 2 ? (() => {
          const mn = Math.min(...sparkMonths), mx = Math.max(...sparkMonths), rng = mx - mn || 1
          const pts = sparkMonths.map((v,i) => `${(i/(sparkMonths.length-1))*260},${42-((v-mn)/rng*38)}`)
          return { line: `M${pts.join(' L')}`, area: `M${pts.join(' L')} L260,44 L0,44Z` }
        })() : null

        // Monthly income/expenses
        const now2 = new Date()
        const curKey = `${now2.getFullYear()}-${String(now2.getMonth()+1).padStart(2,'0')}`
        const monthInc = txsRaw.filter(t=>t.date===curKey&&t.type==='receita').reduce((s,t)=>s+t.amount,0)
        const monthExp = txsRaw.filter(t=>t.date===curKey&&t.type==='despesa').reduce((s,t)=>s+t.amount,0)

        const momPct = dashData.lastMonthNet !== 0 ? Math.round((dashData.thisMonthNet-dashData.lastMonthNet)/Math.abs(dashData.lastMonthNet)*100) : 0

        return (
          <main className="dash-content">
            {/* ── Row 1: Hero + 3 metrics ── */}
            <div className="bento-row bento-r1">

              {/* Hero card */}
              <div className="bc bc-hero">
                <div className="hero-eyebrow">Saldo Financeiro</div>
                <div className="hero-amount">{fmt(dashData.balance)}</div>
                <span className={`hero-pill ${momPct >= 0 ? 'hero-pill-pos' : 'hero-pill-neg'}`}>
                  {momPct >= 0 ? '↑' : '↓'} {Math.abs(momPct)}% vs mês anterior
                </span>
                {sparkPath && (
                  <div className="hero-spark">
                    <div className="hero-spark-lbl">Evolução — últimos 6 meses</div>
                    <svg className="spark-svg" viewBox="0 0 260 44" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="sg2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#c0392b" stopOpacity=".3"/>
                          <stop offset="100%" stopColor="#c0392b" stopOpacity="0"/>
                        </linearGradient>
                      </defs>
                      <path d={sparkPath.area} fill="url(#sg2)"/>
                      <path d={sparkPath.line} stroke="#e74c3c" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="260" cy={42-((sparkMonths[5]-Math.min(...sparkMonths))/(Math.max(...sparkMonths)-Math.min(...sparkMonths)||1)*38)} r="3" fill="#e74c3c"/>
                    </svg>
                  </div>
                )}
              </div>

              {/* Metric: Receita */}
              <div className="bc bc-metric">
                <div className="metric-ico mi-green">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 2v16M14 5H8a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6H6" strokeLinecap="round"/></svg>
                </div>
                <div className="metric-lbl">Receita mensal</div>
                <div className="metric-val">{fmt(monthInc)}</div>
                <div className={`metric-chg ${monthInc > 0 ? 'mc-pos' : 'mc-neu'}`}>
                  {monthInc > 0 ? '↑' : '—'} {curKey.split('-').reverse().join('/')}
                </div>
              </div>

              {/* Metric: Gastos */}
              <div className="bc bc-metric">
                <div className="metric-ico mi-red">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7h14M3 7l2-3h10l2 3M3 7v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div className="metric-lbl">Gastos mensais</div>
                <div className="metric-val">{fmt(monthExp)}</div>
                <div className={`metric-chg ${monthExp > monthInc ? 'mc-neg' : 'mc-neu'}`}>
                  {monthExp > monthInc ? '↑ Acima da receita' : monthExp > 0 ? `${Math.round((monthExp/Math.max(monthInc,1))*100)}% da receita` : 'Sem gastos'}
                </div>
              </div>

              {/* Metric: Alertas */}
              <div className="bc bc-metric" style={{ cursor:'pointer' }} onClick={toggleAlerts}>
                <div className={`metric-ico ${dashData.dangerCount > 0 ? 'mi-red' : dashData.warnCount > 0 ? 'mi-amber' : 'mi-green'}`}>
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8.57 3.43L1.5 15.5a1.5 1.5 0 0 0 1.29 2.25h14.42A1.5 1.5 0 0 0 18.5 15.5L11.43 3.43a1.65 1.65 0 0 0-2.86 0z" strokeLinejoin="round"/><path d="M10 8v4M10 14h.01" strokeLinecap="round"/></svg>
                </div>
                <div className="metric-lbl">Alertas ativos</div>
                <div className="metric-val">{dashData.totalAlerts}</div>
                <div className={`metric-chg ${dashData.dangerCount > 0 ? 'mc-neg' : dashData.warnCount > 0 ? 'mc-neu' : 'mc-pos'}`}>
                  {dashData.totalAlerts === 0 ? '✓ Tudo em ordem' : `${dashData.dangerCount} crítico(s)`}
                </div>
              </div>

            </div>

            {/* ── Row 2: Activity + Goals + Quick Actions ── */}
            <div className="bento-row bento-r2">

              {/* Activity feed */}
              <div className="bc">
                <div className="bc-title" style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => setActivityOpen(v => !v)}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg viewBox="0 0 12 12" fill="none" style={{ width: '10px', height: '10px', transition: 'transform .2s', transform: activityOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}><path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                    Atividade Recente
                  </span>
                  <button className="bc-title-btn" onClick={e => { e.stopPropagation(); setSidebarPage('financas') }}>+ Transação</button>
                </div>
                {activityOpen && (activity.length === 0 ? (
                  <div className="feed-empty">Nenhuma atividade. Adicione transações, metas ou imóveis.</div>
                ) : activity.slice(0,6).map(a => (
                  <div key={a.id} className="feed-row">
                    <div className="feed-dot" style={{ background: a.color === 'green' ? 'var(--green)' : a.color === 'red' ? 'var(--red)' : a.color === 'amber' ? 'var(--amber)' : 'var(--blue)' }}/>
                    <div className="feed-info">
                      <div className="feed-name">{a.title}</div>
                      <div className="feed-time">{a.time}</div>
                    </div>
                    <div className="feed-amt" style={{ color: a.color === 'green' ? 'var(--green-l)' : a.color === 'red' ? '#f87171' : a.color === 'amber' ? 'var(--amber-l)' : 'var(--blue-l)' }}>{a.sub}</div>
                  </div>
                )))}
              </div>

              {/* Hub de Pagamentos summary */}
              {(() => {
                const hubBills: Bill[] = (() => { try { return JSON.parse(localStorage.getItem('lion-bills') || '[]') } catch { return [] } })()
                const hubNow = new Date()
                const hubMonth = `${hubNow.getFullYear()}-${String(hubNow.getMonth() + 1).padStart(2, '0')}`
                const monthBills = hubBills.filter(b => b.dueDate?.startsWith(hubMonth) && b.status !== 'cancelado')
                const aberto = monthBills.filter(b => effectiveStatus(b) === 'em_aberto')
                const vencido = monthBills.filter(b => effectiveStatus(b) === 'vencido')
                const pago = monthBills.filter(b => b.status === 'pago')
                const totalAberto = aberto.reduce((s, b) => s + b.amount, 0) + vencido.reduce((s, b) => s + b.amount, 0)
                const totalPago = pago.reduce((s, b) => s + b.amount, 0)
                const progress = (totalAberto + totalPago) > 0 ? Math.round((totalPago / (totalAberto + totalPago)) * 100) : 0
                return (
                  <div className="bc">
                    <div className="bc-title">
                      Contas do Mês
                      <button className="bc-title-btn" onClick={() => setSidebarPage('payment-hub')}>Ver todas</button>
                    </div>
                    {monthBills.length === 0 ? (
                      <div className="feed-empty">Nenhuma conta este mês.</div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                          <div style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: 'rgba(239,68,68,.1)' }}>
                            <div style={{ fontSize: 'calc(.65rem * var(--fs))', color: 'var(--text)', opacity: .6 }}>A pagar</div>
                            <div style={{ fontSize: 'calc(.85rem * var(--fs))', fontWeight: 600, color: vencido.length > 0 ? 'var(--red)' : 'var(--text)' }}>{fmt(totalAberto)}</div>
                            <div style={{ fontSize: 'calc(.6rem * var(--fs))', color: 'var(--text)', opacity: .5 }}>{aberto.length + vencido.length} conta{(aberto.length + vencido.length) !== 1 ? 's' : ''}{vencido.length > 0 ? ` · ${vencido.length} vencida` : ''}</div>
                          </div>
                          <div style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', background: 'rgba(16,185,129,.1)' }}>
                            <div style={{ fontSize: 'calc(.65rem * var(--fs))', color: 'var(--text)', opacity: .6 }}>Pago</div>
                            <div style={{ fontSize: 'calc(.85rem * var(--fs))', fontWeight: 600, color: 'var(--green)' }}>{fmt(totalPago)}</div>
                            <div style={{ fontSize: 'calc(.6rem * var(--fs))', color: 'var(--text)', opacity: .5 }}>{pago.length} quitada{pago.length !== 1 ? 's' : ''}</div>
                          </div>
                        </div>
                        <div style={{ background: 'var(--bg3)', borderRadius: '6px', height: '6px', overflow: 'hidden' }}>
                          <div style={{ width: `${progress}%`, height: '100%', background: 'var(--green)', borderRadius: '6px', transition: 'width .3s' }} />
                        </div>
                        <div style={{ fontSize: 'calc(.6rem * var(--fs))', color: 'var(--text)', opacity: .5, marginTop: '4px', textAlign: 'right' }}>{progress}% quitado</div>
                        {vencido.slice(0, 3).map(b => {
                          const collectors: Collector[] = (() => { try { return JSON.parse(localStorage.getItem('lion-collectors') || '[]') } catch { return [] } })()
                          const c = collectors.find(cl => cl.id === b.collectorId)
                          return (
                            <div key={b.id} className="feed-row">
                              <div className="feed-dot" style={{ background: 'var(--red)' }} />
                              <div className="feed-info">
                                <div className="feed-name">{c?.name || 'Conta'}{b.description ? ` — ${b.description}` : ''}</div>
                                <div className="feed-time">Vencida · {fmtDate(b.dueDate)}</div>
                              </div>
                              <div className="feed-amt" style={{ color: '#f87171' }}>{fmt(b.amount)}</div>
                            </div>
                          )
                        })}
                      </>
                    )}
                  </div>
                )
              })()}


            </div>

          </main>
        )
      })()}

      {/* keep legacy section components referenced to avoid unused-locals TS error */}
      {false && <><PatrimonySection /><NotesSection onOpenNotepad={toggleNp} /><RentalsSection /><MaintenanceSection /><VehicleHistorySection />{fxRates}{toggleShare}{showKbLegend}</>}

      </div>{/* /main-col */}

      {/* ── Floating Buttons ── */}
      <div className="floats">
        <button className={`float-btn float-np${showNp ? ' float-active' : ''}`} onClick={toggleNp} title="Notas (N)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4h16v16H4z" rx="2"/>
            <path d="M8 2v4M12 2v4M16 2v4" strokeLinecap="round"/>
            <line x1="8" y1="12" x2="16" y2="12" strokeLinecap="round"/>
            <line x1="8" y1="16" x2="12" y2="16" strokeLinecap="round"/>
          </svg>
        </button>
        <button className={`float-btn float-calc${showCalc ? ' float-active' : ''}`} onClick={toggleCalc} title="Calculadora (C)">
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
      <div className={`float-panel panel-np${showNp ? ' panel-open' : ''}`}>
        <Notepad onClose={() => setShowNp(false)} npTarget={npTarget} onTargetHandled={() => setNpTarget(null)} />
      </div>
      <div className={`float-panel panel-calc${showCalc ? ' panel-open' : ''}`}>
        <Calculator onClose={() => setShowCalc(false)} />
      </div>

      {/* ── Modals ── */}
      {modal && <NewItemModal type={modal} onClose={() => setModal(null)} onNavigate={(page) => { setSidebarPage(page); setShowSidebar(false) }} />}

    </div>
    </UserCtx.Provider>
  )
}
