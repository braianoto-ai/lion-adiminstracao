import { useState, useEffect, useRef, useCallback, useContext, useMemo } from 'react'
import L from 'leaflet'
import { UserCtx } from '../context'
import { useCloudTable, useSyncStatus } from '../hooks'
import { TALHAO_USOS, TERRA_BIOMAS, TERRA_CULTURAS, TERRA_RELEVOS, TERRA_SOLOS, TERRA_UFS, NOTA_CATEGORIAS, compressImage } from '../constants'
import type { TerraFazenda, TerraTalhao, TalhaoUso, TerraNote, NotaCategoria } from '../types'

export default function TerraPage() {
  const userId = useContext(UserCtx)
  const [fazendas, setFazendas] = useCloudTable<TerraFazenda>('terra_fazendas', 'lion-terra', { shared: true })
  const [talhoes, setTalhoes] = useCloudTable<TerraTalhao>('terra_talhoes', 'lion-talhoes', { shared: true })
  const [notas, setNotas] = useCloudTable<TerraNote>('terra_notas', 'lion-notas', { shared: true })
  const [tab, setTab] = useState<'visao' | 'mapa' | 'talhoes' | 'docs' | 'fazendas'>('visao')
  const [shareCopied, setShareCopied] = useState(false)
  const [showValores, setShowValores] = useState(false)
  const isSyncing = useSyncStatus('lion-terra', 'lion-talhoes', 'lion-notas')
  const [activeFazendaId, setActiveFazendaId] = useState<string | null>(null)
  const [showFazendaForm, setShowFazendaForm] = useState(false)
  const [editFazendaId, setEditFazendaId] = useState<string | null>(null)
  const [showTalhaoForm, setShowTalhaoForm] = useState(false)
  const [editTalhaoId, setEditTalhaoId] = useState<string | null>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<L.Map | null>(null)
  const miniMapRef = useRef<HTMLDivElement>(null)
  const miniMapInstance = useRef<L.Map | null>(null)
  const layerGroup = useRef<L.LayerGroup | null>(null)
  const [mapLayer, setMapLayer] = useState<'mapa' | 'satelite' | 'relevo'>('mapa')
  const tileRef = useRef<L.TileLayer | null>(null)
  const [hiddenTalhoes, setHiddenTalhoes] = useState<Set<string>>(new Set())
  const [terraEditMode, setTerraEditMode] = useState(false)
  const [showMapSidebar, setShowMapSidebar] = useState(true)
  const [adminTalhaoOpacity, setAdminTalhaoOpacity] = useState(0.1)
  const [drawMode, setDrawMode] = useState<'none' | 'perimetro' | 'talhao' | 'nota'>('none')
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([])
  const drawLayerRef = useRef<L.Polyline | null>(null)
  const drawMarkersRef = useRef<L.LayerGroup | null>(null)
  const [drawTalhaoId, setDrawTalhaoId] = useState<string | null>(null)
  const [showQuickTalhao, setShowQuickTalhao] = useState(false)
  const [quickTalhaoName, setQuickTalhaoName] = useState('')
  const [quickTalhaoUso, setQuickTalhaoUso] = useState<TalhaoUso>('lavoura')
  const [editingMapTalhaoId, setEditingMapTalhaoId] = useState<string | null>(null)
  const editCoordsRef = useRef<[number, number][]>([])
  const editLayerRef = useRef<L.LayerGroup | null>(null)
  const editPolyRef = useRef<L.Polygon | null>(null)
  const [editVersion, setEditVersion] = useState(0)
  const [showNotaForm, setShowNotaForm] = useState(false)
  const [editNotaId, setEditNotaId] = useState<string | null>(null)
  const [pendingNotaLatLng, setPendingNotaLatLng] = useState<[number, number] | null>(null)
  const [notaForm, setNotaForm] = useState({ titulo: '', conteudo: '', cor: '#3b82f6', icone: 'geral' as NotaCategoria, fotoUrl: '' })
  const notasLayerRef = useRef<L.LayerGroup | null>(null)
  const [hiddenNotas, setHiddenNotas] = useState(false)

  const emptyFazenda: Omit<TerraFazenda, 'id' | 'createdAt'> = {
    nome: '', municipio: '', uf: 'PR', matricula: '', carNumero: '', itrNumero: '', ccir: '',
    areaTotal: 0, areaUtil: 0, areaReservaLegal: 0, areaApp: 0, areaPastagem: 0,
    areaLavoura: 0, areaReflorestamento: 0, areaBenfeitorias: 0,
    latitude: -23.55, longitude: -51.43, perimetro: [],
    tipoSolo: '', bioma: '', relevo: '', fonteAgua: '',
    valorVenal: '', valorMercado: '', geoReferenciado: false, licencaAmbiental: false, notas: '',
  }
  const [fazForm, setFazForm] = useState(emptyFazenda)

  const emptyTalhao: Omit<TerraTalhao, 'id' | 'createdAt'> = {
    fazendaId: '', nome: '', uso: 'lavoura', areaHa: 0, cultura: '', safra: '', poligono: [], cor: '#f59e0b', notas: '', publico: true,
  }
  const [talForm, setTalForm] = useState(emptyTalhao)

  const fazenda = fazendas.find(f => f.id === activeFazendaId) || fazendas[0] || null
  useEffect(() => { if (fazendas.length && !activeFazendaId) setActiveFazendaId(fazendas[0].id) }, [fazendas, activeFazendaId])
  const fazTalhoes = useMemo(() => talhoes.filter(t => t.fazendaId === fazenda?.id), [talhoes, fazenda])
  const fazNotas = useMemo(() => notas.filter(n => n.fazendaId === fazenda?.id), [notas, fazenda])

  const reservaMinPct = useMemo(() => {
    if (!fazenda) return 20
    if (fazenda.bioma === 'Amazônia') return 80
    if (fazenda.bioma === 'Cerrado') return 35
    return 20
  }, [fazenda])

  const reservaPct = fazenda && fazenda.areaTotal > 0 ? ((fazenda.areaReservaLegal / fazenda.areaTotal) * 100) : 0
  const grauUtil = fazenda && fazenda.areaTotal > 0 ? ((fazenda.areaUtil / fazenda.areaTotal) * 100) : 0
  const somaTalhoes = fazTalhoes.reduce((s, t) => s + t.areaHa, 0)

  const fmtHa = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ha'

  // ─── Fazenda CRUD
  const saveFazenda = () => {
    if (!fazForm.nome.trim()) return
    if (editFazendaId) {
      setFazendas(prev => prev.map(f => f.id === editFazendaId ? { ...f, ...fazForm } : f))
    } else {
      const nf: TerraFazenda = { ...fazForm, id: crypto.randomUUID(), createdAt: new Date().toISOString() } as TerraFazenda
      setFazendas(prev => [...prev, nf])
      setActiveFazendaId(nf.id)
    }
    setShowFazendaForm(false)
    setEditFazendaId(null)
    setFazForm(emptyFazenda)
  }
  const editFazenda = (f: TerraFazenda) => {
    setFazForm({ ...f })
    setEditFazendaId(f.id)
    setShowFazendaForm(true)
    setTab('fazendas')
  }
  const deleteFazenda = (id: string) => {
    setFazendas(prev => prev.filter(f => f.id !== id))
    setTalhoes(prev => prev.filter(t => t.fazendaId !== id))
    setNotas(prev => prev.filter(n => n.fazendaId !== id))
    if (activeFazendaId === id) setActiveFazendaId(null)
  }

  // ─── Talhão CRUD
  const saveTalhao = () => {
    if (!talForm.nome.trim() || !fazenda) return
    const cor = talForm.cor || TALHAO_USOS.find(u => u.value === talForm.uso)?.cor || '#6b7280'
    if (editTalhaoId) {
      setTalhoes(prev => prev.map(t => t.id === editTalhaoId ? { ...t, ...talForm, cor } : t))
    } else {
      const nt: TerraTalhao = { ...talForm, cor, fazendaId: fazenda.id, id: crypto.randomUUID(), createdAt: new Date().toISOString() } as TerraTalhao
      setTalhoes(prev => [...prev, nt])
    }
    setShowTalhaoForm(false)
    setEditTalhaoId(null)
    setTalForm(emptyTalhao)
  }
  const editTalhao = (t: TerraTalhao) => {
    setTalForm({ ...t })
    setEditTalhaoId(t.id)
    setShowTalhaoForm(true)
  }
  const deleteTalhao = (id: string) => { setTalhoes(prev => prev.filter(t => t.id !== id)) }

  // ─── Notas CRUD
  const saveNota = () => {
    if (!notaForm.titulo.trim() || !fazenda) return
    if (editNotaId) {
      setNotas(prev => prev.map(n => n.id === editNotaId ? { ...n, ...notaForm } : n))
    } else if (pendingNotaLatLng) {
      const nn: TerraNote = {
        id: crypto.randomUUID(), fazendaId: fazenda.id,
        lat: pendingNotaLatLng[0], lng: pendingNotaLatLng[1],
        ...notaForm, createdAt: new Date().toISOString(),
      }
      setNotas(prev => [...prev, nn])
    }
    setShowNotaForm(false); setEditNotaId(null); setPendingNotaLatLng(null)
    setNotaForm({ titulo: '', conteudo: '', cor: '#3b82f6', icone: 'geral', fotoUrl: '' })
  }
  const editNota = (n: TerraNote) => {
    setNotaForm({ titulo: n.titulo, conteudo: n.conteudo, cor: n.cor, icone: n.icone, fotoUrl: n.fotoUrl || '' })
    setEditNotaId(n.id); setShowNotaForm(true)
  }
  const deleteNota = (id: string) => { if (window.confirm('Excluir esta nota?')) setNotas(prev => prev.filter(n => n.id !== id)) }

  // ─── Map
  useEffect(() => {
    if (tab !== 'mapa' || !mapRef.current || leafletMap.current) return
    const center: [number, number] = fazenda ? [fazenda.latitude, fazenda.longitude] : [-15.78, -47.93]
    const map = L.map(mapRef.current).setView(center, fazenda ? 14 : 4)
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' })
    osm.addTo(map)
    tileRef.current = osm
    layerGroup.current = L.layerGroup().addTo(map)
    drawMarkersRef.current = L.layerGroup().addTo(map)
    notasLayerRef.current = L.layerGroup().addTo(map)
    leafletMap.current = map
    return () => { map.remove(); leafletMap.current = null; drawMarkersRef.current = null; notasLayerRef.current = null }
  }, [tab])

  useEffect(() => {
    if (leafletMap.current) setTimeout(() => leafletMap.current?.invalidateSize(), 200)
  }, [showMapSidebar])

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


  const initialViewSet = useRef(false)
  useEffect(() => {
    if (!leafletMap.current || !layerGroup.current) return
    layerGroup.current.clearLayers()
    const isDrawing = drawMode !== 'none'
    if (fazenda && fazenda.perimetro.length >= 3 && editingMapTalhaoId !== '__perimetro__') {
      const perimPoly = L.polygon(fazenda.perimetro, { color: '#dc2626', weight: 3, fillOpacity: 0.04, dashArray: '8 4', interactive: !isDrawing && !editingMapTalhaoId })
      if (!isDrawing && !editingMapTalhaoId) perimPoly.bindPopup(`<div style="font-family:system-ui;min-width:200px"><strong style="font-size:14px">${fazenda.nome}</strong><br/><span style="color:#888">${fazenda.municipio} — ${fazenda.uf}</span><hr style="margin:6px 0;border:0;border-top:1px solid #ddd"/><b>Área Total:</b> ${fmtHa(fazenda.areaTotal)}<br/><b>Área Útil:</b> ${fmtHa(fazenda.areaUtil)}<br/><b>Reserva Legal:</b> ${fmtHa(fazenda.areaReservaLegal)} (${(fazenda.areaReservaLegal/fazenda.areaTotal*100).toFixed(1)}%)<br/><b>Bioma:</b> ${fazenda.bioma}<br/><b>Relevo:</b> ${fazenda.relevo}</div>`)
      perimPoly.addTo(layerGroup.current)
    }
    fazTalhoes.forEach(t => {
      if (t.poligono.length >= 3 && !hiddenTalhoes.has(t.id) && t.id !== editingMapTalhaoId) {
        const usoInfo = TALHAO_USOS.find(u => u.value === t.uso)
        const cor = t.cor || usoInfo?.cor || '#6b7280'
        const pctArea = fazenda ? ((t.areaHa / fazenda.areaTotal) * 100).toFixed(1) : '—'
        const poly = L.polygon(t.poligono, { color: cor, weight: 1.5, fillColor: cor, fillOpacity: adminTalhaoOpacity, interactive: !isDrawing && !editingMapTalhaoId })
        if (!isDrawing && !editingMapTalhaoId) poly.bindPopup(`<div style="font-family:system-ui;min-width:180px"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="background:${cor};color:#fff;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600">${usoInfo?.label || t.uso}</span></div><strong style="font-size:14px">${t.nome}</strong><hr style="margin:6px 0;border:0;border-top:1px solid #ddd"/><b>Área:</b> ${fmtHa(t.areaHa)} (${pctArea}% da fazenda)${t.cultura ? '<br/><b>Cultura:</b> ' + t.cultura : ''}${t.safra ? '<br/><b>Safra:</b> ' + t.safra : ''}${t.notas ? '<br/><span style="color:#888;font-size:12px">' + t.notas + '</span>' : ''}</div>`)
        poly.addTo(layerGroup.current!)
      }
    })
    if (fazenda && !initialViewSet.current) {
      leafletMap.current.setView([fazenda.latitude, fazenda.longitude], 14)
      initialViewSet.current = true
    }
  }, [fazenda, fazTalhoes, tab, hiddenTalhoes, drawMode, editingMapTalhaoId, adminTalhaoOpacity])

  useEffect(() => {
    if (tab !== 'visao' || !fazenda || !miniMapRef.current) return
    if (miniMapInstance.current) { miniMapInstance.current.remove(); miniMapInstance.current = null }
    const map = L.map(miniMapRef.current, {
      zoomControl: false, dragging: false, scrollWheelZoom: false,
      doubleClickZoom: false, touchZoom: false, boxZoom: false,
      keyboard: false, attributionControl: false,
    })
    L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 20 }).addTo(map)
    if (fazenda.perimetro.length >= 3) {
      const perim = L.polygon(fazenda.perimetro, { color: '#dc2626', weight: 2, fillOpacity: 0.08, dashArray: '6 3' }).addTo(map)
      fazTalhoes.forEach(t => {
        if (t.poligono.length >= 3) {
          const cor = t.cor || TALHAO_USOS.find(u => u.value === t.uso)?.cor || '#6b7280'
          L.polygon(t.poligono, { color: cor, weight: 1, fillColor: cor, fillOpacity: 0.15 }).addTo(map)
        }
      })
      map.fitBounds(perim.getBounds(), { padding: [10, 10] })
    } else {
      map.setView([fazenda.latitude, fazenda.longitude], 14)
    }
    miniMapInstance.current = map
    setTimeout(() => map.invalidateSize(), 150)
    return () => { map.remove(); miniMapInstance.current = null }
  }, [tab, fazenda, fazTalhoes])

  // Render note markers
  useEffect(() => {
    if (!leafletMap.current || !notasLayerRef.current) return
    notasLayerRef.current.clearLayers()
    if (hiddenNotas) return
    fazNotas.forEach(n => {
      const catInfo = NOTA_CATEGORIAS.find(c => c.value === n.icone)
      const cor = n.cor || catInfo?.cor || '#6b7280'
      const emoji = catInfo?.emoji || '📝'
      const icon = L.divIcon({
        className: 'terra-nota-icon',
        html: `<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;background:${cor};transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.35);border:2px solid #fff"><span style="transform:rotate(45deg);font-size:14px">${emoji}</span></div>`,
        iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -34],
      })
      const marker = L.marker([n.lat, n.lng], { icon })
      marker.bindPopup(`<div style="font-family:system-ui;min-width:180px"><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="background:${cor};color:#fff;padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600">${catInfo?.label || n.icone}</span></div><strong style="font-size:14px">${n.titulo}</strong>${n.conteudo ? `<hr style="margin:6px 0;border:0;border-top:1px solid #ddd"/><span style="color:#666;font-size:12px;white-space:pre-wrap">${n.conteudo}</span>` : ''}${n.fotoUrl ? `<hr style="margin:6px 0;border:0;border-top:1px solid #ddd"/><img src="${n.fotoUrl}" style="max-width:200px;max-height:150px;border-radius:6px;cursor:pointer" onclick="window.open(this.src,'_blank')"/>` : ''}<div style="margin-top:6px;font-size:10px;color:#999">${new Date(n.createdAt).toLocaleDateString('pt-BR')}</div></div>`)
      marker.addTo(notasLayerRef.current!)
    })
  }, [fazNotas, hiddenNotas])

  // Draw mode: click handler
  useEffect(() => {
    const map = leafletMap.current
    if (!map) return
    if (drawMode === 'none') {
      map.getContainer().style.cursor = ''
      return
    }
    map.getContainer().style.cursor = 'crosshair'
    map.closePopup()
    if (drawMode === 'nota') {
      const onClick = (e: L.LeafletMouseEvent) => {
        const lat = parseFloat(e.latlng.lat.toFixed(6))
        const lng = parseFloat(e.latlng.lng.toFixed(6))
        setPendingNotaLatLng([lat, lng])
        setNotaForm({ titulo: '', conteudo: '', cor: '#3b82f6', icone: 'geral', fotoUrl: '' })
        setShowNotaForm(true)
        setDrawMode('none')
      }
      map.on('click', onClick)
      return () => { map.off('click', onClick); map.getContainer().style.cursor = '' }
    }
    const onClick = (e: L.LeafletMouseEvent) => {
      const pt: [number, number] = [parseFloat(e.latlng.lat.toFixed(6)), parseFloat(e.latlng.lng.toFixed(6))]
      setDrawPoints(prev => {
        const next = [...prev, pt]
        if (drawLayerRef.current) map.removeLayer(drawLayerRef.current)
        drawLayerRef.current = L.polyline(next, { color: drawMode === 'perimetro' ? '#dc2626' : '#f59e0b', weight: 3, dashArray: '6 4' }).addTo(map)
        L.circleMarker(pt, { radius: 5, color: '#fff', fillColor: drawMode === 'perimetro' ? '#dc2626' : '#f59e0b', fillOpacity: 1, weight: 2 }).addTo(drawMarkersRef.current!)
        return next
      })
    }
    map.on('click', onClick)
    return () => { map.off('click', onClick); map.getContainer().style.cursor = '' }
  }, [drawMode])

  const finishDraw = () => {
    if (drawPoints.length < 3) return
    if (drawMode === 'perimetro' && fazenda) {
      const center = drawPoints.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]] as [number, number], [0, 0] as [number, number])
      const lat = center[0] / drawPoints.length
      const lng = center[1] / drawPoints.length
      setFazendas(prev => prev.map(f => f.id === fazenda.id ? { ...f, perimetro: drawPoints, latitude: lat, longitude: lng } : f))
    } else if (drawMode === 'talhao' && drawTalhaoId) {
      setTalhoes(prev => prev.map(t => t.id === drawTalhaoId ? { ...t, poligono: drawPoints } : t))
    }
    cancelDraw()
  }
  const cancelDraw = () => {
    if (drawLayerRef.current && leafletMap.current) leafletMap.current.removeLayer(drawLayerRef.current)
    drawLayerRef.current = null
    if (drawMarkersRef.current) drawMarkersRef.current.clearLayers()
    setDrawMode('none')
    setDrawPoints([])
    setDrawTalhaoId(null)
  }
  const undoDrawPoint = () => {
    setDrawPoints(prev => {
      const next = prev.slice(0, -1)
      if (drawLayerRef.current && leafletMap.current) leafletMap.current.removeLayer(drawLayerRef.current)
      drawLayerRef.current = null
      if (drawMarkersRef.current) drawMarkersRef.current.clearLayers()
      if (next.length > 0 && leafletMap.current) {
        drawLayerRef.current = L.polyline(next, { color: drawMode === 'perimetro' ? '#dc2626' : '#f59e0b', weight: 3, dashArray: '6 4' }).addTo(leafletMap.current)
        next.forEach(p => L.circleMarker(p, { radius: 5, color: '#fff', fillColor: drawMode === 'perimetro' ? '#dc2626' : '#f59e0b', fillOpacity: 1, weight: 2 }).addTo(drawMarkersRef.current!))
      }
      return next
    })
  }

  // ─── Map polygon editing (drag vertices to reshape/move)
  const PERIM_EDIT_ID = '__perimetro__'
  const startEditMapTalhao = (talhaoId: string) => {
    if (talhaoId === PERIM_EDIT_ID) {
      if (!fazenda || fazenda.perimetro.length < 3) return
      setEditingMapTalhaoId(PERIM_EDIT_ID)
      editCoordsRef.current = [...fazenda.perimetro]
      setEditVersion(v => v + 1)
      return
    }
    const t = talhoes.find(x => x.id === talhaoId)
    if (!t || t.poligono.length < 3) return
    setEditingMapTalhaoId(talhaoId)
    editCoordsRef.current = [...t.poligono]
    setEditVersion(v => v + 1)
  }

  const buildEditLayer = useCallback(() => {
    const map = leafletMap.current
    if (!map) return
    if (!editLayerRef.current) editLayerRef.current = L.layerGroup().addTo(map)
    editLayerRef.current.clearLayers()
    editPolyRef.current = null
    const coords = editCoordsRef.current
    if (coords.length < 3) return
    const isPerimEdit = editingMapTalhaoId === PERIM_EDIT_ID
    const talhao = isPerimEdit ? null : talhoes.find(t => t.id === editingMapTalhaoId)
    const cor = isPerimEdit ? '#dc2626' : (talhao?.cor || '#f59e0b')

    const poly = L.polygon(coords, { color: cor, weight: 3, fillColor: cor, fillOpacity: 0.25, dashArray: '6 3' })
    poly.addTo(editLayerRef.current)
    editPolyRef.current = poly

    const vertexIcon = (color: string) => L.divIcon({
      className: 'terra-vertex-icon',
      html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);cursor:grab"></div>`,
      iconSize: [14, 14], iconAnchor: [7, 7]
    })
    const midIcon = (color: string) => L.divIcon({
      className: 'terra-mid-icon',
      html: `<div style="width:10px;height:10px;border-radius:50%;background:#fff;border:2px solid ${color};opacity:.7;cursor:copy"></div>`,
      iconSize: [10, 10], iconAnchor: [5, 5]
    })

    coords.forEach((c, i) => {
      const m = L.marker(c, { draggable: true, icon: vertexIcon(cor), zIndexOffset: 1000 })
      m.addTo(editLayerRef.current!)
      m.on('drag', () => {
        const pos = m.getLatLng()
        editCoordsRef.current = editCoordsRef.current.map((cc, j) => j === i ? [pos.lat, pos.lng] as [number, number] : cc)
        editPolyRef.current?.setLatLngs(editCoordsRef.current)
      })
      m.on('dragend', () => { setEditVersion(v => v + 1) })
    })

    coords.forEach((c, i) => {
      const next = coords[(i + 1) % coords.length]
      const mid: [number, number] = [(c[0] + next[0]) / 2, (c[1] + next[1]) / 2]
      const mm = L.marker(mid, { icon: midIcon(cor), zIndexOffset: 900 })
      mm.addTo(editLayerRef.current!)
      mm.on('click', () => {
        editCoordsRef.current = [...editCoordsRef.current.slice(0, i + 1), mid, ...editCoordsRef.current.slice(i + 1)]
        setEditVersion(v => v + 1)
      })
    })
  }, [editingMapTalhaoId, talhoes])

  useEffect(() => {
    if (!leafletMap.current) return
    if (editingMapTalhaoId) {
      buildEditLayer()
    } else if (editLayerRef.current) {
      editLayerRef.current.clearLayers()
      leafletMap.current.removeLayer(editLayerRef.current)
      editLayerRef.current = null
      editPolyRef.current = null
    }
  }, [editingMapTalhaoId, editVersion, buildEditLayer])

  const saveEditMapTalhao = () => {
    if (!editingMapTalhaoId || editCoordsRef.current.length < 3) return
    if (editingMapTalhaoId === PERIM_EDIT_ID && fazenda) {
      const pts = [...editCoordsRef.current]
      const center = pts.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]] as [number, number], [0, 0] as [number, number])
      setFazendas(prev => prev.map(f => f.id === fazenda.id ? { ...f, perimetro: pts, latitude: center[0] / pts.length, longitude: center[1] / pts.length } : f))
    } else {
      setTalhoes(prev => prev.map(t => t.id === editingMapTalhaoId ? { ...t, poligono: [...editCoordsRef.current] } : t))
    }
    setEditingMapTalhaoId(null)
    editCoordsRef.current = []
  }
  const cancelEditMapTalhao = () => {
    setEditingMapTalhaoId(null)
    editCoordsRef.current = []
  }
  const deleteEditVertex = () => {
    if (editCoordsRef.current.length <= 3) return
    editCoordsRef.current = editCoordsRef.current.slice(0, -1)
    setEditVersion(v => v + 1)
  }

  // ─── Pie chart SVG (land use distribution)
  const pieData = useMemo(() => {
    if (!fazenda) return []
    if (fazTalhoes.length > 0) {
      return fazTalhoes.map(t => {
        const usoInfo = TALHAO_USOS.find(u => u.value === t.uso)
        return { label: t.nome, value: t.areaHa, cor: t.cor || usoInfo?.cor || '#6b7280' }
      }).filter(i => i.value > 0)
    }
    const items: { label: string; value: number; cor: string }[] = [
      { label: 'Lavoura', value: fazenda.areaLavoura, cor: '#f59e0b' },
      { label: 'Pastagem', value: fazenda.areaPastagem, cor: '#22c55e' },
      { label: 'Reserva Legal', value: fazenda.areaReservaLegal, cor: '#166534' },
      { label: 'APP', value: fazenda.areaApp, cor: '#0d9488' },
      { label: 'Reflorestamento', value: fazenda.areaReflorestamento, cor: '#65a30d' },
      { label: 'Benfeitorias', value: fazenda.areaBenfeitorias, cor: '#8b5cf6' },
    ].filter(i => i.value > 0)
    return items
  }, [fazenda, fazTalhoes])

  const pieSlices = useMemo(() => {
    const total = pieData.reduce((s, i) => s + i.value, 0)
    if (!total) return []
    let cum = 0
    return pieData.map(item => {
      const start = cum / total
      cum += item.value
      const end = cum / total
      const startAngle = start * 2 * Math.PI - Math.PI / 2
      const endAngle = end * 2 * Math.PI - Math.PI / 2
      const large = end - start > 0.5 ? 1 : 0
      const r = 50
      const x1 = 60 + r * Math.cos(startAngle)
      const y1 = 60 + r * Math.sin(startAngle)
      const x2 = 60 + r * Math.cos(endAngle)
      const y2 = 60 + r * Math.sin(endAngle)
      return { ...item, d: `M60,60 L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} Z`, pct: ((item.value / total) * 100).toFixed(1) }
    })
  }, [pieData])

  // ─── Render helpers
  const renderField = (label: string, children: React.ReactNode, span2 = false) => (
    <div className={`terra-field${span2 ? ' terra-span2' : ''}`}><label>{label}</label>{children}</div>
  )

  // ─── VISÃO GERAL
  const renderVisao = () => {
    if (!fazenda) return <div className="terra-empty"><p>Nenhuma fazenda cadastrada.</p><button className="terra-btn-primary" onClick={() => { setTab('fazendas'); setShowFazendaForm(true) }}>+ Adicionar Fazenda</button></div>
    return (
      <div className="terra-visao">
        <div className="terra-summary">
          <div className="terra-card-stat"><span className="terra-stat-label">Área Total</span><span className="terra-stat-value">{fmtHa(fazenda.areaTotal)}</span></div>
          <div className="terra-card-stat"><span className="terra-stat-label">Área Útil</span><span className="terra-stat-value">{fmtHa(fazenda.areaUtil)}</span><span className="terra-stat-sub">{grauUtil.toFixed(1)}% de utilização</span></div>
          <div className="terra-card-stat"><span className="terra-stat-label">Reserva + APP</span><span className="terra-stat-value">{fmtHa(fazenda.areaReservaLegal + fazenda.areaApp)}</span><span className={`terra-stat-sub ${reservaPct >= reservaMinPct ? 'terra-ok' : 'terra-warn'}`}>{reservaPct.toFixed(1)}% (mín. {reservaMinPct}%)</span></div>
          <div className="terra-card-stat"><span className="terra-stat-label">Talhões</span><span className="terra-stat-value">{fazTalhoes.length}</span><span className="terra-stat-sub">{fmtHa(somaTalhoes)} mapeados</span></div>
        </div>

        <div className="terra-minimap-card" onClick={() => setTab('mapa')} title="Clique para abrir o mapa completo">
          <div className="terra-minimap-container" ref={miniMapRef} />
          <div className="terra-minimap-overlay">
            <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path d="M10 2a6 6 0 00-6 6c0 4.5 6 10 6 10s6-5.5 6-10a6 6 0 00-6-6zm0 8.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/></svg>
            Ver mapa completo
          </div>
        </div>

        <div className="terra-visao-grid">
          <div className="terra-chart-card">
            <h4>Distribuição de Uso</h4>
            {pieSlices.length ? (
              <div className="terra-pie-wrap">
                <svg viewBox="0 0 200 200" className="terra-donut">
                  {pieSlices.map((s, i) => {
                    const total = pieData.reduce((acc, it) => acc + it.value, 0)
                    const startFrac = pieData.slice(0, i).reduce((acc, it) => acc + it.value, 0) / total
                    const frac = s.value / total
                    const r = 70
                    const circ = 2 * Math.PI * r
                    return <circle key={i} cx="100" cy="100" r={r} fill="none" stroke={s.cor} strokeWidth="32" strokeDasharray={`${frac * circ} ${circ}`} strokeDashoffset={-startFrac * circ} transform="rotate(-90 100 100)" />
                  })}
                  <circle cx="100" cy="100" r="54" fill="var(--bg2)" />
                  <text x="100" y="96" textAnchor="middle" fill="var(--text3)" fontSize="22" fontWeight="700">{pieSlices.length}</text>
                  <text x="100" y="114" textAnchor="middle" fill="var(--text)" fontSize="10">talhões</text>
                </svg>
                <div className="terra-legend">
                  {pieSlices.map((s, i) => <div key={i} className="terra-legend-item"><span className="terra-legend-dot" style={{ background: s.cor }} /><span className="terra-legend-label">{s.label}</span><span className="terra-legend-pct">{s.pct}%</span></div>)}
                </div>
              </div>
            ) : <p className="terra-muted">Preencha as áreas da fazenda para ver a distribuição.</p>}
          </div>

          <div className="terra-chart-card">
            <h4>Reserva Legal</h4>
            <div className="terra-reserve-bar">
              <div className="terra-reserve-fill" style={{ width: `${Math.min(reservaPct, 100)}%`, background: reservaPct >= reservaMinPct ? '#22c55e' : '#ef4444' }} />
              <div className="terra-reserve-mark" style={{ left: `${reservaMinPct}%` }} title={`Mínimo: ${reservaMinPct}%`} />
            </div>
            <div className="terra-reserve-labels">
              <span>{reservaPct.toFixed(1)}% atual</span>
              <span>Mínimo: {reservaMinPct}%</span>
            </div>
            <div className="terra-info-row"><span>Bioma:</span> <strong>{fazenda.bioma || '—'}</strong></div>
            <div className="terra-info-row"><span>Solo:</span> <strong>{fazenda.tipoSolo || '—'}</strong></div>
            <div className="terra-info-row"><span>Relevo:</span> <strong>{fazenda.relevo || '—'}</strong></div>
          </div>
        </div>

        {(fazenda.valorVenal || fazenda.valorMercado) && (
          <div className="terra-valor-row">
            {fazenda.valorVenal && (
              <div className="terra-card-stat">
                <span className="terra-stat-label">Valor Venal <button className="terra-eye-toggle" onClick={() => setShowValores(v => !v)} title={showValores ? 'Ocultar valores' : 'Mostrar valores'}><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">{showValores ? <><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="10" cy="10" r="3"/></> : <><path d="M1 10s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><path d="M3 17L17 3" strokeLinecap="round"/></>}</svg></button></span>
                <span className="terra-stat-value">{showValores ? `R$ ${fazenda.valorVenal}` : '••••••'}</span>
              </div>
            )}
            {fazenda.valorMercado && (
              <div className="terra-card-stat">
                <span className="terra-stat-label">Valor de Mercado</span>
                <span className="terra-stat-value">{showValores ? `R$ ${fazenda.valorMercado}` : '••••••'}</span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ─── MAPA
  const renderMapa = () => (
    <div className="terra-mapa">
      <div className="terra-map-layout">
        <div ref={mapRef} className="terra-map-container">
          <div className="terra-map-overlay-tl">
            {(['mapa', 'satelite', 'relevo'] as const).map(l => (
              <button key={l} className={`terra-map-toggle ${mapLayer === l ? 'active' : ''}`} onClick={() => setMapLayer(l)}>
                {{ mapa: 'Mapa', satelite: 'Satélite', relevo: 'Relevo' }[l]}
              </button>
            ))}
          </div>
          {drawMode === 'none' && !editingMapTalhaoId && (
            <div className="terra-map-overlay-tr">
              <span className={`terra-sync-status${isSyncing ? ' syncing' : ''}`}>
                {isSyncing ? (
                  <>
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" className="terra-spin"><path d="M2 8a6 6 0 0110.47-4M14 8a6 6 0 01-10.47 4" strokeLinecap="round"/></svg>
                    Salvando...
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 14 14" width="12" height="12" fill="none"><path d="M2 7l4 4 6-6" stroke="#0f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Salvo
                  </>
                )}
              </span>
              <button className={`terra-btn-draw terra-btn-share${shareCopied ? ' copied' : ''}`} onClick={() => {
                const base = window.location.origin + window.location.pathname
                const url = userId ? `${base}#/mapa/${userId}` : `${base}#/mapa`
                navigator.clipboard.writeText(url).then(() => { setShareCopied(true); setTimeout(() => setShareCopied(false), 2500) })
              }}>
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="3" r="2"/><circle cx="4" cy="8" r="2"/><circle cx="12" cy="13" r="2"/><path d="M5.8 9l4.4 3M5.8 7l4.4-3"/></svg>
                {shareCopied ? 'Link copiado!' : 'Compartilhar Mapa'}
              </button>
              {!showQuickTalhao && (
                <button className={`terra-btn-draw${terraEditMode ? ' terra-btn-edit-active' : ''}`} onClick={() => setTerraEditMode(v => !v)}>
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 14h3l9-9-3-3-9 9v3z" strokeLinejoin="round"/></svg>
                  {terraEditMode ? 'Sair da Edição' : 'Editar Mapa'}
                </button>
              )}
            </div>
          )}
          {terraEditMode && drawMode === 'none' && fazenda && !showQuickTalhao && !editingMapTalhaoId && (
            <div className="terra-map-overlay-bottom">
              <div className="terra-draw-bar">
                <button className="terra-btn-draw" onClick={() => { setDrawMode('perimetro'); setDrawPoints([]) }}>
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="2,14 8,2 14,14" strokeLinejoin="round"/></svg>
                  {fazenda && fazenda.perimetro.length >= 3 ? 'Redesenhar Perímetro' : 'Desenhar Perímetro'}
                </button>
                {fazenda && fazenda.perimetro.length >= 3 && (
                  <button className="terra-btn-draw terra-btn-edit-active" onClick={() => startEditMapTalhao(PERIM_EDIT_ID)}>
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8a6 6 0 1112 0A6 6 0 012 8z"/><circle cx="5" cy="8" r="1" fill="currentColor"/><circle cx="8" cy="5" r="1" fill="currentColor"/><circle cx="11" cy="8" r="1" fill="currentColor"/><circle cx="8" cy="11" r="1" fill="currentColor"/></svg>
                    Editar Perímetro
                  </button>
                )}
                {fazenda && fazenda.perimetro.length >= 3 && (
                  <button className="terra-btn-draw terra-btn-danger" onClick={() => { if (window.confirm('Limpar o perímetro atual? Os talhões não serão afetados.')) setFazendas(prev => prev.map(f => f.id === fazenda.id ? { ...f, perimetro: [] } : f)) }} title="Limpar perímetro desenhado">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l10 10M13 3L3 13" strokeLinecap="round"/></svg>
                    Limpar Perímetro
                  </button>
                )}
                <button className="terra-btn-draw" onClick={() => { setShowQuickTalhao(true); setQuickTalhaoName(''); setQuickTalhaoUso('lavoura') }}>
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="2" strokeLinejoin="round"/><path d="M8 5v6M5 8h6" strokeLinecap="round"/></svg>
                  Desenhar Talhão
                </button>
                {fazTalhoes.length > 0 && (
                  <select className="terra-draw-select" value="" onChange={e => { if (e.target.value) { setDrawTalhaoId(e.target.value); setDrawMode('talhao'); setDrawPoints([]) } }}>
                    <option value="">Redesenhar Talhão...</option>
                    {fazTalhoes.map(t => <option key={t.id} value={t.id}>{t.nome}{t.poligono.length >= 3 ? ' ✓' : ''}</option>)}
                  </select>
                )}
              </div>
            </div>
          )}
          {showQuickTalhao && drawMode === 'none' && (
            <div className="terra-map-overlay-bottom">
              <div className="terra-draw-bar" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                <span style={{ fontSize: 'calc(.78rem * var(--fs))', color: 'var(--text2)', marginBottom: 2 }}>Digite o nome e clique em "Iniciar Desenho":</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input className="terra-quick-input" autoFocus placeholder="Nome do talhão (ex: Talhão 1)" value={quickTalhaoName} onChange={e => setQuickTalhaoName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && quickTalhaoName.trim() && fazenda) { const cor = TALHAO_USOS.find(u => u.value === quickTalhaoUso)?.cor || '#6b7280'; const nt: TerraTalhao = { id: crypto.randomUUID(), fazendaId: fazenda.id, nome: quickTalhaoName.trim(), uso: quickTalhaoUso, areaHa: 0, cultura: '', safra: '', poligono: [], cor, notas: '', publico: true, createdAt: new Date().toISOString() }; setTalhoes(prev => [...prev, nt]); setDrawTalhaoId(nt.id); setDrawMode('talhao'); setDrawPoints([]); setShowQuickTalhao(false) } }} />
                  <select className="terra-draw-select" value={quickTalhaoUso} onChange={e => setQuickTalhaoUso(e.target.value as TalhaoUso)}>
                    {TALHAO_USOS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                  <button className="terra-btn-primary" disabled={!quickTalhaoName.trim()} onClick={() => {
                    if (!quickTalhaoName.trim() || !fazenda) return
                    const cor = TALHAO_USOS.find(u => u.value === quickTalhaoUso)?.cor || '#6b7280'
                    const nt: TerraTalhao = { id: crypto.randomUUID(), fazendaId: fazenda.id, nome: quickTalhaoName.trim(), uso: quickTalhaoUso, areaHa: 0, cultura: '', safra: '', poligono: [], cor, notas: '', publico: true, createdAt: new Date().toISOString() }
                    setTalhoes(prev => [...prev, nt])
                    setDrawTalhaoId(nt.id)
                    setDrawMode('talhao')
                    setDrawPoints([])
                    setShowQuickTalhao(false)
                  }}>Iniciar Desenho</button>
                  <button className="terra-btn-secondary" onClick={() => setShowQuickTalhao(false)}>Cancelar</button>
                </div>
              </div>
            </div>
          )}
          {drawMode === 'nota' && (
            <div className="terra-map-overlay-bottom">
              <div className="terra-draw-bar">
                <span className="terra-draw-label">
                  📌 Clique no mapa para posicionar a nota
                </span>
                <button className="terra-btn-secondary" onClick={cancelDraw}>Cancelar</button>
              </div>
            </div>
          )}
          {(drawMode === 'perimetro' || drawMode === 'talhao') && (
            <div className="terra-map-overlay-bottom">
              <div className="terra-draw-bar">
                <span className="terra-draw-label">
                  {drawMode === 'perimetro' ? 'Desenhando perímetro' : 'Desenhando talhão'} — clique no mapa para adicionar pontos ({drawPoints.length} pontos)
                </span>
                <button className="terra-btn-draw terra-btn-undo" onClick={undoDrawPoint} disabled={drawPoints.length === 0}>Desfazer</button>
                <button className="terra-btn-primary" onClick={finishDraw} disabled={drawPoints.length < 3}>Finalizar</button>
                <button className="terra-btn-secondary" onClick={cancelDraw}>Cancelar</button>
              </div>
            </div>
          )}
          {editingMapTalhaoId && (
            <div className="terra-map-overlay-bottom">
              <div className="terra-draw-bar terra-edit-bar">
                <span className="terra-draw-label">
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 14h3l9-9-3-3-9 9v3z" strokeLinejoin="round"/></svg>
                  Editando <strong>{editingMapTalhaoId === PERIM_EDIT_ID ? 'Perímetro' : talhoes.find(t => t.id === editingMapTalhaoId)?.nome}</strong> — arraste os vértices para mover/redimensionar
                </span>
                <button className="terra-btn-draw terra-btn-undo" onClick={deleteEditVertex} disabled={editCoordsRef.current.length <= 3}>Remover Vértice</button>
                <button className="terra-btn-primary" onClick={saveEditMapTalhao}>Salvar</button>
                <button className="terra-btn-secondary" onClick={cancelEditMapTalhao}>Cancelar</button>
              </div>
            </div>
          )}
          <button className="terra-sidebar-toggle" onClick={() => setShowMapSidebar(v => !v)} title={showMapSidebar ? 'Ocultar painel' : 'Mostrar painel'}>
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5">
              {showMapSidebar
                ? <path d="M10 3l5 5-5 5M1 3v10M4 8h11" strokeLinecap="round" strokeLinejoin="round"/>
                : <path d="M6 3L1 8l5 5M15 3v10M12 8H1" strokeLinecap="round" strokeLinejoin="round"/>}
            </svg>
          </button>
          {/* Floating action buttons on map */}
          {drawMode === 'none' && !editingMapTalhaoId && !showQuickTalhao && fazenda && (
            <div className="terra-map-fab">
              <button className="terra-fab-btn" onClick={() => { setDrawMode('nota'); setDrawPoints([]) }} title="Adicionar Nota">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1C5.24 1 3 3.24 3 6c0 3.75 5 9 5 9s5-5.25 5-9c0-2.76-2.24-5-5-5z" strokeLinejoin="round"/><circle cx="8" cy="6" r="1.5"/></svg>
                <span>Nota</span>
              </button>
              <button className="terra-fab-btn" onClick={() => { setDrawMode('perimetro'); setDrawPoints([]) }} title={fazenda.perimetro.length >= 3 ? 'Redesenhar Perímetro' : 'Desenhar Perímetro'}>
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="2,14 8,2 14,14" strokeLinejoin="round"/></svg>
                <span>Perímetro</span>
              </button>
              {fazenda.perimetro.length >= 3 && (
                <button className="terra-fab-btn" onClick={() => startEditMapTalhao(PERIM_EDIT_ID)} title="Editar Perímetro">
                  <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 8a6 6 0 1112 0A6 6 0 012 8z"/><circle cx="5" cy="8" r="1" fill="currentColor"/><circle cx="8" cy="5" r="1" fill="currentColor"/><circle cx="11" cy="8" r="1" fill="currentColor"/><circle cx="8" cy="11" r="1" fill="currentColor"/></svg>
                  <span>Editar Per.</span>
                </button>
              )}
              <button className="terra-fab-btn" onClick={() => { setShowQuickTalhao(true); setQuickTalhaoName(''); setQuickTalhaoUso('lavoura') }} title="Desenhar Talhão">
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="2" strokeLinejoin="round"/><path d="M8 5v6M5 8h6" strokeLinecap="round"/></svg>
                <span>Talhão</span>
              </button>
            </div>
          )}
          {showNotaForm && (
            <div className="terra-nota-modal" onClick={e => { if (e.target === e.currentTarget) { setShowNotaForm(false); setEditNotaId(null); setPendingNotaLatLng(null) } }}>
              <div className="terra-nota-form">
                <h4>{editNotaId ? 'Editar Nota' : 'Nova Nota'}</h4>
                <div className="terra-fields">
                  {renderField('Título', <input value={notaForm.titulo} onChange={e => setNotaForm(p => ({ ...p, titulo: e.target.value }))} placeholder="Ex: Área com erosão" />)}
                  {renderField('Categoria', <select value={notaForm.icone} onChange={e => {
                    const cat = e.target.value as NotaCategoria
                    const catInfo = NOTA_CATEGORIAS.find(c => c.value === cat)
                    setNotaForm(p => ({ ...p, icone: cat, cor: catInfo?.cor || p.cor }))
                  }}>{NOTA_CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>)}</select>)}
                  {renderField('Cor', <input type="color" value={notaForm.cor} onChange={e => setNotaForm(p => ({ ...p, cor: e.target.value }))} className="terra-color-input-lg" />)}
                  {renderField('Conteúdo', <textarea rows={3} value={notaForm.conteudo} onChange={e => setNotaForm(p => ({ ...p, conteudo: e.target.value }))} placeholder="Descrição detalhada..." />, true)}
                  {renderField('Foto', <div>
                    {notaForm.fotoUrl && <div style={{ marginBottom: 8 }}><img src={notaForm.fotoUrl} style={{ maxWidth: '100%', maxHeight: 120, borderRadius: 6 }} /><button className="terra-btn-secondary" style={{ marginTop: 4, fontSize: 11 }} onClick={() => setNotaForm(p => ({ ...p, fotoUrl: '' }))}>Remover foto</button></div>}
                    <input type="file" accept="image/*" onChange={async e => {
                      const f = e.target.files?.[0]
                      if (!f) return
                      const url = await compressImage(f)
                      setNotaForm(p => ({ ...p, fotoUrl: url }))
                    }} />
                    <span style={{ fontSize: 11, color: '#888' }}>Comprimida automaticamente</span>
                  </div>, true)}
                </div>
                <div className="terra-form-actions">
                  <button className="terra-btn-primary" onClick={saveNota} disabled={!notaForm.titulo.trim()}>Salvar</button>
                  <button className="terra-btn-secondary" onClick={() => { setShowNotaForm(false); setEditNotaId(null); setPendingNotaLatLng(null) }}>Cancelar</button>
                </div>
              </div>
            </div>
          )}
        </div>
        {showMapSidebar && <div className="terra-map-sidebar">
          {fazenda && (
            <div className="terra-sidebar-fazenda">
              <div className="terra-sidebar-fazenda-name">{fazenda.nome}</div>
              {fazenda.municipio && <div className="terra-sidebar-fazenda-loc">{fazenda.municipio}{fazenda.uf ? ` — ${fazenda.uf}` : ''}</div>}
              <div className="terra-sidebar-stats">
                <div className="terra-sidebar-stat">
                  <span className="terra-sidebar-stat-val">{fmtHa(fazenda.areaTotal)}</span>
                  <span className="terra-sidebar-stat-lbl">Área Total</span>
                </div>
                <div className="terra-sidebar-stat">
                  <span className="terra-sidebar-stat-val">{fmtHa(fazenda.areaUtil)}</span>
                  <span className="terra-sidebar-stat-lbl">Área Útil</span>
                </div>
                <div className="terra-sidebar-stat">
                  <span className="terra-sidebar-stat-val">{fmtHa(fazenda.areaReservaLegal + fazenda.areaApp)}</span>
                  <span className="terra-sidebar-stat-lbl">Reserva + APP</span>
                </div>
              </div>
              {fazenda.areaTotal > 0 && (
                <div className="terra-sidebar-utiliz">
                  <div className="terra-sidebar-utiliz-bar">
                    <div className="terra-sidebar-utiliz-fill" style={{ width: `${Math.min(100, (fazenda.areaUtil / fazenda.areaTotal) * 100)}%` }} />
                  </div>
                  <span className="terra-sidebar-utiliz-lbl">{((fazenda.areaUtil / fazenda.areaTotal) * 100).toFixed(0)}% utilização</span>
                </div>
              )}
              <div className="terra-sidebar-meta">
                {fazenda.bioma && <span>{fazenda.bioma}</span>}
                {fazenda.tipoSolo && <span>{fazenda.tipoSolo}</span>}
                {fazenda.relevo && <span>{fazenda.relevo}</span>}
              </div>
            </div>
          )}
          {fazTalhoes.length > 0 && (
            <>
            <div className="terra-map-sidebar-title">
              Talhões ({fazTalhoes.length})
              <button className="terra-toggle-all" onClick={() => {
                if (hiddenTalhoes.size === 0) setHiddenTalhoes(new Set(fazTalhoes.map(t => t.id)))
                else setHiddenTalhoes(new Set())
              }}>{hiddenTalhoes.size === 0 ? 'Ocultar todos' : 'Mostrar todos'}</button>
            </div>
            <div className="terra-sidebar-mapped">
              {somaTalhoes > 0 && fazenda && fazenda.areaTotal > 0 && (
                <span className="terra-sidebar-mapped-lbl">{fmtHa(somaTalhoes)} mapeados ({((somaTalhoes / fazenda.areaTotal) * 100).toFixed(0)}%)</span>
              )}
            </div>
            {fazTalhoes.map(t => {
              const usoInfo = TALHAO_USOS.find(u => u.value === t.uso)
              const drawn = t.poligono.length >= 3
              const visible = !hiddenTalhoes.has(t.id)
              const cor = t.cor || usoInfo?.cor || '#6b7280'
              const pct = fazenda && fazenda.areaTotal > 0 ? ((t.areaHa / fazenda.areaTotal) * 100).toFixed(1) : '—'
              return (
                <div key={t.id} className={`terra-map-talhao-item${!visible ? ' terra-talhao-hidden' : ''}`}>
                  <div className="terra-sidebar-color-dot" style={{ background: cor }} />
                  <div className="terra-map-talhao-info">
                    <div className="terra-sidebar-row1">
                      <strong>{t.nome}</strong>
                      <span className="terra-sidebar-area">{fmtHa(t.areaHa)}</span>
                    </div>
                    <div className="terra-sidebar-row2">
                      <span className="terra-talhao-badge" style={{ background: cor, fontSize: 'calc(.6rem * var(--fs))', padding: '1px 8px' }}>{usoInfo?.label}</span>
                      <span className="terra-sidebar-pct">{pct}%{t.cultura ? ` · ${t.cultura}` : ''}</span>
                    </div>
                    <div className="terra-sidebar-row3">
                      <input type="checkbox" checked={visible} onChange={() => setHiddenTalhoes(prev => {
                        const next = new Set(prev)
                        if (next.has(t.id)) next.delete(t.id); else next.add(t.id)
                        return next
                      })} className="terra-talhao-check" style={{ accentColor: cor }} title={visible ? 'Ocultar' : 'Mostrar'} />
                      {terraEditMode && (
                        <>
                          <input type="color" value={cor} onChange={e => setTalhoes(prev => prev.map(x => x.id === t.id ? { ...x, cor: e.target.value } : x))} className="terra-color-swatch" title="Alterar cor" />
                          {drawMode === 'none' && !showQuickTalhao && !editingMapTalhaoId && (
                            <>
                              <span className="terra-sidebar-action-sep" />
                              {drawn && (
                                <button className="terra-btn-draw-sm terra-btn-edit-map" onClick={() => startEditMapTalhao(t.id)} title="Editar no mapa">
                                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="10" height="10" rx="1" strokeDasharray="3 2"/><circle cx="3" cy="3" r="1.5" fill="currentColor" stroke="none"/><circle cx="13" cy="3" r="1.5" fill="currentColor" stroke="none"/><circle cx="3" cy="13" r="1.5" fill="currentColor" stroke="none"/><circle cx="13" cy="13" r="1.5" fill="currentColor" stroke="none"/></svg>
                                </button>
                              )}
                              <button className="terra-btn-draw-sm" onClick={() => { setDrawTalhaoId(t.id); setDrawMode('talhao'); setDrawPoints([]) }} title={drawn ? 'Redesenhar' : 'Desenhar'}>
                                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 2l3 3-9 9H2v-3z" strokeLinejoin="round"/></svg>
                              </button>
                              {drawn && (
                                <button className="terra-btn-draw-sm terra-btn-clear-poly" onClick={() => setTalhoes(prev => prev.map(x => x.id === t.id ? { ...x, poligono: [] } : x))} title="Limpar polígono">
                                  <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 14h7M3.5 10.5l7-7 3 3-5 5H5.5L3.5 10.5z" strokeLinejoin="round"/></svg>
                                </button>
                              )}
                              <button className="terra-btn-draw-sm terra-btn-del-talhao" onClick={() => deleteTalhao(t.id)} title="Excluir">
                                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h8v9a1 1 0 01-1 1H5a1 1 0 01-1-1V4zM6 2h4M3 4h10" strokeLinecap="round" strokeLinejoin="round"/></svg>
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            <div className="terra-map-legend-section">
              {TALHAO_USOS.filter(u => fazTalhoes.some(t => t.uso === u.value)).map(u => (
                <span key={u.value} className="terra-legend-item"><span className="terra-legend-dot" style={{ background: u.cor }} />{u.label}</span>
              ))}
            </div>
            </>
          )}
          {!fazTalhoes.length && fazenda && <p className="terra-muted" style={{ padding: '8px 0', fontSize: 'calc(.75rem * var(--fs))' }}>Nenhum talhão cadastrado.</p>}
          {fazenda && (
            <>
            <div className="terra-map-sidebar-title">
              Notas ({fazNotas.length})
              {fazNotas.length > 0 && (
                <button className="terra-toggle-all" onClick={() => setHiddenNotas(v => !v)}>
                  {hiddenNotas ? 'Mostrar' : 'Ocultar'}
                </button>
              )}
            </div>
            {fazNotas.map(n => {
              const catInfo = NOTA_CATEGORIAS.find(c => c.value === n.icone)
              return (
                <div key={n.id} className="terra-map-nota-item" onClick={() => {
                  if (leafletMap.current) leafletMap.current.setView([n.lat, n.lng], 16)
                }}>
                  <div className="terra-nota-dot" style={{ background: n.cor || catInfo?.cor }}>
                    {catInfo?.emoji || '📝'}
                  </div>
                  <div className="terra-map-talhao-info">
                    <strong style={{ fontSize: 'calc(.78rem * var(--fs))' }}>{n.titulo}</strong>
                    <div className="terra-sidebar-row2">
                      <span className="terra-talhao-badge" style={{ background: n.cor || catInfo?.cor, fontSize: 'calc(.6rem * var(--fs))', padding: '1px 8px' }}>{catInfo?.label}</span>
                      <span className="terra-sidebar-pct">{new Date(n.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                    {terraEditMode && drawMode === 'none' && !editingMapTalhaoId && (
                      <div className="terra-sidebar-row3">
                        <button className="terra-btn-draw-sm" onClick={e => { e.stopPropagation(); editNota(n) }} title="Editar">
                          <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M11 2l3 3-9 9H2v-3z" strokeLinejoin="round"/></svg>
                        </button>
                        <button className="terra-btn-draw-sm terra-btn-del-talhao" onClick={e => { e.stopPropagation(); deleteNota(n.id) }} title="Excluir">
                          <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4h8v9a1 1 0 01-1 1H5a1 1 0 01-1-1V4zM6 2h4M3 4h10" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {!fazNotas.length && <p className="terra-muted" style={{ padding: '4px 0', fontSize: 'calc(.7rem * var(--fs))' }}>Nenhuma nota no mapa.</p>}
            </>
          )}
          <div className="terra-opacity-slider">
            <label>Opacidade <span>{Math.round(adminTalhaoOpacity * 100)}%</span></label>
            <input type="range" min="0" max="100" value={Math.round(adminTalhaoOpacity * 100)} onChange={e => setAdminTalhaoOpacity(Number(e.target.value) / 100)} />
          </div>
        </div>}
      </div>
      {!fazenda && <p className="terra-muted" style={{ marginTop: 12 }}>Cadastre uma fazenda com coordenadas para ver no mapa.</p>}
    </div>
  )

  // ─── TALHÕES
  const renderTalhoes = () => (
    <div className="terra-talhoes">
      <div className="terra-section-header">
        <h4>Talhões{fazenda ? ` — ${fazenda.nome}` : ''}</h4>
        <button className="terra-btn-primary" onClick={() => { setTalForm(emptyTalhao); setEditTalhaoId(null); setShowTalhaoForm(true) }} disabled={!fazenda}>+ Novo Talhão</button>
      </div>
      {fazenda && fazenda.areaTotal > 0 && somaTalhoes > fazenda.areaTotal && (
        <div className="terra-alert">Soma dos talhões ({fmtHa(somaTalhoes)}) excede a área total ({fmtHa(fazenda.areaTotal)})</div>
      )}
      {showTalhaoForm && (
        <div className="terra-form">
          <div className="terra-fields">
            {renderField('Nome', <input value={talForm.nome} onChange={e => setTalForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Talhão 3" />)}
            {renderField('Uso', <select value={talForm.uso} onChange={e => setTalForm(p => ({ ...p, uso: e.target.value as TalhaoUso }))}>{TALHAO_USOS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}</select>)}
            {renderField('Cor', <div className="terra-color-field"><input type="color" value={talForm.cor || TALHAO_USOS.find(u => u.value === talForm.uso)?.cor || '#6b7280'} onChange={e => setTalForm(p => ({ ...p, cor: e.target.value }))} className="terra-color-input-lg" /><span className="terra-color-hex">{talForm.cor || TALHAO_USOS.find(u => u.value === talForm.uso)?.cor || '#6b7280'}</span></div>)}
            {renderField('Área (ha)', <input type="number" step="0.01" value={talForm.areaHa || ''} onChange={e => setTalForm(p => ({ ...p, areaHa: parseFloat(e.target.value) || 0 }))} />)}
            {talForm.uso === 'lavoura' && renderField('Cultura', <select value={talForm.cultura} onChange={e => setTalForm(p => ({ ...p, cultura: e.target.value }))}><option value="">Selecione</option>{TERRA_CULTURAS.map(c => <option key={c} value={c}>{c}</option>)}</select>)}
            {talForm.uso === 'lavoura' && renderField('Safra', <input value={talForm.safra} onChange={e => setTalForm(p => ({ ...p, safra: e.target.value }))} placeholder="Ex: 2025/26" />)}
            {renderField('Coordenadas (lat,lng por linha)', <textarea rows={3} value={talForm.poligono.map(p => p.join(',')).join('\n')} onChange={e => setTalForm(p => ({ ...p, poligono: e.target.value.split('\n').filter(l => l.includes(',')).map(l => { const [a, b] = l.split(',').map(Number); return [a, b] as [number, number] }) }))} placeholder="-23.55,-51.43&#10;-23.56,-51.44&#10;-23.55,-51.45" />, true)}
            {renderField('Notas', <textarea rows={2} value={talForm.notas} onChange={e => setTalForm(p => ({ ...p, notas: e.target.value }))} />, true)}
            {renderField('Visível no link público', <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}><input type="checkbox" checked={talForm.publico ?? true} onChange={e => setTalForm(p => ({ ...p, publico: e.target.checked }))} /><span style={{ fontSize: 13, color: '#aaa' }}>Aparece no mapa compartilhável</span></label>)}
          </div>
          <div className="terra-form-actions">
            <button className="terra-btn-primary" onClick={saveTalhao}>Salvar</button>
            <button className="terra-btn-secondary" onClick={() => { setShowTalhaoForm(false); setEditTalhaoId(null); setTalForm(emptyTalhao) }}>Cancelar</button>
          </div>
        </div>
      )}
      <div className="terra-talhao-grid">
        {fazTalhoes.map(t => {
          const usoInfo = TALHAO_USOS.find(u => u.value === t.uso)
          const cor = t.cor || usoInfo?.cor || '#6b7280'
          const pct = fazenda && fazenda.areaTotal > 0 ? ((t.areaHa / fazenda.areaTotal) * 100).toFixed(1) : null
          return (
            <div key={t.id} className="terra-talhao-card">
              <div className="terra-talhao-color-bar" style={{ background: cor }} />
              <div className="terra-talhao-body">
                <div className="terra-talhao-header">
                  <span className="terra-talhao-badge" style={{ background: cor }}>{usoInfo?.label || t.uso}</span>
                  <span className="terra-talhao-area">{fmtHa(t.areaHa)}</span>
                </div>
                <div className="terra-talhao-name">{t.nome}</div>
                {pct && <div className="terra-talhao-pct">{pct}% da área total</div>}
                {t.cultura && <div className="terra-talhao-detail"><svg className="terra-talhao-detail-icon" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2v12M4 6c2-2 6-2 8 0M4 10c2 2 6 2 8 0" strokeLinecap="round"/></svg>{t.cultura}</div>}
                {t.safra && <div className="terra-talhao-detail"><svg className="terra-talhao-detail-icon" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="11" rx="1.5"/><path d="M2 7h12M5 1v4M11 1v4" strokeLinecap="round"/></svg>{t.safra}</div>}
                {t.notas && <div className="terra-talhao-detail terra-muted">{t.notas}</div>}
                {t.publico === false && <div className="terra-talhao-detail terra-muted" style={{ fontSize: 11, opacity: 0.7 }}>🔒 Oculto no link público</div>}
                <div className="terra-talhao-actions">
                  <button onClick={() => editTalhao(t)}>Editar</button>
                  <button onClick={() => deleteTalhao(t.id)}>Excluir</button>
                </div>
              </div>
            </div>
          )
        })}
        {!fazTalhoes.length && <p className="terra-muted">Nenhum talhão cadastrado.</p>}
      </div>
    </div>
  )

  // ─── DOCUMENTOS
  const [docEditField, setDocEditField] = useState<string | null>(null)
  const [docEditValue, setDocEditValue] = useState('')

  const renderDocs = () => {
    if (!fazenda) return <p className="terra-muted">Cadastre uma fazenda primeiro.</p>

    const textDocs = [
      { label: 'Matrícula do Imóvel', value: fazenda.matricula, field: 'matricula', desc: 'Registro no Cartório de Imóveis', category: 'fundiaria' },
      { label: 'CCIR (Certif. Cadastro Imóvel Rural)', value: fazenda.ccir, field: 'ccir', desc: 'Emitido pelo INCRA', category: 'fundiaria' },
      { label: 'CAR (Cadastro Ambiental Rural)', value: fazenda.carNumero, field: 'carNumero', desc: 'Registro no SICAR', category: 'ambiental' },
      { label: 'ITR (Imposto Territorial Rural)', value: fazenda.itrNumero, field: 'itrNumero', desc: 'Receita Federal / DIAT', category: 'fiscal' },
    ] as const
    const boolDocs = [
      { label: 'Georreferenciamento', ok: fazenda.geoReferenciado, desc: fazenda.areaTotal > 100 ? 'Obrigatório para áreas > 100 ha (Lei 10.267/01)' : 'Opcional para áreas ≤ 100 ha', field: 'geoReferenciado', category: 'fundiaria', warn: fazenda.areaTotal > 100 && !fazenda.geoReferenciado },
      { label: 'Licença Ambiental', ok: fazenda.licencaAmbiental, desc: 'Licença de operação ambiental', field: 'licencaAmbiental', category: 'ambiental', warn: false },
    ] as const

    const totalDocs = textDocs.length + boolDocs.length
    const doneDocs = textDocs.filter(d => !!d.value).length + boolDocs.filter(d => d.ok).length
    const pct = Math.round((doneDocs / totalDocs) * 100)

    const saveDocField = (field: string, val: string) => {
      setFazendas(prev => prev.map(f => f.id === fazenda.id ? { ...f, [field]: val } : f))
      setDocEditField(null)
    }
    const toggleBool = (field: string, current: boolean) => {
      setFazendas(prev => prev.map(f => f.id === fazenda.id ? { ...f, [field]: !current } : f))
    }

    const categories = [
      { key: 'fundiaria', label: 'Regularização Fundiária', icon: '📋' },
      { key: 'ambiental', label: 'Ambiental', icon: '🌿' },
      { key: 'fiscal', label: 'Fiscal', icon: '📊' },
    ]

    return (
      <div className="terra-docs">
        <h4>Documentação — {fazenda.nome}</h4>

        <div className="terra-docs-progress">
          <div className="terra-docs-progress-header">
            <span>{doneDocs} de {totalDocs} documentos</span>
            <span className={`terra-docs-pct ${pct === 100 ? 'terra-docs-pct-ok' : pct >= 50 ? 'terra-docs-pct-mid' : 'terra-docs-pct-low'}`}>{pct}%</span>
          </div>
          <div className="terra-docs-bar">
            <div className="terra-docs-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>

        {categories.map(cat => {
          const catTextDocs = textDocs.filter(d => d.category === cat.key)
          const catBoolDocs = boolDocs.filter(d => d.category === cat.key)
          if (catTextDocs.length === 0 && catBoolDocs.length === 0) return null
          return (
            <div key={cat.key} className="terra-docs-category">
              <div className="terra-docs-cat-header">
                <span>{cat.icon} {cat.label}</span>
              </div>
              <div className="terra-docs-list">
                {catTextDocs.map(d => (
                  <div key={d.field} className="terra-doc-item">
                    <span className={`terra-doc-status ${d.value ? 'terra-doc-ok' : 'terra-doc-missing'}`}>{d.value ? '✓' : '✗'}</span>
                    <div className="terra-doc-content">
                      <span className="terra-doc-label">{d.label}</span>
                      <span className="terra-doc-desc">{d.desc}</span>
                    </div>
                    {docEditField === d.field ? (
                      <div className="terra-doc-edit">
                        <input value={docEditValue} onChange={e => setDocEditValue(e.target.value)} placeholder="Nº do documento" autoFocus onKeyDown={e => { if (e.key === 'Enter') saveDocField(d.field, docEditValue); if (e.key === 'Escape') setDocEditField(null) }} />
                        <button className="terra-doc-save" onClick={() => saveDocField(d.field, docEditValue)}>✓</button>
                        <button className="terra-doc-cancel" onClick={() => setDocEditField(null)}>✗</button>
                      </div>
                    ) : (
                      <span className="terra-doc-value" onClick={() => { setDocEditField(d.field); setDocEditValue(d.value || '') }} title="Clique para editar">{d.value || 'Não informado'}</span>
                    )}
                  </div>
                ))}
                {catBoolDocs.map(d => (
                  <div key={d.field} className={`terra-doc-item${d.warn ? ' terra-doc-warn' : ''}`}>
                    <span className={`terra-doc-status ${d.ok ? 'terra-doc-ok' : 'terra-doc-missing'}`}>{d.ok ? '✓' : '✗'}</span>
                    <div className="terra-doc-content">
                      <span className="terra-doc-label">{d.label}</span>
                      <span className={`terra-doc-desc${d.warn ? ' terra-doc-desc-warn' : ''}`}>{d.desc}</span>
                    </div>
                    <button className={`terra-doc-toggle ${d.ok ? 'terra-doc-toggle-on' : ''}`} onClick={() => toggleBool(d.field, d.ok)}>
                      <span className="terra-doc-toggle-thumb" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {fazenda.areaTotal > 100 && !fazenda.geoReferenciado && (
          <div className="terra-docs-alert">
            <span>⚠️</span>
            <span>A propriedade possui {fazenda.areaTotal.toFixed(2)} ha — o georreferenciamento é <strong>obrigatório</strong> pela Lei 10.267/2001 para imóveis acima de 100 ha.</span>
          </div>
        )}

        {doneDocs < totalDocs && (
          <div className="terra-docs-hint">
            Clique no valor de um documento para editá-lo diretamente.
          </div>
        )}
      </div>
    )
  }

  // ─── FAZENDAS (CRUD)
  const renderFazendas = () => (
    <div className="terra-fazendas">
      <div className="terra-section-header">
        <h4>Fazendas</h4>
        <button className="terra-btn-primary" onClick={() => { setFazForm(emptyFazenda); setEditFazendaId(null); setShowFazendaForm(true) }}>+ Nova Fazenda</button>
      </div>
      {showFazendaForm && (
        <div className="terra-form">
          <div className="terra-fields">
            {renderField('Nome da Fazenda', <input value={fazForm.nome} onChange={e => setFazForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Fazenda Boa Vista" />)}
            {renderField('Município', <input value={fazForm.municipio} onChange={e => setFazForm(p => ({ ...p, municipio: e.target.value }))} />)}
            {renderField('UF', <select value={fazForm.uf} onChange={e => setFazForm(p => ({ ...p, uf: e.target.value }))}>{TERRA_UFS.map(u => <option key={u} value={u}>{u}</option>)}</select>)}
            {renderField('Bioma', <select value={fazForm.bioma} onChange={e => setFazForm(p => ({ ...p, bioma: e.target.value }))}><option value="">Selecione</option>{TERRA_BIOMAS.map(b => <option key={b} value={b}>{b}</option>)}</select>)}
            {renderField('Tipo de Solo', <select value={fazForm.tipoSolo} onChange={e => setFazForm(p => ({ ...p, tipoSolo: e.target.value }))}><option value="">Selecione</option>{TERRA_SOLOS.map(s => <option key={s} value={s}>{s}</option>)}</select>)}
            {renderField('Relevo', <select value={fazForm.relevo} onChange={e => setFazForm(p => ({ ...p, relevo: e.target.value }))}><option value="">Selecione</option>{TERRA_RELEVOS.map(r => <option key={r} value={r}>{r}</option>)}</select>)}
            {renderField('Fonte de Água', <input value={fazForm.fonteAgua} onChange={e => setFazForm(p => ({ ...p, fonteAgua: e.target.value }))} placeholder="Ex: Rio, Poço artesiano..." />)}
          </div>
          <h5 className="terra-form-subtitle">Áreas (hectares)</h5>
          <div className="terra-fields">
            {renderField('Área Total', <input type="number" step="0.01" value={fazForm.areaTotal || ''} onChange={e => setFazForm(p => ({ ...p, areaTotal: parseFloat(e.target.value) || 0 }))} />)}
            {renderField('Área Útil', <input type="number" step="0.01" value={fazForm.areaUtil || ''} onChange={e => setFazForm(p => ({ ...p, areaUtil: parseFloat(e.target.value) || 0 }))} />)}
            {renderField('Reserva Legal', <input type="number" step="0.01" value={fazForm.areaReservaLegal || ''} onChange={e => setFazForm(p => ({ ...p, areaReservaLegal: parseFloat(e.target.value) || 0 }))} />)}
            {renderField('APP', <input type="number" step="0.01" value={fazForm.areaApp || ''} onChange={e => setFazForm(p => ({ ...p, areaApp: parseFloat(e.target.value) || 0 }))} />)}
            {renderField('Pastagem', <input type="number" step="0.01" value={fazForm.areaPastagem || ''} onChange={e => setFazForm(p => ({ ...p, areaPastagem: parseFloat(e.target.value) || 0 }))} />)}
            {renderField('Lavoura', <input type="number" step="0.01" value={fazForm.areaLavoura || ''} onChange={e => setFazForm(p => ({ ...p, areaLavoura: parseFloat(e.target.value) || 0 }))} />)}
            {renderField('Reflorestamento', <input type="number" step="0.01" value={fazForm.areaReflorestamento || ''} onChange={e => setFazForm(p => ({ ...p, areaReflorestamento: parseFloat(e.target.value) || 0 }))} />)}
            {renderField('Benfeitorias', <input type="number" step="0.01" value={fazForm.areaBenfeitorias || ''} onChange={e => setFazForm(p => ({ ...p, areaBenfeitorias: parseFloat(e.target.value) || 0 }))} />)}
          </div>
          <h5 className="terra-form-subtitle">Localização</h5>
          <div className="terra-fields">
            {renderField('Latitude', <input type="number" step="0.000001" value={fazForm.latitude || ''} onChange={e => setFazForm(p => ({ ...p, latitude: parseFloat(e.target.value) || 0 }))} placeholder="-23.550520" />)}
            {renderField('Longitude', <input type="number" step="0.000001" value={fazForm.longitude || ''} onChange={e => setFazForm(p => ({ ...p, longitude: parseFloat(e.target.value) || 0 }))} placeholder="-51.433100" />)}
            {renderField('Perímetro (lat,lng por linha)', <textarea rows={4} value={fazForm.perimetro.map(p => p.join(',')).join('\n')} onChange={e => setFazForm(p => ({ ...p, perimetro: e.target.value.split('\n').filter(l => l.includes(',')).map(l => { const [a, b] = l.split(',').map(Number); return [a, b] as [number, number] }) }))} placeholder="-23.55,-51.43&#10;-23.56,-51.44&#10;-23.55,-51.45" />, true)}
          </div>
          <h5 className="terra-form-subtitle">Documentação</h5>
          <div className="terra-fields">
            {renderField('Matrícula', <input value={fazForm.matricula} onChange={e => setFazForm(p => ({ ...p, matricula: e.target.value }))} />)}
            {renderField('CAR', <input value={fazForm.carNumero} onChange={e => setFazForm(p => ({ ...p, carNumero: e.target.value }))} />)}
            {renderField('ITR', <input value={fazForm.itrNumero} onChange={e => setFazForm(p => ({ ...p, itrNumero: e.target.value }))} />)}
            {renderField('CCIR', <input value={fazForm.ccir} onChange={e => setFazForm(p => ({ ...p, ccir: e.target.value }))} />)}
          </div>
          <div className="terra-fields">
            <div className="terra-field terra-check-field"><label><input type="checkbox" checked={fazForm.geoReferenciado} onChange={e => setFazForm(p => ({ ...p, geoReferenciado: e.target.checked }))} /> Georreferenciamento certificado</label></div>
            <div className="terra-field terra-check-field"><label><input type="checkbox" checked={fazForm.licencaAmbiental} onChange={e => setFazForm(p => ({ ...p, licencaAmbiental: e.target.checked }))} /> Licença Ambiental ativa</label></div>
          </div>
          <h5 className="terra-form-subtitle">Valores</h5>
          <div className="terra-fields">
            {renderField('Valor Venal', <input value={fazForm.valorVenal} onChange={e => setFazForm(p => ({ ...p, valorVenal: e.target.value }))} placeholder="Ex: 5.000.000,00" />)}
            {renderField('Valor de Mercado', <input value={fazForm.valorMercado} onChange={e => setFazForm(p => ({ ...p, valorMercado: e.target.value }))} placeholder="Ex: 8.000.000,00" />)}
          </div>
          <div className="terra-fields">
            {renderField('Notas', <textarea rows={3} value={fazForm.notas} onChange={e => setFazForm(p => ({ ...p, notas: e.target.value }))} />, true)}
          </div>
          <div className="terra-form-actions">
            <button className="terra-btn-primary" onClick={saveFazenda}>Salvar</button>
            <button className="terra-btn-secondary" onClick={() => { setShowFazendaForm(false); setEditFazendaId(null); setFazForm(emptyFazenda) }}>Cancelar</button>
          </div>
        </div>
      )}
      <div className="terra-fazenda-list">
        {fazendas.map(f => (
          <div key={f.id} className={`terra-fazenda-card${f.id === activeFazendaId ? ' terra-fazenda-active' : ''}`} onClick={() => setActiveFazendaId(f.id)}>
            <div className="terra-fazenda-card-header">
              <strong>{f.nome}</strong>
              <span className="terra-fazenda-loc">{f.municipio}{f.uf ? ` — ${f.uf}` : ''}</span>
            </div>
            <div className="terra-fazenda-card-body">
              <span>{fmtHa(f.areaTotal)}</span>
              <span>{f.bioma || '—'}</span>
            </div>
            <div className="terra-talhao-actions">
              <button onClick={e => { e.stopPropagation(); editFazenda(f) }}>Editar</button>
              <button onClick={e => { e.stopPropagation(); deleteFazenda(f.id) }}>Excluir</button>
            </div>
          </div>
        ))}
        {!fazendas.length && <p className="terra-muted">Nenhuma fazenda cadastrada.</p>}
      </div>
    </div>
  )

  return (
    <div className={`terra-page${tab === 'mapa' ? ' terra-page-fullmap' : ''}`}>
      {fazendas.length > 1 && (
        <div className="terra-fazenda-selector">
          <select value={activeFazendaId || ''} onChange={e => setActiveFazendaId(e.target.value)}>
            {fazendas.map(f => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
        </div>
      )}
      <div className="terra-tabs">
        {(['visao', 'mapa', 'talhoes', 'docs', 'fazendas'] as const).map(t => (
          <button key={t} className={`terra-tab${tab === t ? ' terra-tab-active' : ''}`} onClick={() => setTab(t)}>
            {{ visao: 'Visão Geral', mapa: 'Mapa', talhoes: 'Talhões', docs: 'Documentos', fazendas: 'Fazendas' }[t]}
          </button>
        ))}
      </div>
      <div className="terra-tab-content">
        {tab === 'visao' && renderVisao()}
        {tab === 'mapa' && renderMapa()}
        {tab === 'talhoes' && renderTalhoes()}
        {tab === 'docs' && renderDocs()}
        {tab === 'fazendas' && renderFazendas()}
      </div>
    </div>
  )
}
