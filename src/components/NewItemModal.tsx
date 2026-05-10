import { useState } from 'react'
import { useCloudTable } from '../hooks'
import type { ModalType, SidebarPage, Imovel, Produto, Vehicle } from '../types'

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
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>),
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
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="9" width="22" height="11" rx="2"/><path d="M6 9V7a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="6" cy="20" r="2"/><circle cx="18" cy="20" r="2"/></svg>),
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
    icon: (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>),
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

export default 
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
