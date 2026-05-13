import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Transaction, Bill, Collector, Imovel, Vehicle, Produto, Goal } from './types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtBRL(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function today() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function csvEscape(v: string | number) {
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

function buildCSV(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows].map(r => r.map(csvEscape).join(',')).join('\n')
}

// ── PDF base style ────────────────────────────────────────────────────────────

function newPDF(title: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  // Header bar
  doc.setFillColor(26, 26, 26)
  doc.rect(0, 0, 210, 20, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('Lion Admin', 14, 13)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 180)
  doc.text(title, 70, 13)
  doc.text(`Gerado em ${today()}`, 210 - 14, 13, { align: 'right' })

  // Reset color
  doc.setTextColor(40, 40, 40)

  return doc
}

// ── 1. Transações → CSV ───────────────────────────────────────────────────────

export function exportTransactionsCSV(txs: Transaction[]) {
  const headers = ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor (R$)']
  const rows = [...txs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(t => [
      t.date,
      t.description,
      t.category,
      t.type === 'receita' ? 'Receita' : 'Despesa',
      t.amount.toFixed(2).replace('.', ','),
    ])
  const csv = '﻿' + buildCSV(headers, rows) // BOM for Excel
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `financas_${new Date().toISOString().slice(0,10)}.csv`)
}

// ── 2. Transações → PDF ───────────────────────────────────────────────────────

export function exportTransactionsPDF(txs: Transaction[]) {
  const doc = newPDF('Relatório de Finanças')

  const totalRec = txs.filter(t => t.type === 'receita').reduce((s, t) => s + t.amount, 0)
  const totalDes = txs.filter(t => t.type === 'despesa').reduce((s, t) => s + t.amount, 0)
  const saldo    = totalRec - totalDes

  // Summary boxes
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  const boxY = 26
  const boxes = [
    { label: 'Receitas', value: fmtBRL(totalRec), color: [22, 163, 74] as [number,number,number] },
    { label: 'Despesas', value: fmtBRL(totalDes), color: [220, 38, 38] as [number,number,number] },
    { label: 'Saldo',    value: fmtBRL(saldo),    color: saldo >= 0 ? [22,163,74] as [number,number,number] : [220,38,38] as [number,number,number] },
  ]
  boxes.forEach((b, i) => {
    const x = 14 + i * 62
    doc.setFillColor(245, 245, 245)
    doc.roundedRect(x, boxY, 58, 16, 2, 2, 'F')
    doc.setTextColor(100, 100, 100)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(b.label, x + 4, boxY + 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...b.color)
    doc.text(b.value, x + 4, boxY + 13)
  })

  doc.setTextColor(40, 40, 40)

  const sorted = [...txs].sort((a, b) => b.date.localeCompare(a.date))

  autoTable(doc, {
    startY: boxY + 22,
    head: [['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor']],
    body: sorted.map(t => [
      t.date,
      t.description,
      t.category,
      t.type === 'receita' ? 'Receita' : 'Despesa',
      fmtBRL(t.amount),
    ]),
    headStyles: { fillColor: [26, 26, 26], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      0: { cellWidth: 22 },
      3: { cellWidth: 22 },
      4: { cellWidth: 32, halign: 'right' },
    },
    didParseCell(data) {
      if (data.column.index === 3 && data.section === 'body') {
        data.cell.styles.textColor = data.cell.text[0] === 'Receita' ? [22,163,74] : [220,38,38]
      }
      if (data.column.index === 4 && data.section === 'body') {
        const row = sorted[data.row.index]
        if (row) data.cell.styles.textColor = row.type === 'receita' ? [22,163,74] : [220,38,38]
      }
    },
  })

  doc.save(`financas_${new Date().toISOString().slice(0,10)}.pdf`)
}

// ── 3. Contas (Hub) → CSV ─────────────────────────────────────────────────────

export function exportBillsCSV(bills: Bill[], collectors: Collector[]) {
  const headers = ['Descrição', 'Coletor', 'Vencimento', 'Valor (R$)', 'Status']
  const rows = [...bills]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map(b => {
      const coll = collectors.find(c => c.id === b.collectorId)
      return [
        b.description || coll?.name || '',
        coll?.name || '',
        b.dueDate,
        b.amount.toFixed(2).replace('.', ','),
        b.status,
      ]
    })
  const csv = '﻿' + buildCSV(headers, rows)
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `contas_${new Date().toISOString().slice(0,10)}.csv`)
}

// ── 4. Patrimônio → PDF ───────────────────────────────────────────────────────

