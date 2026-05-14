import { useState } from 'react'
import { supabase } from './lib/supabase'

interface Props { onDone: () => void }

export default function ResetPasswordPage({ onDone }: Props) {
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [showPass, setShowPass]   = useState(false)
  const [showConf, setShowConf]   = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)

  const strength = (() => {
    if (!password) return 0
    let s = 0
    if (password.length >= 6)  s++
    if (password.length >= 10) s++
    if (/[A-Z]/.test(password)) s++
    if (/[0-9]/.test(password)) s++
    if (/[^A-Za-z0-9]/.test(password)) s++
    return s
  })()
  const strengthLabel = ['', 'Fraca', 'Razoável', 'Boa', 'Forte', 'Muito forte'][strength]
  const strengthColor = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#10b981'][strength]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    if (password.length < 6)  { setError('A senha precisa ter ao menos 6 caracteres.'); return }
    setLoading(true)
    const { error: err } = await supabase!.auth.updateUser({ password })
    if (err) { setError(err.message); setLoading(false); return }
    setDone(true)
    setLoading(false)
  }

  if (done) return (
    <div className="auth-wrap auth-wrap-center">
      <div className="auth-card auth-card-success">
        <div className="auth-success-icon">
          <svg viewBox="0 0 56 56" fill="none" width="56" height="56">
            <circle cx="28" cy="28" r="27" stroke="#10b981" strokeWidth="1.5" opacity=".3"/>
            <circle cx="28" cy="28" r="20" fill="rgba(16,185,129,.1)"/>
            <path d="M18 28l8 8 12-14" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2 className="auth-title" style={{ textAlign: 'center', marginBottom: 8 }}>Senha atualizada!</h2>
        <p className="auth-desc" style={{ textAlign: 'center', marginBottom: 24 }}>
          Sua nova senha foi salva com sucesso.<br/>Faça login para continuar.
        </p>
        <button className="auth-btn" onClick={onDone}>
          Ir para o login
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14">
            <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )

  return (
    <div className="auth-wrap auth-wrap-center">
      <div className="auth-card" style={{ maxWidth: 420 }}>
        <div className="auth-card-header">
          <div className="auth-logo" style={{ marginBottom: 24 }}>
            <svg viewBox="0 0 32 32" fill="none" width="30" height="30">
              <rect width="32" height="32" rx="10" fill="#1a1a1a" stroke="rgba(59,130,246,.3)" strokeWidth="1"/>
              <text x="16" y="22" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="18" fill="white" letterSpacing="-1">L<tspan fill="#3b82f6">I</tspan></text>
            </svg>
            <span className="auth-logo-name">Lion Admin</span>
          </div>
          <h1 className="auth-title">Definir nova senha</h1>
          <p className="auth-desc">Escolha uma senha segura para sua conta</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label">Nova senha</label>
            <div className="auth-input-wrap">
              <svg className="auth-input-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4">
                <rect x="3" y="8" width="14" height="10" rx="2"/><path d="M7 8V6a3 3 0 0 1 6 0v2" strokeLinecap="round"/>
              </svg>
              <input
                className="auth-input"
                type={showPass ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                autoFocus
              />
              <button type="button" className="auth-eye" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                {showPass
                  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" strokeLinecap="round"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" strokeLinecap="round"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" strokeLinecap="round"/><line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/></svg>
                  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            {password && (
              <div className="auth-strength">
                <div className="auth-strength-bars">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="auth-strength-bar" style={{ background: i <= strength ? strengthColor : 'rgba(255,255,255,.08)' }} />
                  ))}
                </div>
                <span className="auth-strength-label" style={{ color: strengthColor }}>{strengthLabel}</span>
              </div>
            )}
          </div>

          <div className="auth-field">
            <label className="auth-label">Confirmar nova senha</label>
            <div className="auth-input-wrap">
              <svg className="auth-input-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <input
                className="auth-input"
                type={showConf ? 'text' : 'password'}
                placeholder="Repita a senha"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
              <button type="button" className="auth-eye" onClick={() => setShowConf(v => !v)} tabIndex={-1}>
                {showConf
                  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" strokeLinecap="round"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" strokeLinecap="round"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" strokeLinecap="round"/><line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/></svg>
                  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            {confirm && password !== confirm && <p className="auth-mismatch">⚠ As senhas não coincidem</p>}
            {confirm && password === confirm && confirm.length > 0 && <p className="auth-match">✓ Senhas coincidem</p>}
          </div>

          {error && (
            <div className="auth-error">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
                <circle cx="8" cy="8" r="7"/><path d="M8 5v3M8 10v1" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          <button className="auth-btn" type="submit" disabled={loading}>
            {loading
              ? <span className="auth-btn-loading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="auth-spin"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" strokeLinecap="round"/></svg>Salvando…</span>
              : <>Salvar nova senha <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14"><path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/></svg></>
            }
          </button>
        </form>
      </div>
    </div>
  )
}
