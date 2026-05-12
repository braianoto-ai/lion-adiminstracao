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
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark">
            <svg viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="10" fill="#1a1a1a"/>
              <text x="16" y="22" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="18" fill="white" letterSpacing="-1">L<tspan fill="#3b82f6">I</tspan></text>
            </svg>
          </div>
          <div>
            <div className="brand-name">Lion Admin</div>
            <div className="brand-sub">Gestão Financeira</div>
          </div>
        </div>

        <div className="register-success">
          <div className="register-success-icon">
            <svg viewBox="0 0 48 48" fill="none" stroke="#10b981" strokeWidth="2.5" width="48" height="48">
              <circle cx="24" cy="24" r="22" opacity=".15" fill="#10b981" stroke="none"/>
              <path d="M14 24l8 8 12-16" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2 className="register-success-title">Conta criada!</h2>
          <p className="register-success-desc">
            Enviamos um e-mail de confirmação para <strong>{email}</strong>.<br/>
            Clique no link para ativar sua conta e então faça login.
          </p>
          <button className="login-btn" style={{ marginTop: 8 }} onClick={() => window.location.hash = '#/login'}>
            Ir para o login
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark">
            <svg viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="10" fill="#1a1a1a"/>
              <text x="16" y="22" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="18" fill="white" letterSpacing="-1">L<tspan fill="#3b82f6">I</tspan></text>
            </svg>
          </div>
          <div>
            <div className="brand-name">Lion Admin</div>
            <div className="brand-sub">Gestão Financeira</div>
          </div>
        </div>

        <h1 className="login-title">Criar conta</h1>
        <p className="login-desc">Preencha os dados abaixo para se cadastrar</p>

        <form className="login-form" onSubmit={handleRegister}>
          <div className="login-field">
            <label className="login-label">Nome completo</label>
            <input
              className="login-input"
              type="text"
              placeholder="Seu nome"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>

          <div className="login-field">
            <label className="login-label">E-mail</label>
            <input
              className="login-input"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="login-field">
            <label className="login-label">Senha</label>
            <div className="login-input-wrap">
              <input
                className="login-input"
                type={showPass ? 'text' : 'password'}
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <button type="button" className="login-eye" onClick={() => setShowPass(v => !v)} tabIndex={-1}>
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
              <div className="register-strength">
                <div className="register-strength-bars">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="register-strength-bar" style={{ background: i <= strength ? strengthColor : 'var(--border)' }} />
                  ))}
                </div>
                <span className="register-strength-label" style={{ color: strengthColor }}>{strengthLabel}</span>
              </div>
            )}
          </div>

          <div className="login-field">
            <label className="login-label">Confirmar senha</label>
            <div className="login-input-wrap">
              <input
                className="login-input"
                type={showConf ? 'text' : 'password'}
                placeholder="Repita a senha"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />
              <button type="button" className="login-eye" onClick={() => setShowConf(v => !v)} tabIndex={-1}>
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
              <p className="register-mismatch">As senhas não coincidem</p>
            )}
            {confirm && password === confirm && confirm.length > 0 && (
              <p className="register-match">✓ Senhas coincidem</p>
            )}
          </div>

          {error && <p className="login-error">{error}</p>}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Criando conta…' : 'Criar conta'}
          </button>
        </form>

        <p className="login-switch">
          Já tem uma conta?{' '}
          <button className="login-switch-link" onClick={() => window.location.hash = '#/login'}>
            Entrar
          </button>
        </p>
      </div>
    </div>
  )
}
