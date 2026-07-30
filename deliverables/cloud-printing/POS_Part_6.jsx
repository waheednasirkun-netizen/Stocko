            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: colors.textMuted,
                  display: 'block',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                }}>
                  Name *
                </label>
                <input
                  type="text"
                  placeholder="Enter customer name"
                  value={newCustomer.name}
                  onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') createCustomer()
                  }}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: colors.bgInput,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    fontSize: '15px',
                    color: colors.textPrimary,
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = colors.borderActive}
                  onBlur={(e) => e.target.style.borderColor = colors.border}
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
                }}>
                  Phone
                </label>
                <input
                  type="tel"
                  placeholder="Enter phone number"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: colors.bgInput,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    fontSize: '15px',
                    color: colors.textPrimary,
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = colors.borderActive}
                  onBlur={(e) => e.target.style.borderColor = colors.border}
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
                }}>
                  Email
                </label>
                <input
                  type="email"
                  placeholder="Enter email address"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: colors.bgInput,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    fontSize: '15px',
                    color: colors.textPrimary,
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = colors.borderActive}
                  onBlur={(e) => e.target.style.borderColor = colors.border}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowCustomerModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: colors.bgPage,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: colors.textSecondary,
                }}
              >
                Cancel
              </button>
              <button
                onClick={createCustomer}
                disabled={!newCustomer.name.trim()}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: colors.success,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: newCustomer.name.trim() ? 'pointer' : 'not-allowed',
                  opacity: newCustomer.name.trim() ? 1 : 0.55,
                  boxShadow: '0 2px 6px rgba(76, 175, 80, 0.3)',
                }}
              >
                Create Customer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Reason Modal */}
      {showCancelModal && cancelTarget && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: theme?.overlayBg || 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={() => {
            setShowCancelModal(false)
            setCancelTarget(null)
            setCancelReason('')
          }}
        >
          <div
            className="stocko-pos-modal"
            style={{
              width: '100%',
              maxWidth: '500px',
              background: colors.bgModal,
              border: `1px solid ${colors.border}`,
              borderRadius: '14px',
              boxShadow: colors.shadowLg,
              overflow: 'hidden',
            }}
            onClick={event => event.stopPropagation()}
          >
            <div style={{
              padding: '18px 20px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}>
              <div>
                <h3 style={{ margin: '0 0 3px', color: colors.textPrimary, fontSize: '17px' }}>
                  Cancel order #{orderReference(cancelTarget)}
                </h3>
                <p style={{ margin: 0, color: colors.textMuted, fontSize: '12px' }}>
                  Inventory will be restored and the action will be recorded.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowCancelModal(false)
                  setCancelTarget(null)
                  setCancelReason('')
                }}
                aria-label="Close cancellation dialog"
                style={{
                  width: '32px',
                  height: '32px',
                  border: 'none',
                  borderRadius: '8px',
                  background: colors.bgHover,
                  color: colors.textMuted,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ic n="X" size={17} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
                padding: '12px',
                marginBottom: '16px',
                borderRadius: '10px',
                background: colors.bgPage,
                border: `1px solid ${colors.border}`,
              }}>
                <div>
                  <span style={{ display: 'block', color: colors.textMuted, fontSize: '11px' }}>Customer</span>
                  <strong style={{ color: colors.textPrimary, fontSize: '13px' }}>
                    {cancelTarget.customer_name || 'Walk-In'}
                  </strong>
                </div>
                <div>
                  <span style={{ display: 'block', color: colors.textMuted, fontSize: '11px' }}>Order total</span>
                  <strong style={{ color: colors.primary, fontSize: '13px' }}>
                    {formatPrice(cancelTarget.total)}
                  </strong>
                </div>
              </div>

              <label style={{
                display: 'block',
                color: colors.textSecondary,
                fontSize: '12px',
                fontWeight: 700,
              }}>
                Cancellation reason *
                <textarea
                  autoFocus
                  value={cancelReason}
                  onChange={event => setCancelReason(event.target.value)}
                  placeholder="Explain why this order is being cancelled"
                  maxLength={300}
                  rows={4}
                  style={{
                    width: '100%',
                    marginTop: '7px',
                    padding: '11px 12px',
                    resize: 'vertical',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '9px',
                    background: colors.bgInput,
                    color: colors.textPrimary,
                    outline: 'none',
                    lineHeight: 1.5,
                  }}
                />
              </label>
              <div style={{ textAlign: 'right', color: colors.textMuted, fontSize: '10px' }}>
                {cancelReason.length}/300
              </div>
            </div>

            <div style={{
              padding: '14px 20px',
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '9px',
              background: colors.bgPage,
            }}>
              <button
                onClick={() => {
                  setShowCancelModal(false)
                  setCancelTarget(null)
                  setCancelReason('')
                }}
                style={{
                  padding: '9px 14px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  background: colors.bgCard,
                  color: colors.textSecondary,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Keep order
              </button>
              <button
                onClick={requestCancellationAuthorization}
                disabled={!cancelReason.trim()}
                style={{
                  padding: '9px 14px',
                  border: 'none',
                  borderRadius: '8px',
                  background: colors.danger,
                  color: '#fff',
                  fontWeight: 700,
                  cursor: cancelReason.trim() ? 'pointer' : 'not-allowed',
                  opacity: cancelReason.trim() ? 1 : 0.55,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Ic n="Lock" size={14} />
                Authorize cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Auth Modal (Manager Password Required) */}
      {showAuthModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => { setShowAuthModal(false); setAuthAction(null); setAuthPassword('') }}>
          <div className="stocko-pos-modal" style={{
            background: colors.bgModal,
            borderRadius: '10px',
            padding: '28px',
            width: '90%',
            maxWidth: '480px',
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
                Manager authorization
              </h3>
              <button
                onClick={() => { setShowAuthModal(false); setAuthAction(null); setAuthPassword('') }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textMuted,
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0',
                }}
              >
                <Ic n="X" size={18} />
              </button>
            </div>

            <div style={{
              marginBottom: '24px',
              padding: '16px',
              background: colors.dangerLight,
              borderRadius: '8px',
              border: `1px solid rgba(244, 67, 54, 0.2)`,
            }}>
              <p style={{ margin: 0, color: colors.danger, fontSize: '14px', fontWeight: 600 }}>
                Confirm this restricted {authAction?.type || 'management'} action using
                the currently signed-in manager or administrator account.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: colors.textMuted,
                  display: 'block',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                }}>
                  User
                </label>
                <div
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: colors.bgInput,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    color: colors.textPrimary,
                  }}
                >
                  {user?.name || user?.email || 'Current user'} · {user?.role || 'Manager'}
                </div>
              </div>
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: colors.textMuted,
                  display: 'block',
                  marginBottom: '6px',
                  textTransform: 'uppercase',
                }}>
                  Password
                </label>
                <input
                  type="password"
                  placeholder="Enter Password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && checkAuth()}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: colors.bgInput,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '6px',
                    fontSize: '14px',
                    color: colors.textPrimary,
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => e.target.style.borderColor = colors.borderActive}
                  onBlur={(e) => e.target.style.borderColor = colors.border}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowAuthModal(false); setAuthAction(null); setAuthPassword('') }}
                style={{
                  padding: '12px 20px',
                  background: colors.bgPage,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: colors.textSecondary,
                }}
              >
                Close
              </button>
              <button
                onClick={checkAuth}
                disabled={authProcessing || !authPassword}
                style={{
                  padding: '12px 20px',
                  background: colors.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: authProcessing || !authPassword ? 'not-allowed' : 'pointer',
                  opacity: authProcessing || !authPassword ? 0.6 : 1,
                  boxShadow: '0 2px 8px rgba(33, 150, 243, 0.3)',
                }}
              >
                {authProcessing ? 'Verifying…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {showOrderDetailModal && detailOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: theme?.overlayBg || 'rgba(15, 23, 42, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={() => {
            setShowOrderDetailModal(false)
            setDetailOrder(null)
          }}
        >
          <div
            className="stocko-pos-modal stocko-pos-scroll"
            style={{
              width: '100%',
              maxWidth: '760px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: colors.bgModal,
              border: `1px solid ${colors.border}`,
              borderRadius: '14px',
              boxShadow: colors.shadowLg,
            }}
            onClick={event => event.stopPropagation()}
          >
            <div style={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              padding: '18px 20px',
              background: colors.bgModal,
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}>
              <div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '9px',
                  marginBottom: '3px',
                }}>
                  <h3 style={{ margin: 0, color: colors.textPrimary, fontSize: '18px' }}>
                    Order #{orderReference(detailOrder)}
                  </h3>
                  <span style={{
                    ...statusStyle(detailOrder.status),
                    padding: '3px 8px',
                    borderRadius: '999px',
                    fontSize: '10px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                  }}>
                    {(detailOrder.status || 'pending').replaceAll('_', ' ')}
                  </span>
                </div>
                <p style={{ margin: 0, color: colors.textMuted, fontSize: '12px' }}>
                  {formatDateTime(detailOrder.created_at)}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowOrderDetailModal(false)
                  setDetailOrder(null)
                }}
                aria-label="Close order details"
                style={{
                  width: '34px',
                  height: '34px',
                  border: 'none',
                  borderRadius: '8px',
                  background: colors.bgHover,
                  color: colors.textMuted,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ic n="X" size={17} />
              </button>
            </div>

            <div style={{ padding: '20px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '10px',
                marginBottom: '18px',
              }}>
                {[
                  ['Customer', detailOrder.customer_name || 'Walk-In'],
                  ['Order type', (detailOrder.type || detailOrder.order_type || 'sale').replaceAll('_', ' ')],
                  ['Payment', (getPaymentMethod(detailOrder) || 'Not paid').replaceAll('_', ' ')],
                  ['Cashier', detailOrder.created_by_name || 'Unknown'],
                  ['Reference', detailOrder.reference || '—'],
                  ['Items', String(detailOrder.order_items?.length || 0)],
                ].map(([label, value]) => (
                  <div key={label} style={{
                    padding: '10px 12px',
                    borderRadius: '9px',
                    background: colors.bgPage,
                    border: `1px solid ${colors.border}`,
                  }}>
                    <span style={{
                      display: 'block',
                      marginBottom: '3px',
                      color: colors.textMuted,
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}>
                      {label}
                    </span>
                    <strong style={{ color: colors.textPrimary, fontSize: '13px', textTransform: 'capitalize' }}>
                      {value}
                    </strong>
                  </div>
                ))}
              </div>

              {detailOrder.notes && (
                <div style={{
                  padding: '11px 12px',
                  marginBottom: '16px',
                  borderRadius: '9px',
                  background: colors.warningLight,
                  color: dark ? '#fde68a' : '#92400e',
                  fontSize: '12px',
                  lineHeight: 1.5,
                }}>
                  <strong>Order note:</strong> {detailOrder.notes}
                </div>
              )}

              <div className="stocko-pos-scroll" style={{
                overflowX: 'auto',
                border: `1px solid ${colors.border}`,
                borderRadius: '10px',
              }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: colors.tableHeader }}>
                      {['Item', 'Qty', 'Price', 'Subtotal'].map(header => (
                        <th key={header} style={{
                          padding: '10px 12px',
                          textAlign: header === 'Item' ? 'left' : 'right',
                          color: colors.textSecondary,
                          borderBottom: `1px solid ${colors.border}`,
                        }}>
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(detailOrder.order_items || []).map((item, index) => (
                      <tr key={item.id || `${item.inventory_id}-${index}`}>
                        <td style={{
                          padding: '10px 12px',
                          color: colors.textPrimary,
                          borderBottom: `1px solid ${colors.borderLight}`,
                        }}>
                          {item.name || 'Item'}
                        </td>
                        <td style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          color: colors.textSecondary,
                          borderBottom: `1px solid ${colors.borderLight}`,
                        }}>
                          {safeNumber(item.quantity)}
                        </td>
                        <td style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          color: colors.textSecondary,
                          borderBottom: `1px solid ${colors.borderLight}`,
                        }}>
                          {formatPrice(extractLinePrice(item))}
                        </td>
                        <td style={{
                          padding: '10px 12px',
                          textAlign: 'right',
                          color: colors.textPrimary,
                          fontWeight: 700,
                          borderBottom: `1px solid ${colors.borderLight}`,
                        }}>
                          {formatPrice(safeNumber(item.quantity) * extractLinePrice(item))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{
                width: 'min(100%, 320px)',
                marginLeft: 'auto',
                marginTop: '16px',
                display: 'grid',
                gap: '7px',
              }}>
                {[
                  ['Subtotal', safeNumber(detailOrder.subtotal), false],
                  ['Discount', -safeNumber(detailOrder.discount), false],
                  ['Tax', safeNumber(detailOrder.tax), false],
                  ['Service charge', getServiceCharge(detailOrder), false],
                  ['Total', safeNumber(detailOrder.total), true],
                ].map(([label, value, important]) => (
                  <div key={label} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: important ? '10px' : 0,
                    marginTop: important ? '3px' : 0,
                    borderTop: important ? `2px solid ${colors.border}` : 'none',
                    color: important ? colors.textPrimary : colors.textMuted,
                    fontSize: important ? '15px' : '12px',
                    fontWeight: important ? 800 : 600,
                  }}>
                    <span>{label}</span>
                    <span style={{ color: important ? colors.primary : 'inherit' }}>
                      {value < 0 ? `-${formatPrice(Math.abs(value))}` : formatPrice(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              padding: '14px 20px',
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '9px',
              background: colors.bgPage,
            }}>
              <button
                onClick={() => handlePrintOrder(detailOrder)}
                disabled={Boolean(printingJobs[posReceiptPrintKey(detailOrder)])}
                style={{
                  padding: '9px 13px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  background: colors.bgCard,
                  color: colors.textSecondary,
                  fontWeight: 700,
                  cursor: printingJobs[posReceiptPrintKey(detailOrder)] ? 'wait' : 'pointer',
                  opacity: printingJobs[posReceiptPrintKey(detailOrder)] ? 0.65 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Ic n="Printer" size={15} />
                {printingJobs[posReceiptPrintKey(detailOrder)] ? 'Queueing...' : 'Print receipt'}
              </button>
              {[ORDER_STATUS.PENDING, ORDER_STATUS.PARTIALLY_PAID].includes(detailOrder.status) && (
                <button
                  onClick={() => {
                    setShowOrderDetailModal(false)
                    openPaymentModal(detailOrder)
                  }}
                  style={{
                    padding: '9px 13px',
                    border: 'none',
                    borderRadius: '8px',
                    background: colors.success,
                    color: '#fff',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Ic n="DollarSign" size={15} />
                  Take payment
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Customer History Modal */}
      {showHistoryModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setShowHistoryModal(false)}>
          <div className="stocko-pos-modal stocko-pos-scroll" style={{
            background: colors.bgModal,
            borderRadius: '10px',
            padding: '24px',
            width: '90%',
            maxWidth: '700px',
            maxHeight: '80vh',
            overflowY: 'auto',
            boxShadow: colors.shadowLg,
            border: `1px solid ${colors.border}`,
          }} onClick={e => e.stopPropagation()}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '20px',
            }}>
              <h3 style={{ 
                fontSize: '20px', 
                fontWeight: 700, 
                margin: 0, 
                color: colors.textPrimary 
              }}>
                Customer History: {selectedCustomer?.name}
              </h3>
              <button
                onClick={() => setShowHistoryModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textMuted,
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '0',
                }}
              >
                <Ic n="X" size={18} />
              </button>
            </div>

            {customerHistory.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px',
                color: colors.textMuted,
              }}>
                <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
                  No order history
                </div>
                <div>This customer has no previous orders</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {customerHistory.map((order) => (
                  <div
                    key={order.id}
                    style={{
                      background: colors.bgPage,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      padding: '14px',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '6px',
                    }}>
                      <span style={{ color: colors.textPrimary, fontWeight: 700 }}>
                        #{orderReference(order)}
                      </span>
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
                    </div>
                    <div style={{
                      fontSize: '13px',
                      color: colors.textMuted,
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}>
                      <span>{formatDateTime(order.created_at)}</span>
                      <span style={{ color: colors.primary, fontWeight: 700 }}>
                        {formatPrice(order.total)}
                      </span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '7px',
                      marginTop: '10px',
                    }}>
                      <button
                        onClick={() => {
                          setShowHistoryModal(false)
                          viewOrderDetail(order)
                        }}
                        style={{
                          padding: '6px 9px',
                          borderRadius: '7px',
                          border: `1px solid ${colors.border}`,
                          background: colors.bgCard,
                          color: colors.textSecondary,
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <Ic n="Eye" size={12} />
                        Details
                      </button>
                      <button
                        onClick={() => handlePrintOrder(order)}
                        disabled={Boolean(printingJobs[posReceiptPrintKey(order)])}
                        style={{
                          padding: '6px 9px',
                          borderRadius: '7px',
                          border: `1px solid ${colors.border}`,
                          background: colors.bgCard,
                          color: colors.textSecondary,
                          fontSize: '11px',
                          fontWeight: 700,
                          cursor: printingJobs[posReceiptPrintKey(order)] ? 'wait' : 'pointer',
                          opacity: printingJobs[posReceiptPrintKey(order)] ? 0.65 : 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <Ic n="Printer" size={12} />
                        {printingJobs[posReceiptPrintKey(order)] ? 'Queueing...' : 'Print'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
