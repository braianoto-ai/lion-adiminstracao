import { useState, useEffect, useRef, useMemo } from 'react'
import L from 'leaflet'
import { supabase } from '../lib/supabase'
import { TALHAO_USOS } from '../constants'
import type { TerraFazenda, TerraTalhao } from '../types'

export default function PublicMapPage() {
  const [fazendas, setFazendas] = useState<TerraFazenda[]>([])
  const [talhoes, setTalhoes] = useState<TerraTalhao[]>([])
  const [loading, setLoading] = useState(true)
  const [pubTab, setPubTab] = useState<'mapa' | 'talhoes'>('mapa')
  const [mapLayer, setMapLayer] = useState<'mapa' | 'satelite' | 'relevo'>('satelite')
  const hiddenUsos = useMemo(() => new Set<string>(), [])
  const [showSidebar, setShowSidebar] = useState(true)
  const [hiddenTalhoes, setHiddenTalhoes] = useState<Set<string>>(new Set())
  const [talhaoOpacity, setTalhaoOpacity] = useState(0.1)
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<L.Map | null>(null)
  const layerGroup = useRef<L.LayerGroup | null>(null)
  const tileRef = useRef<L.TileLayer | null>(null)

  const fmtHa = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ha'

  useEffect(() => {
    const load = async () => {
      let loaded = false
      if (supabase) {
        const hash = window.location.hash
        const uidMatch = hash.match(/#\/mapa\/([a-f0-9-]+)/i)
        const uid = uidMatch?.[1]
        if (uid) {
          const [fRes, tRes] = await Promise.all([
            supabase.from('terra_fazendas').select('id, data').eq('user_id', uid),
            supabase.from('terra_talhoes').select('id, data').eq('user_id', uid),
          ])
          if (fRes.data?.length) { setFazendas(fRes.data.map(r => ({ ...(r.data as object), id: r.id }) as TerraFazenda)); loaded = true }
          if (tRes.data?.length) { setTalhoes(tRes.data.map(r => ({ ...(r.data as object), id: r.id }) as TerraTalhao)); loaded = true }
        }
      }
      if (!loaded) {
        try {
          const f = JSON.parse(localStorage.getItem('lion-terra') || '[]') as TerraFazenda[]
          const t = JSON.parse(localStorage.getItem('lion-talhoes') || '[]') as TerraTalhao[]
          if (f.length) setFazendas(f)
          if (t.length) setTalhoes(t)
        } catch { /* ignore */ }
      }
      setLoading(false)
    }
    load()
  }, [])

  const fazenda = fazendas[0] || null
  const fazTalhoes = fazenda ? talhoes.filter(t => t.fazendaId === fazenda.id) : talhoes
  const somaTalhoes = fazTalhoes.reduce((s, t) => s + t.areaHa, 0)

  useEffect(() => {
    if (loading || pubTab !== 'mapa' || !mapRef.current || leafletMap.current) return
    const center: [number, number] = fazenda ? [fazenda.latitude, fazenda.longitude] : [-15.78, -47.93]
    const map = L.map(mapRef.current, { zoomControl: false }).setView(center, fazenda ? 14 : 4)
    L.control.zoom({ position: 'topright' }).addTo(map)
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' })
    osm.addTo(map)
    tileRef.current = osm
    layerGroup.current = L.layerGroup().addTo(map)
    leafletMap.current = map
    return () => { map.remove(); leafletMap.current = null }
  }, [loading, pubTab])

  useEffect(() => {
    if (!leafletMap.current || !tileRef.current) return
    leafletMap.current.removeLayer(tileRef.current)
    const tiles = {
      mapa: { url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', attr: '&copy; OpenStreetMap', maxZ: 19 },
      satelite: { url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', attr: '&copy; Google', maxZ: 20 },
      relevo: { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attr: '&copy; OpenTopoMap', maxZ: 17 },
    }
    const t = tiles[mapLayer]
    tileRef.current = L.tileLayer(t.url, { attribution: t.attr, maxZoom: t.maxZ }).addTo(leafletMap.current)
  }, [mapLayer])

  useEffect(() => {
    if (!leafletMap.current || !layerGroup.current) return
    layerGroup.current.clearLayers()
    if (fazenda && fazenda.perimetro.length >= 3) {
      const perimPoly = L.polygon(fazenda.perimetro, { color: '#dc2626', weight: 3, fillOpacity: 0.04, dashArray: '8 4' })
      perimPoly.bindPopup(`<div style="font-family:system-ui;min-width:200px"><strong style="font-size:14px">${fazenda.nome}</strong><br/><span style="color:#888">${fazenda.municipio} — ${fazenda.uf}</span><hr style="margin:6px 0;border:0;border-top:1px solid #ddd"/><b>Área Total:</b> ${fmtHa(fazenda.areaTotal)}<br/><b>Área Útil:</b> ${fmtHa(fazenda.areaUtil)}<br/><b>Reserva Legal:</b> ${fmtHa(fazenda.areaReservaLegal)} (${(fazenda.areaReservaLegal / fazenda.areaTotal * 100).toFixed(1)}%)<br/><b>Bioma:</b> ${fazenda.bioma}<br/><b>Relevo:</b> ${fazenda.relevo}</div>`)
      perimPoly.addTo(layerGroup.current)
    }
    fazTalhoes.forEach(t => {
      if (t.poligono.length >= 3 && !hiddenUsos.has(t.uso) && !hiddenTalhoes.has(t.id)) {
        const usoInfo = TALHAO_USOS.find(u => u.value === t.uso)
        const cor = t.cor || usoInfo?.cor || '#6b7280'
        const pctArea = fazenda ? ((t.areaHa / fazenda.areaTotal) * 100).toFixed(1) : '—'
        const poly = L.polygon(t.poligono, { color: cor, weight: 1.5, fillColor: cor, fillOpacity: talhaoOpacity })
        poly.bindPopup(`<div style="font-family:system-ui;min-width:180px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="background:${cor};color:#fff;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600">${usoInfo?.label || t.uso}</span></div><strong style="font-size:14px">${t.nome}</strong><hr style="margin:6px 0;border:0;border-top:1px solid #ddd"/><b>Área:</b> ${fmtHa(t.areaHa)} (${pctArea}% da fazenda)${t.cultura ? '<br/><b>Cultura:</b> ' + t.cultura : ''}${t.safra ? '<br/><b>Safra:</b> ' + t.safra : ''}${t.notas ? '<br/><span style="color:#888;font-size:12px">' + t.notas + '</span>' : ''}</div>`)
        poly.addTo(layerGroup.current!)
      }
    })
    if (fazenda && fazenda.perimetro.length >= 3) {
      const bounds = L.polygon(fazenda.perimetro).getBounds()
      leafletMap.current.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [fazenda, fazTalhoes, hiddenUsos, hiddenTalhoes, talhaoOpacity])



  useEffect(() => {
    if (leafletMap.current) setTimeout(() => leafletMap.current?.invalidateSize(), 200)
  }, [showSidebar])

  if (loading) return <div className="pub-map-loading"><div className="pub-map-spinner" /><span>Carregando mapa...</span></div>

  return (
    <div className="pub-terra-root">
      <div className="pub-terra-header">
        <div className="pub-terra-header-left">
          <svg viewBox="0 0 20 20" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 16l4-3 3 2 4-5 5 3" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 18h16" strokeLinecap="round"/></svg>
          {fazenda ? (
            <>
              <strong>{fazenda.nome}</strong>
              <span className="pub-terra-sub">{fazenda.municipio} — {fazenda.uf} · {fmtHa(fazenda.areaTotal)}</span>
            </>
          ) : <strong>Propriedade Rural</strong>}
        </div>
        <div className="pub-terra-tabs">
          <button className={`pub-terra-tab${pubTab === 'mapa' ? ' active' : ''}`} onClick={() => setPubTab('mapa')}>Mapa</button>
          <button className={`pub-terra-tab${pubTab === 'talhoes' ? ' active' : ''}`} onClick={() => setPubTab('talhoes')}>Talhões</button>
        </div>
      </div>

      {pubTab === 'mapa' && (
        <div className="pub-terra-map-wrap">
          <div className="pub-terra-map-controls">
            {(['mapa', 'satelite', 'relevo'] as const).map(l => (
              <button key={l} className={`pub-map-layer-btn${mapLayer === l ? ' active' : ''}`} onClick={() => setMapLayer(l)}>
                {({ mapa: 'Mapa', satelite: 'Satélite', relevo: 'Relevo' } as Record<string,string>)[l]}
              </button>
            ))}
          </div>
          <div className="pub-terra-map-layout">
            <div ref={mapRef} className="pub-terra-map-container">
              <button className="terra-sidebar-toggle" onClick={() => setShowSidebar(v => !v)} title={showSidebar ? 'Ocultar painel' : 'Mostrar painel'}>
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  {showSidebar
                    ? <path d="M10 3l5 5-5 5M1 3v10M4 8h11" strokeLinecap="round" strokeLinejoin="round"/>
                    : <path d="M6 3L1 8l5 5M15 3v10M12 8H1" strokeLinecap="round" strokeLinejoin="round"/>}
                </svg>
              </button>
            </div>
            {showSidebar && (
              <div className="pub-terra-map-sidebar">
                {fazenda && (
                  <div className="pub-terra-fazenda-info">
                    <div className="pub-terra-stats">
                      <div className="pub-terra-stat"><span className="pub-terra-stat-val">{fmtHa(fazenda.areaTotal)}</span><span className="pub-terra-stat-lbl">Área Total</span></div>
                      <div className="pub-terra-stat"><span className="pub-terra-stat-val">{fmtHa(fazenda.areaUtil)}</span><span className="pub-terra-stat-lbl">Área Útil</span></div>
                      <div className="pub-terra-stat"><span className="pub-terra-stat-val">{fmtHa(fazenda.areaReservaLegal + fazenda.areaApp)}</span><span className="pub-terra-stat-lbl">Reserva + APP</span></div>
                    </div>
                    {fazenda.areaTotal > 0 && (
                      <div className="pub-terra-utiliz">
                        <div className="pub-terra-utiliz-bar"><div className="pub-terra-utiliz-fill" style={{ width: `${Math.min(100, (fazenda.areaUtil / fazenda.areaTotal) * 100)}%` }} /></div>
                        <span className="pub-terra-utiliz-lbl">{((fazenda.areaUtil / fazenda.areaTotal) * 100).toFixed(0)}% utilização</span>
                      </div>
                    )}
                    <div className="pub-terra-meta">
                      {fazenda.bioma && <span>{fazenda.bioma}</span>}
                      {fazenda.tipoSolo && <span>{fazenda.tipoSolo}</span>}
                      {fazenda.relevo && <span>{fazenda.relevo}</span>}
                    </div>
                  </div>
                )}
                {fazTalhoes.length > 0 && (
                  <>
                    <div className="pub-terra-talhoes-title">Talhões ({fazTalhoes.length})<span className="pub-terra-talhoes-mapped">{fmtHa(somaTalhoes)} mapeados</span></div>
                    {fazTalhoes.map(t => {
                      const usoInfo = TALHAO_USOS.find(u => u.value === t.uso)
                      const cor = t.cor || usoInfo?.cor || '#6b7280'
                      const pct = fazenda && fazenda.areaTotal > 0 ? ((t.areaHa / fazenda.areaTotal) * 100).toFixed(1) : '—'
                      const visible = !hiddenTalhoes.has(t.id)
                      return (
                        <div key={t.id} className={`pub-map-legend-item${!visible ? ' hidden' : ''}`} style={{ cursor: 'default' }}>
                          <input type="checkbox" checked={visible} onChange={() => setHiddenTalhoes(prev => {
                            const next = new Set(prev)
                            if (next.has(t.id)) next.delete(t.id); else next.add(t.id)
                            return next
                          })} style={{ accentColor: cor }} />
                          <span className="pub-map-legend-swatch" style={{ background: cor, opacity: visible ? 1 : 0.3 }} />
                          <span className="pub-map-legend-label">{t.nome}</span>
                          <span className="pub-map-legend-info">{fmtHa(t.areaHa)} · {pct}%</span>
                        </div>
                      )
                    })}
                  </>
                )}
                {mapLayer === 'relevo' && (
                  <div className="pub-terra-elev-legend">
                    <div className="pub-terra-elev-title">Elevação</div>
                    <div className="pub-terra-elev-bar" />
                    <div className="pub-terra-elev-labels"><span>200m</span><span>400m</span><span>600m</span><span>800m</span><span>1000m+</span></div>
                  </div>
                )}
                <div className="terra-opacity-slider">
                  <label>Opacidade <span>{Math.round(talhaoOpacity * 100)}%</span></label>
                  <input type="range" min="0" max="100" value={Math.round(talhaoOpacity * 100)} onChange={e => setTalhaoOpacity(Number(e.target.value) / 100)} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {pubTab === 'talhoes' && (
        <div className="pub-terra-talhoes-content">
          {fazenda && fazenda.areaTotal > 0 && (
            <div className="pub-terra-talhoes-summary">
              <span>{fazTalhoes.length} talhões · {fmtHa(somaTalhoes)} mapeados de {fmtHa(fazenda.areaTotal)} ({((somaTalhoes / fazenda.areaTotal) * 100).toFixed(0)}%)</span>
            </div>
          )}
          <div className="pub-terra-talhao-grid">
            {fazTalhoes.map(t => {
              const usoInfo = TALHAO_USOS.find(u => u.value === t.uso)
              const cor = t.cor || usoInfo?.cor || '#6b7280'
              const pct = fazenda && fazenda.areaTotal > 0 ? ((t.areaHa / fazenda.areaTotal) * 100).toFixed(1) : null
              return (
                <div key={t.id} className="pub-terra-talhao-card">
                  <div className="pub-terra-talhao-color" style={{ background: cor }} />
                  <div className="pub-terra-talhao-body">
                    <div className="pub-terra-talhao-top">
                      <span className="pub-terra-talhao-badge" style={{ background: cor }}>{usoInfo?.label || t.uso}</span>
                      <span className="pub-terra-talhao-area">{fmtHa(t.areaHa)}</span>
                    </div>
                    <div className="pub-terra-talhao-name">{t.nome}</div>
                    {pct && <div className="pub-terra-talhao-pct">{pct}% da área total</div>}
                    {t.cultura && <div className="pub-terra-talhao-detail">{t.cultura}{t.safra ? ` · Safra ${t.safra}` : ''}</div>}
                    {t.notas && <div className="pub-terra-talhao-notes">{t.notas}</div>}
                  </div>
                </div>
              )
            })}
            {!fazTalhoes.length && <p className="pub-terra-empty">Nenhum talhão cadastrado.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
