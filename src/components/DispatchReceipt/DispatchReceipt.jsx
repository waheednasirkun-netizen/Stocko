import { useMemo } from 'react'
import './DispatchReceipt.css'

/**
 * DispatchReceipt
 * 
 * Professional Epson 80mm thermal printer receipt.
 * HIGH CONTRAST VERSION - All text is pure black for thermal printers.
 * 
 * Printable content width: 72mm
 * Paper size: 80mm
 */

const SEPARATOR = '----------------------------------------'

export default function DispatchReceipt({
  request,
  item,
  qty,
  notes,
  user,
  fulfilled,
  remaining,
  newStatus,
  timestamp,
  branchName,
}) {
  const data = useMemo(() => {
    const dateStr = timestamp
      ? timestamp.toLocaleDateString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })
      : 'N/A'

    const timeStr = timestamp
      ? timestamp.toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'N/A'

    const refId = request?.id?.slice(-8)?.toUpperCase() || 'N/A'
    const branch = branchName || request?.branch_name || 'MAIN BRANCH'

    return {
      branch,
      refId,
      dateStr,
      timeStr,
      department: request?.department || 'N/A',
      requestedBy: request?.created_by_name || request?.createdBy || 'N/A',
      fulfilledBy: user?.name || user?.email || 'N/A',
      itemName: item?._displayName || 'N/A',
      category: request?.category || 'N/A',
      unit: item?._unit || 'pcs',
      requestedQty: Number(item?._qty || 0),
      fulfilledQty: Number(fulfilled || 0),
      remainingQty: Number(remaining || 0),
      thisDispatchQty: Number(qty || 0),
      prevFulfilledQty: Number(fulfilled || 0) - Number(qty || 0),
      newStatus: newStatus || 'Pending',
      notes: notes || '',
    }
  }, [request, item, qty, user, fulfilled, remaining, newStatus, timestamp, branchName])

  return (
    <div className="receipt-root">
      <div className="receipt-paper">

        {/* === STORE HEADER === */}
        <div className="receipt-center receipt-store-name">
          {data.branch}
        </div>
        <div className="receipt-center receipt-subtitle">
          DISPATCH RECEIPT
        </div>

        <div className="receipt-separator">{SEPARATOR}</div>

        {/* === REFERENCE & DATE === */}
        <table className="receipt-table">
          <tbody>
            <tr>
              <td className="receipt-label">REF #</td>
              <td className="receipt-value">{data.refId}</td>
            </tr>
            <tr>
              <td className="receipt-label">DATE</td>
              <td className="receipt-value">{data.dateStr}</td>
            </tr>
            <tr>
              <td className="receipt-label">TIME</td>
              <td className="receipt-value">{data.timeStr}</td>
            </tr>
          </tbody>
        </table>

        <div className="receipt-separator">{SEPARATOR}</div>

        {/* === PEOPLE === */}
        <table className="receipt-table">
          <tbody>
            <tr>
              <td className="receipt-label">DEPARTMENT</td>
              <td className="receipt-value">{data.department}</td>
            </tr>
            <tr>
              <td className="receipt-label">REQUESTED BY</td>
              <td className="receipt-value">{data.requestedBy}</td>
            </tr>
            <tr>
              <td className="receipt-label">FULFILLED BY</td>
              <td className="receipt-value">{data.fulfilledBy}</td>
            </tr>
          </tbody>
        </table>

        <div className="receipt-separator">{SEPARATOR}</div>

        {/* === ITEM DETAILS === */}
        <div className="receipt-section-title">ITEM DETAILS</div>

        <table className="receipt-table">
          <tbody>
            <tr>
              <td className="receipt-label">ITEM</td>
              <td className="receipt-value">{data.itemName}</td>
            </tr>
            <tr>
              <td className="receipt-label">CATEGORY</td>
              <td className="receipt-value">{data.category}</td>
            </tr>
            <tr>
              <td className="receipt-label">UNIT</td>
              <td className="receipt-value">{data.unit}</td>
            </tr>
          </tbody>
        </table>

        <div className="receipt-separator">{SEPARATOR}</div>

        {/* === QUANTITIES === */}
        <table className="receipt-table">
          <tbody>
            <tr>
              <td className="receipt-label">TOTAL REQUESTED</td>
              <td className="receipt-value">{data.requestedQty}</td>
            </tr>
            <tr>
              <td className="receipt-label">PREVIOUSLY FULFILLED</td>
              <td className="receipt-value">{data.prevFulfilledQty}</td>
            </tr>
            <tr>
              <td className="receipt-label receipt-highlight-label">THIS DISPATCH</td>
              <td className="receipt-value receipt-highlight-value">
                + {data.thisDispatchQty}
              </td>
            </tr>
            <tr>
              <td className="receipt-label">NOW FULFILLED</td>
              <td className="receipt-value">{data.fulfilledQty}</td>
            </tr>
            <tr>
              <td className="receipt-label">REMAINING</td>
              <td className="receipt-value">{data.remainingQty}</td>
            </tr>
          </tbody>
        </table>

        <div className="receipt-separator">{SEPARATOR}</div>

        {/* === STATUS BOX === */}
        <div
          className={
            data.newStatus === 'Completed'
              ? 'receipt-status-box receipt-status-completed'
              : 'receipt-status-box receipt-status-partial'
          }
        >
          {data.newStatus === 'Completed'
            ? 'FULLY FULFILLED'
            : 'PARTIALLY FULFILLED'}
        </div>

        {/* === NOTES === */}
        {data.notes && (
          <>
            <div className="receipt-separator">{SEPARATOR}</div>
            <div className="receipt-notes">
              <span className="receipt-bold">NOTES:</span> {data.notes}
            </div>
          </>
        )}

        <div className="receipt-separator">{SEPARATOR}</div>

        {/* === BARCODE === */}
        <div className="receipt-barcode">*{data.refId}*</div>
        <div className="receipt-barcode-text">{data.refId}</div>

        <div className="receipt-separator">{SEPARATOR}</div>

        {/* === FOOTER === */}
        <div className="receipt-center receipt-footer">
          PRINTED: {data.dateStr} {data.timeStr}
        </div>

        <div className="receipt-software-by">
          SOFTWARE BY STOCKO
        </div>

      </div>
    </div>
  )
}