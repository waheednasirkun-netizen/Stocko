import { supabase } from './supabase'

export const PRINT_JOB_TYPES = Object.freeze({
  POS_RECEIPT: 'pos_receipt',
  POS_REPORT: 'pos_report',
  FULFILLMENT_RECEIPT: 'fulfillment_receipt',
})

const numberOrZero = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

const firstValue = (...values) => values.find(
  value => value !== undefined && value !== null && value !== ''
)

export const resolveOrderCustomer = async (order = {}, selectedCustomer = null) => {
  const customerId = order?.customer_id || null

  if (!customerId) {
    return {
      id: null,
      name: order?.customer_name || 'Walk-in Customer',
      phone: '',
      email: '',
      address: '',
    }
  }

  const matchingSelectedCustomer = selectedCustomer?.id === customerId
    ? selectedCustomer
    : null
  let fetchedCustomer = null

  try {
    const { data, error } = await supabase
      .from('customers')
      .select('id, name, phone, address')
      .eq('id', customerId)
      .maybeSingle()

    if (error) throw error
    fetchedCustomer = data

    if (!fetchedCustomer) {
      console.warn(
        `[PrintQueue] Customer record not found for order ${order?.id || 'unknown'} ` +
        `(customer ${customerId}); printing with order fallback data`
      )
    }
  } catch (error) {
    console.warn(
      `[PrintQueue] Failed to resolve customer for order ${order?.id || 'unknown'} ` +
      `(customer ${customerId}); printing with fallback data`,
      error
    )
  }

  return {
    id: customerId,
    name: firstValue(
      fetchedCustomer?.name,
      matchingSelectedCustomer?.name,
      order?.customer_name
    ) || 'Walk-in Customer',
    phone: firstValue(
      fetchedCustomer?.phone,
      matchingSelectedCustomer?.phone
    ) || '',
    email: firstValue(
      fetchedCustomer?.email,
      matchingSelectedCustomer?.email
    ) || '',
    address: firstValue(
      fetchedCustomer?.address,
      matchingSelectedCustomer?.address
    ) || '',
  }
}

