import { useState } from 'react'

export default 
function Calculator({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState('0')
  const [prev, setPrev] = useState<string | null>(null)
  const [op, setOp] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(false)

  const input = (n: string) => {
    if (waiting) { setDisplay(n); setWaiting(false) }
    else setDisplay(display === '0' ? n : display + n)
  }

  const decimal = () => {
    if (waiting) { setDisplay('0.'); setWaiting(false); return }
    if (!display.includes('.')) setDisplay(display + '.')
  }

  const calc = (a: number, o: string, b: number) => {
    if (o === '+') return a + b
    if (o === '−') return a - b
    if (o === '×') return a * b
    if (o === '÷') return b !== 0 ? a / b : 0
    return b
  }

  const operator = (o: string) => {
    const cur = parseFloat(display)
    if (prev !== null && !waiting) {
      const res = calc(parseFloat(prev), op!, cur)
      const str = parseFloat(res.toFixed(10)).toString()
      setDisplay(str); setPrev(str)
    } else { setPrev(display) }
    setOp(o); setWaiting(true)
  }

  const equals = () => {
    if (prev === null || op === null) return
    const res = calc(parseFloat(prev), op, parseFloat(display))
    const str = parseFloat(res.toFixed(10)).toString()
    setDisplay(str); setPrev(null); setOp(null); setWaiting(true)
  }

  const clear = () => { setDisplay('0'); setPrev(null); setOp(null); setWaiting(false) }
  const sign = () => setDisplay(String(parseFloat(display) * -1))
  const pct = () => setDisplay(String(parseFloat(display) / 100))
  const back = () => display.length > 1 ? setDisplay(display.slice(0, -1)) : setDisplay('0')

  const Btn = ({ label, variant = 'num', wide = false, action }: {
    label: string; variant?: 'num' | 'fn' | 'op' | 'eq'; wide?: boolean; action: () => void
  }) => (
    <button className={`cb cb-${variant}${wide ? ' cb-wide' : ''}`} onClick={action}>{label}</button>
  )

  return (
    <div className="calc-wrap">
      <div className="panel-header">
        <div className="panel-header-left">
          <div className="panel-icon calc-icon-header">
            <svg viewBox="0 0 20 20" fill="none">
              <rect x="2" y="2" width="16" height="16" rx="3" stroke="currentColor" strokeWidth="1.5"/>
              <rect x="5" y="5" width="10" height="3" rx="1" fill="currentColor" opacity=".6"/>
              <circle cx="6.5" cy="11.5" r="1" fill="currentColor"/>
              <circle cx="10" cy="11.5" r="1" fill="currentColor"/>
              <circle cx="13.5" cy="11.5" r="1" fill="currentColor"/>
              <circle cx="6.5" cy="15" r="1" fill="currentColor"/>
              <circle cx="10" cy="15" r="1" fill="currentColor"/>
              <circle cx="13.5" cy="15" r="1" fill="currentColor"/>
            </svg>
          </div>
          <span>Calculadora</span>
        </div>
        <button className="panel-close" onClick={onClose}>
          <svg viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </button>
      </div>
      <div className="calc-display">
        <div className="calc-expr">{prev && op ? `${prev} ${op}` : ''}</div>
        <div className="calc-val">{display.length > 12 ? parseFloat(parseFloat(display).toExponential(4)).toString() : display}</div>
      </div>
      <div className="calc-grid">
        <Btn label="AC" variant="fn" action={clear} />
        <Btn label="+/−" variant="fn" action={sign} />
        <Btn label="%" variant="fn" action={pct} />
        <Btn label="÷" variant="op" action={() => operator('÷')} />

        <Btn label="7" action={() => input('7')} />
        <Btn label="8" action={() => input('8')} />
        <Btn label="9" action={() => input('9')} />
        <Btn label="×" variant="op" action={() => operator('×')} />

        <Btn label="4" action={() => input('4')} />
        <Btn label="5" action={() => input('5')} />
        <Btn label="6" action={() => input('6')} />
        <Btn label="−" variant="op" action={() => operator('−')} />

        <Btn label="1" action={() => input('1')} />
        <Btn label="2" action={() => input('2')} />
        <Btn label="3" action={() => input('3')} />
        <Btn label="+" variant="op" action={() => operator('+')} />

        <Btn label="⌫" action={back} />
        <Btn label="0" action={() => input('0')} />
        <Btn label="." action={decimal} />
        <Btn label="=" variant="eq" action={equals} />
      </div>
    </div>
  )
}
