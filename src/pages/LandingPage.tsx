import { useEffect, useRef } from 'react'

export default function LandingPage() {
  const statsRef = useRef<HTMLDivElement>(null)

  // Animate counters when stats section enters viewport
  useEffect(() => {
    const el = statsRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      el.querySelectorAll<HTMLElement>('.landing-stat-num').forEach(span => {
        const target = parseFloat(span.dataset.target || '0')
        const isFloat = String(target).includes('.')
        const duration = 1400
        const start = performance.now()
        const tick = (now: number) => {
          const p = Math.min((now - start) / duration, 1)
          const ease = 1 - Math.pow(1 - p, 3)
          const val = target * ease
          span.textContent = isFloat ? val.toFixed(1) : Math.round(val).toString()
          if (p < 1) requestAnimationFrame(tick)
          else span.textContent = isFloat ? target.toFixed(1) + '%' : target.toString() + (span.dataset.suffix || '')
        }
        requestAnimationFrame(tick)
      })
      observer.disconnect()
    }, { threshold: 0.4 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const features = [
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" strokeLinecap="round"/><path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      title: 'Finanças', desc: 'Receitas, despesas e câmbio (USD, EUR, BTC) em tempo real com gráficos mensais.', color: '#10b981',
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 21V9" strokeLinecap="round"/></svg>,
      title: 'Patrimônio', desc: 'Imóveis, veículos e produtos organizados com valores, documentos e histórico.', color: '#3b82f6',
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26"><path d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-4h4v4h4a1 1 0 001-1v-9" strokeLinecap="round" strokeLinejoin="round"/></svg>,
      title: 'Terra', desc: 'Mapa interativo com talhões georreferenciados, radar de chuva e clima ao vivo.', color: '#84cc16',
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.58-7 8-7s8 3 8 7" strokeLinecap="round"/></svg>,
      title: 'Família', desc: 'Perfis de membros com gastos individuais, papéis e histórico financeiro por pessoa.', color: '#f59e0b',
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>,
      title: 'Metas', desc: 'Objetivos financeiros com barra de progresso, prazo e projeção de aporte mensal.', color: '#8b5cf6',
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20" strokeLinecap="round"/></svg>,
      title: 'Pagamentos', desc: 'Contas a pagar com vencimento, status e alertas automáticos de atraso.', color: '#ef4444',
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round"/></svg>,
      title: 'Calendário', desc: 'Agenda unificada com eventos, vencimentos e lembretes por categoria.', color: '#06b6d4',
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinejoin="round"/><path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round"/></svg>,
      title: 'Alertas', desc: 'Notificações de IPVA, revisões, aluguéis, seguros e metas com prazo próximo.', color: '#f97316',
    },
    {
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="26" height="26"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" strokeLinejoin="round"/></svg>,
      title: 'Dashboard', desc: 'Visão geral do patrimônio, finanças, agenda e fazendas num único painel.', color: '#a78bfa',
    },
  ]

  const stats = [
    { value: 9, suffix: ' módulos', label: 'Integrados' },
    { value: 100, suffix: '%', label: 'Offline-first' },
    { value: 5, suffix: ' moedas', label: 'Câmbio ao vivo' },
    { value: 7, suffix: ' dias', label: 'Previsão do tempo' },
  ]

  return (
    <div className="landing">

      {/* ── Navbar ───────────────────────────────────── */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">
          <svg viewBox="0 0 32 32" width="28" height="28" fill="none">
            <circle cx="16" cy="16" r="15" fill="#3b82f6" opacity=".15" stroke="#3b82f6" strokeWidth="1.5"/>
            <path d="M10 22l4-10 2 5 2-3 4 8" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Lion Admin</span>
        </div>
        <div className="landing-nav-actions">
          <button className="landing-nav-ghost" onClick={() => window.location.hash = '#/register'}>
            Criar conta
          </button>
          <button className="landing-nav-btn" onClick={() => window.location.hash = '#/login'}>
            Entrar
          </button>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="landing-hero">
        <div className="landing-hero-glow landing-hero-glow-1" />
        <div className="landing-hero-glow landing-hero-glow-2" />
        <div className="landing-hero-content">
          <div className="landing-badge">
            <span className="landing-badge-dot" />
            Gestão Financeira e Patrimonial
          </div>
          <h1 className="landing-h1">
            Controle total das<br />suas finanças e<br />
            <span className="landing-h1-accent">patrimônio</span>
          </h1>
          <p className="landing-sub">
            Finanças, imóveis, fazendas, família e metas em um único painel.<br />
            Seguro, offline-first e disponível em qualquer dispositivo.
          </p>
          <div className="landing-hero-ctas">
            <button className="landing-cta-primary" onClick={() => window.location.hash = '#/register'}>
              Criar conta grátis
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button className="landing-cta-secondary" onClick={() => window.location.hash = '#/login'}>
              Já tenho conta
            </button>
          </div>
        </div>

        {/* mini dashboard preview */}
        <div className="landing-preview">
          <div className="lp-card lp-card-a">
            <span className="lp-card-label">Patrimônio total</span>
            <span className="lp-card-value">R$ 2.4M</span>
            <span className="lp-card-delta lp-delta-up">↑ 8.2%</span>
          </div>
          <div className="lp-card lp-card-b">
            <span className="lp-card-label">Saldo do mês</span>
            <span className="lp-card-value">R$ 12.840</span>
            <span className="lp-card-delta lp-delta-up">↑ 3.1%</span>
          </div>
          <div className="lp-card lp-card-c">
            <span className="lp-card-label">Metas ativas</span>
            <div className="lp-goals">
              {[68, 42, 91].map((p, i) => (
                <div key={i} className="lp-goal-row">
                  <div className="lp-goal-bar"><div className="lp-goal-fill" style={{ width: `${p}%`, background: ['#3b82f6','#10b981','#8b5cf6'][i] }} /></div>
                  <span>{p}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="lp-card lp-card-d">
            <span className="lp-card-label">Próx. vencimentos</span>
            <div className="lp-bills">
              {[['Condomínio','3d'],['IPTU','12d'],['Seguro','18d']].map(([n,d]) => (
                <div key={n} className="lp-bill-row"><span>{n}</span><span className="lp-bill-days">{d}</span></div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────── */}
      <div className="landing-stats-wrap" ref={statsRef}>
        <div className="landing-stats">
          {stats.map(({ value, suffix, label }) => (
            <div key={label} className="landing-stat">
              <span className="landing-stat-num" data-target={value} data-suffix={suffix}>0</span>
              <span className="landing-stat-label">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Features ─────────────────────────────────── */}
      <section className="landing-features">
        <h2 className="landing-section-title">Tudo que você precisa</h2>
        <p className="landing-section-sub">9 módulos integrados para gerenciar sua vida financeira e patrimonial</p>
        <div className="landing-grid">
          {features.map(({ icon, title, desc, color }) => (
            <div key={title} className="landing-feature-card" style={{ '--fc': color } as React.CSSProperties}>
              <div className="landing-feature-icon" style={{ color }}>{icon}</div>
              <h3 className="landing-feature-title">{title}</h3>
              <p className="landing-feature-desc">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA Bottom ───────────────────────────────── */}
      <section className="landing-bottom-cta">
        <div className="landing-bottom-cta-glow" />
        <h2>Pronto para começar?</h2>
        <p>Acesse seu painel com segurança e mantenha tudo sob controle.</p>
        <div className="landing-hero-ctas" style={{ justifyContent: 'center' }}>
          <button className="landing-cta-primary" onClick={() => window.location.hash = '#/register'}>
            Criar conta grátis
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <button className="landing-cta-secondary" onClick={() => window.location.hash = '#/login'}>
            Já tenho conta
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-logo">
          <svg viewBox="0 0 32 32" width="20" height="20" fill="none">
            <circle cx="16" cy="16" r="15" fill="#3b82f6" opacity=".15" stroke="#3b82f6" strokeWidth="1.5"/>
            <path d="M10 22l4-10 2 5 2-3 4 8" stroke="#3b82f6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Lion Admin</span>
        </div>
        <span>© 2026 Lion Admin · Gestão Financeira e Patrimonial</span>
      </footer>
    </div>
  )
}
