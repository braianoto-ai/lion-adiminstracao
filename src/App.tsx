import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import './App.css'

type Property = {
  id: string
  name: string
  type: string | null
  street: string | null
  number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  iptu_number: string | null
  registration_number: string | null
  total_area: number | null
  bedrooms: number | null
  bathrooms: number | null
  parking_spots: number | null
  status: string | null
  acquisition_date: string | null
  acquisition_value: number | null
  current_value: number | null
  notes: string | null
  address: string | null
  created_at: string
}

type Bill = {
  id: string
  property_id: string
  description: string
  category: string | null
  amount: number
  due_date: string
  status: string
  paid_at: string | null
  notes: string | null
  created_at: string
}

type DocItem = {
  id: string
  property_id: string
  name: string
  category: string | null
  file_url: string | null
  file_name: string | null
  notes: string | null
  created_at: string
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session); setLoadingSession(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  if (loadingSession) return <div className="loading-screen">Carregando...</div>
  if (!session) return <Login />
  return <Shell onLogout={() => supabase.auth.signOut()} userEmail={session.user.email} />
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Email ou senha incorretos')
    setLoading(false)
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>Lion</h1>
          <p>Administração de imóveis</p>
        </div>
        <form onSubmit={handleLogin}>
          <div className="field">
            <label>Email</label>
            <input type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Senha</label>
            <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="primary full" disabled={loading}>{loading ? 'Entrando...' : 'Entrar'}</button>
        </form>
      </div>
    </div>
  )
}

function Shell({ onLogout, userEmail }: { onLogout: () => void; userEmail?: string }) {
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null)
  return (
    <div className="app">
      <nav className="navbar">
        <div className="nav-content">
          <div className="brand" style={{ cursor: 'pointer' }} onClick={() => setSelectedProperty(null)}>
            <span className="brand-icon">L</span>
            <div>
              <h1>Lion</h1>
              <p>Administração</p>
            </div>
          </div>
          <div className="user-info">
            <span className="user-email">{userEmail}</span>
            <button onClick={onLogout} className="ghost">Sair</button>
          </div>
        </div>
      </nav>
      <main className="main">
        {selectedProperty
          ? <PropertyDetail property={selectedProperty} onBack={() => setSelectedProperty(null)} />
          : <PropertiesList onSelect={setSelectedProperty} />
        }
      </main>
      <CalcFloating />
    </div>
  )
}

const initialPropForm = {
  name: '', type: 'casa', street: '', number: '', complement: '',
  neighborhood: '', city: '', state: '', zip_code: '',
  iptu_number: '', registration_number: '',
  total_area: '', bedrooms: '', bathrooms: '', parking_spots: '',
  status: 'proprio', acquisition_date: '',
  acquisition_value: '', current_value: '', notes: '',
}

