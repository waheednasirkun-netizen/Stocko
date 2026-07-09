console.log('[RestoStock] api.js loaded')

/**
 * RestoStock — src/lib/api.js
 * Production-ready Supabase API layer
 */

import { supabase } from './supabase'

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

const now = () => new Date().toISOString()

const USER_SELECT = 'id, auth_id, email, name, full_name, role, status, phone, branch_id, created_at'

function wrap(data, error) {
  if (error) {
    return {
      data: null,
      error: {
        message: error.message ?? String(error),
      },
    }
  }
  return { data, error: null }
}

function normalizeUser(u) {
  if (!u) return u
  const name = u.name ?? u.full_name ?? u.email
  return { ...u, name, full_name: u.full_name ?? u.name ?? name }
}

/* ─── Internal helpers ─────────────────────────────────────────────────────── */

async function fetchProfile(authId, email) {
  console.log('[api] fetchProfile — authId:', authId, 'email:', email)

  const queryUser = async (label, column, value) => {
    const { data, error } = await supabase
      .from('users')
      .select(USER_SELECT)
      .eq(column, value)
      .maybeSingle()

    if (error) {
      console.error(`[api] fetchProfile error (${label}):`, error.message, error.code ?? '')
      return { data: null, error }
    }
    if (data) console.log(`[api] fetchProfile success (${label}) — users.id:`, data.id)
    return { data, error: null }
  }

  let { data, error } = await queryUser('auth_id', 'auth_id', authId)
  if (error) return { profile: null, error }
  if (data) return { profile: data, error: null }

  ;({ data, error } = await queryUser('id', 'id', authId))
  if (error) return { profile: null, error }
  if (data) {
    if (!data.auth_id) {
      await supabase.from('users').update({ auth_id: authId }).eq('id', data.id)
      data.auth_id = authId
    }
    return { profile: data, error: null }
  }

  const normalizedEmail = email?.trim().toLowerCase()
  if (normalizedEmail) {
    ;({ data, error } = await queryUser('email', 'email', normalizedEmail))
    if (error) return { profile: null, error }
    if (data) {
      if (!data.auth_id) {
        await supabase.from('users').update({ auth_id: authId }).eq('id', data.id)
        data.auth_id = authId
      }
      return { profile: data, error: null }
    }
  }

  console.error(
    '[api] fetchProfile: no row returned for authId', authId,
    '— row may exist but RLS is blocking SELECT.'
  )
  return {
    profile: null,
    error: {
      message:
        'No profile found for this account. Ask your administrator to add you, or check Row Level Security on the users table.',
    },
  }
}

async function fetchBranchName(branchId) {
  if (!branchId) return null
  const { data, error } = await supabase
    .from('branches')
    .select('id, name')
    .eq('id', branchId)
    .maybeSingle()

  if (error) {
    console.warn('[api] fetchBranchName error:', error.message)
    return null
  }
  return data?.name ?? null
}

async function buildUser(authUser) {
  const authId = typeof authUser === 'string' ? authUser : authUser?.id
  const email = typeof authUser === 'object' ? authUser?.email : undefined
  if (!authId) return { user: null, error: { message: 'Not authenticated' } }

  const { profile, error: pe } = await fetchProfile(authId, email)
  if (pe) return { user: null, error: pe }

  const branchName = await fetchBranchName(profile.branch_id)

  const user = {
    ...normalizeUser(profile),
    auth_id: profile.auth_id ?? authId,
    branch_name: branchName,
  }
  console.log('[api] buildUser complete:', { id: user.id, role: user.role, branch_id: user.branch_id })
  return { user, error: null }
}

function logActivity({ branchId, userId, userName, action, details }) {
  if (!branchId) return
  supabase
    .from('activity_logs')
    .insert([
      {
        branch_id: branchId,
        user_id: userId,
        user_name: userName,
        action,
        details,
        created_at: now(),
      },
    ])
    .then(({ error }) => {
      if (error) console.warn('[api] activity log error:', error.message)
    })
}

/* ─── Auth ───────────────────────────────────────────────────────────────── */

