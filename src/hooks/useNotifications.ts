import { useEffect } from 'react'
import type { Bill, Collector } from '../types'

const NOTIF_KEY_PREFIX = 'lion-notified-'

function todayKey(): string {
  return NOTIF_KEY_PREFIX + new Date().toISOString().slice(0, 10)
}

function getNotifiedToday(): Set<string> {
  try {
    const raw = localStorage.getItem(todayKey())
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}

function markNotified(ids: string[]) {
  const notified = getNotifiedToday()
  ids.forEach(id => notified.add(id))
  localStorage.setItem(todayKey(), JSON.stringify([...notified]))

  // Limpa chaves de dias anteriores
  const today = todayKey()
  Object.keys(localStorage)
    .filter(k => k.startsWith(NOTIF_KEY_PREFIX) && k !== today)
    .forEach(k => localStorage.removeItem(k))
}

async function requestPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

function sendNotification(title: string, body: string, tag: string) {
  try {
    new Notification(title, {
      body,
      tag,
      icon: '/lion-adiminstracao/pwa-192.png',
      badge: '/lion-adiminstracao/pwa-192.png',
    })
  } catch {
    // silencia erros em ambientes sem suporte
  }
}

function checkAndNotify() {
  const bills: Bill[] = (() => {
    try { return JSON.parse(localStorage.getItem('lion-bills') || '[]') } catch { return [] }
  })()
  const collectors: Collector[] = (() => {
    try { return JSON.parse(localStorage.getItem('lion-collectors') || '[]') } catch { return [] }
  })()

  if (!bills.length) return

  const notifiedToday = getNotifiedToday()
  const now = Date.now()
  const toMark: string[] = []

  for (const bill of bills) {
    if (bill.status === 'pago' || bill.status === 'cancelado') continue
    if (notifiedToday.has(bill.id)) continue

    const coll = collectors.find(c => c.id === bill.collectorId)
    const name = coll?.name || bill.description || 'Conta'
    const valor = bill.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    const daysLeft = Math.ceil((new Date(bill.dueDate + 'T23:59:59').getTime() - now) / 86_400_000)

    let title = ''
    let body = ''

    if (daysLeft < 0) {
      const n = Math.abs(daysLeft)
      title = '⚠️ Conta vencida'
      body = `${name} — ${valor} · Venceu há ${n} dia${n !== 1 ? 's' : ''}`
    } else if (daysLeft === 0) {
      title = '🔔 Conta vence hoje'
      body = `${name} — ${valor}`
    } else if (daysLeft === 1) {
      title = '🔔 Conta vence amanhã'
      body = `${name} — ${valor}`
    } else if (daysLeft <= 3) {
      title = '📅 Conta próxima'
      body = `${name} — ${valor} · Vence em ${daysLeft} dias`
    } else {
      continue
    }

    sendNotification(title, body, `bill-${bill.id}`)
    toMark.push(bill.id)
  }

  if (toMark.length) markNotified(toMark)
}

export function useNotifications(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return

    requestPermission().then(granted => {
      if (!granted) return
      // Pequeno delay para os dados carregarem do Supabase/localStorage
      const timer = setTimeout(checkAndNotify, 3000)
      return () => clearTimeout(timer)
    })
  }, [enabled])
}
