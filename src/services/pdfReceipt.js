import { jsPDF } from 'jspdf'
import optimaLogoUrl from '../assets/optima-logo.png'

const BRAND_GOLD = [201, 162, 58]    // #c9a23a
const DARK = [33, 33, 33]          // near-black for body text
const GRAY = [100, 100, 100]       // medium gray for labels
const LIGHT_GRAY = [220, 220, 220] // dividers
const WHITE = [255, 255, 255]

// TD logo as base64 PNG for PDF watermark
// Logo imported via Vite — no base64 embedding needed
const TD_LOGO_B64 = null // replaced by OPTIMA_LOGO_URL below

function formatCurrency(n) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDate(iso) {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }) + ' at ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

/**
 * Generate a professional PDF receipt for a wire / local transfer.
 * @param {Object} txn - transaction data
 * @param {'international'|'local'} txn.type
 * @param {string} txn.ref
 * @param {string} txn.beneficiary
 * @param {number} txn.amount
 * @param {number} [txn.balanceAfter]
 * @param {string} txn.date - ISO date string
 * @param {string} [txn.iban]
 * @param {string} [txn.swift]
 * @param {string} [txn.bankName]
 * @param {string} [txn.country]
 * @param {string} [txn.accountNumber] - for local transfers
 */
export function generateTransferPDF(txn) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 20
  const contentW = pageW - margin * 2
  const isIntl = txn.type === 'international'

  // ══════════════════════════════════════════════════════════
  // DRAW ALL CONTENT FIRST (at full opacity)
  // Then draw watermark LAST so GState opacity bug doesn't
  // affect readable content.
  // ══════════════════════════════════════════════════════════

  // ── Green header bar ──────────────────────────────────
  doc.setFillColor(...BRAND_GOLD)
  doc.rect(0, 0, pageW, 40, 'F')

  // Bank name — bold, top-left
  doc.setTextColor(...WHITE)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.text('Optima Credit Union', margin, 16)

  // Sub-line under bank name
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text('Optima Credit Union  |  Member FDIC  |  Equal Housing Lender', margin, 23)

  // Title — right-aligned
  const title = isIntl ? 'International Wire Confirmation' : 'Local Transfer Confirmation'
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text(title, pageW - margin, 16, { align: 'right' })

  // Date line — right-aligned
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.text(formatDate(txn.date), pageW - margin, 24, { align: 'right' })

  // Thin accent line at bottom of header
  doc.setFillColor(...BRAND_GOLD)
  doc.rect(0, 40, pageW, 1.5, 'F')

  // ── Reference chip ────────────────────────────────────
  let y = 54

  doc.setFillColor(245, 247, 250)
  doc.roundedRect(margin, y - 6, contentW, 16, 3, 3, 'F')
  doc.setFontSize(8)
  doc.setTextColor(...GRAY)
  doc.setFont('helvetica', 'normal')
  doc.text('Transaction Reference', margin + 6, y + 1)
  doc.setFontSize(11)
  doc.setTextColor(...DARK)
  doc.setFont('helvetica', 'bold')
  doc.text(txn.ref, pageW - margin - 6, y + 1, { align: 'right' })

  // ── Section: Transfer Details ─────────────────────────
  y += 26

  doc.setFillColor(...BRAND_GOLD)
  doc.rect(margin, y, 3, 8, 'F')
  doc.setFontSize(11)
  doc.setTextColor(...BRAND_GOLD)
  doc.setFont('helvetica', 'bold')
  doc.text('Transfer Details', margin + 7, y + 6)

  y += 16

  // Table rows helper
  let rowIndex = 0
  const drawRow = (label, value) => {
    // Alternating background
    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 250, 252)
      doc.rect(margin, y - 4.5, contentW, 11, 'F')
    }
    // Separator line
    doc.setDrawColor(...LIGHT_GRAY)
    doc.setLineWidth(0.2)
    doc.line(margin, y + 6.5, pageW - margin, y + 6.5)

    // Label
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...GRAY)
    doc.text(label, margin + 4, y + 2)

    // Value
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...DARK)
    doc.text(String(value), pageW - margin - 4, y + 2, { align: 'right' })

    y += 11
    rowIndex++
  }

  drawRow('Beneficiary Name', txn.beneficiary)

  const category = txn.category || (isIntl ? 'International Wire Transfer' : 'Local Transfer')
  drawRow('Transaction Category', category)

  if (isIntl) {
    drawRow('IBAN / Account No.', txn.iban || '—')
    drawRow('SWIFT / BIC Code', txn.swift || '—')
    drawRow('Bank Name', txn.bankName || '—')
    drawRow('Country', txn.country || '—')
  } else {
    drawRow('Account Number', txn.accountNumber || '—')
    drawRow('Bank Name', txn.bankName || '—')
  }

  drawRow('Transfer Amount', `$${formatCurrency(txn.amount)}`)

  // ── Status badge ──────────────────────────────────────
  y += 8
  doc.setFillColor(253, 248, 236)
  doc.roundedRect(margin, y - 4, 56, 12, 3, 3, 'F')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND_GOLD)
  doc.setFont('helvetica', 'bold')
  doc.text('\u2713  Status: Completed', margin + 5, y + 3)

  // Timestamp
  doc.setFontSize(7.5)
  doc.setTextColor(...GRAY)
  doc.setFont('helvetica', 'normal')
  doc.text(`Processed: ${formatDate(txn.date)}`, pageW - margin, y + 3, { align: 'right' })

  // ── Divider ───────────────────────────────────────────
  y += 20
  doc.setDrawColor(...LIGHT_GRAY)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageW - margin, y)

  // ── Important Notice (international only) ──────────────
  if (isIntl) {
    y += 10
    doc.setFillColor(255, 251, 235)
    doc.roundedRect(margin, y - 4, contentW, 22, 3, 3, 'F')
    doc.setFontSize(8)
    doc.setTextColor(161, 98, 7)
    doc.setFont('helvetica', 'bold')
    doc.text('Important Notice', margin + 6, y + 2)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(
      'International wire transfers may take 1-3 business days to process. Fees may apply based on your account type.',
      margin + 6, y + 9,
      { maxWidth: contentW - 12 }
    )
  }

  // ── Footer ────────────────────────────────────────────
  const footerY = pageH - 42

  // Green accent line
  doc.setDrawColor(...BRAND_GOLD)
  doc.setLineWidth(0.6)
  doc.line(margin, footerY, pageW - margin, footerY)

  // Footer text
  doc.setFontSize(7)
  doc.setTextColor(...GRAY)
  doc.setFont('helvetica', 'normal')
  doc.text(
    'This is a computer-generated document and requires no signature.',
    pageW / 2, footerY + 6,
    { align: 'center' }
  )
  doc.text(
    'Optima Credit Union  |  Member FDIC  |  Equal Housing Lender',
    pageW / 2, footerY + 11,
    { align: 'center' }
  )
  doc.text(
    `\u00A9 ${new Date().getFullYear()} Optima Credit Union. All rights reserved.`,
    pageW / 2, footerY + 16,
    { align: 'center' }
  )

  // ── Bank Addresses ────────────────────────────────────
  doc.setFontSize(6.5)
  doc.setTextColor(130, 130, 130)
  doc.setFont('helvetica', 'bold')
  doc.text('U.S. Corporate Office:', margin, footerY + 24)
  doc.setFont('helvetica', 'normal')
  doc.text('4140 Church Road, Mount Laurel, N.J., 08054', margin + 32, footerY + 24)

  doc.setFont('helvetica', 'bold')
  doc.text('Customer Support:', margin, footerY + 29)
  doc.setFont('helvetica', 'normal')
  doc.text('1-800-555-0199  |  support@optimacreditunion.com', margin + 26, footerY + 29)

  // ══════════════════════════════════════════════════════════
  // WATERMARK — drawn LAST so GState opacity issue doesn't
  // affect any readable content above.
  // ══════════════════════════════════════════════════════════
  const logoW = 80
  const logoH = 71  // maintain aspect ratio
  const logoX = (pageW - logoW) / 2
  const logoY = (pageH - logoH) / 2 - 10
  try {
    doc.setGState(new doc.GState({ opacity: 0.07 }))
    doc.addImage(optimaLogoUrl, 'PNG', logoX, logoY, logoW, logoH)
    // No need to reset — watermark is the last thing drawn
  } catch (_) {
    // GState not supported in this build — skip watermark silently
  }

  // ── Save ──────────────────────────────────────────────
  const filename = `TD_Bank_${isIntl ? 'Wire' : 'Transfer'}_${txn.ref}.pdf`
  doc.save(filename)
}