export const authApi = {
  async login(email, password) {
    console.log('[api] authApi.login for:', email)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (authError) {
      console.error('[api] Supabase Auth error:', authError.message)
      const msg = authError.message.toLowerCase()
      if (msg.includes('invalid') || msg.includes('not found')) {
        return wrap(null, { message: 'Incorrect email or password.' })
      }
      if (msg.includes('confirmed')) {
        return wrap(null, { message: 'Please confirm your email first.' })
      }
      if (msg.includes('many')) {
        return wrap(null, { message: 'Too many attempts. Please wait.' })
      }
      return wrap(null, authError)
    }

    if (authData.session) {
      await supabase.auth.setSession({
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      })
    }

    const { user, error: buildError } = await buildUser(authData.user)
    if (buildError) {
      await supabase.auth.signOut()
      return wrap(null, buildError)
    }
    return wrap(user, null)
  },

  async userFromSession(session) {
    if (!session?.user) {
      console.log('[api] userFromSession: no session user')
      return wrap(null, null)
    }
    const { user, error: buildError } = await buildUser(session.user)
    if (buildError) return wrap(null, buildError)
    return wrap(user, null)
  },

  async restoreSession() {
    console.log('[api] restoreSession')
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error) return wrap(null, error)
    if (!session) {
      console.log('[api] no active session')
      return wrap(null, null)
    }
    const { user, error: buildError } = await buildUser(session.user)
    if (buildError) return wrap(null, buildError)
    return wrap(user, null)
  },

  async logout() {
    const { error } = await supabase.auth.signOut()
    return wrap(null, error)
  },

  async getCurrentUserProfile() {
    const { data: { user: au }, error } = await supabase.auth.getUser()
    if (error || !au) return wrap(null, { message: 'Not authenticated' })
    const { user, error: be } = await buildUser(au)
    return wrap(user, be)
  },

  async getUser(id) {
    const { data, error } = await supabase
      .from('users')
      .select(USER_SELECT)
      .eq('id', id)
      .single()
    return wrap(normalizeUser(data), error)
  },
}

/* ─── Branches ───────────────────────────────────────────────────────────── */

export const branchApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('branches')
      .select('id, name, address')
      .order('name')
    return wrap(data, error)
  },

  async getForUser(userId) {
    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('branch_id')
      .eq('id', userId)
      .maybeSingle()
    if (userError) return wrap(null, userError)
    if (!userRow?.branch_id) return wrap([], null)

    const { data, error } = await supabase
      .from('branches')
      .select('id, name, address')
      .eq('id', userRow.branch_id)
    return wrap(data ?? [], error)
  },
}

/* ─── Users ──────────────────────────────────────────────────────────────── */

export const usersApi = {
  async getAll() {
    const { data, error } = await supabase
      .from('users')
      .select(USER_SELECT)
      .order('name')
    const normalised = data?.map(normalizeUser) ?? null
    return wrap(normalised, error)
  },

  async create(userData) {
    const { id: _id, created_at: _ca, auth_id: _ai, branch_name: _bn, ...safe } = userData
    const payload = {
      ...safe,
      full_name: safe.full_name ?? safe.name,
      created_at: now(),
    }
    const { data, error } = await supabase
      .from('users')
      .insert([payload])
      .select(USER_SELECT)
      .single()
    return wrap(normalizeUser(data), error)
  },

  async update(id, updates) {
    const { id: _id, created_at: _ca, auth_id: _ai, branch_name: _bn, ...safe } = updates
    const payload = {
      ...safe,
      ...(safe.name !== undefined && safe.full_name === undefined ? { full_name: safe.name } : {}),
    }
    const { data, error } = await supabase
      .from('users')
      .update(payload)
      .eq('id', id)
      .select(USER_SELECT)
      .single()
    return wrap(normalizeUser(data), error)
  },

  async remove(id) {
    const { error } = await supabase.from('users').delete().eq('id', id)
    return wrap(null, error)
  },
}

/* ─── Item Templates ─────────────────────────────────────────────────────── */

