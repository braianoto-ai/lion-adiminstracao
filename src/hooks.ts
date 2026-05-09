import { useState, useEffect, useRef, useCallback, useContext } from 'react'
import { supabase } from './lib/supabase'
import { UserCtx, CLOUD_BUS, SYNC_STATUS, SYNC_ERRORS } from './context'

export function useSyncStatus(...keys: string[]): boolean {
  const [syncing, setSyncing] = useState(false)
  useEffect(() => {
    const handler = () => setSyncing(keys.some(k => SYNC_STATUS.get(k)))
    keys.forEach(k => CLOUD_BUS.addEventListener(`${k}:status`, handler))
    return () => keys.forEach(k => CLOUD_BUS.removeEventListener(`${k}:status`, handler))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return syncing
}

export function useSyncError(): string | null {
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as string | null
      setError(detail)
      if (detail) setTimeout(() => {
        SYNC_ERRORS.clear()
        CLOUD_BUS.dispatchEvent(new CustomEvent('sync:error', { detail: null }))
      }, 8000)
    }
    CLOUD_BUS.addEventListener('sync:error', handler)
    return () => CLOUD_BUS.removeEventListener('sync:error', handler)
  }, [])
  return error
}

export function useCloudTable<T extends { id: string }>(
  tableName: string,
  lsKey: string,
  options?: { shared?: boolean },
): [T[], React.Dispatch<React.SetStateAction<T[]>>] {
  const userId = useContext(UserCtx)
  const userIdRef = useRef(userId)
  useEffect(() => { userIdRef.current = userId }, [userId])
  const shared = options?.shared || false

  const [data, _setData] = useState<T[]>(() => {
    try { return JSON.parse(localStorage.getItem(lsKey) || '[]') } catch { return [] }
  })

  const dataRef = useRef(data)
  useEffect(() => { dataRef.current = data }, [data])

  const ownerMap = useRef<Map<string, string>>(new Map())

  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!supabase) return
    if (!userId) {
      _setData([])
      localStorage.removeItem(lsKey)
      return
    }
    const query = shared
      ? supabase.from(tableName).select('id, data, user_id').or(`user_id.eq.${userId},shared_with.cs.{${userId}}`)
      : supabase.from(tableName).select('id, data, user_id').eq('user_id', userId)
    query.then(({ data: rows, error: fetchErr }) => {
        if (fetchErr) {
          CLOUD_BUS.dispatchEvent(new CustomEvent('sync:error', { detail: `Erro ao carregar ${tableName}: ${fetchErr.message}` }))
          return
        }
        if (rows) {
          const remote = rows.map(r => {
            ownerMap.current.set(r.id, r.user_id)
            return { ...(r.data as object), id: r.id } as T
          })
          const local: T[] = (() => { try { return JSON.parse(localStorage.getItem(lsKey) || '[]') } catch { return [] } })()
          const remoteIds = new Set(remote.map(i => i.id))
          const pending = local.filter(i => !remoteIds.has(i.id))
          const merged = [...remote, ...pending]
          _setData(merged)
          localStorage.setItem(lsKey, JSON.stringify(merged))
        }
      })
  }, [userId, tableName, lsKey, shared])

  useEffect(() => {
    const handler = () => {
      try {
        const fresh = JSON.parse(localStorage.getItem(lsKey) || '[]') as T[]
        _setData(fresh)
      } catch { /* ignore */ }
    }
    CLOUD_BUS.addEventListener(lsKey, handler)
    return () => CLOUD_BUS.removeEventListener(lsKey, handler)
  }, [lsKey])

  const setData: React.Dispatch<React.SetStateAction<T[]>> = useCallback((action) => {
    const next = typeof action === 'function' ? (action as (p: T[]) => T[])(dataRef.current) : action
    dataRef.current = next
    localStorage.setItem(lsKey, JSON.stringify(next))
    CLOUD_BUS.dispatchEvent(new Event(lsKey))
    _setData(next)
    if (supabase && userIdRef.current) {
      if (syncTimer.current) clearTimeout(syncTimer.current)
      SYNC_STATUS.set(lsKey, true)
      CLOUD_BUS.dispatchEvent(new Event(`${lsKey}:status`))
      syncTimer.current = setTimeout(async () => {
        const uid = userIdRef.current
        if (!uid || !supabase) return
        let retries = 0
        const maxRetries = 2
        const attempt = async (): Promise<void> => {
          try {
            if (next.length > 0) {
              const { error: upsertErr } = await supabase.from(tableName).upsert(
                next.map(item => ({ id: item.id, user_id: ownerMap.current.get(item.id) || uid, data: item })),
                { onConflict: 'id' }
              )
              if (upsertErr) throw upsertErr
              const keepIds = next.map(i => i.id)
              await supabase.from(tableName).delete()
                .eq('user_id', uid)
                .not('id', 'in', `(${keepIds.join(',')})`)
            } else {
              await supabase.from(tableName).delete().eq('user_id', uid)
            }
            SYNC_ERRORS.delete(lsKey)
          } catch (err) {
            if (retries < maxRetries) {
              retries++
              await new Promise(r => setTimeout(r, 1000 * retries))
              return attempt()
            }
            const msg = err instanceof Error ? err.message : 'Erro de conexão'
            SYNC_ERRORS.set(lsKey, msg)
            CLOUD_BUS.dispatchEvent(new CustomEvent('sync:error', { detail: `Falha ao salvar ${tableName}: ${msg}` }))
          } finally {
            SYNC_STATUS.set(lsKey, false)
            CLOUD_BUS.dispatchEvent(new Event(`${lsKey}:status`))
          }
        }
        await attempt()
      }, 2000)
    }
  }, [tableName, lsKey])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (syncTimer.current) e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  return [data, setData]
}
