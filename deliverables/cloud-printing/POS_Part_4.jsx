                              {formatPrice(extractLinePrice(item))} each
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: colors.danger,
                              cursor: 'pointer',
                              fontSize: '20px',
                              padding: '0 4px',
                              opacity: 0.6,
                              transition: 'opacity 0.2s',
                              lineHeight: 1,
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
                          >
                            <Ic n="X" size={15} />
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity - 1)}
                            style={{
                              width: '30px',
                              height: '30px',
                              border: `1px solid ${colors.border}`,
                              background: colors.bgPage,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '16px',
                              color: colors.textSecondary,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s',
                              fontWeight: 700,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = colors.borderActive
                              e.currentTarget.style.color = colors.primary
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = colors.border
                              e.currentTarget.style.color = colors.textSecondary
                            }}
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                            style={{
                              width: '55px',
                              textAlign: 'center',
                              padding: '6px',
                              border: `1px solid ${colors.border}`,
                              borderRadius: '6px',
                              fontSize: '14px',
                              background: colors.bgInput,
                              color: colors.textPrimary,
                              outline: 'none',
                            }}
                          />
                          <button
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            style={{
                              width: '30px',
                              height: '30px',
                              border: `1px solid ${colors.border}`,
                              background: colors.bgPage,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '16px',
                              color: colors.textSecondary,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s',
                              fontWeight: 700,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = colors.borderActive
                              e.currentTarget.style.color = colors.primary
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = colors.border
                              e.currentTarget.style.color = colors.textSecondary
                            }}
                          >
                            +
                          </button>
                          <div style={{
                            flex: 1,
                            textAlign: 'right',
                            fontSize: '15px',
                            fontWeight: 700,
                            color: colors.primary,
                          }}>
                            {formatPrice(safeNumber(item.quantity) * extractLinePrice(item))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Discount, Tax & Service Charge */}
              {cart.length > 0 && (
                <div style={{
                  padding: '10px 14px',
                  borderTop: `1px solid ${colors.border}`,
                  borderBottom: `1px solid ${colors.border}`,
                  background: colors.bgPage,
                  display: 'flex',
                  gap: '10px',
                }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      color: colors.textMuted, 
                      display: 'block', 
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      Discount (Rs)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={cartSubtotal}
                      value={discount}
                      onChange={(e) => setDiscount(
                        clamp(safeNumber(e.target.value), 0, cartSubtotal)
                      )}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '6px',
                        fontSize: '14px',
                        background: colors.bgInput,
                        color: colors.textPrimary,
                        outline: 'none',
                      }}
                      onFocus={(e) => e.target.style.borderColor = colors.borderActive}
                      onBlur={(e) => e.target.style.borderColor = colors.border}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      color: colors.textMuted, 
                      display: 'block', 
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      Tax (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={taxRate}
                      onChange={(e) => setTaxRate(
                        clamp(safeNumber(e.target.value), 0, 100)
                      )}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '6px',
                        fontSize: '14px',
                        background: colors.bgInput,
                        color: colors.textPrimary,
                        outline: 'none',
                      }}
                      onFocus={(e) => e.target.style.borderColor = colors.borderActive}
                      onBlur={(e) => e.target.style.borderColor = colors.border}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: colors.textMuted,
                      display: 'block',
                      marginBottom: '4px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      Service (Rs)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={serviceCharge}
                      onChange={(event) => setServiceCharge(
                        Math.max(0, safeNumber(event.target.value))
                      )}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '6px',
                        fontSize: '14px',
                        background: colors.bgInput,
                        color: colors.textPrimary,
                        outline: 'none',
                      }}
                      onFocus={(event) => {
                        event.target.style.borderColor = colors.borderActive
                      }}
                      onBlur={(event) => {
                        event.target.style.borderColor = colors.border
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Totals */}
              {cart.length > 0 && (
                <div style={{
                  padding: '11px 14px',
                  borderBottom: `1px solid ${colors.border}`,
                  background: colors.bgCard,
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginBottom: '6px', 
                    fontSize: '12px'
                  }}>
                    <span style={{ color: colors.textMuted }}>Subtotal:</span>
                    <span style={{ fontWeight: 600, color: colors.textSecondary }}>{formatPrice(cartSubtotal)}</span>
                  </div>
                  {normalizedDiscount > 0 && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      marginBottom: '6px', 
                      fontSize: '14px' 
                    }}>
                      <span style={{ color: colors.textMuted }}>Discount:</span>
                      <span style={{ color: colors.success, fontWeight: 600 }}>-{formatPrice(normalizedDiscount)}</span>
                    </div>
                  )}
                  {cartTax > 0 && (
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      marginBottom: '8px', 
                      fontSize: '14px' 
                    }}>
                      <span style={{ color: colors.textMuted }}>Tax:</span>
                      <span style={{ fontWeight: 600, color: colors.textSecondary }}>{formatPrice(cartTax)}</span>
                    </div>
                  )}
                  {normalizedServiceCharge > 0 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: '8px',
                      fontSize: '14px'
                    }}>
                      <span style={{ color: colors.textMuted }}>Service charge:</span>
                      <span style={{ fontWeight: 600, color: colors.textSecondary }}>
                        {formatPrice(normalizedServiceCharge)}
                      </span>
                    </div>
                  )}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 0 0',
                    borderTop: `2px solid ${colors.border}`,
                    fontSize: '13px',
                  }}>
                    <span style={{ fontWeight: 700, color: colors.textPrimary }}>TOTAL</span>
                    <span style={{ 
                      fontSize: '20px',
                      fontWeight: 900, 
                      color: colors.primary 
                    }}>
                      {formatPrice(cartTotal)}
                    </span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{
                padding: '10px 12px',
                display: 'flex',
                gap: '10px',
                background: colors.bgCard,
              }}>
                <button
                  onClick={editingOrder ? cancelEditing : clearCart}
                  disabled={cart.length === 0 && !editingOrder}
                  style={{
                    padding: '9px 13px',
                    background: editingOrder ? colors.bgHover : colors.dangerLight,
                    color: editingOrder ? colors.textSecondary : colors.danger,
                    border: `1px solid ${editingOrder ? colors.border : colors.danger}`,
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: cart.length === 0 && !editingOrder ? 'not-allowed' : 'pointer',
                    opacity: cart.length === 0 && !editingOrder ? 0.4 : 1,
                    transition: 'opacity 0.2s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Ic n={editingOrder ? 'X' : 'Trash2'} size={15} />
                  {editingOrder ? 'Cancel edit' : 'Clear'}
                </button>
                <button
                  onClick={placeOrder}
                  disabled={processing || cart.length === 0}
                  style={{
                    flex: 1,
                    padding: '9px 12px',
                    background: colors.primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: processing || cart.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: processing || cart.length === 0 ? 0.5 : 1,
                    transition: 'all 0.2s',
                    boxShadow: processing || cart.length === 0 ? 'none' : '0 2px 8px rgba(33, 150, 243, 0.3)',
                  }}
                >
                  <Ic n={editingOrder ? 'Edit' : 'CheckCircle'} size={17} />
                  {processing
                    ? (editingOrder ? 'Saving…' : 'Placing…')
                    : (editingOrder ? 'Save dispatch changes' : 'Create dispatch')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: PENDING ORDERS ── */}
        {activeTab === 'pending' && (
          <div className="stocko-pos-scroll" style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            background: colors.bgPage,
          }}>
            <div className="stocko-pos-order-card-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}>
              <div>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: 750,
                  color: colors.textPrimary,
                  margin: '0 0 4px',
                }}>
                  Pending orders
                </h2>
                <p style={{ margin: 0, fontSize: '12px', color: colors.textMuted }}>
                  Review branch dispatches, print details, or use manager controls.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  padding: '7px 11px',
                  background: colors.bgCard,
                  borderRadius: '9px',
                  color: colors.textMuted,
                  fontSize: '12px',
                  border: `1px solid ${colors.border}`,
                  fontWeight: 700,
                }}>
                  {pendingOrders.length} open
                </div>
                <button
                  onClick={() => loadOrders()}
                  disabled={ordersLoading}
                  style={{
                    width: '34px',
                    height: '34px',
                    border: `1px solid ${colors.border}`,
                    background: colors.bgCard,
                    borderRadius: '9px',
                    color: colors.textMuted,
                    cursor: ordersLoading ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ic n="RefreshCw" size={15} />
                </button>
              </div>
            </div>

            {ordersLoading ? (
              <div style={{
                textAlign: 'center',
                padding: '80px 20px',
                color: colors.textMuted,
                background: colors.bgCard,
                borderRadius: '12px',
                border: `1px solid ${colors.border}`,
              }}>
                Loading pending orders…
              </div>
            ) : pendingOrders.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '80px 20px',
                color: colors.textMuted,
                background: colors.bgCard,
                borderRadius: '12px',
                border: `1px solid ${colors.border}`,
              }}>
                <div style={{ fontSize: '20px', fontWeight: 600, color: colors.textSecondary, marginBottom: '8px' }}>
                  No pending orders
                </div>
                <div style={{ fontSize: '14px' }}>All orders have been processed</div>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                {pendingOrders.map((order) => (
                  <div
                    key={order.id}
                    className="stocko-pos-table-row"
                    style={{
                      background: colors.bgCard,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '10px',
                      padding: '14px',
                      transition: 'all 0.2s',
                      boxShadow: colors.shadowSm,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.borderHover
                      e.currentTarget.style.boxShadow = colors.shadowMd
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = colors.border
                      e.currentTarget.style.boxShadow = colors.shadowSm
                    }}
                  >
                    <div className="stocko-pos-order-card-header" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '10px',
                    }}>
                      <div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: colors.textPrimary,
                          marginBottom: '4px',
                        }}>
                          Order #{orderReference(order)}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: colors.textMuted,
                        }}>
                          {formatDateTime(order.created_at)} · {order.customer_name || 'Walk-In'} · {(order.type || order.order_type || 'sale').replaceAll('_', ' ')}
                        </div>
                      </div>
                      <div style={{
                        padding: '5px 10px',
                        ...statusStyle(order.status),
                        borderRadius: '20px',
                        fontSize: '10px',
                        fontWeight: 700,
                        border: `1px solid rgba(255, 152, 0, 0.2)`,
                      }}>
                        {(order.status || ORDER_STATUS.PENDING).replaceAll('_', ' ').toUpperCase()}
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '18px',
                      marginBottom: '10px',
                      fontSize: '12px',
                    }}>
                      <div>
                        <span style={{ color: colors.textMuted }}>Items: </span>
                        <span style={{ color: colors.textSecondary, fontWeight: 700 }}>
                          {order.order_items?.length || 0}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: colors.textMuted }}>Total: </span>
                        <span style={{ color: colors.primary, fontWeight: 800 }}>
                          {formatPrice(order.total)}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: colors.textMuted }}>By: </span>
                        <span style={{ color: colors.textSecondary }}>
                          {order.created_by_name || 'Unknown'}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="stocko-pos-order-actions" style={{
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap',
                      paddingTop: '10px',
                      borderTop: `1px solid ${colors.border}`,
                    }}>
                      <button
                        onClick={() => viewOrderDetail(order)}
                        style={{
                          padding: '7px 10px',
                          background: colors.bgHover,
                          color: colors.textSecondary,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '7px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Ic n="Eye" size={14} />
                        View
                      </button>
                      <button
                        onClick={() => handlePrintOrder(order)}
                        disabled={Boolean(printingJobs[posReceiptPrintKey(order)])}
                        style={{
                          padding: '7px 10px',
                          background: colors.bgHover,
                          color: colors.textSecondary,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '7px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: printingJobs[posReceiptPrintKey(order)] ? 'wait' : 'pointer',
                          opacity: printingJobs[posReceiptPrintKey(order)] ? 0.65 : 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Ic n="Printer" size={14} />
                        {printingJobs[posReceiptPrintKey(order)] ? 'Queueing...' : 'Print'}
                      </button>
                      <button
                        onClick={() => openPaymentModal(order)}
                        style={{
                          padding: '7px 11px',
                          background: colors.success,
                          color: '#fff',
                          border: 'none',
                          borderRadius: '7px',
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Ic n="DollarSign" size={14} />
                        Pay
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => requestEditAuthorization(order)}
                            style={{
                              padding: '7px 10px',
                              background: colors.primaryLight,
                              color: colors.primary,
                              border: `1px solid ${colors.primary}`,
                              borderRadius: '7px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <Ic n="Edit" size={14} />
                            Edit
                          </button>
                          <button
                            onClick={() => cancelOrder(order)}
                            style={{
                              padding: '7px 10px',
                              background: colors.dangerLight,
                              color: colors.danger,
                              border: `1px solid ${colors.danger}`,
                              borderRadius: '7px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <Ic n="X" size={14} />
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: CANCELLED ORDERS ── */}
        {activeTab === 'cancelled' && (
          <div className="stocko-pos-scroll" style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            background: colors.bgPage,
          }}>
            <div className="stocko-pos-order-card-header" style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}>
              <div>
                <h2 style={{
                  fontSize: '18px',
                  fontWeight: 750,
                  color: colors.textPrimary,
                  margin: '0 0 4px',
                }}>
                  Cancelled orders
                </h2>
                <p style={{ margin: 0, fontSize: '12px', color: colors.textMuted }}>
                  Audit cancellation reasons and reprint archived receipts.
                </p>
              </div>
              <div style={{
                padding: '7px 11px',
                background: colors.bgCard,
                borderRadius: '20px',
                color: colors.textMuted,
                fontSize: '12px',
                border: `1px solid ${colors.border}`,
                fontWeight: 600,
              }}>
                {cancelledOrders.length} orders
              </div>
            </div>

            {cancelledOrders.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '80px 20px',
                color: colors.textMuted,
                background: colors.bgCard,
                borderRadius: '12px',
                border: `1px solid ${colors.border}`,
              }}>
                <div style={{ fontSize: '20px', fontWeight: 600, color: colors.textSecondary, marginBottom: '8px' }}>
                  No cancelled orders
                </div>
                <div style={{ fontSize: '14px' }}>No orders have been cancelled</div>
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                {cancelledOrders.map((order) => (
                  <div
                    key={order.id}
                    className="stocko-pos-table-row"
                    style={{
                      background: colors.bgCard,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '10px',
                      padding: '14px',
                      opacity: 0.85,
                      boxShadow: colors.shadowSm,
                    }}
                  >
                    <div className="stocko-pos-order-card-header" style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: '10px',
                    }}>
                      <div>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: colors.textPrimary,
                          marginBottom: '4px',
                        }}>
                          Order #{orderReference(order)}
                        </div>
                        <div style={{
                          fontSize: '12px',
                          color: colors.textMuted,
                        }}>
                          {formatDateTime(order.created_at)} · {order.customer_name || 'Walk-In'}
                        </div>
                      </div>
                      <div style={{
                        padding: '6px 14px',
                        background: colors.dangerLight,
                        borderRadius: '20px',
                        color: colors.danger,
                        fontSize: '12px',
                        fontWeight: 700,
                        border: `1px solid rgba(244, 67, 54, 0.2)`,
                      }}>
                        CANCELLED
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      gap: '24px',
                      marginBottom: '14px',
                      fontSize: '14px',
                    }}>
                      <div>
                        <span style={{ color: colors.textMuted }}>Items: </span>
                        <span style={{ color: colors.textSecondary, fontWeight: 700 }}>
                          {order.order_items?.length || 0}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: colors.textMuted }}>Total: </span>
                        <span style={{ color: colors.primary, fontWeight: 800 }}>
                          {formatPrice(order.total)}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: colors.textMuted }}>Cancelled By: </span>
                        <span style={{ color: colors.textSecondary }}>
                          {order.cancelled_by_name || order.cancelled_by || 'Unknown'}
                        </span>
                      </div>
                    </div>
                    {order.cancellation_reason && (
                      <div style={{
                        padding: '10px 12px',
                        marginBottom: '12px',
                        borderRadius: '8px',
                        background: colors.dangerLight,
                        color: dark ? '#fecaca' : '#991b1b',
                        fontSize: '12px',
                        lineHeight: 1.5,
                      }}>
                        <strong>Reason:</strong> {order.cancellation_reason}
                      </div>
                    )}
                    <div className="stocko-pos-order-actions" style={{
                      display: 'flex',
                      gap: '8px',
                      paddingTop: '12px',
                      borderTop: `1px solid ${colors.border}`,
                    }}>
                      <button
                        onClick={() => viewOrderDetail(order)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '7px',
                          border: `1px solid ${colors.border}`,
                          background: colors.bgHover,
                          color: colors.textSecondary,
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Ic n="Eye" size={14} />
                        Details
                      </button>
                      <button
                        onClick={() => handlePrintOrder(order)}
                        disabled={Boolean(printingJobs[posReceiptPrintKey(order)])}
                        style={{
                          padding: '8px 12px',
                          borderRadius: '7px',
                          border: `1px solid ${colors.border}`,
                          background: colors.bgHover,
                          color: colors.textSecondary,
                          fontSize: '12px',
                          fontWeight: 700,
                          cursor: printingJobs[posReceiptPrintKey(order)] ? 'wait' : 'pointer',
                          opacity: printingJobs[posReceiptPrintKey(order)] ? 0.65 : 1,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <Ic n="Printer" size={14} />
                        {printingJobs[posReceiptPrintKey(order)] ? 'Queueing...' : 'Receipt'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: REPORTS ── */}
        {activeTab === 'reports' && hasReportAccess && (
          <div className="stocko-pos-scroll" style={{
            flex: 1,
            padding: '16px',
            overflowY: 'auto',
            background: colors.bgPage,
          }}>
            {/* Filter Section */}
            <div style={{
              background: colors.bgCard,
              border: `1px solid ${colors.border}`,
              borderRadius: '10px',
              padding: '18px',
              marginBottom: '16px',
              boxShadow: colors.shadowSm,
            }}>
              <div className="stocko-pos-report-header" style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '14px',
                marginBottom: '14px',
              }}>
                <div>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 750,
                    color: colors.textPrimary,
                    margin: '0 0 4px',
                  }}>
                    Dispatch report
                  </h3>
                  <p style={{ margin: 0, color: colors.textMuted, fontSize: '12px' }}>
                    Filter branch orders, export CSV, or print an audit-ready summary.
                  </p>
                </div>
                <div style={{
                  padding: '8px 11px',
                  borderRadius: '8px',
                  background: colors.primaryLight,
                  color: colors.primary,
                  fontSize: '12px',
                  fontWeight: 750,
                }}>
                  {currentBranch?.name || user?.branch_name || 'Current branch'}
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '10px',
              }}>
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
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={reportFilters.startDate}
                    onChange={(e) => setReportFilters(prev => ({ ...prev, startDate: e.target.value }))}
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
                    End Date