export const templatesApi = {
  async getAll(branchId) {
    if (!branchId) return wrap([], null)
    const { data, error } = await supabase
      .from('item_templates')
      .select('*')
      .eq('branch_id', branchId)
      .order('name')
    return wrap(data, error)
  },

  async create(template) {
    const { data, error } = await supabase
      .from('item_templates')
      .insert([{ ...template, created_at: now() }])
      .select()
      .single()
    return wrap(data, error)
  },

  async update(id, updates) {
    const { id: _id, created_at: _ca, ...safe } = updates
    const { data, error } = await supabase
      .from('item_templates')
      .update({ ...safe, updated_at: now() })
      .eq('id', id)
      .select()
      .single()
    return wrap(data, error)
  },

  async remove(id) {
    const { error } = await supabase.from('item_templates').delete().eq('id', id)
    return wrap(null, error)
  },
}

/* ─── Suppliers ───────────────────────────────────────────────────────────── */

export const suppliersApi = {
  async getAll(branchId) {
    if (!branchId) return wrap([], null)
    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('branch_id', branchId)
      .order('name')
    return wrap(data, error)
  },

  async create(supplier) {
    const { data, error } = await supabase
      .from('suppliers')
      .insert([{ ...supplier, created_at: now() }])
      .select()
      .single()
    return wrap(data, error)
  },

  async update(id, updates) {
    const { id: _id, created_at: _ca, ...safe } = updates
    const { data, error } = await supabase
      .from('suppliers')
      .update({ ...safe, updated_at: now() })
      .eq('id', id)
      .select()
      .single()
    return wrap(data, error)
  },

  async remove(id) {
    const { error } = await supabase.from('suppliers').delete().eq('id', id)
    return wrap(null, error)
  },
}

/* ─── Transactions ───────────────────────────────────────────────────────── */

export const transactionsApi = {
  async getAll(branchId) {
    if (!branchId) return wrap([], null)
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
    return wrap(data, error)
  },

  async stockIn({ item, qty, unit, source, category, notes, branchId, userId, userName }) {
    if (!branchId) {
      console.error('[api] stockIn: branchId is required')
      return wrap(null, { message: 'Branch ID is required for stock in' })
    }

    const quantity = Math.abs(Number(qty))
    const itemName = String(item).trim()

    if (!itemName || quantity <= 0) {
      return wrap(null, { message: 'Valid item name and quantity are required' })
    }

    console.log('[api] stockIn:', { branchId, itemName, quantity, unit, userId })

    // 1. Insert transaction
    const { data: txnData, error: txnError } = await supabase
      .from('transactions')
      .insert([
        {
          branch_id: branchId,
          item_name: itemName,
          type: 'Stock IN',
          quantity,
          unit,
          price_per_unit: 0,
          total_amount: 0,
          source: source ?? null,
          category: category ?? null,
          notes: notes ?? null,
          recorded_by: userId,
          recorded_by_name: userName,
          created_at: now(),
        },
      ])
      .select()
      .single()

    if (txnError) {
      console.error('[api] stockIn transaction error:', txnError)
      return wrap(null, txnError)
    }

    // 2. Upsert inventory
    const { data: existingItem } = await supabase
      .from('inventory')
      .select('id, quantity, unit')
      .eq('branch_id', branchId)
      .ilike('name', itemName)
      .maybeSingle()

    if (existingItem) {
      const newQty = Number(existingItem.quantity || 0) + quantity
      const { error: updateError } = await supabase
        .from('inventory')
        .update({
          quantity: newQty,
          unit: unit || existingItem.unit,
          category: category ?? 'Other',
          updated_at: now(),
        })
        .eq('id', existingItem.id)

      if (updateError) {
        console.error('[api] stockIn inventory update error:', updateError)
        return wrap(null, updateError)
      }
    } else {
      const { error: insertError } = await supabase.from('inventory').insert([
        {
          branch_id: branchId,
          name: itemName,
          category: category ?? 'Other',
          quantity,
          unit,
          created_at: now(),
          updated_at: now(),
        },
      ])

      if (insertError) {
        console.error('[api] stockIn inventory insert error:', insertError)
        return wrap(null, insertError)
      }
    }

    logActivity({
      branchId,
      userId,
      userName,
      action: 'stock_in',
      details: `Stock IN: ${quantity} ${unit} of ${itemName}`,
    })

    return wrap(txnData, null)
  },
}

