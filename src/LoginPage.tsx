import { useState } from 'react'
import { supabase } from './lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: err } = await supabase!.auth.signInWithPassword({ email, password })
    if (err) setError(err.message)
    setLoading(false)
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark">
            <svg viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="10" fill="url(#lg)"/>
              <path d="M8 22L13 10l5 8 4-5 4 9" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32">
                  <stop stopColor="#7c3aed"/>
                  <stop offset="1" stopColor="#4f46e5"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <div className="brand-name">Lion Admin</div>
            <div className="brand-sub">Gestão Financeira</div>
          </div>
        </div>

        <h1 className="login-title">Entrar na conta</h1>
        <p className="login-desc">Acesse seu painel financeiro com segurança</p>

        <form className="login-form" onSubmit={handleLogin}>
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
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button type="button" className="login-eye" onClick={() => setShowPassword(v => !v)} tabIndex={-1}>
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

          {error && <p className="login-error">{error}</p>}

          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
