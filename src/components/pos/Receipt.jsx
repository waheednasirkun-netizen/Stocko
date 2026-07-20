// ==========================================
// Receipt.jsx — A4 + Thermal (80mm) printable
// ==========================================
import { useRef } from 'react'
import { useApp } from '../../context/AppContext'

const PAYMENT_LABELS = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  credit: 'Credit',
}

export default function Receipt({
  sale, items, customer, payment,
  type = 'a4', onClose, branch, user,
}) {
  const receiptRef = useRef(null)
  const { theme } = useApp()

  /* ── Stocko Design Tokens (theme-aware) ── */
  const bg = theme.cardBg || '#ffffff'
  const cardBg = theme.bg || '#f8fafc'
  const border = theme.border || '#e2e8f0'
  const text = theme.text || '#0f172a'
  const muted = theme.textMuted || '#64748b'
  const accent = theme.primary || '#3b82f6'

  const format = (n) => `Rs. ${(n || 0).toFixed(2)}`

  const formatDate = (str) => {
    if (!str) return 'N/A'
    return new Date(str).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  const handlePrint = () => {
    const content = receiptRef.current
    if (!content) return
    const isThermal = type === 'thermal'
    const w = window.open('', '_blank')
    if (!w) return

    w.document.write(`
      <!DOCTYPE html>
      <html><head><title>Receipt ${sale?.invoice_no || ''}</title>
      <style>
        @page { size: ${isThermal ? '80mm' : '210mm'} auto; margin: 0; }
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Courier New',monospace; font-size:${isThermal ? '12px' : '14px'};
          line-height:1.4; color:#000; background:#fff; padding:${isThermal ? '8px' : '40px'};
          width:${isThermal ? '80mm' : '210mm'}; }
        .header { text-align:center; margin-bottom:${isThermal ? '8px' : '20px'};
          padding-bottom:${isThermal ? '8px' : '16px'};
          border-bottom:${isThermal ? '1px dashed #000' : '2px solid #000'}; }
        .header h1 { font-size:${isThermal ? '16px' : '28px'}; margin-bottom:4px; font-weight:bold; }
        .header .sub { font-size:${isThermal ? '10px' : '12px'}; color:#333; }
        .section { margin-bottom:${isThermal ? '8px' : '16px'};
          padding-bottom:${isThermal ? '8px' : '12px'};
          border-bottom:${isThermal ? '1px dashed #ccc' : '1px solid #eee'}; }
        .row { display:flex; justify-content:space-between; margin-bottom:2px; }
        .label { font-weight:bold; }
        table { width:100%; border-collapse:collapse; margin-bottom:${isThermal ? '8px' : '16px'}; }
        th { text-align:left; border-bottom:${isThermal ? '1px dashed #000' : '2px solid #000'};
          padding-bottom:4px; font-size:${isThermal ? '11px' : '13px'}; font-weight:bold; }
        td { padding:3px 0; vertical-align:top; font-size:${isThermal ? '11px' : '13px'}; }
        .qty { text-align:center; width:40px; }
        .right { text-align:right; width:80px; }
        .totals { margin-top:${isThermal ? '8px' : '16px'};
          padding-top:${isThermal ? '8px' : '12px'};
          border-top:${isThermal ? '1px dashed #000' : '2px solid #000'}; }
        .grand { font-size:${isThermal ? '14px' : '18px'}; font-weight:bold;
          border-top:1px solid #000; padding-top:4px; margin-top:4px; }
        .footer { text-align:center; margin-top:${isThermal ? '20px' : '40px'};
          padding-top:${isThermal ? '12px' : '20px'};
          border-top:${isThermal ? '1px dashed #000' : '1px solid #ccc'};
          font-size:${isThermal ? '11px' : '13px'}; color:#333; }
        .barcode { text-align:center; margin-top:8px; font-family:'Courier New',monospace;
          font-size:20px; letter-spacing:2px; }
        @media print { body { -webkit-print-color-adjust: exact; } }
      </style></head><body>
      ${content.innerHTML}
      </body></html>
    `)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 250)
  }

  if (!sale) return null
  const isThermal = type === 'thermal'

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000, padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: bg, borderRadius: 16, width: '100%',
        maxWidth: isThermal ? 400 : 700, maxHeight: '90vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', boxShadow: theme.shadowLg || '0 24px 64px rgba(0,0,0,0.2)',
        border: `1px solid ${border}`,
      }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{
          padding: '16px 24px', borderBottom: `1px solid ${border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: cardBg,
        }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: text }}>
            {isThermal ? 'Thermal Receipt (80mm)' : 'A4 Invoice'}
          </h3>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: muted,
            width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }} onMouseEnter={e => e.currentTarget.style.background = theme.cardHover || '#f1f5f9'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>✕</button>
        </div>

        {/* Preview */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: cardBg }}>
          <div ref={receiptRef} style={{
            background: '#fff', padding: isThermal ? 16 : 40,
            maxWidth: isThermal ? 320 : 600, margin: '0 auto',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            fontFamily: "'Courier New', monospace", color: '#000',
            fontSize: isThermal ? 12 : 14, lineHeight: '1.4',
            borderRadius: 8,
          }}>
            {/* Receipt Header */}
            <div style={{
              textAlign: 'center', marginBottom: isThermal ? 12 : 24,
              paddingBottom: isThermal ? 12 : 20,
              borderBottom: isThermal ? '1px dashed #000' : '2px solid #000',
            }}>
              <h1 style={{ fontSize: isThermal ? 16 : 28, margin: '0 0 4px 0', fontWeight: 'bold', color: '#000' }}>
                {branch?.name || 'Stocko POS'}
              </h1>
              <div style={{ fontSize: isThermal ? 10 : 12, color: '#333' }}>
                {branch?.address || 'Your Business Address'}
              </div>
              {branch?.phone && <div style={{ fontSize: isThermal ? 10 : 12, color: '#333' }}>Tel: {branch.phone}</div>}
            </div>

            {/* Info */}
            <div style={{
              marginBottom: isThermal ? 12 : 20,
              paddingBottom: isThermal ? 12 : 16,
              borderBottom: isThermal ? '1px dashed #ccc' : '1px solid #eee',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontWeight: 'bold' }}>Invoice:</span><span>{sale.invoice_no}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontWeight: 'bold' }}>Date:</span><span>{formatDate(sale.created_at)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ fontWeight: 'bold' }}>Cashier:</span><span>{user?.name || user?.email || 'Staff'}</span>
              </div>
            </div>

            {/* Customer */}
            <div style={{
              marginBottom: isThermal ? 12 : 20,
              paddingBottom: isThermal ? 12 : 16,
              borderBottom: isThermal ? '1px dashed #ccc' : '1px solid #eee',
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Customer:</div>
              <div>{customer?.name || 'Walk-in Customer'}</div>
              {customer?.phone && <div>{customer.phone}</div>}
              {customer?.address && <div>{customer.address}</div>}
            </div>

            {/* Items */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: isThermal ? 12 : 20 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', borderBottom: isThermal ? '1px dashed #000' : '2px solid #000', paddingBottom: 4, fontSize: isThermal ? 11 : 13, fontWeight: 'bold' }}>Item</th>
                  <th style={{ textAlign: 'center', borderBottom: isThermal ? '1px dashed #000' : '2px solid #000', paddingBottom: 4, fontSize: isThermal ? 11 : 13, fontWeight: 'bold', width: 40 }}>Qty</th>
                  <th style={{ textAlign: 'right', borderBottom: isThermal ? '1px dashed #000' : '2px solid #000', paddingBottom: 4, fontSize: isThermal ? 11 : 13, fontWeight: 'bold', width: 80 }}>Price</th>
                  <th style={{ textAlign: 'right', borderBottom: isThermal ? '1px dashed #000' : '2px solid #000', paddingBottom: 4, fontSize: isThermal ? 11 : 13, fontWeight: 'bold', width: 80 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td style={{ padding: '3px 0', verticalAlign: 'top', fontSize: isThermal ? 11 : 13 }}>{item.item_name}</td>
                    <td style={{ textAlign: 'center', padding: '3px 0', verticalAlign: 'top', fontSize: isThermal ? 11 : 13 }}>{item.qty}</td>
                    <td style={{ textAlign: 'right', padding: '3px 0', verticalAlign: 'top', fontSize: isThermal ? 11 : 13 }}>{format(item.unit_price)}</td>
                    <td style={{ textAlign: 'right', padding: '3px 0', verticalAlign: 'top', fontSize: isThermal ? 11 : 13 }}>{format(item.qty * item.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{
              marginTop: isThermal ? 8 : 16,
              paddingTop: isThermal ? 8 : 12,
              borderTop: isThermal ? '1px dashed #000' : '2px solid #000',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span>Subtotal:</span><span>{format(sale.subtotal)}</span>
              </div>
              {sale.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span>Discount:</span><span>-{format(sale.discount)}</span>
                </div>
              )}
              {sale.tax > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <span>Tax:</span><span>+{format(sale.tax)}</span>
                </div>
              )}
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: isThermal ? 14 : 18, fontWeight: 'bold',
                borderTop: '1px solid #000', paddingTop: 4, marginTop: 4,
              }}>
                <span>Total:</span><span>{format(sale.total)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span>Paid:</span><span>{format(sale.paid)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Due:</span><span>{format(sale.due)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Method:</span><span>{PAYMENT_LABELS[payment?.payment_method] || 'Cash'}</span>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              textAlign: 'center', marginTop: isThermal ? 20 : 40,
              paddingTop: isThermal ? 12 : 20,
              borderTop: isThermal ? '1px dashed #000' : '1px solid #ccc',
              fontSize: isThermal ? 11 : 13, color: '#333',
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>Thank you for your business!</div>
              <div>Please keep this receipt for your records</div>
              <div style={{ marginTop: 8, fontFamily: "'Courier New', monospace", letterSpacing: 2, fontSize: 20 }}>
                *{sale.invoice_no}*
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: '16px 24px', borderTop: `1px solid ${border}`,
          display: 'flex', gap: 12, background: cardBg,
        }}>
          <button onClick={onClose} style={{
            flex: 1, padding: 12, borderRadius: 10, border: `1px solid ${border}`,
            background: 'transparent', color: text, cursor: 'pointer',
            fontSize: 14, fontWeight: 600, transition: 'all 0.15s',
          }}>Close</button>
          <button onClick={handlePrint} style={{
            flex: 2, padding: 12, borderRadius: 10, border: 'none',
            background: accent, color: '#fff', cursor: 'pointer',
            fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.15s', boxShadow: `0 4px 14px ${accent}60`,
          }}>🖨️ Print {isThermal ? 'Thermal' : 'A4'} Receipt</button>
        </div>
      </div>
    </div>
  )
}