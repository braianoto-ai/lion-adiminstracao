import { useState } from 'react'
import { OB_STEPS } from '../App'

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