/* ─── Demands ────────────────────────────────────────────────────────────── */

export const demandsApi = {
  async getAll(branchId) {
    if (!branchId) return wrap([], null)
    const { data, error } = await supabase
      .from('demands')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
    return wrap(data, error)
  },

  async create(demand) {
    const { data, error } = await supabase
      .from('demands')
      .insert([{ ...demand, status: 'Pending', created_at: now() }])
      .select()
      .single()
    return wrap(data, error)
  },

  async approve(id, approvedBy) {
    const { data, error } = await supabase
      .from('demands')
      .update({ status: 'Approved', approved_by: approvedBy, approved_at: now() })
      .eq('id', id)
      .select()
      .single()
    return wrap(data, error)
  },

  async reject(id, rejectedBy, reason) {
    const { data, error } = await supabase
      .from('demands')
      .update({
        status: 'Rejected',
        rejected_by: rejectedBy,
        rejection_reason: reason,
        updated_at: now(),
      })
      .eq('id', id)
      .select()
      .single()
    return wrap(data, error)
  },

  async stockOut({ item, qty, unit, type = 'Stock OUT', notes, branchId, userId, userName }) {
    if (!branchId) {
      console.error('[api] stockOut: branchId is required')
      return wrap(null, { message: 'Branch ID is required for stock out' })
    }

    const quantity = Math.abs(Number(qty))
    const itemName = String(item).trim()

    if (!itemName || quantity <= 0) {
      return wrap(null, { message: 'Valid item name and quantity are required' })
    }

    console.log('[api] stockOut:', { branchId, itemName, quantity, unit, type })

    // 1. Verify item exists
    const { data: existingItem, error: findError } = await supabase
      .from('inventory')
      .select('id, quantity, unit')
      .eq('branch_id', branchId)
      .ilike('name', itemName)
      .maybeSingle()

    if (findError) {
      console.error('[api] stockOut findError:', findError)
      return wrap(null, findError)
    }

    if (!existingItem) {
      return wrap(null, { message: `Item "${itemName}" not found in inventory` })
    }

    // 2. Verify sufficient stock
    const currentQty = Number(existingItem.quantity || 0)
    if (currentQty < quantity) {
      return wrap(null, {
        message: `Insufficient stock. Available: ${currentQty} ${existingItem.unit || unit}`,
      })
    }

    // 3. Insert transaction
    const { data: txnData, error: txnError } = await supabase
      .from('transactions')
      .insert([
        {
          branch_id: branchId,
          item_name: itemName,
          type,
          quantity,
          unit,
          price_per_unit: 0,
          total_amount: 0,
          source: null,
          category: null,
          notes: notes ?? null,
          recorded_by: userId,
          recorded_by_name: userName,
          created_at: now(),
        },
      ])
      .select()
      .single()

    if (txnError) {
      console.error('[api] stockOut transaction error:', txnError)
      return wrap(null, txnError)
    }

    // 4. Deduct inventory
    const newQty = currentQty - quantity
    const { error: updateError } = await supabase
      .from('inventory')
      .update({
        quantity: newQty,
        updated_at: now(),
      })
      .eq('id', existingItem.id)

    if (updateError) {
      console.error('[api] stockOut update error:', updateError)
      return wrap(null, updateError)
    }

    console.log('[api] stockOut success:', { item: itemName, deducted: quantity, remaining: newQty })

    logActivity({
      branchId,
      userId,
      userName,
      action: 'stock_out',
      details: `${type}: ${quantity} ${unit || existingItem.unit} of ${itemName}`,
    })

    return wrap(txnData, null)
  },
}

/* ─── Procurement ────────────────────────────────────────────────────────── */