export function exportPatrimonioPDF(
  imoveis: Imovel[],
  vehicles: Vehicle[],
  produtos: Produto[],
) {
  const doc = newPDF('Relatório de Patrimônio')

  const totalImoveis  = imoveis.reduce((s, i) => s + (parseFloat(i.valorAtual || i.valor || '0') || 0), 0)
  const totalVeiculos = vehicles.reduce((s, v) => {
    const m = v.notes?.match(/Atual:\s*R\$\s*([\d.,]+)/)
    return m ? s + (parseFloat(m[1].replace(/\./g,'').replace(',','.')) || 0) : s
  }, 0)
  const totalProdutos = produtos.reduce((s, p) => s + (parseFloat(p.valor||'0')||0) * (parseInt(p.quantidade||'1')||1), 0)
  const total = totalImoveis + totalVeiculos + totalProdutos

  // Summary
  const boxY = 26
  const boxes = [
    { label: 'Imóveis',       value: fmtBRL(totalImoveis),  n: imoveis.length   },
    { label: 'Veículos',      value: fmtBRL(totalVeiculos), n: vehicles.length  },
    { label: 'Bens/Produtos', value: fmtBRL(totalProdutos), n: produtos.length  },
    { label: 'Total',         value: fmtBRL(total),         n: imoveis.length + vehicles.length + produtos.length },
  ]
  boxes.forEach((b, i) => {
    const x = 14 + i * 46
    doc.setFillColor(i === 3 ? 26 : 245, i === 3 ? 26 : 245, i === 3 ? 26 : 245)
    doc.roundedRect(x, boxY, 42, 16, 2, 2, 'F')
    doc.setTextColor(i === 3 ? 255 : 100, i === 3 ? 255 : 100, i === 3 ? 255 : 100)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(`${b.label} (${b.n})`, x + 3, boxY + 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(i === 3 ? 255 : 40, i === 3 ? 255 : 40, i === 3 ? 255 : 40)
    doc.text(b.value, x + 3, boxY + 13)
  })

  doc.setTextColor(40, 40, 40)
  let curY = boxY + 22

  if (imoveis.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Imóveis', 14, curY + 6)
    autoTable(doc, {
      startY: curY + 8,
      head: [['Nome', 'Tipo', 'Endereço', 'Valor']],
      body: imoveis.map(i => [i.descricao || '', i.tipo || '', i.endereco || '', fmtBRL(parseFloat(i.valorAtual||i.valor||'0')||0)]),
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 3: { halign: 'right', cellWidth: 36 } },
    })
    curY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  }

  if (vehicles.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Veículos', 14, curY + 6)
    autoTable(doc, {
      startY: curY + 8,
      head: [['Nome', 'Placa', 'Km atual', 'Valor']],
      body: vehicles.map(v => {
        const m = v.notes?.match(/Atual:\s*R\$\s*([\d.,]+)/)
        const val = m ? parseFloat(m[1].replace(/\./g,'').replace(',','.')) : 0
        return [v.name, v.plate || '', v.currentKm?.toLocaleString('pt-BR') || '', fmtBRL(val)]
      }),
      headStyles: { fillColor: [245, 158, 11], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 3: { halign: 'right', cellWidth: 36 } },
    })
    curY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6
  }

  if (produtos.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.text('Bens / Produtos', 14, curY + 6)
    autoTable(doc, {
      startY: curY + 8,
      head: [['Nome', 'Categoria', 'Qtd', 'Valor unit.', 'Total']],
      body: produtos.map(p => {
        const val = parseFloat(p.valor||'0') || 0
        const qty = parseInt(p.quantidade||'1') || 1
        return [p.nome, p.categoria||'', qty, fmtBRL(val), fmtBRL(val * qty)]
      }),
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      columnStyles: { 2: { halign: 'center', cellWidth: 14 }, 3: { halign: 'right', cellWidth: 32 }, 4: { halign: 'right', cellWidth: 32 } },
    })
  }

  doc.save(`patrimonio_${new Date().toISOString().slice(0,10)}.pdf`)
}

// ── 5. Metas → PDF ────────────────────────────────────────────────────────────

export function exportGoalsPDF(goals: Goal[]) {
  const doc = newPDF('Relatório de Metas Financeiras')

  const totalTarget = goals.reduce((s, g) => s + g.target, 0)
  const totalSaved  = goals.reduce((s, g) => s + g.current, 0)
  const done        = goals.filter(g => g.current >= g.target).length

  const boxY = 26
  const boxes = [
    { label: 'Total guardado',  value: fmtBRL(totalSaved)  },
    { label: 'Total alvo',      value: fmtBRL(totalTarget) },
    { label: 'Concluídas',      value: `${done} / ${goals.length}` },
    { label: 'Progresso geral', value: `${totalTarget > 0 ? Math.round((totalSaved/totalTarget)*100) : 0}%` },
  ]
  boxes.forEach((b, i) => {
    const x = 14 + i * 46
    doc.setFillColor(245, 245, 245)
    doc.roundedRect(x, boxY, 42, 16, 2, 2, 'F')
    doc.setTextColor(100, 100, 100)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text(b.label, x + 3, boxY + 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(40, 40, 40)
    doc.text(b.value, x + 3, boxY + 13)
  })

  doc.setTextColor(40, 40, 40)

  autoTable(doc, {
    startY: boxY + 22,
    head: [['Meta', 'Categoria', 'Prazo', 'Guardado', 'Alvo', '%']],
    body: goals.map(g => {
      const pct = g.target > 0 ? Math.min(Math.round((g.current / g.target) * 100), 100) : 0
      return [g.name, g.category, g.deadline || '—', fmtBRL(g.current), fmtBRL(g.target), `${pct}%`]
    }),
    headStyles: { fillColor: [139, 92, 246], textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 248, 248] },
    columnStyles: {
      3: { halign: 'right', cellWidth: 32 },
      4: { halign: 'right', cellWidth: 32 },
      5: { halign: 'center', cellWidth: 14 },
    },
    didParseCell(data) {
      if (data.column.index === 5 && data.section === 'body') {
        const pct = parseInt(String(data.cell.text[0]))
        data.cell.styles.textColor = pct >= 100 ? [22,163,74] : pct >= 50 ? [245,158,11] : [220,38,38]
      }
    },
  })

  doc.save(`metas_${new Date().toISOString().slice(0,10)}.pdf`)
}
