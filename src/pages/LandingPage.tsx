import { useEffect, useRef, useCallback } from 'react'

export default function LandingPage() {
  const statsRef = useRef<HTMLDivElement>(null)

  // Scroll fade-in for all sections
  const observeFadeIn = useCallback(() => {
    const els = document.querySelectorAll<HTMLElement>('.lp-fade')
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('lp-fade-in')
          io.unobserve(e.target)
        }
      })
    }, { threshold: 0.12 })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const cleanup = observeFadeIn()
    return cleanup
  }, [observeFadeIn])

  // Nav scroll shadow
  useEffect(() => {
    const nav = document.querySelector('.landing-nav')
    if (!nav) return
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
      <div className="landing-stats-wrap lp-fade" ref={statsRef}>
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
      <section className="landing-features lp-fade">
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


      <div className="landing-section-divider" />

      {/* ── Terra Section ───────────────────────────── */}
      <section className="landing-terra lp-fade">
        <div className="landing-terra-inner">

          {/* Cabeçalho: badge + título + descrição */}
          <div className="landing-terra-header">
            <div className="landing-badge" style={{ marginBottom: 16 }}>
              <span className="landing-badge-dot" style={{ background: '#84cc16' }} />
              Módulo Terra
            </div>
            <h2 className="landing-terra-title">
              Suas fazendas no{' '}
              <span className="landing-terra-accent">mapa inteligente</span>
            </h2>
            <p className="landing-terra-sub">
              Georreferencie propriedades, desenhe talhões e acompanhe
              clima em tempo real — tudo sem sair do painel.
            </p>
          </div>

          {/* Features em grid — 3 col desktop, 1 col mobile */}
          <div className="landing-terra-feats-grid">
            {[
              { icon: '📍', title: 'Localização exata', desc: 'Marque a coordenada da fazenda no mapa com um clique.' },
              { icon: '✏️', title: 'Desenhe talhões', desc: 'Trace os perímetros diretamente sobre o satélite.' },
              { icon: '📝', title: 'Anotações no mapa', desc: 'Registre observações, plantios e histórico por talhão.' },
              { icon: '🌧️', title: 'Radar de chuva ao vivo', desc: 'Sobreponha precipitação em tempo real sobre suas terras.' },
              { icon: '🌡️', title: 'Clima por fazenda', desc: 'Temperatura, umidade e previsão de 7 dias por propriedade.' },
              { icon: '🛰️', title: 'Visão de satélite', desc: 'Alterne entre satélite ESRI, mapa base e relevo.' },
            ].map(({ icon, title, desc }) => (
              <div key={title} className="landing-terra-feat">
                <span className="landing-terra-feat-icon">{icon}</span>
                <div>
                  <div className="landing-terra-feat-title">{title}</div>
                  <div className="landing-terra-feat-desc">{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop: iframe real do mapa */}
          <div className="landing-terra-map-full landing-terra-map-desktop">
            <iframe
              src="https://braianoto-ai.github.io/lion-adiminstracao/#/mapa/30056726-5681-4e59-bb26-c0a83212c8e7"
              title="Lion Farm — mapa público"
              className="landing-terra-iframe-full"
              loading="lazy"
              allow="geolocation"
            />
          </div>

          {/* Mobile: preview leve com botão de abertura */}
          <div className="landing-terra-map-mobile">
            <div className="landing-terra-map-preview">
              <div className="ltm-preview-grid" />
              <div className="ltm-preview-content">
                <div className="ltm-preview-icon">🗺️</div>
                <p className="ltm-preview-title">Lion Farm</p>
                <p className="ltm-preview-sub">Mapa interativo com talhões, clima e radar de chuva</p>
                <a
                  className="ltm-preview-btn"
                  href="https://admlion.com/#/mapa/30056726-5681-4e59-bb26-c0a83212c8e7"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir mapa completo
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="14" height="14">
                    <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>

        </div>
      </section>


      <div className="landing-section-divider" />

      {/* ── Família & Metas ─────────────────────────── */}
      <section className="landing-famgoals lp-fade">
        <div className="landing-famgoals-inner">

          {/* Text */}
          <div className="landing-famgoals-text">
            <div className="landing-badge" style={{ marginBottom: 20 }}>
              <span className="landing-badge-dot" style={{ background: '#f59e0b' }} />
              Família & Metas
            </div>
            <h2 className="landing-famgoals-title">
              Gestão por pessoa,<br />
              <span className="landing-famgoals-accent">objetivos no foco</span>
            </h2>
            <p className="landing-famgoals-sub">
              Perfis individuais por membro da família com gastos, papéis
              e histórico. Metas financeiras com projeção mensal automática.
            </p>
            <div className="landing-famgoals-feats">
              {[
                { icon: '👤', title: 'Perfil por membro', desc: 'Gastos, papel na família e histórico individual.' },
                { icon: '🎯', title: 'Metas com prazo', desc: 'Defina objetivos, acompanhe progresso e receba projeção de aporte.' },
                { icon: '⚠️', title: 'Alertas de urgência', desc: 'Metas com prazo próximo destacadas automaticamente.' },
                { icon: '💰', title: 'Depósito rápido', desc: 'Adicione valores às metas em um clique, sem formulário.' },
              ].map(({ icon, title, desc }) => (
                <div key={title} className="landing-famgoals-feat">
                  <span className="landing-famgoals-feat-icon">{icon}</span>
                  <div>
                    <div className="landing-famgoals-feat-title">{title}</div>
                    <div className="landing-famgoals-feat-desc">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mockup cards */}
          <div className="landing-famgoals-mockup">

            {/* Família card */}
            <div className="lfg-card">
              <div className="lfg-card-header">
                <span className="lfg-card-title">Membros da família</span>
                <span className="lfg-card-count">4 membros</span>
              </div>
              <div className="lfg-members">
                {[
                  { name: 'Braian', role: 'Titular', spent: 'R$ 3.200', color: '#3b82f6', initials: 'B' },
                  { name: 'Ana',    role: 'Cônjuge', spent: 'R$ 1.840', color: '#ec4899', initials: 'A' },
                  { name: 'Lucas',  role: 'Filho',   spent: 'R$ 420',   color: '#f59e0b', initials: 'L' },
                  { name: 'Sofia',  role: 'Filha',   spent: 'R$ 380',   color: '#8b5cf6', initials: 'S' },
                ].map(({ name, role, spent, color, initials }) => (
                  <div key={name} className="lfg-member">
                    <div className="lfg-avatar" style={{ background: `${color}22`, border: `1.5px solid ${color}55`, color }}>{initials}</div>
                    <div className="lfg-member-info">
                      <span className="lfg-member-name">{name}</span>
                      <span className="lfg-member-role">{role}</span>
                    </div>
                    <span className="lfg-member-spent">{spent}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Metas card */}
            <div className="lfg-card" style={{ marginTop: 12 }}>
              <div className="lfg-card-header">
                <span className="lfg-card-title">Metas financeiras</span>
                <span className="lfg-badge-done">✓ 1 concluída</span>
              </div>
              <div className="lfg-goals">
                {[
                  { name: 'Casa própria',   pct: 68, color: '#3b82f6', current: 'R$ 136k', target: 'R$ 200k', deadline: '8m' },
                  { name: 'Viagem Europa',  pct: 42, color: '#8b5cf6', current: 'R$ 8.4k',  target: 'R$ 20k',  deadline: '⚠ 22d' },
                  { name: 'Reserva 12 meses', pct: 91, color: '#10b981', current: 'R$ 54.6k', target: 'R$ 60k',  deadline: null },
                ].map(({ name, pct, color, current, target, deadline }) => (
                  <div key={name} className="lfg-goal">
                    <div className="lfg-goal-top">
                      <span className="lfg-goal-name">{name}</span>
                      <span className="lfg-goal-deadline" style={{ color: deadline?.startsWith('⚠') ? '#f59e0b' : '#6b7280' }}>{deadline ?? '—'}</span>
                    </div>
                    <div className="lfg-goal-amounts">
                      <span>{current}</span><span className="lfg-goal-sep">/</span><span style={{ color: '#6b7280' }}>{target}</span>
                    </div>
                    <div className="lfg-goal-track">
                      <div className="lfg-goal-fill" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="lfg-goal-pct" style={{ color }}>{pct}%</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>


      <div className="landing-section-divider" />

      {/* ── Depoimentos ─────────────────────────────── */}
      <section className="landing-testimonials lp-fade">
        <div className="landing-testimonials-inner">
          <h2 className="landing-section-title">O que dizem os usuários</h2>
          <p className="landing-section-sub" style={{ marginBottom: 40 }}>Produtores rurais e famílias que organizam sua vida financeira com o Lion</p>
          <div className="landing-testimonials-grid">
            {[
              {
                quote: 'Finalmente consigo ver todos os talhões da fazenda no mapa e anotar cada plantio. Nunca foi tão fácil controlar o que acontece em cada área.',
                name: 'Roberto Alves',
                role: 'Produtor rural · Mato Grosso',
                initials: 'RA',
                color: '#84cc16',
              },
              {
                quote: 'O painel de metas me ajudou a planejar a compra da casa própria. Ver o progresso todo mês me motiva a depositar mais.',
                name: 'Camila Souza',
                role: 'Gestora financeira · São Paulo',
                initials: 'CS',
                color: '#8b5cf6',
              },
              {
                quote: 'Controlo as finanças de toda a família, com gastos separados por pessoa. Meu marido e filhos têm cada um seu perfil.',
                name: 'Fernanda Lima',
                role: 'Empresária · Paraná',
                initials: 'FL',
                color: '#f59e0b',
              },
            ].map(({ quote, name, role, initials, color }) => (
              <div key={name} className="landing-testimonial-card">
                <div className="ltc-stars">{'★★★★★'}</div>
                <p className="ltc-quote">"{quote}"</p>
                <div className="ltc-author">
                  <div className="ltc-avatar" style={{ background: `${color}22`, border: `1.5px solid ${color}55`, color }}>{initials}</div>
                  <div>
                    <div className="ltc-name">{name}</div>
                    <div className="ltc-role">{role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="landing-section-divider" />

      {/* ── Disponível em todo dispositivo ───────────── */}
      <section className="landing-devices lp-fade">
        <div className="landing-devices-inner">
          <div className="landing-devices-text">
            <div className="landing-badge" style={{ marginBottom: 20 }}>
              <span className="landing-badge-dot" style={{ background: '#06b6d4' }} />
              Multi-plataforma
            </div>
            <h2 className="landing-devices-title">
              Acesse de qualquer<br />
              <span className="landing-devices-accent">dispositivo</span>
            </h2>
            <p className="landing-devices-sub">
              Progressive Web App — instale no celular, use no tablet ou desktop.
              Funciona offline e sincroniza quando volta a internet.
            </p>
            <div className="landing-devices-items">
              {[
                { icon: '📱', label: 'Mobile', desc: 'iOS e Android via PWA' },
                { icon: '💻', label: 'Desktop', desc: 'Chrome, Safari, Firefox' },
                { icon: '📡', label: 'Offline-first', desc: 'Dados salvos localmente' },
                { icon: '🔄', label: 'Sync automático', desc: 'Supabase em tempo real' },
              ].map(({ icon, label, desc }) => (
                <div key={label} className="landing-device-item">
                  <span className="landing-device-icon">{icon}</span>
                  <div>
                    <div className="landing-device-label">{label}</div>
                    <div className="landing-device-desc">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Device mockups */}
          <div className="landing-devices-mockups">
            {/* Desktop frame */}
            <div className="ldm-desktop">
              <div className="ldm-desktop-bar">
                <span /><span /><span />
              </div>
              <div className="ldm-desktop-screen">
                <div className="ldm-screen-sidebar">
                  {['◈','◉','◎','⊞','◷'].map((ic, i) => (
                    <div key={i} className={`ldm-sidebar-item${i === 0 ? ' active' : ''}`}>{ic}</div>
                  ))}
                </div>
                <div className="ldm-screen-content">
                  <div className="ldm-content-bar ldm-bar-blue" />
                  <div className="ldm-content-bar ldm-bar-green" style={{ width: '70%' }} />
                  <div className="ldm-content-bar ldm-bar-purple" style={{ width: '85%' }} />
                  <div className="ldm-content-row">
                    <div className="ldm-mini-card" />
                    <div className="ldm-mini-card" />
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile frame */}
            <div className="ldm-mobile">
              <div className="ldm-mobile-notch" />
              <div className="ldm-mobile-screen">
                <div className="ldm-mob-bar ldm-bar-blue" />
                <div className="ldm-mob-bar ldm-bar-green" style={{ width: '60%' }} />
                <div className="ldm-mob-bar" style={{ width: '80%', background: 'rgba(255,255,255,.06)' }} />
                <div className="ldm-mob-bar" style={{ width: '50%', background: 'rgba(255,255,255,.04)' }} />
              </div>
              <div className="ldm-mobile-home" />
            </div>
          </div>
        </div>
      </section>


      <div className="landing-section-divider" />

      {/* ── Preços ───────────────────────────────────── */}
      <section className="landing-pricing lp-fade">
        <div className="landing-pricing-inner">
          <h2 className="landing-section-title">Simples e transparente</h2>
          <p className="landing-section-sub" style={{ marginBottom: 48 }}>Um plano completo. Sem surpresas, sem limites.</p>

          <div className="landing-pricing-cards">

            {/* Plano mensal */}
            <div className="lpr-card lpr-card-featured">
              <div className="lpr-badge">Mais popular</div>
              <div className="lpr-plan">Plano Completo</div>
              <div className="lpr-price-row">
                <span className="lpr-currency">R$</span>
                <span className="lpr-amount">49</span>
                <span className="lpr-period">/mês</span>
              </div>
              <p className="lpr-desc">Acesso total a todos os 9 módulos para você e sua família.</p>

              <ul className="lpr-features">
                {[
                  'Finanças com câmbio ao vivo',
                  'Patrimônio: imóveis, veículos e produtos',
                  'Mapa Terra com talhões e radar',
                  'Gestão familiar com perfis individuais',
                  'Metas financeiras com projeção',
                  'Pagamentos e alertas automáticos',
                  'Calendário unificado',
                  'Dashboard com visão geral',
                  'Sincronização em tempo real',
                  'Funciona offline (PWA)',
                  'Suporte prioritário',
                ].map(f => (
                  <li key={f} className="lpr-feature-item">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                      <circle cx="8" cy="8" r="7" fill="rgba(59,130,246,.15)" stroke="rgba(59,130,246,.4)" strokeWidth="1"/>
                      <path d="M5 8l2 2 4-4" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button className="lpr-cta" onClick={() => window.location.hash = '#/register'}>
                Começar agora
                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <p className="lpr-cancel">Cancele quando quiser · Sem fidelidade</p>
            </div>

            {/* Plano anual */}
            <div className="lpr-card lpr-card-annual">
              <div className="lpr-badge lpr-badge-green">Economize 20%</div>
              <div className="lpr-plan">Plano Anual</div>
              <div className="lpr-price-row">
                <span className="lpr-currency">R$</span>
                <span className="lpr-amount">39</span>
                <span className="lpr-period">/mês</span>
              </div>
              <p className="lpr-annual-total">Cobrado R$ 468/ano</p>
              <p className="lpr-desc">Tudo do plano mensal com desconto de 20% no pagamento anual.</p>

              <ul className="lpr-features">
                {[
                  'Tudo do plano mensal',
                  '2 meses grátis por ano',
                  'Suporte prioritário VIP',
                  'Acesso antecipado a novidades',
                ].map(f => (
                  <li key={f} className="lpr-feature-item">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
                      <circle cx="8" cy="8" r="7" fill="rgba(16,185,129,.15)" stroke="rgba(16,185,129,.4)" strokeWidth="1"/>
                      <path d="M5 8l2 2 4-4" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <button className="lpr-cta lpr-cta-green" onClick={() => window.location.hash = '#/register'}>
                Assinar anual
                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <p className="lpr-cancel">Renovação automática · Cancele antes do vencimento</p>
            </div>

          </div>

          <p className="lpr-guarantee">
            <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="#10b981" strokeWidth="1.5">
              <path d="M10 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3L10 14l-4.8 2.6.9-5.3L2.3 7.6l5.3-.8L10 2z" strokeLinejoin="round"/>
            </svg>
            Garantia de 7 dias · Se não gostar, devolvemos 100% do valor
          </p>
        </div>
      </section>

      {/* ── CTA Bottom ───────────────────────────────── */}
      <section className="landing-bottom-cta lp-fade">
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
