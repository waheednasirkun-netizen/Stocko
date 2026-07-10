import {
  ROLES,
  isAdmin, isManager, isChief, isStoreKeeper,
  hasRole, hasAnyRole,
  canCreateUsers, canDeleteUsers, canAssignRoles,
  canApproveRequests, canRejectRequests, canFulfillRequests,
  canCreateDemand, canManageInventory, canManageSuppliers,
  canManageProcurement, canManagePurchaseOrders, canManageFinancials,
  canViewReports, canAccessSettings,
  canAccessUserManagement, canAccessSuppliers, canAccessProcurement,
  canAccessPurchaseOrders, canAccessFinancials, canAccessInventory,
  canAccessStockMovement, canAccessFulfillment, canAccessDemands,
  canAccessDashboard, canAccessActivityLog, canAccessItemTemplates,
  SIDEBAR_PERMISSIONS,
} from '../lib/constants'
import { fetchUserRole } from '../lib/api'
import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  authApi, usersApi, templatesApi, suppliersApi,
  transactionsApi, procurementApi,
  purchaseOrdersApi, financialApi, activityApi,
  inventoryApi,
} from '../lib/api'
import { supabase } from '../lib/supabase'
import { lightTheme, darkTheme, DEFAULT_UNITS } from '../lib/constants'

const AppContext = createContext(null)

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}

/* ═══════════════════════════════════════════════════════════════════════════
   APPCONTEXT PROVIDER
   ═══════════════════════════════════════════════════════════════════════════ */

