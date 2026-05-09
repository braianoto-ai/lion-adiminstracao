import { createContext } from 'react'

export const UserCtx = createContext<string | undefined>(undefined)

export const DATA_KEYS = [
  'lion-txs','lion-goals','lion-rentals','lion-maintenance',
  'lion-vehicles','lion-revisions','lion-calendar','lion-trips',
  'lion-family','lion-collectors','lion-bills','np-folders',
  'lion-docs-meta','lion-imoveis','lion-produtos',
  'lion-terra','lion-talhoes',
]

export const CLOUD_BUS = new EventTarget()
export const SYNC_STATUS = new Map<string, boolean>()
