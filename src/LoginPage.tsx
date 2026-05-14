import { useState } from 'react'
import { supabase } from './lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: err } = await supabase!.auth.signInWithPassword({ email, password })
    if (err) setError(err.message)
    setLoading(false)
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotLoading(true)
    const redirectTo = `${window.location.origin}${window.location.pathname}`
    await supabase!.auth.resetPasswordForEmail(forgotEmail, { redirectTo })
    setForgotSent(true)
    setForgotLoading(false)
  }

  return (
    <div className="auth-wrap">

      {/* ── Painel esquerdo ── */}
      <div className="auth-panel">
        <div className="auth-panel-glow" />
        <div className="auth-panel-content">
          <div className="auth-logo">
            <svg viewBox="0 0 32 32" fill="none" width="36" height="36">
              <rect width="32" height="32" rx="10" fill="#1a1a1a" stroke="rgba(59,130,246,.3)" strokeWidth="1"/>
              <text x="16" y="22" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="18" fill="white" letterSpacing="-1">L<tspan fill="#3b82f6">I</tspan></text>
            </svg>
            <span className="auth-logo-name">Lion Admin</span>
          </div>

          <div className="auth-panel-text">
            <h2 className="auth-panel-title">Controle total das suas finanças e patrimônio</h2>
            <p className="auth-panel-sub">Finanças, fazendas, família e metas em um único painel. Seguro e offline-first.</p>
          </div>

          <div className="auth-panel-feats">
            {[
              { icon: '💰', label: 'Câmbio ao vivo — USD, EUR, BTC' },
              { icon: '🗺️', label: 'Mapa de fazendas com talhões' },
              { icon: '🔔', label: 'Alertas de vencimentos automáticos' },
              { icon: '📊', label: '9 módulos integrados' },
            ].map(({ icon, label }) => (
              <div key={label} className="auth-panel-feat">
                <span>{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Formulário ── */}
      <div className="auth-form-side">
        <div className="auth-card">
          <div className="auth-card-header">
            <div className="auth-logo auth-logo-mobile">
              <svg viewBox="0 0 32 32" fill="none" width="30" height="30">
                <rect width="32" height="32" rx="10" fill="#1a1a1a" stroke="rgba(59,130,246,.3)" strokeWidth="1"/>
                <text x="16" y="22" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="18" fill="white" letterSpacing="-1">L<tspan fill="#3b82f6">I</tspan></text>
              </svg>
              <span className="auth-logo-name">Lion Admin</span>
            </div>
            <h1 className="auth-title">Entrar na conta</h1>
            <p className="auth-desc">Acesse seu painel financeiro</p>
          </div>

          {/* ── Modo esqueci a senha ── */}
          {forgotMode && (
            <div className="auth-forgot-box">
              {forgotSent ? (
                <>
                  <div className="auth-forgot-sent-icon">
                    <svg viewBox="0 0 40 40" fill="none" width="40" height="40">
                      <circle cx="20" cy="20" r="19" stroke="#3b82f6" strokeWidth="1.2" opacity=".4"/>
                      <path d="M8 18l6 2 4-8 4 10 4-6 6 4" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <p className="auth-forgot-sent-title">E-mail enviado!</p>
                  <p className="auth-forgot-sent-desc">Verifique sua caixa de entrada em <strong>{forgotEmail}</strong> e clique no link para redefinir sua senha.</p>
                  <button className="auth-forgot-cancel" onClick={() => { setForgotMode(false); setForgotSent(false) }}>
                    ← Voltar para o login
                  </button>
                </>
              ) : (
                <form onSubmit={handleForgot}>
                  <p className="auth-forgot-title">Recuperar senha</p>
                  <p className="auth-forgot-desc">Digite seu e-mail e enviaremos um link para redefinir sua senha.</p>
                  <div className="auth-input-wrap" style={{ marginBottom: 12 }}>
                    <svg className="auth-input-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4">
                      <rect x="2" y="4" width="16" height="12" rx="2"/><path d="M2 7l8 5 8-5" strokeLinecap="round"/>
                    </svg>
                    <input
                      className="auth-input"
                      type="email"
                      placeholder="seu@email.com"
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="auth-forgot-cancel" onClick={() => setForgotMode(false)}>Cancelar</button>
                    <button className="auth-btn" type="submit" disabled={forgotLoading} style={{ flex: 1, marginTop: 0 }}>
                      {forgotLoading
                        ? <span className="auth-btn-loading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14" className="auth-spin"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" strokeLinecap="round"/></svg>Enviando…</span>
                        : 'Enviar link'
                      }
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          <form className="auth-form" onSubmit={handleLogin} style={{ display: forgotMode ? 'none' : 'flex' }}>
            <div className="auth-field">
              <label className="auth-label">E-mail</label>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <rect x="2" y="4" width="16" height="12" rx="2"/><path d="M2 7l8 5 8-5" strokeLinecap="round"/>
                </svg>
                <input
                  className="auth-input"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="auth-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="auth-label">Senha</label>
                <button type="button" className="auth-forgot-link" onClick={() => { setForgotMode(true); setForgotEmail(email) }}>
                  Esqueci a senha
                </button>
              </div>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <rect x="3" y="8" width="14" height="10" rx="2"/><path d="M7 8V6a3 3 0 0 1 6 0v2" strokeLinecap="round"/>
                </svg>
                <input
                  className="auth-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button type="button" className="auth-eye" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" strokeLinecap="round"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" strokeLinecap="round"/>
                      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" strokeLinecap="round"/>
                      <line x1="1" y1="1" x2="23" y2="23" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" strokeLinecap="round"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
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
              {loading ? (
                <span className="auth-btn-loading">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" className="auth-spin">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4" strokeLinecap="round"/>
                  </svg>
                  Entrando…
                </span>
              ) : (
                <>
                  Entrar
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14">
                    <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="auth-divider"><span>ou</span></div>

          <p className="auth-switch">
            Não tem uma conta?{' '}
            <button className="auth-switch-link" onClick={() => window.location.hash = '#/register'}>
              Criar conta grátis →
            </button>
          </p>

          <button className="auth-back" onClick={() => window.location.hash = '#/'}>
            ← Voltar para o início
          </button>
        </div>
      </div>
    </div>
  )
}
