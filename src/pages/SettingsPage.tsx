import { useState } from 'react'
import { supabase } from '../lib/supabase'
import type { User } from '@supabase/supabase-js'

export default 
function SettingsPage({ user }: { user: User | null }) {
  const [logo, setLogo] = useState<string>(() => localStorage.getItem('lion-logo') || '')
  const [favicon, setFavicon] = useState<string>(() => localStorage.getItem('lion-favicon') || '')
  const [logoSaved, setLogoSaved] = useState(false)
  const [favSaved, setFavSaved] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  const displayName = user?.user_metadata?.full_name ?? user?.email ?? 'Usuário'
  const initials = displayName.split(/\s|@/).filter(Boolean).slice(0, 2).map((s: string) => s[0].toUpperCase()).join('')
  const createdAt = user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'
  const provider = user?.app_metadata?.provider ?? 'email'

  const readFile = (file: File): Promise<string> => new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = rej
    r.readAsDataURL(file)
  })

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const data = await readFile(f)
    setLogo(data)
    localStorage.setItem('lion-logo', data)
    window.dispatchEvent(new Event('lion-logo-changed'))
    if (!localStorage.getItem('lion-favicon')) {
      const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]') || (() => {
        const l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); return l
      })()
      link.href = data
    }
    setLogoSaved(true); setTimeout(() => setLogoSaved(false), 2000)
  }

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return
    const data = await readFile(f)
    setFavicon(data)
    localStorage.setItem('lion-favicon', data)
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]') || (() => {
      const l = document.createElement('link'); l.rel = 'icon'; document.head.appendChild(l); return l
    })()
    link.href = data
    setFavSaved(true); setTimeout(() => setFavSaved(false), 2000)
  }

  const removeLogo = () => {
    setLogo(''); localStorage.removeItem('lion-logo')
    window.dispatchEvent(new Event('lion-logo-changed'))
  }

  const removeFavicon = () => {
    setFavicon(''); localStorage.removeItem('lion-favicon')
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
    if (link) link.href = '/lion-adiminstracao/favicon.svg'
  }

  const sendResetEmail = async () => {
    if (!supabase || !user?.email) return
    setPwLoading(true); setPwMsg('')
    const { error } = await supabase.auth.resetPasswordForEmail(user.email)
    setPwLoading(false)
    setPwMsg(error ? 'Erro: ' + error.message : 'E-mail de redefinição enviado!')
    setTimeout(() => setPwMsg(''), 4000)
  }

  return (
    <div className="settings-page">
      <h2 className="settings-title">Configurações</h2>

      {/* Account */}
      <section className="settings-card">
        <div className="settings-card-title">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/><path d="M4 18a6 6 0 0 1 12 0"/></svg>
          Conta
        </div>
        <div className="settings-account-row">
          <div className="settings-avatar">{initials || '?'}</div>
          <div className="settings-account-info">
            <div className="settings-account-name">{displayName.split('@')[0]}</div>
            <div className="settings-account-email">{user?.email || '—'}</div>
            <div className="settings-account-meta">
              <span className="settings-badge">{provider === 'google' ? 'Google' : 'E-mail'}</span>
              <span className="settings-account-date">Conta criada em {createdAt}</span>
            </div>
          </div>
        </div>
        {supabase && provider !== 'google' && (
          <div className="settings-pw-row">
            <span className="settings-field-label">Senha</span>
            <button className="settings-action-btn" onClick={sendResetEmail} disabled={pwLoading}>
              {pwLoading ? 'Enviando…' : 'Enviar e-mail de redefinição'}
            </button>
            {pwMsg && <span className={`settings-pw-msg${pwMsg.startsWith('Erro') ? ' settings-pw-err' : ''}`}>{pwMsg}</span>}
          </div>
        )}
      </section>

      {/* Logo */}
      <section className="settings-card">
        <div className="settings-card-title">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="16" height="10" rx="2"/><path d="M5 10h.01M8 10l2 2 3-4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Logo do Site
        </div>
        <p className="settings-hint">Aparece na barra superior. Formatos: PNG, JPG, SVG, WebP. Recomendado: 200×200px.</p>
        <div className="settings-img-row">
          <div className="settings-img-preview">
            {logo
              ? <img src={logo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 6 }} />
              : <svg viewBox="0 0 32 32" fill="none" style={{ width: 32, height: 32, opacity: .3 }}><rect width="32" height="32" rx="10" fill="currentColor" opacity=".15"/><text x="16" y="23" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="18" fill="currentColor" letterSpacing="-1">LI</text></svg>
            }
          </div>
          <div className="settings-img-actions">
            <label className="settings-upload-btn">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2v8M4 6l4-4 4 4" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 12h12" strokeLinecap="round"/></svg>
              {logoSaved ? 'Salvo!' : 'Enviar imagem'}
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
            </label>
            {logo && <button className="settings-remove-btn" onClick={removeLogo}>Remover</button>}
          </div>
        </div>
      </section>

      {/* Favicon */}
      <section className="settings-card">
        <div className="settings-card-title">
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="16" height="16" rx="3"/><path d="M6 10l3 3 5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Favicon (ícone da aba)
        </div>
        <p className="settings-hint">Ícone exibido na aba do navegador. Formatos: PNG, ICO, SVG. Recomendado: 32×32px ou 64×64px.</p>
        <div className="settings-img-row">
          <div className="settings-img-preview settings-img-preview--sm">
            {favicon
              ? <img src={favicon} alt="Favicon" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : <svg viewBox="0 0 16 16" fill="none" style={{ width: 16, height: 16, opacity: .3 }}><rect width="16" height="16" rx="3" fill="currentColor"/><text x="8" y="12" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontWeight="800" fontSize="9" fill="white" letterSpacing="-0.5">LI</text></svg>
            }
          </div>
          <div className="settings-img-actions">
            <label className="settings-upload-btn">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2v8M4 6l4-4 4 4" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 12h12" strokeLinecap="round"/></svg>
              {favSaved ? 'Salvo!' : 'Enviar imagem'}
              <input type="file" accept="image/*,.ico" style={{ display: 'none' }} onChange={handleFaviconUpload} />
            </label>
            {favicon && <button className="settings-remove-btn" onClick={removeFavicon}>Remover</button>}
          </div>
        </div>
      </section>
    </div>
  )
}
