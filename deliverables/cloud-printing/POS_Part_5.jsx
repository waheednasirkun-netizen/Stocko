                  </label>
                  <input
                    type="date"
                    value={reportFilters.endDate}
                    onChange={(e) => setReportFilters(prev => ({ ...prev, endDate: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: colors.bgInput,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      color: colors.textPrimary,
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: colors.textMuted,
                    display: 'block',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    Customer
                  </label>
                  <select
                    value={reportFilters.customer}
                    onChange={(e) => setReportFilters(prev => ({ ...prev, customer: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: colors.bgInput,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      color: colors.textPrimary,
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  >
                    <option value="">All Customers</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: colors.textMuted,
                    display: 'block',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    Payment Type
                  </label>
                  <select
                    value={reportFilters.paymentType}
                    onChange={(e) => setReportFilters(prev => ({ ...prev, paymentType: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: colors.bgInput,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      color: colors.textPrimary,
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  >
                    <option value="all">All</option>
                    <option value="cash">Cash</option>
                    <option value="credit">Credit</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="debit_card">Debit Card</option>
                  </select>
                </div>

                <div>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color: colors.textMuted,
                    display: 'block',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}>
                    Status
                  </label>
                  <select
                    value={reportFilters.status}
                    onChange={(e) => setReportFilters(prev => ({ ...prev, status: e.target.value }))}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: colors.bgInput,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      color: colors.textPrimary,
                      fontSize: '14px',
                      outline: 'none',
                    }}
                  >
                    {REPORT_STATUS_OPTIONS.map(option => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '20px',
                gap: '10px',
              }}>
                <button
                  onClick={() => {
                    setReportFilters({
                      startDate: new Date().toISOString().split('T')[0],
                      endDate: new Date().toISOString().split('T')[0],
                      customer: '',
                      paymentType: 'all',
                      status: 'all',
                    })
                    loadTodayOrders()
                  }}
                  style={{
                    padding: '10px 20px',
                    background: colors.bgPage,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    color: colors.textSecondary,
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Reset
                </button>
                <button
                  onClick={generateReport}
                  disabled={reportLoading}
                  style={{
                    padding: '10px 24px',
                    background: colors.primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: 700,
                    cursor: reportLoading ? 'not-allowed' : 'pointer',
                    opacity: reportLoading ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
                  }}
                >
                  <Ic n="Search" size={14} />
                  {reportLoading ? 'Searching...' : 'Search'}
                </button>
              </div>
            </div>

            {/* Report Results */}
            <div style={{
              background: colors.bgCard,
              border: `1px solid ${colors.border}`,
              borderRadius: '10px',
              overflow: 'hidden',
              boxShadow: colors.shadowSm,
            }}>
              <div style={{
                padding: '14px 20px',
                borderBottom: `1px solid ${colors.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{
                  fontSize: '14px',
                  color: colors.textMuted,
                  fontWeight: 600,
                }}>
                  {reportData.length} orders · {formatPrice(reportData.reduce((sum, order) => (
                    order.status === ORDER_STATUS.CANCELLED ? sum : sum + safeNumber(order.total)
                  ), 0))}
                </div>
                <div style={{
                  display: 'flex',
                  gap: '6px',
                }}>
                  <button
                    onClick={exportReportCSV}
                    style={{
                      padding: '7px 11px',
                      background: colors.bgPage,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '7px',
                      color: colors.textSecondary,
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Ic n="Download" size={14} />
                    Export CSV
                  </button>
                  <button
                    onClick={printReport}
                    disabled={Boolean(printingJobs[POS_REPORT_PRINT_KEY])}
                    style={{
                      padding: '7px 11px',
                      background: colors.primary,
                      border: `1px solid ${colors.primary}`,
                      borderRadius: '7px',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: printingJobs[POS_REPORT_PRINT_KEY] ? 'wait' : 'pointer',
                      opacity: printingJobs[POS_REPORT_PRINT_KEY] ? 0.65 : 1,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <Ic n="Printer" size={14} />
                    {printingJobs[POS_REPORT_PRINT_KEY] ? 'Queueing...' : 'Print report'}
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="stocko-pos-scroll" style={{ overflowX: 'auto' }}>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '13px',
                }}>
                  <thead>
                    <tr style={{
                      background: colors.tableHeader,
                      borderBottom: `2px solid ${colors.tableBorder}`,
                    }}>
                      {['Sr.', 'Type', 'ID', 'Invoice#', 'Order Time', 'Customer', 'Payment', 'Bill', 'Disc', 'Tax', 'Service', 'Grand Total', 'Status', 'Action'].map((header) => (
                        <th key={header} style={{
                          padding: '12px 10px',
                          textAlign: 'left',
                          color: colors.textSecondary,
                          fontWeight: 700,
                          fontSize: '12px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          whiteSpace: 'nowrap',
                        }}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.length === 0 ? (
                      <tr>
                        <td colSpan="14" style={{
                          padding: '50px',
                          textAlign: 'center',
                          color: colors.textMuted,
                        }}>
                          <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
                            No data found
                          </div>
                          <div>Click Search to generate report</div>
                        </td>
                      </tr>
                    ) : (
                      reportData.map((order, index) => (
                        <tr
                          key={order.id}
                          style={{
                            background: index % 2 === 0 ? colors.tableRow : colors.tableRowAlt,
                            borderBottom: `1px solid ${colors.tableBorder}`,
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = colors.bgHover
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = index % 2 === 0 ? colors.tableRow : colors.tableRowAlt
                          }}
                        >
                          <td style={{ padding: '12px 10px', color: colors.textSecondary }}>{index + 1}</td>
                          <td style={{ padding: '12px 10px', color: colors.textSecondary }}>
                            {(order.type || order.order_type || 'sale').replaceAll('_', ' ')}
                          </td>
                          <td style={{ padding: '12px 10px', color: colors.primary, fontWeight: 700 }}>
                            {orderReference(order)}
                          </td>
                          <td style={{ padding: '12px 10px', color: colors.textSecondary }}>{order.invoice_no || orderReference(order)}</td>
                          <td style={{ padding: '12px 10px', color: colors.textMuted, whiteSpace: 'nowrap' }}>
                            {formatDateTime(order.created_at)}
                          </td>
                          <td style={{ padding: '12px 10px', color: colors.textSecondary }}>
                            {order.customer_name || 'Walk-In'}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              background: getPaymentMethod(order) === 'cash' ? colors.successLight : 
                                         getPaymentMethod(order) === 'credit' ? colors.infoLight : 
                                         colors.bgPage,
                              color: getPaymentMethod(order) === 'cash' ? colors.success : 
                                    getPaymentMethod(order) === 'credit' ? colors.info : 
                                    colors.textSecondary,
                              border: `1px solid ${colors.border}`,
                            }}>
                              {getPaymentMethod(order)?.replaceAll('_', ' ') || 'N/A'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 10px', color: colors.textSecondary, fontWeight: 700 }}>
                            {formatPrice(order.subtotal)}
                          </td>
                          <td style={{ padding: '12px 10px', color: colors.success }}>
                            {safeNumber(order.discount) > 0 ? formatPrice(order.discount) : '—'}
                          </td>
                          <td style={{ padding: '12px 10px', color: colors.textSecondary }}>
                            {safeNumber(order.tax) > 0 ? formatPrice(order.tax) : '—'}
                          </td>
                          <td style={{ padding: '12px 10px', color: colors.textSecondary }}>
                            {getServiceCharge(order) > 0 ? formatPrice(getServiceCharge(order)) : '—'}
                          </td>
                          <td style={{ padding: '12px 10px', color: colors.primary, fontWeight: 800 }}>
                            {formatPrice(order.total)}
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <span style={{
                              padding: '3px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              ...statusStyle(order.status),
                              border: `1px solid ${colors.border}`,
                            }}>
                              {(order.status || 'pending').replaceAll('_', ' ').toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '12px 10px' }}>
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <button
                                onClick={() => handlePrintOrder(order)}
                                disabled={Boolean(printingJobs[posReceiptPrintKey(order)])}
                                style={{
                                  padding: '5px 10px',
                                  background: colors.primary,
                                  border: 'none',
                                  borderRadius: '4px',
                                  color: '#fff',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: printingJobs[posReceiptPrintKey(order)] ? 'wait' : 'pointer',
                                  opacity: printingJobs[posReceiptPrintKey(order)] ? 0.65 : 1,
                                }}
                              >
                                <Ic n="Printer" size={12} />
                              </button>
                              <button
                                onClick={() => viewOrderDetail(order)}
                                style={{
                                  padding: '5px 10px',
                                  background: colors.bgPage,
                                  border: `1px solid ${colors.border}`,
                                  borderRadius: '4px',
                                  color: colors.textSecondary,
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                }}
                              >
                                <Ic n="Eye" size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MODALS
          ═══════════════════════════════════════════════════════════════ */}

      {/* Payment Modal */}
      {showPaymentModal && paymentOrder && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => { setShowPaymentModal(false); setPaymentOrder(null) }}>
          <div className="stocko-pos-modal" style={{
            background: colors.bgModal,
            borderRadius: '14px',
            width: '90%',
            maxWidth: '900px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: colors.shadowLg,
            border: `1px solid ${colors.border}`,
          }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: 700, 
                margin: 0, 
                color: colors.textPrimary 
              }}>
                Make Payment
              </h3>
              <button
                onClick={() => { setShowPaymentModal(false); setPaymentOrder(null) }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textMuted,
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ic n="X" size={18} />
              </button>
            </div>

            <div className="stocko-pos-payment-layout" style={{ display: 'flex' }}>
              {/* Left: Order Details */}
              <div style={{
                flex: 1,
                padding: '24px',
                borderRight: `1px solid ${colors.border}`,
              }}>
                {/* Order Info */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  marginBottom: '20px',
                  fontSize: '13px',
                }}>
                  <div><span style={{ color: colors.textMuted }}>Order ID:</span> <span style={{ fontWeight: 600 }}>{orderReference(paymentOrder)}</span></div>
                  <div><span style={{ color: colors.textMuted }}>Customer:</span> <span style={{ fontWeight: 600 }}>{paymentOrder.customer_name || 'Walk-In'}</span></div>
                  <div><span style={{ color: colors.textMuted }}>Order Status:</span> <span style={{ ...statusStyle(paymentOrder.status), fontWeight: 700, padding: '2px 7px', borderRadius: '999px' }}>{(paymentOrder.status || 'pending').replaceAll('_', ' ')}</span></div>
                  <div><span style={{ color: colors.textMuted }}>Order Date:</span> <span>{formatDateTime(paymentOrder.created_at)}</span></div>
                </div>

                {/* Items Table */}
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: colors.textPrimary,
                    margin: '0 0 12px',
                    paddingBottom: '8px',
                    borderBottom: `1px solid ${colors.border}`,
                  }}>
                    Items Detail
                  </h4>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '13px',
                  }}>
                    <thead>
                      <tr style={{
                        borderBottom: `2px solid ${colors.border}`,
                      }}>
                        {['Item', 'Qty', 'Price', 'Discount', 'Tax', 'Total'].map(h => (
                          <th key={h} style={{
                            padding: '8px',
                            textAlign: h === 'Item' ? 'left' : 'center',
                            color: colors.textSecondary,
                            fontWeight: 700,
                            fontSize: '12px',
                          }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paymentOrder.order_items?.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: `1px solid ${colors.borderLight}` }}>
                          <td style={{ padding: '8px', color: colors.textPrimary }}>{item.name}</td>
                          <td style={{ padding: '8px', textAlign: 'center', color: colors.textSecondary }}>{item.quantity}</td>
                          <td style={{ padding: '8px', textAlign: 'center', color: colors.textSecondary }}>{formatPrice(extractLinePrice(item))}</td>
                          <td style={{ padding: '8px', textAlign: 'center', color: colors.textMuted }}>-</td>
                          <td style={{ padding: '8px', textAlign: 'center', color: colors.textMuted }}>-</td>
                          <td style={{ padding: '8px', textAlign: 'center', color: colors.textPrimary, fontWeight: 700 }}>
                            {formatPrice(safeNumber(item.quantity) * extractLinePrice(item))}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan="5" style={{ padding: '10px 8px', textAlign: 'right', color: colors.textMuted, fontWeight: 600 }}>
                          Sub Total
                        </td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: colors.textPrimary, fontWeight: 700 }}>
                          {formatPrice(paymentOrder.subtotal)}
                        </td>
                      </tr>
                      {getServiceCharge(paymentOrder) > 0 && (
                        <tr>
                          <td colSpan="5" style={{ padding: '6px 8px', textAlign: 'right', color: colors.textMuted, fontWeight: 600 }}>
                            Service Charge
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'center', color: colors.textPrimary, fontWeight: 700 }}>
                            {formatPrice(getServiceCharge(paymentOrder))}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right: Payment Options */}
              <div className="stocko-pos-payment-options" style={{
                width: '380px',
                padding: '24px',
                background: colors.bgPage,
              }}>
                {/* Payment Method Selection */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: colors.textMuted,
                    display: 'block',
                    marginBottom: '10px',
                    textTransform: 'uppercase',
                  }}>
                    Payment Method
                  </label>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '10px',
                  }}>
                    {PAYMENT_OPTIONS.map((method) => (
                      <button
                        key={method.id}
                        onClick={() => {
                          setPaymentMethod(method.id)
                          if (method.id !== PAYMENT_METHODS.CREDIT) {
                            setPaymentAmount(paymentDue)
                            setCashReceived(paymentDue)
                          }
                        }}
                        style={{
                          padding: '14px',
                          background: paymentMethod === method.id ? colors.primary : colors.bgCard,
                          color: paymentMethod === method.id ? '#fff' : colors.textSecondary,
                          border: `2px solid ${paymentMethod === method.id ? colors.primary : colors.border}`,
                          borderRadius: '8px',
                          fontSize: '13px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: paymentMethod === method.id ? 'rgba(255,255,255,0.2)' : colors.bgPage,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 800,
                        }}>
                          <Ic n={method.icon} size={16} />
                        </span>
                        {method.label}
                      </button>
                    ))}
                  </div>
                </div>

                {paymentMethod !== PAYMENT_METHODS.CREDIT && (
                  <label style={{
                    display: 'block',
                    marginBottom: '16px',
                    color: colors.textMuted,
                    fontSize: '12px',
                    fontWeight: 700,
                  }}>
                    Payment amount
                    <input
                      type="number"
                      min="0.01"
                      max={paymentDue}
                      step="0.01"
                      value={paymentAmount}
                      onChange={(event) => {
                        const nextAmount = Math.min(
                          paymentDue,
                          Math.max(0, safeNumber(event.target.value))
                        )
                        setPaymentAmount(nextAmount)
                        if (paymentMethod === PAYMENT_METHODS.CASH) {
                          setCashReceived(nextAmount)
                        }
                      }}
                      style={{
                        width: '100%',
                        marginTop: '6px',
                        padding: '10px 11px',
                        borderRadius: '8px',
                        border: `1px solid ${colors.border}`,
                        background: colors.bgCard,
                        color: colors.textPrimary,
                        fontSize: '16px',
                        fontWeight: 700,
                        outline: 'none',
                        textAlign: 'right',
                      }}
                    />
                  </label>
                )}

                {/* Cash Input (only for cash) */}
                {paymentMethod === PAYMENT_METHODS.CASH && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      fontSize: '12px',
                      fontWeight: 700,
                      color: colors.textMuted,
                      display: 'block',
                      marginBottom: '6px',
                    }}>
                      Cash Given By Customer
                    </label>
                    <input
                      type="number"
                      min={paymentAmount}
                      value={cashReceived}
                      onChange={(e) => setCashReceived(Math.max(0, safeNumber(e.target.value)))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: colors.bgCard,
                        border: `2px solid ${colors.borderActive}`,
                        borderRadius: '6px',
                        fontSize: '18px',
                        fontWeight: 700,
                        color: colors.textPrimary,
                        outline: 'none',
                        textAlign: 'right',
                      }}
                    />
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: '6px',
                      marginTop: '8px',
                    }}>
                      {[
                        paymentAmount,
                        Math.ceil(paymentAmount / 100) * 100,
                        Math.ceil(paymentAmount / 500) * 500,
                        Math.ceil(paymentAmount / 1000) * 1000,
                      ].filter((value, index, list) => value > 0 && list.indexOf(value) === index).map(value => (
                        <button
                          key={value}
                          onClick={() => setCashReceived(value)}
                          style={{
                            padding: '7px 4px',
                            borderRadius: '7px',
                            border: `1px solid ${colors.border}`,
                            background: colors.bgCard,
                            color: colors.textSecondary,
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {safeNumber(value).toFixed(0)}
                        </button>
                      ))}
                    </div>
                    <div style={{
                      marginTop: '8px',
                      padding: '10px',
                      background: colors.bgCard,
                      borderRadius: '6px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '14px',
                    }}>
                      <span style={{ color: colors.textMuted }}>Change Return:</span>
                      <span style={{ 
                        color: cashReceived >= paymentAmount ? colors.success : colors.danger,
                        fontWeight: 700,
                      }}>
                        {formatPrice(cashChange)}
                      </span>
                    </div>
                  </div>
                )}

                {paymentMethod === PAYMENT_METHODS.CREDIT && !paymentOrder.customer_id && (
                  <div style={{
                    marginBottom: '14px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: colors.warningLight,
                    color: dark ? '#fcd34d' : '#92400e',
                    fontSize: '12px',
                    lineHeight: 1.5,
                  }}>
                    Select a named customer before recording a credit sale.
                  </div>
                )}

                <label style={{
                  display: 'block',
                  marginBottom: '16px',
                  color: colors.textMuted,
                  fontSize: '12px',
                  fontWeight: 700,
                }}>
                  Payment note
                  <input
                    value={paymentRemarks}
                    onChange={event => setPaymentRemarks(event.target.value)}
                    placeholder="Optional transaction reference"
                    maxLength={180}
                    style={{
                      width: '100%',
                      marginTop: '6px',
                      padding: '10px 11px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      background: colors.bgCard,
                      color: colors.textPrimary,
                      outline: 'none',
                    }}
                  />
                </label>

                {/* Totals */}
                <div style={{
                  borderTop: `2px solid ${colors.border}`,
                  paddingTop: '16px',
                  marginBottom: '20px',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontSize: '14px', color: colors.textMuted, fontWeight: 600 }}>Amount due</span>
                    <span style={{ 
                      fontSize: '28px', 
                      fontWeight: 900, 
                      color: colors.redText 
                    }}>
                      {formatPrice(paymentDue)}
                    </span>
                  </div>
                  {paymentMethod === PAYMENT_METHODS.CASH && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '8px',
                      fontSize: '12px',
                      color: colors.textMuted,
                    }}>
                      <span>Payment to record</span>
                      <strong style={{ color: colors.textPrimary }}>
                        {formatPrice(paymentAmount)}
                      </strong>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '10px',
                }}>
                  <button
                    onClick={() => processPayment(false)}
                    disabled={
                      paymentProcessing ||
                      (paymentMethod !== PAYMENT_METHODS.CREDIT && paymentAmount <= 0) ||
                      (paymentMethod === PAYMENT_METHODS.CASH && cashReceived < paymentAmount) ||
                      (paymentMethod === PAYMENT_METHODS.CREDIT && !paymentOrder.customer_id)
                    }
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: colors.primary,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: paymentProcessing ? 'not-allowed' : 'pointer',
                      opacity: paymentProcessing ? 0.6 : 1,
                      boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
                    }}
                  >
                    <Ic n="CheckCircle" size={15} />
                    {paymentProcessing ? 'Processing...' : 'Pay Only'}
                  </button>
                  <button
                    onClick={() => processPayment(true)}
                    disabled={
                      paymentProcessing ||
                      (paymentMethod !== PAYMENT_METHODS.CREDIT && paymentAmount <= 0) ||
                      (paymentMethod === PAYMENT_METHODS.CASH && cashReceived < paymentAmount) ||
                      (paymentMethod === PAYMENT_METHODS.CREDIT && !paymentOrder.customer_id)
                    }
                    style={{
                      flex: 1,
                      padding: '12px',
                      background: colors.primary,
                      color: '#fff',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: 700,
                      cursor: paymentProcessing ? 'not-allowed' : 'pointer',
                      opacity: paymentProcessing ? 0.6 : 1,
                      boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
                    }}
                  >
                    <Ic n="Printer" size={15} />
                    {paymentProcessing ? 'Processing...' : 'Pay & Print'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Customer Modal */}
      {showCustomerModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowCustomerModal(false)}>
          <div className="stocko-pos-modal" style={{
            background: colors.bgModal,
            borderRadius: '10px',
            padding: '28px',
            width: '90%',
            maxWidth: '440px',
            boxShadow: colors.shadowLg,
            border: `1px solid ${colors.border}`,
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '24px',
            }}>
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: 700, 
                margin: 0, 
                color: colors.textPrimary 
              }}>
                New Customer
              </h3>
              <button
                onClick={() => setShowCustomerModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textMuted,
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0',
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ic n="X" size={18} />
              </button>
            </div>

