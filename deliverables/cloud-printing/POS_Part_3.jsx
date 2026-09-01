        })
      } catch (error) {
        console.error('[POS] Unexpected cloud report error:', error)
        result = { success: false, error }
      }

      if (result.success) {
        showToast('success', 'Print queued', 'The POS report was sent to the branch printer')
        return result
      }

      console.error('[POS] Cloud report queue failed; opening browser fallback:', result.error)
      showToast(
        'warning',
        'Printer queue unavailable',
        'The report was not queued. Opening the browser print fallback.'
      )
      try {
        printReportInBrowser()
      } catch (fallbackError) {
        console.error('[POS] Browser report fallback failed:', fallbackError)
        showToast('error', 'Browser print failed', 'Run the report and try printing again.')
      }
      return result
    })
  }

  // ── Auth Check ──
  const checkAuth = async () => {
    if (!isAdmin || !authAction) {
      showToast('error', 'Access denied', 'Manager authorization is required')
      return
    }
    if (!authPassword) {
      showToast('error', 'Password required', 'Enter your current Stocko password')
      return
    }

    setAuthProcessing(true)
    try {
      let email = user?.email
      if (!email && user?.id) {
        const { data } = await supabase
          .from('users')
          .select('email')
          .eq('id', user.id)
          .single()
        email = data?.email
      }

      if (!email) throw new Error('The current user email could not be verified')

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password: authPassword,
      })
      if (error) throw new Error('The password is incorrect')

      const action = authAction
      setShowAuthModal(false)
      setAuthAction(null)
      setAuthPassword('')

      if (action.type === 'cancel') {
        await confirmCancelOrder(action.order)
      } else if (action.type === 'edit') {
        beginEditOrder(action.order)
      }
    } catch (error) {
      showToast('error', 'Authorization failed', error.message)
      setAuthPassword('')
    } finally {
      setAuthProcessing(false)
    }
  }

  // ── Access Gate ──
  if (!hasAccess) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        background: colors.bgPage,
        textAlign: 'center',
        padding: '20px',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px', color: colors.danger }}>!</div>
        <h2 style={{ fontSize: '20px', fontWeight: 700, color: colors.textPrimary, marginBottom: '8px' }}>
          Access Denied
        </h2>
        <p style={{ fontSize: '14px', color: colors.textMuted, maxWidth: '400px' }}>
          Your role ({user?.role || 'unknown'}) does not have access to POS.
          Only Admins, Managers, and Storekeepers can access this.
        </p>
      </div>
    )
  }

  return (
    <div className="stocko-pos-shell animate-fade-in" style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: 'calc(100dvh - 100px)',
      minHeight: '660px',
      background: colors.bgPage,
      border: `1px solid ${colors.border}`,
      borderRadius: '12px',
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      overflow: 'hidden',
      boxShadow: colors.shadowSm,
    }}>
      <style>{`
        .stocko-pos-shell, .stocko-pos-shell * {
          box-sizing: border-box;
        }
        .stocko-pos-shell {
          font-size: 13px;
        }
        .stocko-pos-shell button,
        .stocko-pos-shell input,
        .stocko-pos-shell select,
        .stocko-pos-shell textarea {
          font: inherit;
        }
        .stocko-pos-shell button:focus-visible,
        .stocko-pos-shell input:focus-visible,
        .stocko-pos-shell select:focus-visible,
        .stocko-pos-shell textarea:focus-visible {
          outline: 3px solid ${dark ? 'rgba(96,165,250,.35)' : 'rgba(37,99,235,.22)'};
          outline-offset: 2px;
        }
        .stocko-pos-scroll {
          scrollbar-width: thin;
          scrollbar-color: ${theme?.scrollbarThumb || '#94a3b8'} transparent;
        }
        .stocko-pos-scroll::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .stocko-pos-scroll::-webkit-scrollbar-thumb {
          background: ${theme?.scrollbarThumb || '#94a3b8'};
          border-radius: 999px;
        }
        .stocko-pos-tab-strip {
          min-width: 0;
        }
        .stocko-pos-product-card:hover {
          transform: translateY(-1px);
        }
        .stocko-pos-product-grid {
          align-content: start;
          grid-auto-rows: minmax(82px, auto);
        }
        .stocko-pos-product-card {
          min-height: 82px;
          align-self: start;
        }
        .stocko-pos-product-name,
        .stocko-pos-product-price {
          font-size: 13px !important;
        }
        .stocko-pos-cart-panel {
          width: clamp(440px, 35%, 540px) !important;
          min-width: 440px;
        }
        .stocko-pos-table-row:hover {
          background: ${colors.bgHover} !important;
        }
        @media (max-width: 1180px) {
          .stocko-pos-cart-panel {
            width: 410px !important;
            min-width: 410px !important;
          }
          .stocko-pos-product-grid {
            grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)) !important;
          }
          .stocko-pos-toolbar-metric {
            display: none !important;
          }
        }
        @media (max-width: 900px) {
          .stocko-pos-shell {
            height: auto !important;
            min-height: calc(100vh - 145px) !important;
            overflow: visible !important;
          }
          .stocko-pos-tab-strip {
            overflow-x: auto !important;
            justify-content: flex-start !important;
          }
          .stocko-pos-main {
            overflow: visible !important;
          }
          .stocko-pos-sale-layout {
            flex-direction: column !important;
            overflow: visible !important;
          }
          .stocko-pos-products-panel {
            min-height: 560px;
            border-right: 0 !important;
          }
          .stocko-pos-cart-panel {
            width: 100% !important;
            min-width: 0 !important;
            min-height: 620px;
            border-left: 0 !important;
            border-top: 1px solid ${colors.border};
          }
          .stocko-pos-payment-layout {
            flex-direction: column !important;
          }
          .stocko-pos-payment-options {
            width: 100% !important;
            border-left: 0 !important;
            border-top: 1px solid ${colors.border};
          }
        }
        @media (max-width: 640px) {
          .stocko-pos-shell {
            border-radius: 10px !important;
          }
          .stocko-pos-command-bar {
            align-items: stretch !important;
            flex-direction: column !important;
          }
          .stocko-pos-tab-strip {
            width: 100%;
          }
          .stocko-pos-tab-button {
            padding: 9px 11px !important;
          }
          .stocko-pos-search-bar {
            align-items: stretch !important;
            flex-direction: column !important;
          }
          .stocko-pos-search-bar > * {
            width: 100% !important;
            max-width: none !important;
          }
          .stocko-pos-product-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            padding: 8px !important;
            gap: 8px !important;
          }
          .stocko-pos-product-card {
            padding: 10px !important;
          }
          .stocko-pos-order-card-header,
          .stocko-pos-order-actions,
          .stocko-pos-report-header {
            align-items: stretch !important;
            flex-direction: column !important;
          }
          .stocko-pos-modal {
            width: calc(100vw - 20px) !important;
            max-height: calc(100vh - 20px) !important;
          }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════
          POS COMMAND BAR — global application Header remains the only header
          ═══════════════════════════════════════════════════════════════ */}
      <div className="stocko-pos-command-bar" style={{
        background: colors.bgHeader,
        borderBottom: `1px solid ${colors.border}`,
        padding: '8px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        minHeight: '52px',
        flexShrink: 0,
      }}>
        <div className="stocko-pos-tab-strip stocko-pos-scroll" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flex: 1,
        }}>
          {[
            { id: 'new_order', label: editingOrder ? 'Edit Dispatch' : 'New Dispatch', icon: editingOrder ? 'Edit' : 'Plus', count: null },
            { id: 'pending', label: 'Pending', icon: 'History', count: pendingOrders.length },
            { id: 'cancelled', label: 'Cancelled', icon: 'X', count: cancelledOrders.length },
            { id: 'reports', label: 'Reports', icon: 'BarChart2', restricted: true, count: null },
          ].map((tab) => {
            if (tab.restricted && !hasReportAccess) return null

            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                className="stocko-pos-tab-button"
                onClick={() => {
                  if (editingOrder && tab.id !== 'new_order') {
                    showToast('warning', 'Finish editing first', 'Save or cancel the current order edit before leaving')
                    return
                  }
                  setActiveTab(tab.id)
                  if (tab.id === 'reports' && reportData.length === 0) loadTodayOrders()
                }}
                style={{
                  padding: '7px 11px',
                  background: isActive ? colors.primaryLight : colors.bgCard,
                  color: isActive ? colors.primary : colors.textSecondary,
                  border: `1px solid ${isActive ? colors.primary : colors.border}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: isActive ? 700 : 600,
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Ic n={tab.icon} size={14} />
                {tab.label}
                {tab.count !== null && (
                  <span style={{
                    minWidth: '18px',
                    height: '18px',
                    padding: '0 5px',
                    borderRadius: '999px',
                    background: isActive ? colors.primary : colors.bgHover,
                    color: isActive ? '#fff' : colors.textMuted,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: 800,
                  }}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}>
          <div className="stocko-pos-toolbar-metric" style={{
            padding: '5px 9px',
            borderRadius: '8px',
            background: colors.bgHover,
            border: `1px solid ${colors.border}`,
          }}>
            <div style={{ fontSize: '9px', color: colors.textMuted, fontWeight: 700, textTransform: 'uppercase' }}>
              Today
            </div>
            <div style={{ fontSize: '11px', color: colors.textPrimary, fontWeight: 750 }}>
              {formatPrice(todaySales)} · {todayOrderCount} orders
            </div>
          </div>

          <button
            onClick={() => refreshAll()}
            disabled={refreshing}
            title="Refresh POS data"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              background: colors.bgCard,
              color: colors.textMuted,
              cursor: refreshing ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: refreshing ? 0.6 : 1,
            }}
          >
            <Ic n="RefreshCw" size={14} />
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          MAIN CONTENT AREA
          ═══════════════════════════════════════════════════════════════ */}
      <div className="stocko-pos-main" style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
      }}>

        {/* ── TAB: NEW ORDER ── */}
        {activeTab === 'new_order' && (
          <div className="stocko-pos-sale-layout" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
            {/* LEFT: PRODUCTS */}
            <div className="stocko-pos-products-panel" style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              background: colors.bgPage,
              borderRight: `1px solid ${colors.border}`,
              overflow: 'hidden',
            }}>
              {/* Search & Filter Bar */}
              <div className="stocko-pos-search-bar" style={{
                padding: '10px 12px',
                borderBottom: `1px solid ${colors.border}`,
                display: 'flex',
                gap: '8px',
                background: colors.bgCard,
                alignItems: 'center',
              }}>
                <div style={{
                  flex: 1,
                  position: 'relative',
                }}>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search products by name, SKU, or barcode..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: productSearch ? '8px 38px 8px 36px' : '8px 10px 8px 36px',
                      background: colors.bgInput,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      color: colors.textPrimary,
                      fontSize: '13px',
                      outline: 'none',
                      transition: 'border-color 0.2s, box-shadow 0.2s',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = colors.borderActive
                      e.target.style.boxShadow = `0 0 0 3px ${colors.primaryLight}`
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = colors.border
                      e.target.style.boxShadow = 'none'
                    }}
                  />
                  <span aria-hidden="true" style={{
                    position: 'absolute',
                    left: '11px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: colors.textMuted,
                    display: 'inline-flex',
                  }}>
                    <Ic n="Search" size={15} />
                  </span>
                  {productSearch && (
                    <button
                      onClick={() => {
                        setProductSearch('')
                        searchInputRef.current?.focus()
                      }}
                      aria-label="Clear product search"
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '28px',
                        height: '28px',
                        border: 'none',
                        borderRadius: '7px',
                        background: colors.bgHover,
                        color: colors.textMuted,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ic n="X" size={14} />
                    </button>
                  )}
                </div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{
                    padding: '8px 10px',
                    background: colors.bgInput,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    color: colors.textPrimary,
                    fontSize: '13px',
                    minWidth: '150px',
                    cursor: 'pointer',
                    outline: 'none',
                  }}
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>
                      {cat === 'all' ? 'All Categories' : cat}
                    </option>
                  ))}
                </select>
                <div style={{
                  padding: '8px 11px',
                  background: colors.bgHover,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  color: colors.textMuted,
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  whiteSpace: 'nowrap',
                }}>
                  <Ic n="Package" size={14} />
                  {filteredInventory.length} items
                </div>
              </div>

              {/* Products Grid */}
              <div className="stocko-pos-product-grid stocko-pos-scroll" style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                gridAutoRows: 'minmax(82px, auto)',
                alignContent: 'start',
                gap: '8px',
              }}>
                {loading ? (
                  <div style={{ 
                    gridColumn: '1 / -1', 
                    textAlign: 'center', 
                    padding: '60px 20px', 
                    color: colors.textMuted 
                  }}>
                    <div style={{ fontSize: '14px', marginBottom: '8px' }}>Loading inventory...</div>
                  </div>
                ) : filteredInventory.length === 0 ? (
                  <div style={{ 
                    gridColumn: '1 / -1', 
                    textAlign: 'center', 
                    padding: '60px 20px', 
                    color: colors.textMuted 
                  }}>
                    <div style={{ fontSize: '14px', marginBottom: '8px' }}>No products found</div>
                  </div>
                ) : (
                  productGridItems.map(({
                    product,
                    salePrice,
                    stock,
                    inStock,
                    inCart,
                    lowStock,
                  }) => (
                      <div
                        key={product.id}
                        className="stocko-pos-product-card"
                        onClick={() => inStock && addToCart(product)}
                        onKeyDown={(event) => {
                          if (inStock && (event.key === 'Enter' || event.key === ' ')) {
                            event.preventDefault()
                            addToCart(product)
                          }
                        }}
                        role="button"
                        tabIndex={inStock ? 0 : -1}
                        aria-disabled={!inStock}
                        style={{
                          background: colors.bgCard,
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          padding: '11px 12px',
                          cursor: inStock ? 'pointer' : 'not-allowed',
                          opacity: inStock ? 1 : 0.5,
                          transition: 'border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease',
                          position: 'relative',
                          boxShadow: colors.shadowSm,
                        }}
                        onMouseEnter={(e) => {
                          if (inStock) {
                            e.currentTarget.style.borderColor = colors.borderActive
                            e.currentTarget.style.boxShadow = colors.shadowMd
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = colors.border
                          e.currentTarget.style.boxShadow = colors.shadowSm
                        }}
                      >
                        <div style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          fontSize: '10px',
                          padding: '3px 7px',
                          borderRadius: '20px',
                          background: !inStock ? colors.dangerLight : lowStock ? colors.warningLight : colors.successLight,
                          color: !inStock ? colors.danger : lowStock ? colors.warning : colors.success,
                          fontWeight: 700,
                          border: `1px solid ${inStock ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)'}`,
                        }}>
                          {inStock ? `${stock} ${product.unit || ''}`.trim() : 'Out of stock'}
                        </div>

                        <div>
                          <div className="stocko-pos-product-name" style={{
                            fontSize: '13px',
                            fontWeight: 700,
                            color: colors.textPrimary,
                            marginBottom: '3px',
                            lineHeight: 1.3,
                            paddingRight: '72px',
                          }}>
                            {product.name}
                          </div>
                          <div style={{ fontSize: '10px', color: colors.textMuted, marginBottom: '6px', minHeight: '12px' }}>
                            {product.sku && `SKU: ${product.sku}`}
                            {product.barcode && ` | Barcode: ${product.barcode}`}
                          </div>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}>
                            <span className="stocko-pos-product-price" style={{
                              fontSize: '13px',
                              fontWeight: 650,
                              color: colors.textSecondary,
                            }}>
                              {formatPrice(salePrice)}
                            </span>
                            {inCart && (
                              <span style={{
                                fontSize: '10px',
                                background: colors.primary,
                                color: '#fff',
                                padding: '3px 7px',
                                borderRadius: '20px',
                                fontWeight: 700,
                              }}>
                                {inCart.quantity} in cart
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                  ))
                )}
              </div>
            </div>

            {/* RIGHT: CART & CHECKOUT */}
            <div className="stocko-pos-cart-panel" style={{
              width: 'clamp(440px, 35%, 540px)',
              minWidth: '440px',
              display: 'flex',
              flexDirection: 'column',
              background: colors.bgCard,
              borderLeft: `1px solid ${colors.border}`,
              boxShadow: '-1px 0 4px rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}>
              {/* Cart Header */}
              <div className="stocko-pos-report-header" style={{
                padding: '11px 13px',
                borderBottom: `1px solid ${colors.border}`,
                background: colors.bgPage,
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '10px',
                }}>
                  <h2 style={{
                    fontSize: '14px',
                    fontWeight: 750,
                    color: colors.textPrimary,
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <Ic n="Package" size={16} />
                    Current dispatch
                    <span style={{
                      minWidth: '20px',
                      height: '20px',
                      padding: '0 6px',
                      borderRadius: '999px',
                      background: colors.primaryLight,
                      color: colors.primary,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 800,
                    }}>
                      {cart.reduce((sum, item) => sum + safeNumber(item.quantity), 0)}
                    </span>
                  </h2>
                  {cart.length > 0 && !editingOrder && (
                    <button
                      onClick={clearCart}
                      style={{
                        padding: '6px 9px',
                        background: 'transparent',
                        color: colors.danger,
                        border: `1px solid ${colors.danger}`,
                        borderRadius: '8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <Ic n="Trash2" size={13} />
                      Clear
                    </button>
                  )}
                </div>

                {editingOrder && (
                  <div style={{
                    marginBottom: '10px',
                    padding: '9px 10px',
                    borderRadius: '8px',
                    background: colors.warningLight,
                    color: dark ? '#fcd34d' : '#92400e',
                    border: `1px solid ${colors.warning}`,
                    fontSize: '12px',
                    fontWeight: 650,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '7px',
                  }}>
                    <Ic n="Edit" size={14} />
                    Editing #{orderReference(editingOrder)} — saving updates this order
                  </div>
                )}

                {/* Receiving branch/customer selection */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <select
                      value={selectedCustomer?.id || ''}
                      disabled={customersLoading}
                      onChange={(e) => {
                        const cust = customers.find(c => c.id === e.target.value)
                        setSelectedCustomer(cust || null)
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 28px 8px 10px',
                        background: colors.bgInput,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '8px',
                        color: colors.textPrimary,
                        fontSize: '13px',
                        cursor: 'pointer',
                        appearance: 'none',
                        outline: 'none',
                      }}
                    >
                      <option value="">{customersLoading ? 'Loading destinations…' : 'Select receiving branch / customer'}</option>
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.phone ? `(${c.phone})` : ''}
                        </option>
                      ))}
                    </select>
                    <span aria-hidden="true" style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: colors.textMuted,
                      fontSize: '10px',
                      pointerEvents: 'none',
                    }}>▾</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCustomer({ name: '', phone: '', email: '' })
                      setShowCustomerModal(true)
                    }}
                    title="Add a new customer"
                    style={{
                      height: '34px',
                      padding: '0 11px',
                      flexShrink: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px',
                      border: `1px solid ${colors.primary}`,
                      borderRadius: '8px',
                      background: colors.primaryLight,
                      color: colors.primary,
                      fontSize: '11px',
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                    }}
                  >
                    <Ic n="UserPlus" size={14} />
                    New customer
                  </button>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                  gap: '7px',
                  marginTop: '8px',
                }}>
                  <input
                    value={orderReferenceText}
                    onChange={event => setOrderReferenceText(event.target.value)}
                    placeholder="Demand / transfer reference"
                    maxLength={80}
                    style={{
                      minWidth: 0,
                      width: '100%',
                      padding: '8px 9px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      background: colors.bgInput,
                      color: colors.textPrimary,
                      fontSize: '11px',
                      outline: 'none',
                    }}
                  />
                  <input
                    value={orderNotes}
                    onChange={event => setOrderNotes(event.target.value)}
                    placeholder="Dispatch note"
                    maxLength={240}
                    style={{
                      minWidth: 0,
                      width: '100%',
                      padding: '8px 9px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      background: colors.bgInput,
                      color: colors.textPrimary,
                      fontSize: '11px',
                      outline: 'none',
                    }}
                  />
                </div>

                {selectedCustomer && (
                  <div style={{
                    fontSize: '11px',
                    color: colors.textMuted,
                    marginTop: '7px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}>
                    <Ic n="User" size={12} />
                    <strong style={{ color: colors.textSecondary }}>{selectedCustomer.name}</strong>
                    {selectedCustomer.phone && <span>· {selectedCustomer.phone}</span>}
                  </div>
                )}
              </div>

              {/* Cart Items */}
              <div className="stocko-pos-scroll" style={{
                flex: 1,
                overflowY: 'auto',
                padding: '10px 12px',
                background: colors.bgPage,
              }}>
                {cart.length === 0 ? (
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '42px 20px',
                    color: colors.textMuted 
                  }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      margin: '0 auto 12px',
                      borderRadius: '14px',
                      background: colors.primaryLight,
                      color: colors.primary,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Ic n="ShoppingCart" size={22} />
                    </div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: colors.textSecondary, marginBottom: '6px' }}>
                      Dispatch is empty
                    </div>
                    <div style={{ fontSize: '12px' }}>Select stock items to prepare this dispatch</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {cart.map(item => (
                      <div
                        key={item.id}
                        style={{
                          background: colors.bgCard,
                          padding: '10px 11px',
                          borderRadius: '8px',
                          border: `1px solid ${colors.border}`,
                          boxShadow: colors.shadowSm,
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginBottom: '7px',
                        }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ 
                              fontSize: '13px',
                              fontWeight: 600, 
                              color: colors.textPrimary 
                            }}>
                              {item.name}
                            </div>
                            <div style={{ 
                              fontSize: '11px',
                              color: colors.textMuted, 
                              marginTop: '3px' 
                            }}>
