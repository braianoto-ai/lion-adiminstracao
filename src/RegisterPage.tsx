import { useState } from 'react'
import { supabase } from './lib/supabase'

export default function RegisterPage() {
  const [name, setName]               = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [confirm, setConfirm]         = useState('')
  const [showPass, setShowPass]       = useState(false)
  const [showConf, setShowConf]       = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [loading, setLoading]         = useState(false)
  const [done, setDone]               = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('As senhas não coincidem.'); return }
    if (password.length < 6)  { setError('A senha precisa ter ao menos 6 caracteres.'); return }
    setLoading(true)
    const { error: err } = await supabase!.auth.signUp({
      email,
      password,
      options: { data: { full_name: name.trim() } },
    })
    if (err) { setError(err.message); setLoading(false); return }
    setDone(true)
    setLoading(false)
  }

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
        <h2 className="auth-title" style={{ textAlign: 'center', marginBottom: 8 }}>Conta criada!</h2>
        <p className="auth-desc" style={{ textAlign: 'center', marginBottom: 24 }}>
          Enviamos um e-mail de confirmação para<br/>
          <strong style={{ color: '#f1f5f9' }}>{email}</strong>.<br/>
          Clique no link para ativar sua conta.
        </p>
        <button className="auth-btn" onClick={() => window.location.hash = '#/login'}>
          Ir para o login
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14">
            <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )

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
            <h2 className="auth-panel-title">Comece a controlar seu patrimônio hoje mesmo</h2>
            <p className="auth-panel-sub">Crie sua conta grátis e tenha acesso completo a todos os módulos.</p>
          </div>

          <div className="auth-panel-feats">
            {[
              { icon: '✅', label: 'Acesso imediato após confirmação' },
              { icon: '🔒', label: 'Dados criptografados e seguros' },
              { icon: '📱', label: 'Funciona offline como app nativo' },
              { icon: '🚀', label: 'Sem cartão de crédito para testar' },
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
            <h1 className="auth-title">Criar conta</h1>
            <p className="auth-desc">Preencha os dados abaixo para começar</p>
          </div>

          <form className="auth-form" onSubmit={handleRegister}>
            <div className="auth-field">
              <label className="auth-label">Nome completo</label>
              <div className="auth-input-wrap">
                <svg className="auth-input-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <circle cx="10" cy="7" r="3"/><path d="M3 17a7 7 0 0 1 14 0" strokeLinecap="round"/>
                </svg>
                <input
                  className="auth-input"
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
            </div>

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
              <label className="auth-label">Senha</label>
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
                />
                <button type="button" className="auth-eye" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
                  {showPass ? (
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
              <label className="auth-label">Confirmar senha</label>
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
                  {showConf ? (
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
              {confirm && password !== confirm && (
                <p className="auth-mismatch">⚠ As senhas não coincidem</p>
              )}
              {confirm && password === confirm && confirm.length > 0 && (
                <p className="auth-match">✓ Senhas coincidem</p>
              )}
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
                  Criando conta…
                </span>
              ) : (
                <>
                  Criar conta grátis
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14">
                    <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </>
              )}
            </button>
          </form>

          <div className="auth-divider"><span>ou</span></div>

          <p className="auth-switch">
            Já tem uma conta?{' '}
            <button className="auth-switch-link" onClick={() => window.location.hash = '#/login'}>
              Entrar →
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
