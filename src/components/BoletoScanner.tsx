import { useState, useRef } from 'react'
import { createWorker } from 'tesseract.js'

interface BoletoData {
  description: string
  amount: string
  date: string
}

interface Props {
  onResult: (data: BoletoData) => void
  onClose: () => void
}

function parseBoletoText(text: string): BoletoData {
  const result: BoletoData = { description: '', amount: '', date: '' }

  // Valor — tenta "Valor Cobrado", "Valor do Documento", depois qualquer R$
  const valorPatterns = [
    /valor\s+cobrado[^R\d]*R?\$?\s*([\d.,]+)/i,
    /valor\s+do\s+documento[^R\d]*R?\$?\s*([\d.,]+)/i,
    /valor\s+nominal[^R\d]*R?\$?\s*([\d.,]+)/i,
    /valor[^R\d\n]{0,20}R?\$\s*([\d.,]+)/i,
    /R\$\s*([\d.,]+)/i,
  ]
  for (const pat of valorPatterns) {
    const m = text.match(pat)
    if (m) {
      // normaliza: "1.234,56" → "1234.56"
      const raw = m[1].replace(/\.(?=\d{3})/g, '').replace(',', '.')
      const n = parseFloat(raw)
      if (!isNaN(n) && n > 0 && n < 10_000_000) {
        result.amount = n.toFixed(2)
        break
      }
    }
  }

  // Vencimento — DD/MM/YYYY ou YYYY-MM-DD próximo à palavra "vencimento"
  const vencPatterns = [
    /vencimento[^0-9]{0,20}(\d{2})[\/\-](\d{2})[\/\-](\d{4})/i,
    /(\d{2})[\/\-](\d{2})[\/\-](\d{4})/,
  ]
  for (const pat of vencPatterns) {
    const m = text.match(pat)
    if (m) {
      const [, d, mo, y] = m
      const year = parseInt(y)
      const month = parseInt(mo)
      if (year >= 2020 && year <= 2040 && month >= 1 && month <= 12) {
        result.date = `${y}-${mo.padStart(2, '0')}`
        break
      }
    }
  }

  // Descrição — beneficiário / cedente / sacado
  const descPatterns = [
    /benefici[aá]rio\s*[:\-]?\s*([^\n]{3,60})/i,
    /cedente\s*[:\-]?\s*([^\n]{3,60})/i,
    /sacado\s*[:\-]?\s*([^\n]{3,60})/i,
    /pagamento\s+de\s+([^\n]{3,60})/i,
    /referente\s+a\s*[:\-]?\s*([^\n]{3,60})/i,
  ]
  for (const pat of descPatterns) {
    const m = text.match(pat)
    if (m) {
      const cleaned = m[1].trim().replace(/\s+/g, ' ').slice(0, 60)
      if (cleaned.length >= 3) {
        result.description = cleaned
        break
      }
    }
  }

  return result
}

export default function BoletoScanner({ onResult, onClose }: Props) {
  const [status, setStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [extracted, setExtracted] = useState<BoletoData>({ description: '', amount: '', date: '' })
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    setPreview(URL.createObjectURL(file))
    setStatus('processing')
    setProgress(0)

    try {
      const worker = await createWorker('por', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100))
          }
        },
      })
      const { data } = await worker.recognize(file)
      await worker.terminate()
      const parsed = parseBoletoText(data.text)
      setExtracted(parsed)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleConfirm = () => {
    onResult(extracted)
    onClose()
  }

  const hasData = extracted.description || extracted.amount || extracted.date

  return (
    <div className="boleto-overlay" onClick={onClose}>
      <div className="boleto-modal" onClick={e => e.stopPropagation()}>
        <div className="boleto-header">
          <div className="boleto-title">
            <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
              <rect x="2" y="4" width="16" height="12" rx="2" stroke="currentColor" strokeWidth="1.4"/>
              <path d="M5 8h1v4H5zM7 7h1v5H7zM9 9h1v2H9zM11 7h1v5h-1zM13 8h1v4h-1z" fill="currentColor"/>
            </svg>
            Escanear Boleto
          </div>
          <button className="boleto-close" onClick={onClose}>
            <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          </button>
        </div>

        {status === 'idle' && (
          <div
            className="boleto-drop"
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            <svg viewBox="0 0 48 48" fill="none" width="48" height="48">
              <rect x="4" y="8" width="40" height="32" rx="4" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3"/>
              <path d="M24 18v12M18 24l6-6 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="boleto-drop-title">Toque para fotografar ou escolher imagem</span>
            <span className="boleto-drop-sub">Foto do boleto, print ou PDF impresso</span>
          </div>
        )}

        {status === 'processing' && (
          <div className="boleto-processing">
            {preview && <img src={preview} alt="boleto" className="boleto-preview" />}
            <div className="boleto-progress-wrap">
              <div className="boleto-progress-bar">
                <div className="boleto-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span className="boleto-progress-label">Lendo boleto... {progress}%</span>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="boleto-error">
            <svg viewBox="0 0 24 24" fill="none" width="32" height="32">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M12 8v5M12 16v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>Não foi possível ler a imagem. Tente uma foto com mais luz e foco.</span>
            <button className="btn-ghost" onClick={() => setStatus('idle')}>Tentar novamente</button>
          </div>
        )}

        {status === 'done' && (
          <div className="boleto-result">
            {preview && <img src={preview} alt="boleto" className="boleto-preview" />}

            <div className="boleto-fields">
              <div className="boleto-field">
                <label>Descrição</label>
                <input
                  type="text"
                  value={extracted.description}
                  onChange={e => setExtracted(p => ({ ...p, description: e.target.value }))}
                  placeholder="Ex: Conta de luz, IPTU..."
                />
              </div>
              <div className="boleto-row">
                <div className="boleto-field">
                  <label>Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={extracted.amount}
                    onChange={e => setExtracted(p => ({ ...p, amount: e.target.value }))}
                    placeholder="0,00"
                  />
                </div>
                <div className="boleto-field">
                  <label>Vencimento (mês)</label>
                  <input
                    type="month"
                    value={extracted.date}
                    onChange={e => setExtracted(p => ({ ...p, date: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {!hasData && (
              <div className="boleto-warn">
                Não encontrei dados automaticamente. Preencha os campos manualmente ou tente outra foto.
              </div>
            )}

            <div className="boleto-actions">
              <button className="btn-ghost" onClick={() => { setStatus('idle'); setPreview(null) }}>
                Nova foto
              </button>
              <button className="btn-accent" onClick={handleConfirm}>
                Usar esses dados
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