const createPrintReference = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `print-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

const toSerializableJson = (value) => {
  const seen = new WeakSet()
  const json = JSON.stringify(value, (_key, nestedValue) => {
    if (typeof nestedValue === 'function' || typeof nestedValue === 'symbol') {
      return undefined
    }
    if (typeof nestedValue === 'bigint') return nestedValue.toString()
    if (nestedValue && typeof nestedValue === 'object') {
      if (seen.has(nestedValue)) {
        throw new TypeError('Print payload contains a circular reference')
      }
      seen.add(nestedValue)
    }
    return nestedValue
  })

  return JSON.parse(json)
}

const sumPayments = (payments) => (
  Array.isArray(payments)
    ? payments.reduce((sum, payment) => sum + Math.max(0, numberOrZero(payment?.amount)), 0)
    : 0
)

export const createPosReceiptPayload = ({
  order = {},
  items = [],
  branch = {},
  user = {},
  payment = {},
  customer = {},
  metadata = {},
}) => {
  const safeItems = Array.isArray(items) ? items : []
  const paymentsTotal = sumPayments(order.order_payments)
  const paidAmount = Math.max(numberOrZero(order.paid_amount), paymentsTotal)
  const currentPayment = Math.max(0, numberOrZero(payment.current_amount))
  const previouslyPaid = Math.max(
    0,
    numberOrZero(payment.previously_paid ?? Math.max(0, paidAmount - currentPayment))
  )
  const grandTotal = Math.max(0, numberOrZero(order.total ?? order.grand_total))
  const remainingDue = Math.max(
    0,
    numberOrZero(payment.remaining_due ?? order.due_amount ?? grandTotal - paidAmount)
  )
  const cashReceived = Math.max(0, numberOrZero(payment.cash_received))
  const changeReturned = Math.max(
    0,
    numberOrZero(payment.change_returned ?? cashReceived - currentPayment)
  )

  return {
    order: {
      id: order.id || null,
      invoice_number: firstValue(order.invoice_no, order.invoice_number, order.reference) || null,
      status: order.status || 'pending',
      created_at: firstValue(order.created_at, order.order_date) || null,
      completed_at: order.completed_at || null,
      order_type: firstValue(order.type, order.order_type) || 'sale',
      reference: order.reference || null,
      note: firstValue(order.notes, order.note) || null,
      dispatch_note: firstValue(order.dispatch_note, order.delivery_note) || null,
    },
    branch: {
      id: firstValue(branch.id, order.branch_id) || null,
      name: firstValue(branch.name, order.branch_name, user.branch_name) || null,
      address: firstValue(branch.address, order.branch_address) || null,
    },
    customer: {
      id: firstValue(customer.id, order.customer_id) || null,
      name: firstValue(customer.name, order.customer_name) || 'Walk-in Customer',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
    },
    cashier: {
      id: firstValue(order.created_by, user.id) || null,
      name: firstValue(order.created_by_name, user.name, user.full_name) || null,
      email: user.email || null,
      role: firstValue(user.role, user.user_role, user.type) || null,
    },
    items: safeItems.map(item => {
      const quantity = numberOrZero(item.quantity ?? item.qty)
      const salePrice = numberOrZero(
        firstValue(item.price, item.sale_price, item.selling_price, item.rate)
      )
      const lineDiscount = numberOrZero(item.discount ?? item.line_discount)
      const lineTax = numberOrZero(item.tax ?? item.line_tax)

      return {
        id: item.id || null,
        inventory_id: firstValue(item.inventory_id, item.product_id) || null,
        name: firstValue(item.name, item.item_name) || 'Item',
        sku: firstValue(item.sku, item.barcode, item.item_code) || null,
        barcode: item.barcode || null,
        quantity,
        unit: firstValue(item.unit, item.uom) || null,
        sale_price: salePrice,
        line_discount: lineDiscount,
        line_tax: lineTax,
        line_total: numberOrZero(
          item.subtotal ?? item.line_total ?? (quantity * salePrice) - lineDiscount + lineTax
        ),
      }
    }),
    totals: {
      subtotal: numberOrZero(order.subtotal),
      order_discount: numberOrZero(order.discount),
      tax: numberOrZero(order.tax),
      service_charge: numberOrZero(order.service_charge ?? order.service_fee),
      grand_total: grandTotal,
      previously_paid: previouslyPaid,
      current_payment: currentPayment,
      paid_total: paidAmount,
      remaining_due: remainingDue,
      cash_received: cashReceived,
      change_returned: changeReturned,
    },
    payment: {
      method: firstValue(payment.method, order.payment_type) || null,
      amount: currentPayment,
      note: firstValue(payment.note, payment.remarks) || null,
      reference: firstValue(payment.reference, order.payment_reference) || null,
      cash_received: cashReceived,
      change_returned: changeReturned,
    },
    metadata,
  }
}

export const createPosReportPayload = ({
  orders = [],
  filters = {},
  branch = {},
  user = {},
  metadata = {},
}) => {
  const safeOrders = Array.isArray(orders) ? orders : []
  const activeOrders = safeOrders.filter(order => order.status !== 'cancelled')

  return {
    report: {
      name: 'POS Sales Report',
      filters,
      order_count: safeOrders.length,
      revenue: activeOrders.reduce((sum, order) => sum + numberOrZero(order.total), 0),
    },
    branch: {
      id: branch.id || null,
      name: firstValue(branch.name, user.branch_name) || null,
      address: branch.address || null,
    },
    requested_by: {
      id: user.id || null,
      name: firstValue(user.name, user.full_name) || null,
      email: user.email || null,
    },
    orders: safeOrders.map(order => ({
      id: order.id || null,
      invoice_number: firstValue(order.invoice_no, order.invoice_number, order.reference) || null,
      created_at: order.created_at || null,
      customer_id: order.customer_id || null,
      customer_name: order.customer_name || 'Walk-In',
      order_type: firstValue(order.type, order.order_type) || 'sale',
      payment_method: firstValue(
        order.payment_type,
        order.order_payments?.at?.(-1)?.method,
        order.order_payments?.[0]?.method
      ) || null,
      subtotal: numberOrZero(order.subtotal),
      discount: numberOrZero(order.discount),
      tax: numberOrZero(order.tax),
      service_charge: numberOrZero(order.service_charge ?? order.service_fee),
      total: numberOrZero(order.total),
      paid_amount: numberOrZero(order.paid_amount),
      due_amount: numberOrZero(order.due_amount),
      status: order.status || 'pending',
    })),
    metadata,
  }
}

export const createFulfillmentReceiptPayload = ({
  request = {},
  item = {},
  quantity = 0,
  fulfilled = 0,
  remaining = 0,
  status,
  notes,
  branch = {},
  user = {},
  timestamp = new Date(),
  metadata = {},
}) => {
  const requestedQuantity = numberOrZero(item._qty ?? item.qty ?? request.quantity ?? request.qty)
  const fulfilledQuantity = numberOrZero(fulfilled)
  const dispatchedQuantity = numberOrZero(quantity)
  const sourceBranchId = firstValue(branch.id, user.branch_id)
  const destinationBranchId = firstValue(
    request.destination_branch_id,
    request.receiving_branch_id,
    request.branch_id
  )

  return {
    fulfillment: {
      id: firstValue(request.fulfillment_id, request.last_fulfillment_id) || null,
      demand_id: request.id || item._requestId || null,
      dispatch_reference: firstValue(
        request.dispatch_reference,
        request.transfer_reference,
        request.reference,
        request.id
      ) || null,
      created_at: timestamp instanceof Date ? timestamp.toISOString() : timestamp,
      demand_status: request.status || null,
      fulfillment_status: status || request.status || null,
      is_partial: numberOrZero(remaining) > 0,
      notes: notes || null,
      dispatch_note: firstValue(request.dispatch_note, request.notes) || null,
    },
    source_branch: {
      id: sourceBranchId || null,
      name: firstValue(branch.name, user.branch_name, request.source_branch_name) || null,
      address: branch.address || null,
    },
    destination_branch: {
      id: destinationBranchId || null,
      name: firstValue(
        request.destination_branch_name,
        request.receiving_branch_name,
        request.branch_name,
        request.department
      ) || null,
    },
    fulfilled_by: {
      id: user.id || null,
      name: firstValue(user.name, user.full_name, user.email) || null,
      email: user.email || null,
    },
    items: [{
      id: firstValue(item._itemId, item.id) || null,
      inventory_id: firstValue(item.inventory_id, item.item_id) || null,
      name: firstValue(item._displayName, item.name, request.item_name) || 'Item',
      category: firstValue(item.category, request.category) || null,
      requested_quantity: requestedQuantity,
      previously_fulfilled_quantity: Math.max(0, fulfilledQuantity - dispatchedQuantity),
      dispatched_quantity: dispatchedQuantity,
      fulfilled_quantity: fulfilledQuantity,
      remaining_quantity: numberOrZero(remaining),
      unit: firstValue(item._unit, item.unit, request.unit) || 'pcs',
      notes: firstValue(item._itemNotes, item.notes) || null,
    }],
    metadata,
  }
}

export const enqueuePrintJob = async ({
  branchId,
  jobType,
  source,
  payload,
  reference = createPrintReference(),
}) => {
  if (!branchId) {
    const error = new Error('No branch is selected for this print job')
    error.code = 'MISSING_BRANCH'
    console.error('[PrintQueue] Print job rejected:', error)
    return { success: false, error, reference }
  }

  if (!Object.values(PRINT_JOB_TYPES).includes(jobType)) {
    const error = new Error(`Unsupported print job type: ${jobType || 'missing'}`)
    error.code = 'INVALID_JOB_TYPE'
    console.error('[PrintQueue] Print job rejected:', error)
    return { success: false, error, reference }
  }

  try {
    const queuedPayload = toSerializableJson({
      version: 1,
      job_type: jobType,
      source,
      receipt: jobType !== PRINT_JOB_TYPES.POS_REPORT,
      requested_at: new Date().toISOString(),
      ...payload,
      metadata: {
        ...(payload?.metadata || {}),
        print_reference: reference,
      },
    })

    const { data, error } = await supabase
      .from('print_jobs')
      .insert({
        branch_id: branchId,
        payload: queuedPayload,
      })
      .select()
      .single()

    if (error) throw error

    return { success: true, job: data, reference }
  } catch (error) {
    console.error('[PrintQueue] Failed to enqueue print job:', error)
    return { success: false, error, reference }
  }
}
