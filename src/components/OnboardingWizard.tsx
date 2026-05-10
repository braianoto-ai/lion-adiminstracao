import { useState } from 'react'

const OB_STEPS = [
  {
    icon: (
      <svg viewBox="0 0 48 48" fill="none">
        <rect width="48" height="48" rx="14" fill="url(#obg)"/>
        <path d="M12 34L18 18l8 13 6-8 6 15" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <defs><linearGradient id="obg" x1="0" y1="0" x2="48" y2="48"><stop stopColor="#3b82f6"/><stop offset="1" stopColor="#1d4ed8"/></linearGradient></defs>
      </svg>
    ),
    title: 'Bem-vindo ao Lion Admin',
    body: 'Seu painel completo de gestão financeira e patrimonial. Em menos de 2 minutos você estará configurado e pronto para usar.',
    cta: 'Começar tour',
  },
  {
    icon: <svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="14" fill="rgba(59,130,246,.15)"/><path d="M24 8v32M31 14H19.5a5 5 0 0 0 0 10h9a5 5 0 0 1 0 10H16" stroke="var(--blue)" strokeWidth="2.5" strokeLinecap="round"/></svg>,
    title: 'Registre suas Finanças',
    body: 'Clique no botão "Finanças" (ou pressione F) para lançar receitas e despesas. Acompanhe seu saldo mensal e histórico de transações.',
    cta: 'Entendido',
  },
  {
    icon: <svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="14" fill="rgba(16,185,129,.15)"/><circle cx="24" cy="24" r="14" stroke="var(--green)" strokeWidth="2.5"/><circle cx="24" cy="24" r="8" stroke="var(--green)" strokeWidth="2"/><circle cx="24" cy="24" r="3" fill="var(--green)"/></svg>,
    title: 'Defina Metas Financeiras',
    body: 'Crie objetivos como reserva de emergência, viagem ou compra de imóvel. Acompanhe o progresso em tempo real com barras visuais.',
    cta: 'Entendido',
  },
  {
    icon: <svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="14" fill="rgba(245,158,11,.15)"/><path d="M8 20l16-14 16 14v20a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3z" stroke="var(--amber)" strokeWidth="2.5"/><polyline points="18,43 18,28 30,28 30,43" stroke="var(--amber)" strokeWidth="2.5"/></svg>,
    title: 'Gerencie Imóveis e Aluguéis',
    body: 'Cadastre seus imóveis, controle recebimento de aluguéis, registre manutenções e armazene documentos importantes com segurança.',
    cta: 'Entendido',
  },
  {
    icon: <svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="14" fill="rgba(16,185,129,.15)"/><path d="M14 26l8 8 14-16" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    title: 'Tudo pronto!',
    body: 'Use os botões flutuantes à direita ou os atalhos de teclado (pressione ? para ver todos). Seus dados ficam salvos localmente no seu dispositivo.',
    cta: 'Ir para o painel',
  },
]

export default
function OnboardingWizard({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const last = step === OB_STEPS.length - 1
  const s = OB_STEPS[step]

  const next = () => last ? onDone() : setStep(s => s + 1)
  const prev = () => setStep(s => s - 1)

  return (
    <div className="ob-overlay" onClick={e => { if ((e.target as HTMLElement).classList.contains('ob-overlay')) onDone() }}>
      <div className="ob-card">
        <button className="ob-skip" onClick={onDone}>Pular</button>
        <div className="ob-icon">{s.icon}</div>
        <h2 className="ob-title">{s.title}</h2>
        <p className="ob-body">{s.body}</p>
        <div className="ob-dots">
          {OB_STEPS.map((_, i) => <span key={i} className={`ob-dot${i === step ? ' ob-dot-active' : ''}`}/>)}
        </div>
        <div className="ob-actions">
          {step > 0 && <button className="ob-back" onClick={prev}>Anterior</button>}
          <button className="ob-next" onClick={next}>{s.cta}</button>
        </div>
      </div>
    </div>
  )
}
