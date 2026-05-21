import { jsPDF } from 'jspdf'
import optimaLogoUrl from '../assets/optima-logo.png'

/* ── Brand palette ─────────────────────────────────────────── */
const NAVY      = [11,  31, 77]   // #0b1f4d
const GOLD      = [201, 162, 58]  // #c9a23a
const DARK      = [33,  33, 33]   // body text
const GRAY      = [110, 110, 120] // labels
const MID_GRAY  = [160, 160, 168] // secondary
const DIVIDER   = [225, 225, 230] // dividers
const WHITE     = [255, 255, 255]
const PAGE_BG   = [248, 245, 238] // warm cream
const GREEN     = [22,  163, 74]  // #16a34a — incoming
const RED       = [220,  38, 38]  // #dc2626 — outgoing

function formatCurrency(n) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(iso) {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  }) + ' at ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function formatDateShort(iso) {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Generate a professional PDF receipt.
 * @param {Object} txn
 */
export function generateTransferPDF(txn) {
  const doc      = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW    = doc.internal.pageSize.getWidth()
  const pageH    = doc.internal.pageSize.getHeight()
  const margin   = 18
  const cW       = pageW - margin * 2
  const isIntl   = txn.type === 'international'
  const isCredit = txn.direction === 'incoming' || txn.type === 'credit'

  // ── Page background ────────────────────────────────────────
  doc.setFillColor(...PAGE_BG)
  doc.rect(0, 0, pageW, pageH, 'F')

  // ══════════════════════════════════════════════════════════
  // HEADER — navy bar with logo
  // ══════════════════════════════════════════════════════════
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, pageW, 44, 'F')

  // Gold accent stripe at bottom of header
  doc.setFillColor(...GOLD)
  doc.rect(0, 44, pageW, 2, 'F')

  // Logo — right-aligned in header, white box
  try {
    doc.setFillColor(...WHITE)
    doc.roundedRect(pageW - margin - 48, 6, 48, 32, 3, 3, 'F')
    doc.addImage(optimaLogoUrl, 'PNG', pageW - margin - 46, 8.5, 44, 27)
  } catch (_) { /* logo unavailable — skip */ }

  // Bank name — left side of header
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('Optima Credit Union', margin, 18)

  // Receipt type subtitle
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(229, 201, 110) // light gold
  const receiptTitle = isIntl ? 'International Wire Transfer Receipt'
                               : isCredit ? 'Incoming Transfer Receipt'
                               : 'Local Transfer Receipt'
  doc.text(receiptTitle, margin, 27)

  // FDIC / date line
  doc.setTextColor(180, 160, 100)
  doc.setFontSize(7)
  doc.text(`Member FDIC  ·  Equal Housing Lender  ·  Generated: ${formatDateShort(txn.date)}`, margin, 36)

  // ══════════════════════════════════════════════════════════
  // REFERENCE STRIP
  // ══════════════════════════════════════════════════════════
  let y = 54

  doc.setFillColor(...WHITE)
  doc.roundedRect(margin, y, cW, 14, 2, 2, 'F')
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.4)
  doc.roundedRect(margin, y, cW, 14, 2, 2, 'S')

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.text('Transaction Reference', margin + 5, y + 5.5)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...NAVY)
  doc.text(txn.ref || '—', pageW - margin - 5, y + 5.5, { align: 'right' })

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MID_GRAY)
  doc.text(`Processed: ${formatDate(txn.date)}`, margin + 5, y + 11)

  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...(isCredit ? GREEN : RED))
  const statusText = `✓  ${isCredit ? 'RECEIVED' : 'SENT'} · COMPLETED`
  doc.text(statusText, pageW - margin - 5, y + 11, { align: 'right' })

  // ══════════════════════════════════════════════════════════
  // AMOUNT HIGHLIGHT BOX
  // ══════════════════════════════════════════════════════════
  y += 22

  doc.setFillColor(...WHITE)
  doc.roundedRect(margin, y, cW, 24, 3, 3, 'F')

  // Left accent bar — green for incoming, red for outgoing
  doc.setFillColor(...(isCredit ? GREEN : RED))
  doc.roundedRect(margin, y, 4, 24, 2, 2, 'F')

  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.text(isCredit ? 'Amount Received' : 'Amount Sent', margin + 9, y + 8)

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...(isCredit ? GREEN : RED))
  doc.text(`${isCredit ? '+' : '-'}$${formatCurrency(txn.amount)}`, margin + 9, y + 19)

  if (txn.balanceAfter !== undefined && txn.balanceAfter !== null) {
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text(`Balance after: $${formatCurrency(txn.balanceAfter)}`, pageW - margin - 5, y + 19, { align: 'right' })
  }

  // ══════════════════════════════════════════════════════════
  // TRANSFER DETAILS TABLE
  // ══════════════════════════════════════════════════════════
  y += 32

  // Section header
  doc.setFillColor(...NAVY)
  doc.rect(margin, y, cW, 8, 'F')
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  doc.text('TRANSFER DETAILS', margin + 5, y + 5.5)

  y += 8

  // Table helper
  let rowIdx = 0
  const drawRow = (label, value, highlight = false) => {
    const h = 10
    if (rowIdx % 2 === 0) {
      doc.setFillColor(255, 255, 255)
    } else {
      doc.setFillColor(244, 241, 234) // warm stripe
    }
    doc.rect(margin, y, cW, h, 'F')

    // Bottom border
    doc.setDrawColor(...DIVIDER)
    doc.setLineWidth(0.15)
    doc.line(margin, y + h, margin + cW, y + h)

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text(label, margin + 4, y + 6.5)

    doc.setFont('helvetica', highlight ? 'bold' : 'normal')
    if (highlight) doc.setTextColor(...NAVY); else doc.setTextColor(...DARK)
    doc.text(String(value || '—'), pageW - margin - 4, y + 6.5, { align: 'right' })

    y += h
    rowIdx++
  }

  drawRow('Beneficiary / Recipient', txn.beneficiary || txn.toName || '—', true)
  drawRow('Transfer Type', isIntl ? 'International Wire Transfer' : 'Local Bank Transfer')

  if (isIntl) {
    drawRow('IBAN / Account No.', txn.iban || '—')
    drawRow('SWIFT / BIC Code', txn.swift || '—')
    drawRow('Beneficiary Bank', txn.bankName || '—')
    drawRow('Country', txn.country || '—')
  } else {
    drawRow('Account Number', txn.accountNumber || '—')
    drawRow('Receiving Bank', txn.bankName || 'Optima Credit Union')
  }

  drawRow('Transfer Amount', `USD $${formatCurrency(txn.amount)}`, true)
  drawRow('Direction', isCredit ? 'Incoming (Credit)' : 'Outgoing (Debit)')
  drawRow('Status', 'Completed — Funds Settled')
  drawRow('Transaction Date', formatDate(txn.date))

  // Close table border
  doc.setDrawColor(...NAVY)
  doc.setLineWidth(0.3)
  doc.rect(margin, y - rowIdx * 10 - 8, cW, rowIdx * 10 + 8, 'S')

  // ══════════════════════════════════════════════════════════
  // INTERNATIONAL NOTICE BOX (intl only)
  // ══════════════════════════════════════════════════════════
  if (isIntl) {
    y += 8
    doc.setFillColor(255, 251, 235)
    doc.roundedRect(margin, y, cW, 20, 2, 2, 'F')
    doc.setDrawColor(201, 162, 58)
    doc.setLineWidth(0.3)
    doc.roundedRect(margin, y, cW, 20, 2, 2, 'S')
    // left accent
    doc.setFillColor(...GOLD)
    doc.rect(margin, y, 3.5, 20, 'F')

    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(161, 98, 7)
    doc.text('Important — International Transfer Notice', margin + 7, y + 6)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(130, 80, 0)
    doc.text(
      'International wires may take 1–3 business days. Correspondent bank fees may apply. Exchange rates are',
      margin + 7, y + 12, { maxWidth: cW - 10 }
    )
    doc.text('determined at time of settlement. Contact support if funds are not received within 5 business days.',
      margin + 7, y + 17, { maxWidth: cW - 10 }
    )
    y += 20
  }

  // ══════════════════════════════════════════════════════════
  // FOOTER
  // ══════════════════════════════════════════════════════════
  const footerY = pageH - 30

  doc.setFillColor(...NAVY)
  doc.rect(0, footerY, pageW, 0.8, 'F')
  doc.setFillColor(...GOLD)
  doc.rect(0, footerY + 0.8, pageW, 0.4, 'F')

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.text('This is a computer-generated receipt. No signature required.', pageW / 2, footerY + 6, { align: 'center' })

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...NAVY)
  doc.text('Optima Credit Union', pageW / 2, footerY + 12, { align: 'center' })

  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...MID_GRAY)
  doc.text('Member FDIC  ·  Equal Housing Lender  ·  1-800-555-0199  ·  support@optimacreditunion.com',
    pageW / 2, footerY + 18, { align: 'center' })
  doc.text(`© ${new Date().getFullYear()} Optima Credit Union. All rights reserved. Reference: ${txn.ref}`,
    pageW / 2, footerY + 23, { align: 'center' })

  // ══════════════════════════════════════════════════════════
  // WATERMARK — drawn last (lowest opacity)
  // ══════════════════════════════════════════════════════════
  try {
    doc.setGState(new doc.GState({ opacity: 0.05 }))
    const wW = 90, wH = Math.round(90 / 2.46)
    doc.addImage(optimaLogoUrl, 'PNG', (pageW - wW) / 2, (pageH - wH) / 2, wW, wH)
  } catch (_) { /* GState unsupported — skip */ }

  // ── Save ──────────────────────────────────────────────────
  const fname = `Optima_${isIntl ? 'Wire' : 'Transfer'}_${txn.ref || Date.now()}.pdf`
  doc.save(fname)
}
