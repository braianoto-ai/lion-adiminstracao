import { useState } from 'react'
import { SHARE_KEYS } from '../constants'

export default 
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
