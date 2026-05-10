import { useState } from 'react'
import { useCloudTable } from '../hooks'
import { MODAL_CONFIG } from '../App'
import type { ModalType, SidebarPage, Imovel, Produto, Vehicle } from '../types'

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