export function AppProvider({ children }) {

  // ── Auth state ────────────────────────────────────────────────────────────
  const [user,      setUser]      = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState(null)

  // ── RBAC state ──────────────────────────────────────────────────────────────
  const [userRole, setUserRole] = useState(null)

  // ── Theme state ─────────────────────────────────────────────────────────────
  const [dark, setDark] = useState(() => localStorage.getItem('rs_dark') === 'true')

  useEffect(() => {
    localStorage.setItem('rs_dark', dark)
  }, [dark])

  const theme = dark ? darkTheme : lightTheme

  // ── UI state ────────────────────────────────────────────────────────────────
  const [tab,           setTab]           = useState('dashboard')
  const [sidebarOpen,   setSidebar]       = useState(window.innerWidth > 768)
  const [toasts,        setToasts]        = useState([])
  const [notifications, setNotifications] = useState([])
  const [systemEnabled, setSystemEnabled] = useState(true)
  const [systemMsg,     setSystemMsg]     = useState('System is currently under maintenance.')
  const [customUnits,   setCustomUnits]   = useState([])
  const [loading,       setLoading]       = useState(false)
  const [categories,    setCategories]    = useState([])

  // ── Business data ─────────────────────────────────────────────────────────
  const [transactions,          setTransactions]          = useState([])
  const [requests,              setRequests]              = useState([])
  const [inventory,             setInventory]             = useState([])
  const [templates,             setTemplates]             = useState([])
  const [suppliers,             setSuppliers]             = useState([])
  const [users,                 setUsers]                 = useState([])
  const [procurements,          setProcurements]          = useState([])
  const [purchaseOrders,        setPurchaseOrders]        = useState([])
  const [financialTransactions, setFinancialTransactions] = useState([])
  const [activityLogs,          setActivityLogs]          = useState([])
  const [dataLoaded,            setDataLoaded]            = useState(false)

  // ── Derived: all units ────────────────────────────────────────────────────
  const allUnits = useMemo(
    () => [...new Set([...DEFAULT_UNITS, ...customUnits])],
    [customUnits]
  )

  // ═══════════════════════════════════════════════════════════════════════════
  // RBAC: LOAD USER ROLE (uses auth.users.id, not custom users table id)
  // ═══════════════════════════════════════════════════════════════════════════

  const loadUserRole = useCallback(async (authUserId) => {
    console.log('[RBAC] loadUserRole called for userId:', authUserId)
    if (!authUserId) {
      console.log('[RBAC] No authUserId provided, defaulting to Store Keeper')
      setUserRole(ROLES.STORE_KEEPER)
      return
    }
    try {
      const data = await fetchUserRole(authUserId)
      console.log('[RBAC] fetchUserRole returned:', data)
      if (data && data.role) {
        console.log('[RBAC] Setting role to:', data.role)
        setUserRole(data.role)
      } else {
        console.log('[RBAC] No role found in DB, defaulting to Store Keeper')
        setUserRole(ROLES.STORE_KEEPER)
      }
    } catch (err) {
      console.warn('[RBAC] Error loading role:', err)
      setUserRole(ROLES.STORE_KEEPER)
    }
  }, [])

  // ── Toast helpers ───────────────────────────────────────────────────────────
  const showToast = useCallback((type, title, msg, duration = 4500) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev.slice(-4), { id, type, title, msg }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addNotification = useCallback((notif) => {
    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    setNotifications(prev => [
      { id: Date.now(), time: `Just now (${time})`, read: false, ...notif },
      ...prev.slice(0, 29),
    ])
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  // ── Clear data on logout ──────────────────────────────────────────────────
  const clearData = useCallback(() => {
    setTransactions([])
    setRequests([])
    setInventory([])
    setTemplates([])
    setSuppliers([])
    setUsers([])
    setProcurements([])
    setPurchaseOrders([])
    setFinancialTransactions([])
    setActivityLogs([])
    setCategories([])
    setDataLoaded(false)
    setUserRole(null)
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA FETCHING
  // ═══════════════════════════════════════════════════════════════════════════

  const getBranchId = useCallback((u) => {
    return u?.branch_id ?? u?.branchId ?? null
  }, [])

  const fetchInventory = useCallback(async (branchId) => {
    if (!branchId) return
    const { data, error } = await inventoryApi.getAll(branchId)
    if (error) console.error('[AppContext] fetchInventory error:', error.message)
    else setInventory(data || [])
  }, [])

  const fetchRequests = useCallback(async (branchId) => {
    if (!branchId) return
    try {
      const { data, error } = await supabase
        .from('requests')
        .select(`*, request_items (*)`)
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })

      if (error) throw error

      const flattened = (data || []).map(r => {
        const primaryItem = r.request_items?.[0] || {}
        return {
          ...r,
          item_name: primaryItem.name || r.item_name,
          name: primaryItem.name || r.name,
          category: primaryItem.category || r.category,
          unit: primaryItem.unit || r.unit,
          quantity: primaryItem.qty || r.quantity,
          qty: primaryItem.qty || r.qty,
        }
      })

      setRequests(flattened)
      return flattened
    } catch (error) {
      console.error('[AppContext] fetchRequests error:', error)
      showToast('error', 'Error loading requests', error.message)
      return []
    }
  }, [showToast])

  const fetchCategories = useCallback(async (branchId) => {
    if (!branchId) return
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('branch_id', branchId)
        .order('name', { ascending: true })
      if (error) throw error
      setCategories(data || [])
    } catch (err) {
      console.error('[AppContext] fetchCategories error:', err)
      showToast('error', 'Error loading categories', err.message)
    }
  }, [showToast])

  // ── Load all business data ──────────────────────────────────────────────────
  const loadAllData = useCallback(async (loggedInUser) => {
    if (!loggedInUser) {
      console.warn('[AppContext] loadAllData: no user provided')
      setDataLoaded(true)
      return
    }

    const branchId = getBranchId(loggedInUser)

    if (!branchId) {
      console.warn('[AppContext] loadAllData: no branch_id — user:', loggedInUser)
      showToast('error', 'Branch Error', 'No branch assigned to your account. Please contact administrator.')
      setDataLoaded(true)
      return
    }

    console.log('[AppContext] loadAllData start — branch:', branchId)
    setLoading(true)
    try {
      const [
        txnRes, invRes, tmplRes, supRes,
        usrRes, procRes, poRes, finRes, actRes,
      ] = await Promise.all([
        transactionsApi.getAll(branchId),
        inventoryApi.getAll(branchId),
        templatesApi.getAll(branchId),
        suppliersApi.getAll(branchId),
        usersApi.getAll(),
        procurementApi.getAll(branchId),
        purchaseOrdersApi.getAll(branchId),
        financialApi.getAll(branchId),
        activityApi.getAll(branchId),
      ])

      if (txnRes.error)  console.error('[AppContext] transactions:', txnRes.error.message)
      if (invRes.error)  console.error('[AppContext] inventory:', invRes.error.message)
      if (tmplRes.error) console.error('[AppContext] templates:', tmplRes.error.message)
      if (supRes.error)  console.error('[AppContext] suppliers:', supRes.error.message)
      if (usrRes.error)  console.error('[AppContext] users:', usrRes.error.message)
      if (procRes.error) console.error('[AppContext] procurement:', procRes.error.message)
      if (poRes.error)   console.error('[AppContext] purchase orders:', poRes.error.message)
      if (finRes.error)  console.error('[AppContext] financials:', finRes.error.message)
      if (actRes.error)  console.error('[AppContext] activity logs:', actRes.error.message)

      if (txnRes.data)  setTransactions(txnRes.data)
      if (invRes.data)  setInventory(invRes.data)
      if (tmplRes.data) setTemplates(tmplRes.data)
      if (supRes.data)  setSuppliers(supRes.data)
      if (usrRes.data)  setUsers(usrRes.data)
      if (procRes.data) setProcurements(procRes.data)
      if (poRes.data)   setPurchaseOrders(poRes.data)
      if (finRes.data)  setFinancialTransactions(finRes.data)
      if (actRes.data)  setActivityLogs(actRes.data)

      await fetchRequests(branchId)
      await fetchCategories(branchId)

      setDataLoaded(true)
      console.log('[AppContext] loadAllData complete ✓')
    } catch (err) {
      console.error('[AppContext] loadAllData error:', err)
      showToast('error', 'Load Failed', 'Could not load data. Check console for details.')
      setDataLoaded(true)
    } finally {
      setLoading(false)
    }
  }, [showToast, fetchRequests, fetchCategories, getBranchId])

  // ═══════════════════════════════════════════════════════════════════════════
  // REAL-TIME SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!user?.branch_id) return

    const channels = []

    const invChannel = supabase
      .channel(`inventory:${user.branch_id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'inventory',
        filter: `branch_id=eq.${user.branch_id}`,
      }, () => { fetchInventory(user.branch_id) })
      .subscribe()
    channels.push(invChannel)

    const txnChannel = supabase
      .channel(`transactions:${user.branch_id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'transactions',
        filter: `branch_id=eq.${user.branch_id}`,
      }, (payload) => {
        setTransactions(prev => [payload.new, ...prev])
      })
      .subscribe()
    channels.push(txnChannel)

    const reqChannel = supabase
      .channel(`requests:${user.branch_id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'requests',
        filter: `branch_id=eq.${user.branch_id}`,
      }, () => { fetchRequests(user.branch_id) })
      .subscribe()
    channels.push(reqChannel)

    return () => { channels.forEach(ch => supabase.removeChannel(ch)) }
  }, [user?.branch_id, fetchInventory, fetchRequests])

  // ═══════════════════════════════════════════════════════════════════════════
  // AUTH LISTENER
  // ═══════════════════════════════════════════════════════════════════════════

  const loadAllDataRef  = useRef(loadAllData)
  const clearDataRef    = useRef(clearData)

  useEffect(() => { loadAllDataRef.current = loadAllData }, [loadAllData])
  useEffect(() => { clearDataRef.current   = clearData   }, [clearData])

  useEffect(() => {
    const finishAuth = async (session) => {
      console.log('[Auth] finishAuth called, session exists:', !!session)
      if (!session) {
        setAuthReady(true)
        return
      }

      const { data: restoredUser, error } = await authApi.userFromSession(session)

      if (error || !restoredUser) {
        console.error('[Auth] session profile failed:', error?.message)
        setAuthReady(true)
        return
      }

      console.log('[Auth] authenticated:', restoredUser.email, 'authId:', session.user?.id, 'profileId:', restoredUser.id)
      setUser(restoredUser)

      // ── CRITICAL: Use auth.users.id for role lookup, not profile id ──
      const authUserId = session.user?.id || restoredUser.auth_id || restoredUser.id
      console.log('[Auth] Looking up role for authUserId:', authUserId)
      await loadUserRole(authUserId)

      await loadAllDataRef.current(restoredUser)
      setAuthReady(true)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Auth] auth event:', event)

        if (event === 'INITIAL_SESSION') {
          setTimeout(() => { void finishAuth(session) }, 0)
          return
        }

        if (event === 'SIGNED_IN') {
          setTimeout(() => { void finishAuth(session) }, 0)
          return
        }

        if (event === 'SIGNED_OUT') {
          setUser(null)
          clearDataRef.current()
          setTab('dashboard')
          setAuthReady(true)
          return
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [loadUserRole])

  // ── Login ───────────────────────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    console.log('[Auth] login:', email)
    setAuthError(null)

    const { data: loggedInUser, error } = await authApi.login(email, password)

    if (error) {
      setAuthError(error.message)
      return { error }
    }

    if (loggedInUser) {
      console.log('[Auth] login success, profile:', loggedInUser)
      setUser(loggedInUser)

      // ── CRITICAL: Get auth user ID from session, not profile ──
      const { data: { session } } = await supabase.auth.getSession()
      const authUserId = session?.user?.id
      console.log('[Auth] login authUserId from session:', authUserId)

      if (authUserId) {
        await loadUserRole(authUserId)
      } else {
        // Fallback: try profile id or auth_id field
        await loadUserRole(loggedInUser.auth_id || loggedInUser.id)
      }

      await loadAllData(loggedInUser)
    }

    return { data: loggedInUser }
  }, [loadAllData, loadUserRole])

  // ── Logout ──────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    await authApi.logout()
  }, [])

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION LOCK
  // ═══════════════════════════════════════════════════════════════════════════

  const actionInProgress = useRef(false)
  const withActionLock = useCallback(async (fn) => {
    if (actionInProgress.current) {
      showToast('info', 'Please wait', 'An operation is already in progress')
      return { locked: true }
    }
    actionInProgress.current = true
    try {
      const result = await fn()
      return { locked: false, result }
    } catch (err) {
      console.error('[AppContext] action lock error:', err)
      return { locked: false, error: err }
    } finally {
      actionInProgress.current = false
    }
  }, [showToast])

  // ═══════════════════════════════════════════════════════════════════════════
  // STOCK OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const handleStockIn = useCallback(async (formData) => {
    const branchId = getBranchId(user)
    if (!branchId) {
      showToast('error', 'Branch Error', 'No branch assigned to your account')
      return { success: false }
    }

    return withActionLock(async () => {
      const { data, error } = await transactionsApi.stockIn({
        ...formData,
        branchId,
        userId:   user?.id,
        userName: user?.name || user?.full_name || 'Unknown',
      })
      if (error) {
        showToast('error', 'Stock IN Failed', error.message)
        return { success: false, error }
      }
      setTransactions(prev => [data, ...prev])
      setInventory(prev => {
        const idx = prev.findIndex(i => i.name?.toLowerCase() === formData.item?.toLowerCase())
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = {
            ...updated[idx],
            quantity: (Number(updated[idx].quantity) || 0) + Math.abs(Number(formData.qty)),
            updated_at: new Date().toISOString(),
          }
          return updated
        }
        return prev
      })
      addNotification({ title: 'Stock IN', msg: `${formData.qty} ${formData.unit} of ${formData.item}`, type: 'success' })
      showToast('success', 'Stock IN Recorded', `${formData.item} — ${formData.qty} ${formData.unit}`)
      return { success: true, data }
    })
  }, [user, getBranchId, withActionLock, addNotification, showToast])

  const handleStockOut = useCallback(async (formData) => {
    const branchId = getBranchId(user)
    if (!branchId) {
      showToast('error', 'Branch Error', 'No branch assigned to your account')
      return { success: false }
    }

    return withActionLock(async () => {
      const { data, error } = await transactionsApi.stockOut({
        ...formData,
        branchId,
        userId:   user?.id,
        userName: user?.name || user?.full_name || 'Unknown',
      })
      if (error) {
        showToast('error', 'Stock OUT Failed', error.message)
        return { success: false, error }
      }
      setTransactions(prev => [data, ...prev])
      setInventory(prev => {
        const idx = prev.findIndex(i => i.name?.toLowerCase() === formData.item?.toLowerCase())
        if (idx >= 0) {
          const updated = [...prev]
          updated[idx] = {
            ...updated[idx],
            quantity: Math.max(0, (Number(updated[idx].quantity) || 0) - Math.abs(Number(formData.qty))),
            updated_at: new Date().toISOString(),
          }
          return updated
        }
        return prev
      })
      addNotification({ title: formData.type || 'Stock OUT', msg: `${formData.qty} ${formData.unit} of ${formData.item}`, type: 'success' })
      showToast('success', `${formData.type || 'Stock OUT'} Recorded`, `${formData.item} — ${formData.qty} ${formData.unit}`)
      return { success: true, data }
    })
  }, [user, getBranchId, withActionLock, addNotification, showToast])

  // ═══════════════════════════════════════════════════════════════════════════
  // REQUESTS SYSTEM
  // ═══════════════════════════════════════════════════════════════════════════

  const createRequest = useCallback(async ({ department, notes, items }) => {
    const branchId = getBranchId(user)
    if (!branchId) {
      showToast('error', 'Branch Error', 'No branch assigned')
      return { success: false, error: new Error('No branch') }
    }

    try {
      const { data: req, error: reqError } = await supabase
        .from('requests')
        .insert({
          department,
          notes,
          status: 'Pending',
          branch_id: branchId,
          created_by: user?.id,
          created_by_name: user?.name || user?.full_name || 'Unknown',
        })
        .select()
        .single()

      if (reqError) throw reqError

      const requestItems = items.map(item => ({
        request_id: req.id,
        name: item.name,
        category: item.category,
        unit: item.unit,
        qty: item.qty,
        notes: item.notes,
      }))

      const { error: itemsError } = await supabase
        .from('request_items')
        .insert(requestItems)

      if (itemsError) throw itemsError

      await createNotification({
        type: 'request_created',
        title: 'New Request',
        message: `${department} requested ${items.length} item(s)`,
        link: '/requests',
      })

      await createActivityLog({
        action: 'REQUEST_CREATED',
        description: `${department} created a request with ${items.length} item(s)`,
        metadata: { department, itemCount: items.length, requestId: req.id }
      })

      await fetchRequests(branchId)
      return { success: true, data: req }

    } catch (error) {
      console.error('createRequest error:', error)
      showToast('error', 'Create Failed', error.message)
      return { success: false, error }
    }
  }, [user, getBranchId, showToast, fetchRequests])

  const approveRequest = useCallback(async (id) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({
          status: 'Approved',
          approved_by: user.id,
          approved_by_name: user.name,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error
      await fetchRequests(getBranchId(user))
      return { success: true }
    } catch (error) {
      console.error('approveRequest error:', error)
      showToast('error', 'Approve Failed', error.message)
      return { success: false, error }
    }
  }, [user, getBranchId, showToast, fetchRequests])

  const rejectRequest = useCallback(async (id) => {
    try {
      const { error } = await supabase
        .from('requests')
        .update({
          status: 'Rejected',
          approved_by: user.id,
          approved_by_name: user.name,
          approved_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error
      await fetchRequests(getBranchId(user))
      return { success: true }
    } catch (error) {
      console.error('rejectRequest error:', error)
      showToast('error', 'Reject Failed', error.message)
      return { success: false, error }
    }
  }, [user, getBranchId, showToast, fetchRequests])

  const fulfillRequest = useCallback(async (id) => {
    try {
      const { data: req, error: fetchError } = await supabase
        .from('requests')
        .select(`*, request_items (*)`)
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError

      const items = req.request_items || []
      if (items.length === 0) throw new Error('No items found on this request')

      const branchId = getBranchId(user)

      for (const item of items) {
        const qty = Number(item.qty) || 0
        if (qty <= 0) continue

        const { data: txnData, error: stockError } = await transactionsApi.stockOut({
          item: item.name,
          qty,
          unit: item.unit || 'pcs',
          type: 'Fulfillment',
          notes: `Fulfilled request from ${req.department || 'department'}`,
          branchId,
          userId: user?.id,
          userName: user?.name || user?.full_name || 'Unknown',
        })

        if (stockError) throw new Error(`Failed to deduct ${item.name}: ${stockError.message}`)
        if (txnData) setTransactions(prev => [txnData, ...prev])

        if (item.id) {
          const { error: itemError } = await supabase
            .from('request_items')
            .update({ fulfilled_qty: qty })
            .eq('id', item.id)
          if (itemError) throw new Error(`Failed to update ${item.name}: ${itemError.message}`)
        }
      }

      const { error } = await supabase
        .from('requests')
        .update({ status: 'Completed', completed_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error

      await createNotification({ type: 'request_fulfilled', title: 'Request Fulfilled', message: 'Request has been fulfilled and inventory updated', link: '/requests' })
      await createActivityLog({ action: 'REQUEST_FULFILLED', description: 'Request was fulfilled and inventory updated', metadata: { requestId: id } })
      await fetchRequests(branchId)
      showToast('success', 'Request Fulfilled', 'Inventory has been updated')
      return { success: true }

    } catch (error) {
      console.error('fulfillRequest error:', error)
      showToast('error', 'Fulfill Failed', error.message)
      return { success: false, error }
    }
  }, [user, getBranchId, showToast, fetchRequests])

  const partialFulfillRequest = useCallback(async (id, fulfilledItems = []) => {
    try {
      if (!Array.isArray(fulfilledItems) || fulfilledItems.length === 0) {
        throw new Error('No fulfilled items provided')
      }

      const { data: req, error: fetchError } = await supabase
        .from('requests')
        .select(`*, request_items (*)`)
        .eq('id', id)
        .single()

      if (fetchError) throw fetchError

      const branchId = getBranchId(user)

      for (const { itemId, qty } of fulfilledItems) {
        const item = (req.request_items || []).find(ri => ri.id === itemId)
        if (!item) throw new Error('Request item not found')

        const deductQty = Number(qty) || 0
        if (deductQty <= 0) continue

        const { data: txnData, error: stockError } = await transactionsApi.stockOut({
          item: item.name,
          qty: deductQty,
          unit: item.unit || 'pcs',
          type: 'Fulfillment',
          notes: `Partially fulfilled request from ${req.department || 'department'}`,
          branchId,
          userId: user?.id,
          userName: user?.name || user?.full_name || 'Unknown',
        })

        if (stockError) throw new Error(`Failed to deduct ${item.name}: ${stockError.message}`)
        if (txnData) setTransactions(prev => [txnData, ...prev])

        const newFulfilled = Number(item.fulfilled_qty || 0) + deductQty
        const { error: itemError } = await supabase
          .from('request_items')
          .update({ fulfilled_qty: newFulfilled })
          .eq('id', itemId)
        if (itemError) throw new Error(`Failed to update ${item.name}: ${itemError.message}`)
      }

      const allFulfilled = (req.request_items || []).every(ri => {
        const fulfilled = fulfilledItems.find(fi => fi.itemId === ri.id)
        const addedQty = Number(fulfilled?.qty) || 0
        return Number(ri.fulfilled_qty || 0) + addedQty >= Number(ri.qty || 0)
      })

      const { error } = await supabase
        .from('requests')
        .update({
          status: allFulfilled ? 'Completed' : 'Partially Fulfilled',
          completed_at: allFulfilled ? new Date().toISOString() : null,
        })
        .eq('id', id)
      if (error) throw error

      await createNotification({ type: 'request_partial', title: allFulfilled ? 'Request Fulfilled' : 'Request Partially Fulfilled', message: allFulfilled ? 'Request fulfilled' : 'Request partially fulfilled', link: '/requests' })
      await createActivityLog({ action: allFulfilled ? 'REQUEST_FULFILLED' : 'REQUEST_PARTIAL', description: allFulfilled ? 'Request fulfilled' : 'Request partially fulfilled', metadata: { requestId: id } })
      await fetchRequests(branchId)
      showToast('success', allFulfilled ? 'Request Fulfilled' : 'Partially Fulfilled', 'Inventory has been updated')
      return { success: true }

    } catch (error) {
      console.error('partialFulfillRequest error:', error)
      showToast('error', 'Partial Fulfill Failed', error.message)
      return { success: false, error }
    }
  }, [user, getBranchId, showToast, fetchRequests])

  const deleteRequest = useCallback(async (id) => {
    try {
      const { error } = await supabase.from('requests').delete().eq('id', id)
      if (error) throw error
      await fetchRequests(getBranchId(user))
      return { success: true }
    } catch (error) {
      console.error('deleteRequest error:', error)
      showToast('error', 'Delete Failed', error.message)
      return { success: false, error }
    }
  }, [user, getBranchId, showToast, fetchRequests])

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS & ACTIVITY LOGS
  // ═══════════════════════════════════════════════════════════════════════════

  const createNotification = useCallback(async ({ type, title, message, link }) => {
    try {
      await supabase.from('notifications').insert({
        type, title, message, link,
        user_id: user?.id,
        branch_id: getBranchId(user),
        read: false,
        created_at: new Date().toISOString(),
      })
    } catch (error) {
      console.error('createNotification error:', error)
    }
  }, [user, getBranchId])

  const createActivityLog = useCallback(async ({ action, description, metadata }) => {
    try {
      await supabase.from('activity_logs').insert({
        action, description, metadata,
        user_id: user?.id,
        user_name: user?.name,
        branch_id: getBranchId(user),
        created_at: new Date().toISOString(),
      })
    } catch (error) {
      console.error('createActivityLog error:', error)
    }
  }, [user, getBranchId])

  // ═══════════════════════════════════════════════════════════════════════════
  // CRUD OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Templates ───────────────────────────────────────────────────────────────
  const createTemplate = useCallback(async (tmpl) => {
    const { data, error } = await templatesApi.create({ ...tmpl, branch_id: getBranchId(user), created_by: user?.id })
    if (error) { showToast('error', 'Failed', error.message); return null }
    setTemplates(prev => [...prev, data])
    return data
  }, [user, getBranchId, showToast])

  const updateTemplate = useCallback(async (id, updates) => {
    const { data, error } = await templatesApi.update(id, updates)
    if (error) { showToast('error', 'Failed', error.message); return }
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
  }, [showToast])

  const deleteTemplate = useCallback(async (id) => {
    const { error } = await templatesApi.remove(id)
    if (error) { showToast('error', 'Failed', error.message); return }
    setTemplates(prev => prev.filter(t => t.id !== id))
  }, [showToast])

  // ── Suppliers ──────────────────────────────────────────────────────────────
  const createSupplier = useCallback(async (sup) => {
    const { data, error } = await suppliersApi.create({ ...sup, branch_id: getBranchId(user) })
    if (error) { showToast('error', 'Failed', error.message); return null }
    setSuppliers(prev => [...prev, data])
    return data
  }, [user, getBranchId, showToast])

  const updateSupplier = useCallback(async (id, updates) => {
    const { data, error } = await suppliersApi.update(id, updates)
    if (error) { showToast('error', 'Failed', error.message); return }
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, ...data } : s))
  }, [showToast])

  const deleteSupplier = useCallback(async (id) => {
    const { error } = await suppliersApi.remove(id)
    if (error) { showToast('error', 'Failed', error.message); return }
    setSuppliers(prev => prev.filter(s => s.id !== id))
  }, [showToast])

  // ── Users ──────────────────────────────────────────────────────────────────
  const createUser = useCallback(async (userData) => {
    const payload = {
      ...userData,
      branch_id: getBranchId(user),
    }
    const { data, error } = await usersApi.create(payload)
    if (error) { showToast('error', 'Failed', error.message); return null }
    setUsers(prev => [...prev, data])
    return data
  }, [user, getBranchId, showToast])

  const updateUser = useCallback(async (id, updates) => {
    const { data, error } = await usersApi.update(id, updates)
    if (error) { showToast('error', 'Failed', error.message); return }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...data } : u))
  }, [showToast])

  const deleteUser = useCallback(async (id) => {
    const { error } = await usersApi.remove(id)
    if (error) { showToast('error', 'Failed', error.message); return }
    setUsers(prev => prev.filter(u => u.id !== id))
  }, [showToast])

  // ── Categories ────────────────────────────────────────────────────────────
  const createCategory = useCallback(async (cat) => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .insert({ ...cat, branch_id: getBranchId(user), created_by: user?.id })
        .select()
        .single()
      if (error) throw error
      setCategories(prev => [...prev, data])
      showToast('success', 'Category Created', data.name)
      return data
    } catch (err) {
      showToast('error', 'Failed', err.message)
      throw err
    }
  }, [user, getBranchId, showToast])

  const updateCategory = useCallback(async (id, updates) => {
    try {
      const { data, error } = await supabase.from('categories').update(updates).eq('id', id).select().single()
      if (error) throw error
      setCategories(prev => prev.map(c => c.id === id ? { ...c, ...data } : c))
      showToast('success', 'Category Updated', data.name)
      return data
    } catch (err) {
      showToast('error', 'Failed', err.message)
      throw err
    }
  }, [showToast])

  const deleteCategory = useCallback(async (id) => {
    try {
      const { error } = await supabase.from('categories').delete().eq('id', id)
      if (error) throw error
      setCategories(prev => prev.filter(c => c.id !== id))
      showToast('info', 'Category Deleted', '')
    } catch (err) {
      showToast('error', 'Failed', err.message)
      throw err
    }
  }, [showToast])

  // ── Procurement ────────────────────────────────────────────────────────────
  const createProcurement = useCallback(async (req) => {
    const { data, error } = await procurementApi.create({ ...req, branch_id: getBranchId(user), created_by: user?.id })
    if (error) { showToast('error', 'Failed', error.message); return null }
    setProcurements(prev => [data, ...prev])
    return data
  }, [user, getBranchId, showToast])

  const updateProcurementStatus = useCallback(async (id, status) => {
    const { data, error } = await procurementApi.updateStatus(id, status, user?.id)
    if (error) { showToast('error', 'Failed', error.message); return }
    setProcurements(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
  }, [user, showToast])

  const deleteProcurement = useCallback(async (id) => {
    const { error } = await procurementApi.remove(id)
    if (error) { showToast('error', 'Failed', error.message); return }
    setProcurements(prev => prev.filter(p => p.id !== id))
  }, [showToast])

  // ── Purchase orders ────────────────────────────────────────────────────────
  const createPurchaseOrder = useCallback(async ({ po, items }) => {
    const { data, error } = await purchaseOrdersApi.create({
      po: { ...po, branch_id: getBranchId(user), created_by: user?.id },
      items,
    })
    if (error) { showToast('error', 'Failed', error.message); return null }
    setPurchaseOrders(prev => [data, ...prev])
    return data
  }, [user, getBranchId, showToast])

  const updatePOStatus = useCallback(async (id, status) => {
    const { data, error } = await purchaseOrdersApi.updateStatus(id, status, user?.id)
    if (error) { showToast('error', 'Failed', error.message); return }
    setPurchaseOrders(prev => prev.map(p => p.id === id ? { ...p, ...data } : p))
  }, [user, showToast])

  // ── Financial ──────────────────────────────────────────────────────────────
  const updateFinancialTxnStatus = useCallback(async (id, paymentStatus) => {
    const { data, error } = await financialApi.updatePaymentStatus(id, paymentStatus)
    if (error) { showToast('error', 'Failed', error.message); return }
    setFinancialTransactions(prev => prev.map(f => f.id === id ? { ...f, ...data } : f))
  }, [showToast])

  // ═══════════════════════════════════════════════════════════════════════════
  // STATS
  // ═══════════════════════════════════════════════════════════════════════════

  const stats = useMemo(() => {
    const safeInventory = Array.isArray(inventory) ? inventory : []
    const safeTransactions = Array.isArray(transactions) ? transactions : []
    const safeSuppliers = Array.isArray(suppliers) ? suppliers : []

    const lowStock = safeInventory.filter(i => {
      const qty = Number(i.quantity) || 0
      const threshold = Number(i.min_threshold || i.min_stock || i.threshold || 0)
      return threshold > 0 && qty <= threshold
    })

    const critical = safeInventory.filter(i => (Number(i.quantity) || 0) === 0)

    const stockInTotal = safeTransactions
      .filter(t => t.type === 'Stock IN')
      .reduce((s, t) => s + Math.abs(Number(t.quantity || t.qty) || 0), 0)

    const stockOutTotal = safeTransactions
      .filter(t => ['Stock OUT', 'Wastage', 'Fulfillment'].includes(t.type))
      .reduce((s, t) => s + Math.abs(Number(t.quantity || t.qty) || 0), 0)

    const invValue = safeInventory.reduce((s, i) =>
      s + (Number(i.quantity) || 0) * (Number(i.cost || i.price || 0) || 0), 0)

    return {
      totalItems: safeInventory.length,
      lowStockCount: lowStock.length,
      criticalCount: critical.length,
      stockInTotal,
      stockOutTotal,
      activeSuppliers: safeSuppliers.length,
      inventoryValue: invValue,
    }
  }, [inventory, transactions, suppliers])

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXT VALUE
  // ═══════════════════════════════════════════════════════════════════════════

  const value = {
    // Auth
    user, setUser, login, logout,
    authReady, authError,
    // Theme
    dark, setDark, theme,
    // UI
    tab, setTab, sidebarOpen, setSidebar,
    loading, dataLoaded,
    toasts, showToast, dismissToast,
    notifications, addNotification, markAllRead,
    systemEnabled, setSystemEnabled, systemMsg, setSystemMsg,
    // Data
    transactions, setTransactions,
    requests, setRequests,
    inventory, setInventory,
    templates, setTemplates,
    suppliers, setSuppliers,
    users, setUsers,
    procurements, setProcurements,
    purchaseOrders, setPurchaseOrders,
    financialTransactions, setFinancialTransactions,
    activityLogs,
    stats,
    // Units
    customUnits, setCustomUnits, allUnits,
    // Categories
    categories, setCategories,
    fetchCategories, createCategory, updateCategory, deleteCategory,
    // Stock operations
    handleStockIn, handleStockOut,
    // Requests
    createRequest, approveRequest, rejectRequest,
    fulfillRequest, partialFulfillRequest, deleteRequest,
    fetchRequests,
    // Notifications & Logs
    createNotification, createActivityLog,
    // CRUD
    createTemplate, updateTemplate, deleteTemplate,
    createSupplier, updateSupplier, deleteSupplier,
    createUser, updateUser, deleteUser,
    createProcurement, updateProcurementStatus, deleteProcurement,
    createPurchaseOrder, updatePOStatus,
    updateFinancialTxnStatus,
    // Utils
    withActionLock,
    loadAllData,

    // ═════════════════════════════════════════════════════════════════════════
    // RBAC EXPORTS
    // ═════════════════════════════════════════════════════════════════════════
    userRole,
    isAdmin: () => isAdmin(userRole),
    isManager: () => isManager(userRole),
    isChief: () => isChief(userRole),
    isStoreKeeper: () => isStoreKeeper(userRole),
    hasRole: (role) => hasRole(userRole, role),
    hasAnyRole: (roles) => hasAnyRole(userRole, roles),
    canCreateUsers: () => canCreateUsers(userRole),
    canDeleteUsers: () => canDeleteUsers(userRole),
    canAssignRoles: () => canAssignRoles(userRole),
    canApproveRequests: () => canApproveRequests(userRole),
    canRejectRequests: () => canRejectRequests(userRole),
    canFulfillRequests: () => canFulfillRequests(userRole),
    canCreateDemand: () => canCreateDemand(userRole),
    canManageInventory: () => canManageInventory(userRole),
    canManageSuppliers: () => canManageSuppliers(userRole),
    canManageProcurement: () => canManageProcurement(userRole),
    canManagePurchaseOrders: () => canManagePurchaseOrders(userRole),
    canManageFinancials: () => canManageFinancials(userRole),
    canViewReports: () => canViewReports(userRole),
    canAccessSettings: () => canAccessSettings(userRole),
    canAccessUserManagement: () => canAccessUserManagement(userRole),
    canAccessSuppliers: () => canAccessSuppliers(userRole),
    canAccessProcurement: () => canAccessProcurement(userRole),
    canAccessPurchaseOrders: () => canAccessPurchaseOrders(userRole),
    canAccessFinancials: () => canAccessFinancials(userRole),
    canAccessInventory: () => canAccessInventory(userRole),
    canAccessStockMovement: () => canAccessStockMovement(userRole),
    canAccessFulfillment: () => canAccessFulfillment(userRole),
    canAccessDemands: () => canAccessDemands(userRole),
    canAccessDashboard: () => canAccessDashboard(userRole),
    canAccessActivityLog: () => canAccessActivityLog(userRole),
    canAccessItemTemplates: () => canAccessItemTemplates(userRole),
    SIDEBAR_PERMISSIONS,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
