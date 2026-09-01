    if (nextQuantity < 1) {
      removeFromCart(id)
      return
    }

    const product = inventory.find(p => p.id === id)
    const cartItem = cart.find(item => item.id === id)
    const maxStock = editingOrder
      ? getStock(product) + safeNumber(cartItem?.original_quantity)
      : getStock(product)

    if (nextQuantity > maxStock) {
      showToast('error', 'Stock Limit', `Only ${maxStock} available`)
      return
    }

    setCart(prev => prev.map(item =>
      item.id === id ? { ...item, quantity: nextQuantity, max_stock: maxStock } : item
    ))
  }, [cart, editingOrder, inventory, showToast])

  const removeFromCart = useCallback((id) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }, [])

  const clearCart = useCallback(() => {
    setCart([])
    setSelectedCustomer(null)
    setDiscount(0)
    setTaxRate(0)
    setServiceCharge(0)
    setOrderType('branch_dispatch')
    setOrderNotes('')
    setOrderReferenceText('')
    setEditingOrder(null)
  }, [])

  const cancelEditing = useCallback(() => {
    clearCart()
    setActiveTab('pending')
    showToast('info', 'Edit cancelled', 'The original order was not changed')
  }, [clearCart, showToast])

  // ── Create Customer ──
  const createCustomer = async () => {
    if (!branchId) {
      showToast('error', 'No branch', 'Select a branch before creating customers')
      return
    }

    if (!newCustomer.name.trim()) {
      showToast('error', 'Required', 'Customer name is required')
      return
    }

    const normalizedPhone = newCustomer.phone.trim()
    if (normalizedPhone && customers.some(customer => customer.phone === normalizedPhone)) {
      showToast('warning', 'Customer exists', 'A customer with this phone number already exists')
      return
    }

    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          branch_id: branchId,
          name: newCustomer.name.trim(),
          phone: normalizedPhone || null,
          email: newCustomer.email.trim() || null,
        }])
        .select()
        .single()

      if (error) throw error

      setCustomers(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      setSelectedCustomer(data)
      setNewCustomer({ name: '', phone: '', email: '' })
      setShowCustomerModal(false)
      showToast('success', 'Created', 'Customer created successfully')
    } catch (err) {
      showToast('error', 'Failed', err.message)
    }
  }

  const insertOrderWithFallback = async (corePayload, optionalPayload) => {
    let response = await supabase
      .from('orders')
      .insert([{ ...corePayload, ...optionalPayload }])
      .select()
      .single()

    if (response.error && Object.keys(optionalPayload).length > 0) {
      const schemaError = response.error.code === 'PGRST204' ||
        response.error.code === '42703' ||
        /column|schema cache/i.test(response.error.message || '')

      if (schemaError) {
        response = await supabase
          .from('orders')
          .insert([corePayload])
          .select()
          .single()
      }
    }

    return response
  }

  const adjustInventoryBy = async (inventoryId, delta) => {
    if (!inventoryId || !delta) return
    const { data: item, error: readError } = await supabase
      .from('inventory')
      .select('id, quantity')
      .eq('id', inventoryId)
      .eq('branch_id', branchId)
      .single()

    if (readError) throw readError
    const nextQuantity = safeNumber(item.quantity) + delta
    if (nextQuantity < 0) {
      throw new Error(`Insufficient stock for inventory item ${inventoryId}`)
    }

    const { error: updateError } = await supabase
      .from('inventory')
      .update({ quantity: nextQuantity, updated_at: now() })
      .eq('id', inventoryId)
      .eq('branch_id', branchId)

    if (updateError) throw updateError
  }

  const saveEditedOrder = async () => {
    if (!editingOrder) return

    const oldItems = editingOrder.order_items || []
    const oldById = new Map(oldItems.map(item => [item.inventory_id, item]))
    const newById = new Map(cart.map(item => [item.id, item]))
    const ids = new Set([...oldById.keys(), ...newById.keys()])
    const inventoryDiffs = []

    ids.forEach(id => {
      const previousQuantity = safeNumber(oldById.get(id)?.quantity)
      const nextQuantity = safeNumber(newById.get(id)?.quantity)
      const difference = nextQuantity - previousQuantity
      if (difference !== 0) inventoryDiffs.push({ id, difference })
    })

    for (const difference of inventoryDiffs) {
      const item = inventory.find(product => product.id === difference.id)
      if (difference.difference > getStock(item)) {
        throw new Error(`Only ${getStock(item)} additional units are available for ${item?.name || 'this product'}`)
      }
    }

    const updatePayload = {
      customer_id: selectedCustomer?.id || null,
      customer_name: selectedCustomer?.name || 'Walk-In',
      subtotal: cartSubtotal,
      discount: normalizedDiscount,
      tax: cartTax,
      total: cartTotal,
      updated_at: now(),
    }

    const optionalPayload = {
      type: orderType,
      notes: orderNotes.trim() || null,
      reference: orderReferenceText.trim() || null,
      service_charge: normalizedServiceCharge,
    }

    let updateResponse = await supabase
      .from('orders')
      .update({ ...updatePayload, ...optionalPayload })
      .eq('id', editingOrder.id)
      .eq('branch_id', branchId)

    if (updateResponse.error && (
      updateResponse.error.code === 'PGRST204' ||
      updateResponse.error.code === '42703' ||
      /column|schema cache/i.test(updateResponse.error.message || '')
    )) {
      updateResponse = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', editingOrder.id)
        .eq('branch_id', branchId)
    }

    if (updateResponse.error) throw updateResponse.error

    const replacementItems = cart.map(item => ({
      order_id: editingOrder.id,
      inventory_id: item.id,
      quantity: safeNumber(item.quantity),
      price: extractLinePrice(item),
      subtotal: safeNumber(item.quantity) * extractLinePrice(item),
      name: item.name,
      created_at: now(),
    }))

    const { error: deleteError } = await supabase
      .from('order_items')
      .delete()
      .eq('order_id', editingOrder.id)

    if (deleteError) throw deleteError

    const { error: insertError } = await supabase
      .from('order_items')
      .insert(replacementItems)

    if (insertError) {
      const originalItems = oldItems.map(item => ({
        order_id: editingOrder.id,
        inventory_id: item.inventory_id,
        quantity: safeNumber(item.quantity),
        price: extractLinePrice(item),
        subtotal: safeNumber(item.quantity) * extractLinePrice(item),
        name: item.name,
        created_at: item.created_at || now(),
      }))
      if (originalItems.length > 0) {
        await supabase.from('order_items').insert(originalItems)
      }
      throw insertError
    }

    for (const difference of inventoryDiffs) {
      await adjustInventoryBy(difference.id, -difference.difference)
    }

    await logPosActivity(
      'Order Edited',
      `Order #${orderReference(editingOrder)} updated; ${cart.length} line items; total ${cartTotal.toFixed(2)}`
    )

    const updatedOrder = {
      ...editingOrder,
      ...updatePayload,
      ...optionalPayload,
      order_items: replacementItems,
    }

    showToast('success', 'Order updated', `Order #${orderReference(editingOrder)} was updated`)
    clearCart()
    await Promise.all([loadInventory(), loadOrders(), loadTodayOrders()])
    await queuePosReceipt(updatedOrder, replacementItems, {}, 'order_updated')
  }

  // ── Place Order ──
  const placeOrder = async () => {
    if (!branchId) {
      showToast('error', 'No branch', 'Select a branch before placing orders')
      return
    }

    if (cart.length === 0) {
      showToast('error', 'Empty Cart', 'Add items to place an order')
      return
    }

    if (processing || Date.now() - lastSubmissionRef.current < 1200) return
    lastSubmissionRef.current = Date.now()
    setProcessing(true)

    try {
      if (editingOrder) {
        await saveEditedOrder()
        return
      }

      const invalidItem = cart.find(item => (
        safeNumber(item.quantity) <= 0 ||
        safeNumber(item.quantity) > getStock(inventory.find(product => product.id === item.id))
      ))
      if (invalidItem) {
        throw new Error(`Stock changed for ${invalidItem.name}. Refresh the cart and try again.`)
      }

      const coreOrderData = {
        branch_id: branchId,
        customer_id: selectedCustomer?.id || null,
        customer_name: selectedCustomer?.name || 'Walk-In',
        subtotal: cartSubtotal,
        discount: normalizedDiscount,
        tax: cartTax,
        total: cartTotal,
        status: ORDER_STATUS.PENDING,
        created_by: user?.id,
        created_by_name: user?.name,
        created_at: now(),
      }

      const optionalOrderData = {
        type: orderType,
        notes: orderNotes.trim() || null,
        reference: orderReferenceText.trim() || null,
        service_charge: normalizedServiceCharge,
      }

      const { data: order, error: orderError } = await insertOrderWithFallback(
        coreOrderData,
        optionalOrderData
      )

      if (orderError) throw orderError

      const lineItems = cart.map(item => ({
        order_id: order.id,
        inventory_id: item.id,
        quantity: safeNumber(item.quantity),
        price: extractLinePrice(item),
        subtotal: safeNumber(item.quantity) * extractLinePrice(item),
        name: item.name,
        created_at: now(),
      }))

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(lineItems)

      if (itemsError) {
        await supabase.from('orders').delete().eq('id', order.id)
        throw itemsError
      }

      const adjustedItems = []
      try {
        for (const item of cart) {
          await adjustInventoryBy(item.id, -safeNumber(item.quantity))
          adjustedItems.push(item)
        }
      } catch (inventoryError) {
        for (const item of adjustedItems) {
          await adjustInventoryBy(item.id, safeNumber(item.quantity))
        }
        await supabase.from('order_items').delete().eq('order_id', order.id)
        await supabase.from('orders').delete().eq('id', order.id)
        throw inventoryError
      }

      const completedOrder = {
        ...order,
        ...optionalOrderData,
        order_items: lineItems,
      }

      await logPosActivity(
        'Order Placed',
        `Order #${orderReference(order)}; ${cart.length} line items; ${orderType}; total ${cartTotal.toFixed(2)}`
      )

      showToast('success', 'Order placed', `Order #${orderReference(order)} is ready for payment`)
      await queuePosReceipt(completedOrder, lineItems, {}, 'order_created')
      clearCart()
      await Promise.all([loadInventory(), loadOrders()])
    } catch (err) {
      console.error('[POS] Order error:', err)
      showToast('error', editingOrder ? 'Update failed' : 'Order failed', err.message)
    } finally {
      setProcessing(false)
    }
  }

  // ── Open Payment Modal ──
  const openPaymentModal = (order, shouldPrint = false) => {
    const due = getOrderAmountDue(order)
    setPaymentOrder(order)
    setPaymentAmount(due)
    setCashReceived(due)
    setPaymentMethod(PAYMENT_METHODS.CASH)
    setPaymentRemarks('')
    setPrintAfterPayment(shouldPrint)
    setShowPaymentModal(true)
  }

  const ensureLedgerSale = async (order) => {
    if (!order.customer_id) return
    const { data: existing, error: lookupError } = await supabase
      .from('ledger_entries')
      .select('id')
      .eq('order_id', order.id)
      .eq('branch_id', branchId)
      .eq('type', 'sale')
      .limit(1)

    if (lookupError) {
      throw lookupError
    }

    if ((existing || []).length === 0) {
      const { error } = await supabase.from('ledger_entries').insert([{
        customer_id: order.customer_id,
        branch_id: branchId,
        order_id: order.id,
        amount: safeNumber(order.total),
        type: 'sale',
        description: `Sale order #${orderReference(order)}`,
        created_by: user?.id,
        created_by_name: user?.name,
        created_at: now(),
      }])
      // The partial unique index added by the ledger migration closes the
      // check/insert race. A concurrent caller winning is a successful no-op.
      if (error && error.code !== '23505') throw error
    }
  }

  // ── Process Payment ──
  const processPayment = async (shouldPrint = printAfterPayment) => {
    if (!paymentOrder || paymentProcessing) return

    const total = safeNumber(paymentOrder.total)
    const alreadyPaid = getRecordedPaidAmount(paymentOrder)
    const dueBefore = getOrderAmountDue(paymentOrder)

    if (dueBefore <= 0) {
      showToast('info', 'Already paid', 'This order has no outstanding balance')
      setShowPaymentModal(false)
      return
    }

    const amountReceived = paymentMethod === PAYMENT_METHODS.CREDIT
      ? 0
      : Math.min(dueBefore, Math.max(0, safeNumber(paymentAmount)))
    if (paymentMethod !== PAYMENT_METHODS.CREDIT && amountReceived <= 0) {
      showToast('error', 'Invalid payment', 'Enter an amount greater than zero')
      return
    }
    if (paymentMethod === PAYMENT_METHODS.CASH && safeNumber(cashReceived) < amountReceived) {
      showToast('error', 'Insufficient cash', `Receive at least ${formatPrice(amountReceived)}`)
      return
    }

    setPaymentProcessing(true)

    try {
      const paidTotal = alreadyPaid + amountReceived
      const dueAfter = Math.max(0, total - paidTotal)
      const status = paymentMethod === PAYMENT_METHODS.CREDIT
        ? ORDER_STATUS.CREDIT
        : dueAfter > 0.0001
          ? ORDER_STATUS.PARTIALLY_PAID
          : ORDER_STATUS.PAID
      let paymentRecord = null

      if (paymentOrder.customer_id) {
        await ensureLedgerSale(paymentOrder)
      }

      if (amountReceived > 0) {
        const { data, error: paymentError } = await supabase
          .from('order_payments')
          .insert([{
            order_id: paymentOrder.id,
            amount: amountReceived,
            method: paymentMethod,
            remarks: paymentRemarks.trim() || null,
            created_at: now(),
          }])
          .select()
          .single()

        if (paymentError) throw paymentError
        paymentRecord = data
      }

      const { data: order, error } = await supabase
        .from('orders')
        .update({ 
          status,
          paid_amount: paidTotal,
          due_amount: dueAfter,
          completed_by: user?.id,
          completed_by_name: user?.name,
          completed_at: now(),
          updated_at: now(),
        })
        .eq('id', paymentOrder.id)
        .eq('branch_id', branchId)
        .select()
        .single()

      if (error) {
        if (paymentRecord?.id) {
          await supabase.from('order_payments').delete().eq('id', paymentRecord.id)
        }
        throw error
      }

      if (order.customer_id) {
        if (amountReceived > 0) {
          const { error: ledgerPaymentError } = await supabase.from('ledger_entries').insert([{
            customer_id: order.customer_id,
            branch_id: branchId,
            order_id: order.id,
            amount: -amountReceived,
            type: 'payment',
            description: `Payment received via ${paymentMethod.replaceAll('_', ' ')} for order #${orderReference(order)}`,
            created_by: user?.id,
            created_by_name: user?.name,
            created_at: now(),
          }])
          if (ledgerPaymentError) {
            console.warn('[POS] Payment ledger entry failed:', ledgerPaymentError.message)
            showToast('warning', 'Payment saved', 'The ledger entry could not be recorded automatically')
          }
        }
      }

      const printableOrder = {
        ...paymentOrder,
        ...order,
        payment_type: paymentMethod,
        order_payments: [
          ...(paymentOrder.order_payments || []),
          ...(paymentRecord ? [paymentRecord] : []),
        ],
      }

      await logPosActivity(
        'Payment Processed',
        `Order #${orderReference(order)}; ${paymentMethod}; amount ${amountReceived.toFixed(2)}; status ${status}`
      )

      showToast('success', 'Payment processed', `Order #${orderReference(order)} is ${status.replaceAll('_', ' ')}`)

      if (shouldPrint) {
        await queuePosReceipt(
          printableOrder,
          paymentOrder.order_items || [],
          {
            method: paymentMethod,
            current_amount: amountReceived,
            previously_paid: alreadyPaid,
            remaining_due: dueAfter,
            cash_received: paymentMethod === PAYMENT_METHODS.CASH ? safeNumber(cashReceived) : 0,
            change_returned: paymentMethod === PAYMENT_METHODS.CASH
              ? Math.max(0, safeNumber(cashReceived) - amountReceived)
              : 0,
            note: paymentRemarks.trim() || null,
          },
          'pay_and_print'
        )
      }

      setShowPaymentModal(false)
      setPaymentOrder(null)
      setPaymentAmount(0)
      setCashReceived(0)
      setPaymentRemarks('')
      setPrintAfterPayment(false)
      await Promise.all([loadOrders(), loadTodayOrders()])
    } catch (err) {
      showToast('error', 'Payment failed', err.message)
    } finally {
      setPaymentProcessing(false)
    }
  }

  // ── Cancel Order ──
  const cancelOrder = (order) => {
    if (!isAdmin) {
      showToast('error', 'Manager required', 'Only managers and administrators can cancel orders')
      return
    }
    if (!order || order.status === ORDER_STATUS.CANCELLED) return
    setCancelTarget(order)
    setCancelReason('')
    setShowCancelModal(true)
  }

  const requestCancellationAuthorization = () => {
    if (!cancelTarget || !cancelReason.trim()) {
      showToast('error', 'Reason required', 'Enter a cancellation reason before continuing')
      return
    }
    setShowCancelModal(false)
    setAuthAction({ type: 'cancel', order: cancelTarget })
    setShowAuthModal(true)
  }

  const confirmCancelOrder = async (targetOrder) => {
    if (!targetOrder || targetOrder.status === ORDER_STATUS.CANCELLED) return

    try {
      const { data: order, error } = await supabase
        .from('orders')
        .update({ 
          status: ORDER_STATUS.CANCELLED,
          cancelled_by: user?.id,
          cancelled_by_name: user?.name,
          cancellation_reason: cancelReason.trim(),
          cancelled_at: now(),
          updated_at: now(),
        })
        .eq('id', targetOrder.id)
        .eq('branch_id', branchId)
        .neq('status', ORDER_STATUS.CANCELLED)
        .select()
        .single()

      if (error) throw error

      const { data: items } = await supabase
        .from('order_items')
        .select('*')
        .eq('order_id', targetOrder.id)

      for (const item of (items || [])) {
        if (item.inventory_id && safeNumber(item.quantity) > 0) {
          await adjustInventoryBy(item.inventory_id, safeNumber(item.quantity))
        }
      }

      if (order.customer_id) {
        const { data: ledgerRows, error: ledgerLookupError } = await supabase
          .from('ledger_entries')
          .select('amount')
          .eq('order_id', order.id)
          .eq('branch_id', branchId)

        if (ledgerLookupError) throw ledgerLookupError

        const netAmount = (ledgerRows || []).reduce(
          (sum, entry) => sum + safeNumber(entry.amount),
          0
        )
        if (Math.abs(netAmount) > 0.0001) {
          const { error: cancellationLedgerError } = await supabase
            .from('ledger_entries')
            .insert([{
              customer_id: order.customer_id,
              branch_id: branchId,
              order_id: order.id,
              amount: -netAmount,
              type: 'cancellation',
              description: `Cancellation adjustment for order #${orderReference(order)}: ${cancelReason.trim()}`,
              created_by: user?.id,
              created_by_name: user?.name,
              created_at: now(),
            }])
          if (cancellationLedgerError) throw cancellationLedgerError
        }
      }

      await logPosActivity(
        'Order Cancelled',
        `Order #${orderReference(order)}; reason: ${cancelReason.trim()}`
      )

      showToast('success', 'Order cancelled', `Order #${orderReference(order)} was cancelled and stock restored`)
      setShowAuthModal(false)
      setAuthAction(null)
      setAuthPassword('')
      setCancelTarget(null)
      setCancelReason('')
      await Promise.all([loadOrders(), loadInventory(), loadTodayOrders()])
    } catch (err) {
      showToast('error', 'Cancellation failed', err.message)
    }
  }

  const beginEditOrder = (order) => {
    if (!order || ![ORDER_STATUS.PENDING, ORDER_STATUS.PARTIALLY_PAID].includes(order.status)) {
      showToast('error', 'Cannot edit', 'Only pending or partially paid orders can be edited')
      return
    }

    const selected = customers.find(customer => customer.id === order.customer_id) || null
    const editableItems = (order.order_items || []).map(item => {
      const product = inventory.find(inventoryItem => inventoryItem.id === item.inventory_id)
      const originalQuantity = safeNumber(item.quantity)
      return {
        id: item.inventory_id,
        inventory_id: item.inventory_id,
        name: item.name || product?.name || 'Item',
        quantity: originalQuantity,
        original_quantity: originalQuantity,
        price: extractLinePrice(item),
        sale_price: extractLinePrice(item),
        unit: product?.unit || 'unit',
        sku: product?.sku || '',
        max_stock: getStock(product) + originalQuantity,
      }
    })

    setEditingOrder(order)
    setCart(editableItems)
    setSelectedCustomer(selected)
    setDiscount(safeNumber(order.discount))
    const taxableBase = Math.max(0, safeNumber(order.subtotal) - safeNumber(order.discount))
    setTaxRate(taxableBase > 0 ? (safeNumber(order.tax) / taxableBase) * 100 : 0)
    setServiceCharge(getServiceCharge(order))
    setOrderType(order.type || order.order_type || 'branch_dispatch')
    setOrderNotes(order.notes || '')
    setOrderReferenceText(order.reference || '')
    setActiveTab('new_order')
    setTimeout(() => searchInputRef.current?.focus(), 0)
    showToast('info', 'Editing order', `Changes will update order #${orderReference(order)} without creating a duplicate`)
  }

  const requestEditAuthorization = (order) => {
    if (!isAdmin) {
      showToast('error', 'Manager required', 'Only managers and administrators can edit existing orders')
      return
    }
    setAuthAction({ type: 'edit', order })
    setShowAuthModal(true)
  }

  // ── View Customer History ──
  const viewCustomerHistory = async () => {
    if (!selectedCustomer) {
      showToast('error', 'No Customer', 'Please select a customer first')
      return
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('customer_id', selectedCustomer.id)
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setCustomerHistory(data || [])
      setShowHistoryModal(true)
    } catch (err) {
      showToast('error', 'Failed', err.message)
    }
  }

  // ── Generate Report ──
  const generateReport = async () => {
    if (!hasReportAccess) {
      showToast('error', 'Access Denied', 'You do not have permission to view reports')
      return
    }

    setReportLoading(true)
    try {
      let query = supabase
        .from('orders')
        .select('*, order_items(*), order_payments(*)')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })

      if (reportFilters.startDate) {
        query = query.gte('created_at', `${reportFilters.startDate}T00:00:00`)
      }
      if (reportFilters.endDate) {
        query = query.lte('created_at', reportFilters.endDate + 'T23:59:59')
      }
      if (reportFilters.customer) {
        query = query.eq('customer_id', reportFilters.customer)
      }
      if (reportFilters.status !== 'all') {
        query = query.eq('status', reportFilters.status)
      }

      let { data, error } = await query

      if (error) {
        let fallbackQuery = supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('branch_id', branchId)
          .order('created_at', { ascending: false })
        if (reportFilters.startDate) fallbackQuery = fallbackQuery.gte('created_at', `${reportFilters.startDate}T00:00:00`)
        if (reportFilters.endDate) fallbackQuery = fallbackQuery.lte('created_at', `${reportFilters.endDate}T23:59:59`)
        if (reportFilters.customer) fallbackQuery = fallbackQuery.eq('customer_id', reportFilters.customer)
        if (reportFilters.status !== 'all') fallbackQuery = fallbackQuery.eq('status', reportFilters.status)
        const fallback = await fallbackQuery
        data = fallback.data
        error = fallback.error
      }

      if (error) throw error
      const filtered = reportFilters.paymentType === 'all'
        ? (data || [])
        : (data || []).filter(order => getPaymentMethod(order) === reportFilters.paymentType)
      setReportData(filtered)
    } catch (err) {
      showToast('error', 'Report failed', err.message)
    } finally {
      setReportLoading(false)
    }
  }

  const viewOrderDetail = (order) => {
    setDetailOrder(order)
    setShowOrderDetailModal(true)
  }

  const handlePrintOrder = async (order) => {
    await runPrintRequest(posReceiptPrintKey(order), async () => {
      let items = order.order_items || []
      if (items.length === 0) {
        const { data, error } = await supabase
          .from('order_items')
          .select('*')
          .eq('order_id', order.id)
        if (error) {
          showToast('error', 'Print failed', error.message)
          return { success: false, error }
        }
        items = data || []
      }
      return submitPosReceipt(order, items, {}, 'reprint')
    })
  }

  const exportReportCSV = () => {
    if (reportData.length === 0) {
      showToast('info', 'Nothing to export', 'Run a report that contains at least one order')
      return
    }

    const rows = [
      ['Invoice', 'Created', 'Customer', 'Type', 'Payment', 'Subtotal', 'Discount', 'Tax', 'Service Charge', 'Total', 'Status'],
      ...reportData.map(order => [
        orderReference(order),
        formatDateTime(order.created_at),
        order.customer_name || 'Walk-In',
        (order.type || order.order_type || 'sale').replaceAll('_', ' '),
        (getPaymentMethod(order) || 'N/A').replaceAll('_', ' '),
        safeNumber(order.subtotal).toFixed(2),
        safeNumber(order.discount).toFixed(2),
        safeNumber(order.tax).toFixed(2),
        getServiceCharge(order).toFixed(2),
        safeNumber(order.total).toFixed(2),
        order.status || 'pending',
      ]),
    ]

    const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n')
    downloadTextFile(
      `stocko-pos-report-${reportFilters.startDate || 'all'}-${reportFilters.endDate || 'all'}.csv`,
      `\uFEFF${csv}`,
      'text/csv;charset=utf-8'
    )
    showToast('success', 'CSV exported', `${reportData.length} orders were exported`)
  }

  const printReportInBrowser = () => {
    if (reportData.length === 0) {
      showToast('info', 'Nothing to print', 'Run a report that contains at least one order')
      return
    }

    const printWindow = window.open('', '_blank', 'width=1100,height=760')
    if (!printWindow) {
      showToast('error', 'Popup blocked', 'Allow popups to print the report')
      return
    }

    const totalRevenue = reportData.reduce((sum, order) => (
      order.status === ORDER_STATUS.CANCELLED ? sum : sum + safeNumber(order.total)
    ), 0)

    const rows = reportData.map((order, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHtml(orderReference(order))}</td>
        <td>${escapeHtml(formatDateTime(order.created_at))}</td>
        <td>${escapeHtml(order.customer_name || 'Walk-In')}</td>
        <td>${escapeHtml((getPaymentMethod(order) || 'N/A').replaceAll('_', ' '))}</td>
        <td class="right">Rs. ${safeNumber(order.total).toFixed(2)}</td>
        <td>${escapeHtml((order.status || 'pending').replaceAll('_', ' '))}</td>
      </tr>
    `).join('')

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Stocko POS Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 28px; color: #111827; }
            h1 { font-size: 22px; margin: 0 0 4px; }
            p { color: #6b7280; margin: 0 0 18px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
            th { background: #f8fafc; }
            .right { text-align: right; }
            .summary { margin: 18px 0; display: flex; gap: 24px; font-weight: 700; }
            @media print { button { display: none; } }
          </style>
        </head>
        <body>
          <h1>Stocko POS Sales Report</h1>
          <p>${escapeHtml(currentBranch?.name || user?.branch_name || 'Branch')} · ${escapeHtml(reportFilters.startDate || 'Beginning')} to ${escapeHtml(reportFilters.endDate || 'Today')}</p>
          <div class="summary">
            <span>Orders: ${reportData.length}</span>
            <span>Revenue: Rs. ${totalRevenue.toFixed(2)}</span>
          </div>
          <table>
            <thead>
              <tr><th>#</th><th>Invoice</th><th>Time</th><th>Customer</th><th>Payment</th><th>Total</th><th>Status</th></tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <button onclick="window.print()" style="margin-top:18px;padding:10px 18px;">Print report</button>
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
  }

  const printReport = async () => {
    if (reportData.length === 0) {
      showToast('info', 'Nothing to print', 'Run a report that contains at least one order')
      return
    }

    await runPrintRequest(POS_REPORT_PRINT_KEY, async () => {
      let result
      try {
        const payload = createPosReportPayload({
          orders: reportData,
          filters: reportFilters,
          branch: {
            ...currentBranch,
            id: branchId,
            name: currentBranch?.name || user?.branch_name,
          },
          user,
          metadata: {
            origin: 'reports_tab',
          },
        })
        result = await enqueuePrintJob({
          branchId,
          jobType: PRINT_JOB_TYPES.POS_REPORT,
          source: 'pos',
          payload,