function PropertiesList({ onSelect }: { onSelect: (p: Property) => void }) {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(initialPropForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadProperties() }, [])

  async function loadProperties() {
    setLoading(true)
    const { data, error } = await supabase.from('properties').select('*').order('created_at', { ascending: false })
    if (error) alert('Erro: ' + error.message)
    else setProperties(data || [])
    setLoading(false)
  }

  function up(field: string, value: string) { setForm({ ...form, [field]: value }) }

  async function addProperty(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const payload: Record<string, unknown> = { ...form }
    ;['total_area','bedrooms','bathrooms','parking_spots','acquisition_value','current_value'].forEach((f) => {
      payload[f] = payload[f] === '' ? null : Number(payload[f])
    })
    if (payload.acquisition_date === '') payload.acquisition_date = null
    const { error } = await supabase.from('properties').insert(payload)
    if (error) alert('Erro: ' + error.message)
    else { setForm(initialPropForm); setShowForm(false); loadProperties() }
    setSaving(false)
  }

  async function deleteProperty(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm('Remover este imóvel?')) return
    const { error } = await supabase.from('properties').delete().eq('id', id)
    if (error) alert('Erro: ' + error.message)
    else loadProperties()
  }

  function formatAddress(p: Property) {
    const parts = [p.street && `${p.street}${p.number ? ', ' + p.number : ''}`, p.neighborhood, p.city && p.state ? `${p.city}/${p.state}` : p.city || p.state].filter(Boolean)
    return parts.join(' • ') || p.address || ''
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h2>Meus Imóveis</h2>
          <p className="muted">{properties.length} {properties.length === 1 ? 'imóvel cadastrado' : 'imóveis cadastrados'}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="primary">
          {showForm ? 'Cancelar' : '+ Novo Imóvel'}
        </button>
      </div>

      {showForm && (
        <form className="card form-card" onSubmit={addProperty}>
          <h3 className="section-title">Informações básicas</h3>
          <div className="grid-3">
            <div className="field"><label>Nome do imóvel *</label><input type="text" placeholder="Ex: Casa da Praia" value={form.name} onChange={(e) => up('name', e.target.value)} required /></div>
            <div className="field"><label>Tipo</label>
              <select value={form.type} onChange={(e) => up('type', e.target.value)}>
                <option value="casa">Casa</option><option value="apartamento">Apartamento</option>
                <option value="comercial">Comercial</option><option value="terreno">Terreno</option><option value="rural">Rural</option>
              </select>
            </div>
            <div className="field"><label>Status</label>
              <select value={form.status} onChange={(e) => up('status', e.target.value)}>
                <option value="proprio">Próprio</option><option value="alugado">Alugado para terceiros</option>
                <option value="vago">Vago</option><option value="vendido">Vendido</option>
              </select>
            </div>
          </div>
          <h3 className="section-title">Endereço</h3>
          <div className="grid-3">
            <div className="field span-2"><label>Rua</label><input type="text" value={form.street} onChange={(e) => up('street', e.target.value)} /></div>
            <div className="field"><label>Número</label><input type="text" value={form.number} onChange={(e) => up('number', e.target.value)} /></div>
            <div className="field"><label>Complemento</label><input type="text" value={form.complement} onChange={(e) => up('complement', e.target.value)} /></div>
            <div className="field"><label>Bairro</label><input type="text" value={form.neighborhood} onChange={(e) => up('neighborhood', e.target.value)} /></div>
            <div className="field"><label>CEP</label><input type="text" value={form.zip_code} onChange={(e) => up('zip_code', e.target.value)} /></div>
            <div className="field span-2"><label>Cidade</label><input type="text" value={form.city} onChange={(e) => up('city', e.target.value)} /></div>
            <div className="field"><label>Estado</label><input type="text" maxLength={2} placeholder="UF" value={form.state} onChange={(e) => up('state', e.target.value.toUpperCase())} /></div>
          </div>
          <h3 className="section-title">Características</h3>
          <div className="grid-4">
            <div className="field"><label>Área total (m²)</label><input type="number" step="0.01" value={form.total_area} onChange={(e) => up('total_area', e.target.value)} /></div>
            <div className="field"><label>Quartos</label><input type="number" value={form.bedrooms} onChange={(e) => up('bedrooms', e.target.value)} /></div>
            <div className="field"><label>Banheiros</label><input type="number" value={form.bathrooms} onChange={(e) => up('bathrooms', e.target.value)} /></div>
            <div className="field"><label>Vagas</label><input type="number" value={form.parking_spots} onChange={(e) => up('parking_spots', e.target.value)} /></div>
          </div>
          <h3 className="section-title">Documentação e financeiro</h3>
          <div className="grid-2">
            <div className="field"><label>Número do IPTU</label><input type="text" value={form.iptu_number} onChange={(e) => up('iptu_number', e.target.value)} /></div>
            <div className="field"><label>Matrícula</label><input type="text" value={form.registration_number} onChange={(e) => up('registration_number', e.target.value)} /></div>
            <div className="field"><label>Data de aquisição</label><input type="date" value={form.acquisition_date} onChange={(e) => up('acquisition_date', e.target.value)} /></div>
            <div className="field"><label>Valor de aquisição (R$)</label><input type="number" step="0.01" value={form.acquisition_value} onChange={(e) => up('acquisition_value', e.target.value)} /></div>
            <div className="field span-2"><label>Valor estimado atual (R$)</label><input type="number" step="0.01" value={form.current_value} onChange={(e) => up('current_value', e.target.value)} /></div>
          </div>
          <h3 className="section-title">Observações</h3>
          <div className="field"><textarea rows={3} placeholder="Anotações gerais" value={form.notes} onChange={(e) => up('notes', e.target.value)} /></div>
          <div className="form-actions">
            <button type="button" className="ghost" onClick={() => { setShowForm(false); setForm(initialPropForm) }}>Cancelar</button>
            <button type="submit" className="primary" disabled={saving}>{saving ? 'Salvando...' : 'Cadastrar imóvel'}</button>
          </div>
        </form>
      )}

      <div className="properties-grid">
        {loading ? <p className="muted">Carregando...</p>
        : properties.length === 0 ? (
          <div className="empty-state"><p>Nenhum imóvel cadastrado ainda.</p><p className="muted">Clique em "+ Novo Imóvel" para começar.</p></div>
        ) : properties.map((p) => (
          <div key={p.id} className="property-card clickable" onClick={() => onSelect(p)}>
            <div className="property-card-header">
              <div>
                <h3>{p.name}</h3>
                <div className="badges">
                  {p.type && <span className="badge">{p.type}</span>}
                  {p.status && <span className={`badge status-${p.status}`}>{p.status}</span>}
                </div>
              </div>
              <button onClick={(e) => deleteProperty(p.id, e)} className="icon-btn danger" title="Remover">×</button>
            </div>
            {formatAddress(p) && <p className="address">{formatAddress(p)}</p>}
            <div className="property-meta">
              {p.bedrooms != null && <span>{p.bedrooms} quartos</span>}
              {p.bathrooms != null && <span>{p.bathrooms} banheiros</span>}
              {p.total_area != null && <span>{p.total_area} m²</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function PropertyDetail({ property, onBack }: { property: Property; onBack: () => void }) {
  function formatAddress(p: Property) {
    const parts = [p.street && `${p.street}${p.number ? ', ' + p.number : ''}`, p.complement, p.neighborhood, p.zip_code, p.city && p.state ? `${p.city}/${p.state}` : p.city || p.state].filter(Boolean)
    return parts.join(' • ') || p.address || ''
  }
  function fmtCurrency(n: number | null) {
    if (n == null) return '—'
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <>
      <button onClick={onBack} className="ghost back-btn">← Voltar</button>

      <div className="card property-info">
        <div className="property-info-header">
          <div>
            <h2>{property.name}</h2>
            <div className="badges">
              {property.type && <span className="badge">{property.type}</span>}
              {property.status && <span className={`badge status-${property.status}`}>{property.status}</span>}
            </div>
            {formatAddress(property) && <p className="address" style={{ marginTop: 12 }}>{formatAddress(property)}</p>}
          </div>
        </div>
        <div className="property-details-grid">
          {property.bedrooms != null && <div><span className="detail-label">Quartos</span><span>{property.bedrooms}</span></div>}
          {property.bathrooms != null && <div><span className="detail-label">Banheiros</span><span>{property.bathrooms}</span></div>}
          {property.parking_spots != null && <div><span className="detail-label">Vagas</span><span>{property.parking_spots}</span></div>}
          {property.total_area != null && <div><span className="detail-label">Área</span><span>{property.total_area} m²</span></div>}
          {property.iptu_number && <div><span className="detail-label">IPTU</span><span>{property.iptu_number}</span></div>}
          {property.registration_number && <div><span className="detail-label">Matrícula</span><span>{property.registration_number}</span></div>}
          {property.acquisition_value != null && <div><span className="detail-label">Aquisição</span><span>{fmtCurrency(property.acquisition_value)}</span></div>}
          {property.current_value != null && <div><span className="detail-label">Valor atual</span><span>{fmtCurrency(property.current_value)}</span></div>}
        </div>
        {property.notes && <p className="muted" style={{ marginTop: 16, whiteSpace: 'pre-wrap' }}>{property.notes}</p>}
      </div>

      <BillsSection propertyId={property.id} />
      <DocumentsSection propertyId={property.id} />
    </>
  )
}

const initialBillForm = { description: '', category: 'agua', amount: '', due_date: '', status: 'pendente', notes: '' }

function BillsSection({ propertyId }: { propertyId: string }) {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pendente' | 'paga'>('all')
  const [form, setForm] = useState(initialBillForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase.from('bills').select('*').eq('property_id', propertyId).order('due_date', { ascending: true })
      if (error) alert('Erro: ' + error.message)
      else setBills(data || [])
      setLoading(false)
    }
    load()
  }, [propertyId])

  async function reload() {
    const { data } = await supabase.from('bills').select('*').eq('property_id', propertyId).order('due_date', { ascending: true })
    setBills(data || [])
  }

  async function addBill(e: React.FormEvent) {
    e.preventDefault()
    if (!form.description.trim() || !form.amount || !form.due_date) return
    setSaving(true)
    const payload: Record<string, unknown> = {
      property_id: propertyId, description: form.description, category: form.category,
      amount: Number(form.amount), due_date: form.due_date, status: form.status, notes: form.notes,
    }
    if (form.status === 'paga') payload.paid_at = new Date().toISOString()
    const { error } = await supabase.from('bills').insert(payload)
    if (error) alert('Erro: ' + error.message)
    else { setForm(initialBillForm); setShowForm(false); reload() }
    setSaving(false)
  }

  async function togglePaid(bill: Bill) {
    const newStatus = bill.status === 'paga' ? 'pendente' : 'paga'
    const update: Record<string, unknown> = { status: newStatus, paid_at: newStatus === 'paga' ? new Date().toISOString() : null }
    const { error } = await supabase.from('bills').update(update).eq('id', bill.id)
    if (error) alert('Erro: ' + error.message)
    else reload()
  }

  async function deleteBill(id: string) {
    if (!confirm('Remover esta conta?')) return
    const { error } = await supabase.from('bills').delete().eq('id', id)
    if (error) alert('Erro: ' + error.message)
    else reload()
  }

  const filteredBills = filter === 'all' ? bills : bills.filter(b => b.status === filter)
  const pendingBills = bills.filter(b => b.status === 'pendente')
  const totalPending = pendingBills.reduce((s, b) => s + Number(b.amount), 0)

  function fmtCurrency(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
  function fmtDate(d: string) { return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') }
  function isOverdue(b: Bill) { return b.status === 'pendente' && new Date(b.due_date) < new Date(new Date().toDateString()) }

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h3 className="card-title">Contas</h3>
          {pendingBills.length > 0 && <p className="muted small">{pendingBills.length} pendentes — Total: {fmtCurrency(totalPending)}</p>}
        </div>
        <button onClick={() => setShowForm(!showForm)} className="primary">{showForm ? 'Cancelar' : '+ Nova Conta'}</button>
      </div>

      {showForm && (
        <form className="inline-form" onSubmit={addBill}>
          <div className="grid-3">
            <div className="field span-2"><label>Descrição *</label><input type="text" placeholder="Ex: IPTU 2024 - Parcela 3" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} required /></div>
            <div className="field"><label>Categoria</label>
              <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}>
                <option value="agua">Água</option><option value="luz">Luz</option><option value="gas">Gás</option>
                <option value="iptu">IPTU</option><option value="condominio">Condomínio</option><option value="internet">Internet</option>
                <option value="aluguel">Aluguel</option><option value="manutencao">Manutenção</option>
                <option value="seguro">Seguro</option><option value="outros">Outros</option>
              </select>
            </div>
            <div className="field"><label>Valor (R$) *</label><input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} required /></div>
            <div className="field"><label>Vencimento *</label><input type="date" value={form.due_date} onChange={(e) => setForm({...form, due_date: e.target.value})} required /></div>
            <div className="field"><label>Status</label>
              <select value={form.status} onChange={(e) => setForm({...form, status: e.target.value})}>
                <option value="pendente">Pendente</option><option value="paga">Paga</option>
              </select>
            </div>
          </div>
          <div className="field"><label>Observações</label><input type="text" value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} /></div>
          <div className="form-actions">
            <button type="button" className="ghost" onClick={() => { setShowForm(false); setForm(initialBillForm) }}>Cancelar</button>
            <button type="submit" className="primary" disabled={saving}>{saving ? 'Salvando...' : 'Adicionar'}</button>
          </div>
        </form>
      )}

      <div className="filters">
        <button type="button" className={`chip ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>Todas ({bills.length})</button>
        <button type="button" className={`chip ${filter === 'pendente' ? 'active' : ''}`} onClick={() => setFilter('pendente')}>Pendentes ({pendingBills.length})</button>
        <button type="button" className={`chip ${filter === 'paga' ? 'active' : ''}`} onClick={() => setFilter('paga')}>Pagas ({bills.filter(b => b.status === 'paga').length})</button>
      </div>

      {loading ? <p className="muted">Carregando...</p>
      : filteredBills.length === 0 ? <p className="empty-inline muted">Nenhuma conta encontrada.</p>
      : (
        <div className="bills-list">
          {filteredBills.map((bill) => (
            <div key={bill.id} className={`bill-row ${isOverdue(bill) ? 'overdue' : ''}`}>
              <input type="checkbox" checked={bill.status === 'paga'} onChange={() => togglePaid(bill)} className="bill-check" />
              <div className="bill-info">
                <div className="bill-title">
                  <strong className={bill.status === 'paga' ? 'strikethrough' : ''}>{bill.description}</strong>
                  {bill.category && <span className="badge small">{bill.category}</span>}
                </div>
                <div className="bill-meta">
                  <span>Vence {fmtDate(bill.due_date)}</span>
                  {isOverdue(bill) && <span className="text-danger">• Vencida</span>}
                  {bill.notes && <span className="muted">• {bill.notes}</span>}
                </div>
              </div>
              <div className="bill-amount">{fmtCurrency(Number(bill.amount))}</div>
              <button onClick={() => deleteBill(bill.id)} className="icon-btn danger">×</button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

const initialDocForm = { name: '', category: 'escritura', notes: '' }

function DocumentsSection({ propertyId }: { propertyId: string }) {
  const [docs, setDocs] = useState<DocItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(initialDocForm)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase.from('documents').select('*').eq('property_id', propertyId).order('created_at', { ascending: false })
      if (error) alert('Erro: ' + error.message)
      else setDocs(data || [])
      setLoading(false)
    }
    load()
  }, [propertyId])

  async function reload() {
    const { data } = await supabase.from('documents').select('*').eq('property_id', propertyId).order('created_at', { ascending: false })
    setDocs(data || [])
  }

  async function uploadDoc(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !form.name.trim()) return
    setSaving(true)
    const filePath = `${propertyId}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, file)
    if (uploadError) { alert('Erro ao enviar: ' + uploadError.message); setSaving(false); return }
    const { error } = await supabase.from('documents').insert({
      property_id: propertyId, name: form.name, category: form.category,
      file_url: filePath, file_name: file.name, notes: form.notes,
    })
    if (error) alert('Erro: ' + error.message)
    else { setForm(initialDocForm); setFile(null); setShowForm(false); reload() }
    setSaving(false)
  }

  async function deleteDoc(doc: DocItem) {
    if (!confirm('Remover este documento?')) return
    if (doc.file_url) await supabase.storage.from('documents').remove([doc.file_url])
    const { error } = await supabase.from('documents').delete().eq('id', doc.id)
    if (error) alert('Erro: ' + error.message)
    else reload()
  }

  async function openDoc(doc: DocItem) {
    if (!doc.file_url) return
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(doc.file_url, 60)
    if (error) { alert('Erro: ' + error.message); return }
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  function fmtDate(d: string) { return new Date(d).toLocaleDateString('pt-BR') }

  return (
    <section className="card">
      <div className="section-header">
        <h3 className="card-title">Documentos</h3>
        <button onClick={() => setShowForm(!showForm)} className="primary">{showForm ? 'Cancelar' : '+ Novo Documento'}</button>
      </div>

      {showForm && (
        <form className="inline-form" onSubmit={uploadDoc}>
          <div className="grid-2">
            <div className="field"><label>Nome do documento *</label><input type="text" placeholder="Ex: Escritura - Casa Praia 2024" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} required /></div>
            <div className="field"><label>Categoria</label>
              <select value={form.category} onChange={(e) => setForm({...form, category: e.target.value})}>
                <option value="escritura">Escritura</option><option value="iptu">IPTU</option>
                <option value="contrato">Contrato</option><option value="seguro">Seguro</option>
                <option value="comprovante">Comprovante</option><option value="conta">Conta paga</option>
                <option value="planta">Planta</option><option value="outros">Outros</option>
              </select>
            </div>
          </div>
          <div className="field"><label>Arquivo *</label><input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} required /></div>
          <div className="field"><label>Observações</label><input type="text" value={form.notes} onChange={(e) => setForm({...form, notes: e.target.value})} /></div>
          <div className="form-actions">
            <button type="button" className="ghost" onClick={() => { setShowForm(false); setForm(initialDocForm); setFile(null) }}>Cancelar</button>
            <button type="submit" className="primary" disabled={saving}>{saving ? 'Enviando...' : 'Enviar'}</button>
          </div>
        </form>
      )}

      {loading ? <p className="muted">Carregando...</p>
      : docs.length === 0 ? <p className="empty-inline muted">Nenhum documento enviado ainda.</p>
      : (
        <div className="docs-list">
          {docs.map((doc) => (
            <div key={doc.id} className="doc-row">
              <div className="doc-icon">📄</div>
              <div className="doc-info">
                <div className="doc-title">
                  <strong>{doc.name}</strong>
                  {doc.category && <span className="badge small">{doc.category}</span>}
                </div>
                <div className="doc-meta">
                  {doc.file_name && <span className="muted">{doc.file_name}</span>}
                  <span className="muted">• {fmtDate(doc.created_at)}</span>
                  {doc.notes && <span className="muted">• {doc.notes}</span>}
                </div>
              </div>
              <div className="doc-actions">
                <button onClick={() => openDoc(doc)} className="ghost small">Abrir</button>
                <button onClick={() => deleteDoc(doc)} className="icon-btn danger">×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function CalcFloating() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="fab-calc" onClick={() => setOpen(!open)} aria-label="Calculadora">
        {open ? '×' : '🧮'}
      </button>
      {open && <div className="calc-panel"><Calculator /></div>}
    </>
  )
}

function Calculator() {
  const [display, setDisplay] = useState('0')
  const [previous, setPrevious] = useState<number | null>(null)
  const [operator, setOperator] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(false)

  function inputDigit(d: string) {
    if (waiting) {
      setDisplay(d)
      setWaiting(false)
    } else {
      setDisplay(display === '0' ? d : display + d)
    }
  }

  function inputDecimal() {
    if (waiting) {
      setDisplay('0.')
      setWaiting(false)
      return
    }
    if (!display.includes('.')) setDisplay(display + '.')
  }

  function clearAll() {
    setDisplay('0'); setPrevious(null); setOperator(null); setWaiting(false)
  }

  function calc(a: number, b: number, op: string): number {
    if (op === '+') return a + b
    if (op === '-') return a - b
    if (op === '*') return a * b
    if (op === '/') return b === 0 ? 0 : a / b
    return b
  }

  function formatResult(n: number): string {
    if (Number.isInteger(n)) return String(n)
    return String(parseFloat(n.toFixed(8)))
  }

  function performOp(nextOp: string) {
    const v = parseFloat(display)
    if (previous == null) {
      setPrevious(v)
    } else if (operator && !waiting) {
      const r = calc(previous, v, operator)
      setDisplay(formatResult(r))
      setPrevious(r)
    }
    setWaiting(true)
    setOperator(nextOp)
  }

  function handleEquals() {
    const v = parseFloat(display)
    if (previous != null && operator) {
      const r = calc(previous, v, operator)
      setDisplay(formatResult(r))
      setPrevious(null)
      setOperator(null)
      setWaiting(true)
    }
  }

  function toggleSign() {
    if (display === '0') return
    setDisplay(display.startsWith('-') ? display.slice(1) : '-' + display)
  }

  function percent() {
    setDisplay(formatResult(parseFloat(display) / 100))
  }

  function formatDisplay(d: string): string {
    const isNegative = d.startsWith('-')
    const value = isNegative ? d.slice(1) : d
    const [intPart, decPart] = value.split('.')
    const intNum = parseInt(intPart || '0', 10)
    if (isNaN(intNum)) return d
    const formatted = intNum.toLocaleString('pt-BR')
    const result = decPart != null ? `${formatted},${decPart}` : formatted
    return isNegative ? `-${result}` : result
  }

  function isOpActive(op: string) {
    return operator === op && waiting
  }

  return (
    <div className="ios-calc">
      <div className="ios-calc-display">{formatDisplay(display)}</div>
      <div className="ios-calc-grid">
        <button onClick={clearAll} className="ios-btn fn">AC</button>
        <button onClick={toggleSign} className="ios-btn fn">+/−</button>
        <button onClick={percent} className="ios-btn fn">%</button>
        <button onClick={() => performOp('/')} className={`ios-btn op ${isOpActive('/') ? 'active' : ''}`}>÷</button>
        <button onClick={() => inputDigit('7')} className="ios-btn">7</button>
        <button onClick={() => inputDigit('8')} className="ios-btn">8</button>
        <button onClick={() => inputDigit('9')} className="ios-btn">9</button>
        <button onClick={() => performOp('*')} className={`ios-btn op ${isOpActive('*') ? 'active' : ''}`}>×</button>
        <button onClick={() => inputDigit('4')} className="ios-btn">4</button>
        <button onClick={() => inputDigit('5')} className="ios-btn">5</button>
        <button onClick={() => inputDigit('6')} className="ios-btn">6</button>
        <button onClick={() => performOp('-')} className={`ios-btn op ${isOpActive('-') ? 'active' : ''}`}>−</button>
        <button onClick={() => inputDigit('1')} className="ios-btn">1</button>
        <button onClick={() => inputDigit('2')} className="ios-btn">2</button>
        <button onClick={() => inputDigit('3')} className="ios-btn">3</button>
        <button onClick={() => performOp('+')} className={`ios-btn op ${isOpActive('+') ? 'active' : ''}`}>+</button>
        <button onClick={() => inputDigit('0')} className="ios-btn zero">0</button>
        <button onClick={inputDecimal} className="ios-btn">,</button>
        <button onClick={handleEquals} className="ios-btn op">=</button>
      </div>
    </div>
  )
}

export default App
