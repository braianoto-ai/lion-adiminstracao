export interface Note {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface Folder {
  id: string
  name: string
  color: string
  notes: Note[]
}

export type ModalType = 'imovel' | 'carro' | 'produto' | null
export type SidebarPage = 'dashboard' | 'family' | 'calendar' | 'trips' | 'goals' | 'payment-hub' | 'settings' | 'appearance' | 'patrimonio' | 'financas' | 'terra'

export interface Imovel {
  id: string
  descricao: string
  tipo: string
  valor: string
  valorAtual: string
  endereco: string
  area: string
  condominioValue?: number
  condominioDueDay?: number
  condominioPayments?: Record<string, 'pago' | 'pendente' | 'atrasado'>
  createdAt: string
}

export interface Produto {
  id: string
  nome: string
  categoria: string
  valor: string
  quantidade: string
  fornecedor: string
  descricao: string
  createdAt: string
}

export interface TerraFazenda {
  id: string
  nome: string
  municipio: string
  uf: string
  matricula: string
  carNumero: string
  itrNumero: string
  ccir: string
  areaTotal: number
  areaUtil: number
  areaReservaLegal: number
  areaApp: number
  areaPastagem: number
  areaLavoura: number
  areaReflorestamento: number
  areaBenfeitorias: number
  latitude: number
  longitude: number
  perimetro: [number, number][]
  tipoSolo: string
  bioma: string
  relevo: string
  fonteAgua: string
  valorVenal: string
  valorMercado: string
  geoReferenciado: boolean
  licencaAmbiental: boolean
  notas: string
  position?: number
  createdAt: string
}

export type TalhaoUso = 'lavoura' | 'pastagem' | 'reserva_legal' | 'app' | 'reflorestamento' | 'benfeitorias' | 'sede' | 'outro'

export interface TerraTalhao {
  id: string
  fazendaId: string
  nome: string
  uso: TalhaoUso
  areaHa: number
  cultura: string
  safra: string
  poligono: [number, number][]
  cor: string
  notas: string
  publico: boolean
  createdAt: string
}

export type NotaCategoria = 'alerta' | 'observacao' | 'tarefa' | 'lembrete' | 'problema' | 'geral'

export interface TerraNote {
  id: string
  fazendaId: string
  lat: number
  lng: number
  titulo: string
  conteudo: string
  cor: string
  icone: NotaCategoria
  fotoUrl: string
  publico?: boolean
  createdAt: string
}

export type BillStatus = 'em_aberto' | 'pago' | 'vencido' | 'cancelado'
export type BillRecurrence = 'mensal' | 'unica' | 'anual' | 'semanal' | 'quinzenal' | 'bimestral' | 'trimestral' | 'semestral'

export interface Collector {
  id: string
  name: string
  category: string
  color: string
  createdAt: string
}

export interface Bill {
  id: string
  collectorId: string
  description: string
  amount: number
  dueDate: string
  status: BillStatus
  recurrence: BillRecurrence
  paymentLink?: string
  barcode?: string
  paidAt?: string
  notes?: string
  vehicleId?: string
  createdAt: string
  updatedAt: string
}

export interface Camera {
  id: string
  fazendaId: string
  name: string
  streamUrl: string
  description?: string
  createdAt: string
}

export interface FamilyMember {
  id: string
  name: string
  role: string
  color: string
}

export type TxType = 'receita' | 'despesa'

export interface Transaction {
  id: string
  type: TxType
  category: string
  description: string
  amount: number
  date: string
  recurring?: boolean
  recurringId?: string
}

export interface FieldDef {
  key: string
  label: string
  type: string
  placeholder?: string
  options?: string[]
}

export interface Goal {
  id: string
  name: string
  category: string
  target: number
  current: number
  deadline: string
}

export interface Rental {
  id: string
  property: string
  tenant: string
  phone: string
  value: number
  dueDay: number
  startDate: string
  notes: string
  payments: Record<string, 'pago' | 'pendente' | 'atrasado'>
}

export interface Maintenance {
  id: string
  asset: string
  type: string
  description: string
  scheduledDate: string
  doneDate: string
  status: 'pendente' | 'feito' | 'atrasado'
  cost: string
  notes: string
}

export interface DocMeta {
  id: string
  name: string
  category: string
  asset: string
  assetId?: string
  notes: string
  fileUrl: string
  fileName: string
  createdAt: string
}

export interface Vehicle {
  id: string
  name: string
  plate: string
  year: string
  currentKm: number
  nextRevisionKm: number
  nextRevisionDate: string
  notes: string
  ipvaExpiry: string
  insuranceExpiry: string
  valorCompra?: number
  valorAtual?: number
}

export interface Revision {
  id: string
  vehicleId: string
  date: string
  km: number
  type: string
  description: string
  cost: string
  shop: string
}

export type FlatNote = Note & { folderName: string; folderColor: string; folderId: string }

export interface AppAlert {
  id: string
  severity: 'danger' | 'warning'
  category: string
  title: string
  detail: string
}

export interface EmailJSConfig {
  serviceId: string
  templateId: string
  publicKey: string
  toEmail: string
}

export interface ActivityItem {
  id: string
  icon: React.ReactNode
  title: string
  sub: string
  time: string
  color: string
  ts: number
}

export interface SearchResult {
  id: string
  type: string
  label: string
  sub: string
  color: string
  section: string
}

export interface CalEvent {
  id: string
  title: string
  date: string
  time: string
  category: 'financeiro' | 'pessoal' | 'viagem' | 'manutencao' | 'sistema'
  notes: string
  auto?: boolean
  paid?: boolean
}

export interface Trip {
  id: string
  destination: string
  country: string
  departDate: string
  returnDate: string
  budget: string
  spent: string
  status: 'planejando' | 'confirmado' | 'em viagem' | 'concluído'
  notes: string
  checklist: { id: string; text: string; done: boolean }[]
}

export interface AppearancePageProps {
  themeId: string; setThemeId: (v: string) => void
  fontSize: string; setFontSize: (v: string) => void
  accentId: string; setAccentId: (v: string) => void
  animations: boolean; setAnimations: (v: boolean) => void
  sidebarFixed: boolean; setSidebarFixed: (v: boolean) => void
}
