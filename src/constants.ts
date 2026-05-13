import type { TalhaoUso, BillStatus, BillRecurrence, CalEvent, Trip, EmailJSConfig, NotaCategoria } from './types'

// ─── Terra ──────────────────────────────────────────────────────────────────

export const TERRA_BIOMAS = ['Mata Atlântica', 'Cerrado', 'Amazônia', 'Caatinga', 'Pampa', 'Pantanal']
export const TERRA_RELEVOS = ['Plano', 'Suave Ondulado', 'Ondulado', 'Forte Ondulado', 'Montanhoso']
export const TERRA_SOLOS = ['Latossolo Vermelho', 'Latossolo Amarelo', 'Argissolo', 'Neossolo', 'Cambissolo', 'Gleissolo', 'Nitossolo', 'Outro']
export const TERRA_UFS = ['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO']
export const TALHAO_USOS: { value: TalhaoUso; label: string; cor: string }[] = [
  { value: 'lavoura', label: 'Lavoura', cor: '#f59e0b' },
  { value: 'pastagem', label: 'Pastagem', cor: '#22c55e' },
  { value: 'reserva_legal', label: 'Reserva Legal', cor: '#166534' },
  { value: 'app', label: 'APP', cor: '#0d9488' },
  { value: 'reflorestamento', label: 'Reflorestamento', cor: '#65a30d' },
  { value: 'benfeitorias', label: 'Benfeitorias', cor: '#8b5cf6' },
  { value: 'sede', label: 'Sede/Moradia', cor: '#ef4444' },
  { value: 'outro', label: 'Outro', cor: '#6b7280' },
]
export const TERRA_CULTURAS = ['Soja','Milho','Café','Cana-de-Açúcar','Trigo','Algodão','Feijão','Arroz','Mandioca','Eucalipto','Pinus','Pastagem (Braquiária)','Pastagem (Tifton)','Outra']

export const NOTA_CATEGORIAS: { value: NotaCategoria; label: string; cor: string; emoji: string }[] = [
  { value: 'alerta', label: 'Alerta', cor: '#ef4444', emoji: '⚠️' },
  { value: 'observacao', label: 'Observação', cor: '#3b82f6', emoji: '👁️' },
  { value: 'tarefa', label: 'Tarefa', cor: '#f59e0b', emoji: '✅' },
  { value: 'lembrete', label: 'Lembrete', cor: '#8b5cf6', emoji: '📌' },
  { value: 'problema', label: 'Problema', cor: '#dc2626', emoji: '🔴' },
  { value: 'geral', label: 'Geral', cor: '#6b7280', emoji: '📝' },
]

export const compressImage = (file: File, maxW = 800, quality = 0.6): Promise<string> =>
  new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const ratio = Math.min(1, maxW / img.width)
        const canvas = document.createElement('canvas')
        canvas.width = img.width * ratio
        canvas.height = img.height * ratio
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/webp', quality))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })

// ─── Bills ──────────────────────────────────────────────────────────────────

export const BILL_CATEGORIES = ['Energia','Água','Internet','Telefonia','Condomínio','Aluguel','Cartão','Streaming','Educação','Saúde','Imposto','Outros']
export const BILL_COLORS = ['#7c3aed','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16','#a855f7','#f97316']
export const BILL_STATUS_LABEL: Record<BillStatus, string> = {
  em_aberto: 'Em aberto', pago: 'Pago', vencido: 'Vencido', cancelado: 'Cancelado'
}
export const BILL_RECURRENCE_LABEL: Record<BillRecurrence, string> = {
  unica: 'Única', semanal: 'Semanal', quinzenal: 'Quinzenal',
  mensal: 'Mensal', bimestral: 'Bimestral', trimestral: 'Trimestral',
  semestral: 'Semestral', anual: 'Anual',
}
export const COLL_INIT = { name: '', category: BILL_CATEGORIES[0], color: BILL_COLORS[0] }
export const BILL_INIT = { collectorId: '', description: '', amount: '', dueDate: '', status: 'em_aberto' as BillStatus, recurrence: 'mensal' as BillRecurrence, paymentLink: '', barcode: '', notes: '' }

// ─── Finance ────────────────────────────────────────────────────────────────