export const procurementApi = {
  async getAll(branchId) {
    if (!branchId) return wrap([], null)
    const { data, error } = await supabase
      .from('procurement_requests')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
    return wrap(data, error)
  },

  async create(req) {
    const { data, error } = await supabase
      .from('procurement_requests')
      .insert([{ ...req, status: 'Open', created_at: now() }])
      .select()
      .single()
    return wrap(data, error)
  },

  async updateStatus(id, status, updatedBy) {
    const { data, error } = await supabase
      .from('procurement_requests')
      .update({ status, updated_by: updatedBy, updated_at: now() })
      .eq('id', id)
      .select()
      .single()
    return wrap(data, error)
  },

  async remove(id) {
    const { error } = await supabase.from('procurement_requests').delete().eq('id', id)
    return wrap(null, error)
  },
}

/* ─── Purchase Orders ──────────────────────────────────────────────────────── */

export const purchaseOrdersApi = {
  async getAll(branchId) {
    if (!branchId) return wrap([], null)
    const { data, error } = await supabase
      .from('purchase_orders')
      .select('*, purchase_order_items(*)')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
    return wrap(data, error)
  },

  async create({ po, items }) {
    const { data: poData, error: poError } = await supabase
      .from('purchase_orders')
      .insert([{ ...po, created_at: now() }])
      .select()
      .single()
    if (poError) return wrap(null, poError)

    const lineItems = items.map((item) => ({
      ...item,
      po_id: poData.id,
      created_at: now(),
    }))
    const { error: itemsError } = await supabase.from('purchase_order_items').insert(lineItems)
    return wrap(poData, itemsError)
  },

  async updateStatus(id, status, updatedBy) {
    const { data, error } = await supabase
      .from('purchase_orders')
      .update({ status, updated_by: updatedBy, updated_at: now() })
      .eq('id', id)
      .select()
      .single()
    return wrap(data, error)
  },
}

/* ─── Financial ──────────────────────────────────────────────────────────── */

export const financialApi = {
  async getAll(branchId) {
    if (!branchId) return wrap([], null)
    const { data, error } = await supabase
      .from('financial_transactions')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
    return wrap(data, error)
  },

  async updatePaymentStatus(id, paymentStatus) {
    const { data, error } = await supabase
      .from('financial_transactions')
      .update({ payment_status: paymentStatus, updated_at: now() })
      .eq('id', id)
      .select()
      .single()
    return wrap(data, error)
  },
}

/* ─── Activity Logs ───────────────────────────────────────────────────────── */

export const activityApi = {
  async getAll(branchId, limit = 200) {
    if (!branchId) return wrap([], null)
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false })
      .limit(limit)
    return wrap(data, error)
  },
}

/* ─── Inventory ──────────────────────────────────────────────────────────── */

export const inventoryApi = {
  async getAll(branchId) {
    if (!branchId) return wrap([], null)
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('branch_id', branchId)
      .order('name')
    return wrap(data, error)
  },

  async create({ itemData, branchId, userId, userName }) {
    const { data, error } = await supabase
      .from('inventory')
      .insert([{ ...itemData, branch_id: branchId, created_by: userId, created_at: now() }])
      .select()
      .single()
    if (!error) {
      logActivity({
        branchId,
        userId,
        userName,
        action: 'Inventory Item Added',
        details: `Added ${data.name} (${data.quantity} ${data.unit})`,
      })
    }
    return wrap(data, error)
  },

  async update({ id, updates, branchId, userId, userName }) {
    const { id: _id, created_at: _ca, ...safe } = updates
    const { data, error } = await supabase
      .from('inventory')
      .update({ ...safe, updated_at: now() })
      .eq('id', id)
      .select()
      .single()
    if (!error) {
      logActivity({
        branchId,
        userId,
        userName,
        action: 'Inventory Item Updated',
        details: `Updated ${data.name}`,
      })
    }
    return wrap(data, error)
  },

  async remove({ id, branchId, userId, userName, itemName }) {
    const { error } = await supabase.from('inventory').delete().eq('id', id)
    if (!error) {
      logActivity({
        branchId,
        userId,
        userName,
        action: 'Inventory Item Deleted',
        details: `Deleted ${itemName}`,
      })
    }
    return wrap(null, error)
  },
}