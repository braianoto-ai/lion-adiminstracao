import { useState, useEffect } from 'react'
import emailjs from '@emailjs/browser'
import { EMAILJS_CONFIG_KEY, EMAILJS_INIT } from '../constants'
import { buildAlerts } from '../utils'
import type { AppAlert, EmailJSConfig } from '../types'

export default function AlertsPanel({ onClose }: { onClose: () => void }) {
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