export const TX_CATEGORIES = {
  receita: ['Salário', 'Aluguel recebido', 'Dividendos', 'Freelance', 'Vendas', 'Outros'],
  despesa: ['Moradia', 'Alimentação', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Impostos', 'Outros'],
}
export const FOLDER_COLORS = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16']

// ─── Rentals & Maintenance ──────────────────────────────────────────────────

export const RENTAL_FORM_INIT = { property: '', tenant: '', phone: '', value: '', dueDay: '5', startDate: '', notes: '' }
export const MAINT_TYPES = ['Revisão geral', 'Elétrica', 'Hidráulica', 'Pintura', 'Telhado', 'Jardim', 'Limpeza', 'IPTU/taxas', 'Seguro', 'Troca de óleo', 'Pneus', 'Outros']
export const MAINT_FORM_INIT = { asset: '', type: MAINT_TYPES[0], description: '', scheduledDate: '', doneDate: '', cost: '', notes: '' }

// ─── Documents ──────────────────────────────────────────────────────────────

export const DOC_CATEGORIES = ['Escritura', 'IPTU', 'Contrato', 'Seguro', 'Planta', 'Comprovante', 'Laudo', 'Outros']
export const BUCKET = 'lion-docs'

// ─── Vehicles ───────────────────────────────────────────────────────────────

export const REVISION_TYPES = ['Revisão geral', 'Troca de óleo', 'Pneus', 'Freios', 'Correia dentada', 'Filtros', 'Suspensão', 'Elétrica', 'Outros']
export const VEH_FORM_INIT = { name: '', plate: '', year: '', currentKm: '', nextRevisionKm: '', nextRevisionDate: '', notes: '', ipvaExpiry: '', insuranceExpiry: '' }
export const REV_FORM_INIT = { vehicleId: '', date: new Date().toISOString().slice(0, 10), km: '', type: REVISION_TYPES[0], description: '', cost: '', shop: '' }

// ─── EmailJS ────────────────────────────────────────────────────────────────

export const EMAILJS_CONFIG_KEY = 'lion-emailjs'
export const EMAILJS_INIT: EmailJSConfig = { serviceId: '', templateId: '', publicKey: '', toEmail: '' }

// ─── Share ──────────────────────────────────────────────────────────────────

export const SHARE_KEYS = ['lion-txs', 'lion-goals', 'lion-rentals', 'lion-maintenance', 'lion-docs-meta', 'lion-vehicles', 'lion-revisions']

// ─── Appearance ─────────────────────────────────────────────────────────────

export const THEMES = [
  { id: 'dark',     label: 'Noite',    swatch: '#0c0e14', bg: '#13151e' },
  { id: 'charcoal', label: 'Carvão',   swatch: '#171717', bg: '#1f1f1f' },
  { id: 'slate',    label: 'Ardósia',  swatch: '#0e1520', bg: '#15202e' },
  { id: 'light',    label: 'Claro',    swatch: '#f0f2f5', bg: '#e8eaed' },
]

export const FONT_SIZES = [
  { id: 'compact',     label: 'A−',  size: '13px', title: 'Compacto' },
  { id: 'normal',      label: 'A',   size: '14px', title: 'Normal' },
  { id: 'comfortable', label: 'A+',  size: '15px', title: 'Confortável' },
  { id: 'large',       label: 'A++', size: '16px', title: 'Grande' },
]

export const ACCENT_COLORS = [
  { id: 'red',    label: 'Vermelho', color: '#c0392b', light: '#e74c3c' },
  { id: 'blue',   label: 'Azul',    color: '#1d4ed8', light: '#60a5fa' },
  { id: 'green',  label: 'Verde',   color: '#059669', light: '#34d399' },
  { id: 'purple', label: 'Roxo',    color: '#7c3aed', light: '#a78bfa' },
  { id: 'pink',   label: 'Rosa',    color: '#be185d', light: '#f472b6' },
  { id: 'amber',  label: 'Âmbar',   color: '#b45309', light: '#fbbf24' },
  { id: 'cyan',   label: 'Ciano',   color: '#0e7490', light: '#22d3ee' },
  { id: 'indigo', label: 'Índigo',  color: '#4338ca', light: '#818cf8' },
]

// ─── Calendar ───────────────────────────────────────────────────────────────

export const CAL_COLORS: Record<CalEvent['category'], string> = {
  financeiro: '#3b82f6',
  pessoal:    '#8b5cf6',
  viagem:     '#f59e0b',
  manutencao: '#10b981',
  sistema:    '#94a3b8',
}
export const CAL_LABELS: Record<CalEvent['category'], string> = {
  financeiro: 'Financeiro', pessoal: 'Pessoal', viagem: 'Viagem', manutencao: 'Manutenção', sistema: 'Sistema'
}
export const CAL_FORM_INIT: Omit<CalEvent, 'id' | 'auto'> = { title: '', date: '', time: '', category: 'pessoal', notes: '' }

// ─── Goals ──────────────────────────────────────────────────────────────────

export const GOAL_CATS = ['Reserva de emergência','Imóvel','Veículo','Viagem','Educação','Aposentadoria','Investimento','Outro']
export const GOAL_COLORS: Record<string, string> = {
  'Reserva de emergência': 'var(--amber)',
  'Imóvel':                'var(--blue)',
  'Veículo':               'var(--purple-l)',
  'Viagem':                'var(--green)',
  'Educação':              '#8b5cf6',
  'Aposentadoria':         '#ec4899',
  'Investimento':          'var(--blue-l)',
  'Outro':                 'var(--text)',
}
export const GOAL_FORM_INIT = { name: '', category: GOAL_CATS[0], target: '', current: '', deadline: '' }

// ─── Trips ──────────────────────────────────────────────────────────────────

export const TRIP_STATUS_COLOR: Record<Trip['status'], string> = {
  'planejando':  '#94a3b8',
  'confirmado':  '#3b82f6',
  'em viagem':   '#10b981',
  'concluído':   '#6b7280',
}
export const TRIP_FORM_INIT = { destination: '', country: '', departDate: '', returnDate: '', budget: '', spent: '0', status: 'planejando' as Trip['status'], notes: '' }

// ─── Family ─────────────────────────────────────────────────────────────────

export const MEMBER_COLORS = ['#c0392b','#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899','#06b6d4','#84cc16']
export const MEMBER_ROLES  = ['Responsável','Cônjuge','Filho(a)','Dependente','Sócio(a)','Outro']
export const MEMBER_FORM_INIT = { name: '', role: MEMBER_ROLES[0], color: MEMBER_COLORS[0] }

// ─── Patrimônio ─────────────────────────────────────────────────────────────

export const IMOVEL_TIPOS = ['Residencial', 'Comercial', 'Rural', 'Terreno', 'Galpão']
export const PRODUTO_CATS = ['Eletrônico', 'Móvel', 'Eletrodoméstico', 'Veículo', 'Arte', 'Joia', 'Equipamento', 'Outros']
export const IMOVEL_INIT = { descricao: '', tipo: 'Residencial', valor: '', valorAtual: '', endereco: '', area: '' }
export const PRODUTO_INIT = { nome: '', categoria: 'Eletrônico', valor: '', quantidade: '1', fornecedor: '', descricao: '' }
