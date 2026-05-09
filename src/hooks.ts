import { useState, useEffect, useRef, useCallback, useContext } from 'react'
import { supabase } from './lib/supabase'
import { UserCtx, CLOUD_BUS, SYNC_STATUS } from './context'

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
    query.then(({ data: rows }) => {
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
        try {
          if (next.length > 0) {
            await supabase.from(tableName).upsert(
              next.map(item => ({ id: item.id, user_id: ownerMap.current.get(item.id) || uid, data: item })),
              { onConflict: 'id' }
            )
            const keepIds = next.map(i => i.id)
            await supabase.from(tableName).delete()
              .eq('user_id', uid)
              .not('id', 'in', `(${keepIds.join(',')})`)
          } else {
            await supabase.from(tableName).delete().eq('user_id', uid)
          }
        } finally {
          SYNC_STATUS.set(lsKey, false)
          CLOUD_BUS.dispatchEvent(new Event(`${lsKey}:status`))
        }
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
