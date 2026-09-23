import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  authApi, usersApi, templatesApi, suppliersApi,
  transactionsApi, procurementApi,
  purchaseOrdersApi, financialApi, activityApi,
  inventoryApi, demandsApi,
} from '../lib/api'
import { supabase } from '../lib/supabase'
import { userCan, lightTheme, darkTheme, DEFAULT_UNITS } from '../lib/constants'

// Roles recognized by the app (used only for loadUserRole validation).
// Permission checks go through userCan(action, role) / ROLE_CAN in constants.js.
const KNOWN_ROLES = [
  'Developer', 'Master', 'Admin', 'Manager', 'Chief',
  'Store Keeper', 'Kitchen Staff', 'Viewer',
]
const DEFAULT_ROLE = 'Store Keeper'

const AppContext = createContext(null)

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   APPCONTEXT PROVIDER
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

export function AppProvider({ children }) {

  // â”€â”€ Auth state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [user,      setUser]      = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState(null)

  // â”€â”€ RBAC state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [userRole, setUserRole] = useState(null)

  // â”€â”€ Branch state (NEW: multi-branch support) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [branches, setBranches] = useState([])
  const [currentBranch, setCurrentBranch] = useState(null)
  const [isLoadingBranchData, setIsLoadingBranchData] = useState(false)

  // â”€â”€ Theme state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [dark, setDark] = useState(() => localStorage.getItem('rs_dark') === 'true')

  useEffect(() => {
    localStorage.setItem('rs_dark', dark)
  }, [dark])

  const theme = dark ? darkTheme : lightTheme

  // â”€â”€ UI state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [tab,           setTab]           = useState('dashboard')
  const [sidebarOpen,   setSidebar]       = useState(window.innerWidth > 768)
  const [toasts,        setToasts]        = useState([])
  const [notifications, setNotifications] = useState([])
  const [systemEnabled, setSystemEnabled] = useState(true)
  const [systemMsg,     setSystemMsg]     = useState('System is currently under maintenance.')
  const [customUnits,   setCustomUnits]   = useState([])
  const [loading,       setLoading]       = useState(false)
  const [categories,    setCategories]    = useState([])

  // â”€â”€ Business data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [transactions,          setTransactions]          = useState([])
  const [requests,              setRequests]              = useState([])
  const [demands,               setDemands]               = useState([])
  const [assignments,            setAssignments]            = useState([])
  const [assignmentCompletions,  setAssignmentCompletions]  = useState([])

  // User preferences / settings (persisted locally until a settings table is introduced).
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('rs_notifications') !== 'false')
  const [lowStockAlerts, setLowStockAlerts] = useState(() => localStorage.getItem('rs_low_stock_alerts') !== 'false')
  const [requestAlerts, setRequestAlerts] = useState(() => localStorage.getItem('rs_request_alerts') !== 'false')
  const [fulfillmentAlerts, setFulfillmentAlerts] = useState(() => localStorage.getItem('rs_fulfillment_alerts') !== 'false')
  const [browserNotifs, setBrowserNotifs] = useState(() => localStorage.getItem('rs_browser_notifs') === 'true')
  const [autoRefresh, setAutoRefresh] = useState(() => localStorage.getItem('rs_auto_refresh') !== 'false')
  const [lowThreshold, setLowThreshold] = useState(() => Number(localStorage.getItem('rs_low_threshold')) || 10)
  const [restaurantName, setRestaurantName] = useState(() => localStorage.getItem('rs_restaurant_name') || 'RestoStock')
  const [branchName, setBranchName] = useState(() => localStorage.getItem('rs_branch_name') || '')
  const [language, setLanguage] = useState(() => localStorage.getItem('rs_language') || 'en')
  const [timezone, setTimezone] = useState(() => localStorage.getItem('rs_timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  const [inventory,             setInventory]             = useState([])
  const [templates,             setTemplates]             = useState([])
  const [suppliers,             setSuppliers]             = useState([])
  const [users,                 setUsers]                 = useState([])
  const [procurements,          setProcurements]          = useState([])
  const [purchaseOrders,        setPurchaseOrders]        = useState([])
  const [financialTransactions, setFinancialTransactions] = useState([])
  const [activityLogs,          setActivityLogs]          = useState([])
  const [dataLoaded,            setDataLoaded]            = useState(false)

  // â”€â”€ Derived: all units â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const allUnits = useMemo(
    () => [...new Set([...DEFAULT_UNITS, ...customUnits])],
    [customUnits]
  )

  useEffect(() => {
    const values = {
      rs_notifications: notificationsEnabled,
      rs_low_stock_alerts: lowStockAlerts,
      rs_request_alerts: requestAlerts,
      rs_fulfillment_alerts: fulfillmentAlerts,
      rs_browser_notifs: browserNotifs,
      rs_auto_refresh: autoRefresh,
      rs_low_threshold: lowThreshold,
      rs_restaurant_name: restaurantName,
      rs_branch_name: branchName,
      rs_language: language,
      rs_timezone: timezone,
    }
    Object.entries(values).forEach(([key, value]) => localStorage.setItem(key, String(value)))
  }, [notificationsEnabled, lowStockAlerts, requestAlerts, fulfillmentAlerts, browserNotifs, autoRefresh, lowThreshold, restaurantName, branchName, language, timezone])

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // BRANCH MANAGEMENT (NEW)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  // Fetch user's accessible branches
  const fetchUserBranches = useCallback(async (userId, userProfile) => {
    if (!userId) return []

    const branchesList = []
    const profileRole = String(userProfile?.role || userProfile?.role_name || userProfile?.user_role || '').trim().toLowerCase()

    // Developers are global: expose every branch so assignment creation can
    // target a manager from any branch. Other roles keep their existing
    // branch-membership behavior.
    if (profileRole === 'developer') {
      try {
        const { data: allBranches, error: allBranchesError } = await supabase
          .from('branches')
          .select('id, name, address')
          .order('name', { ascending: true })
        if (!allBranchesError && Array.isArray(allBranches) && allBranches.length) {
          setBranches(allBranches)
          return allBranches
        }
      } catch (err) {
        console.warn('[AppContext] Could not load all branches for Developer:', err)
      }
    }


    // â”€â”€ Method 1: Try branch_members table (multi-branch) â”€â”€
    try {
      const { data: memberships, error: memError } = await supabase
        .from('branch_members')
        .select('branch_id, branches(*)')
        .eq('user_id', userId)

      if (!memError && memberships && memberships.length > 0) {
        for (const m of memberships) {
          if (m.branches) {
            branchesList.push({
              id: m.branch_id,
              ...m.branches,
            })
          }
        }
      }
    } catch (err) {
      console.log('[AppContext] branch_members not available, falling back to user.branch_id')
    }

    // â”€â”€ Method 2: Fallback to user.profile.branch_id (legacy single-branch) â”€â”€
    if (branchesList.length === 0 && userProfile?.branch_id) {
      try {
        const { data: branch, error: branchError } = await supabase
          .from('branches')
          .select('id, name, address')
          .eq('id', userProfile.branch_id)
          .maybeSingle()

        if (!branchError && branch) {
          branchesList.push(branch)
          console.log('[AppContext] Loaded branch from user.branch_id:', branch.name)
        }
      } catch (err) {
        console.log('[AppContext] Could not fetch branch by user.branch_id')
      }
    }

    // â”€â”€ Method 3: Create a default branch if nothing found â”€â”€
    if (branchesList.length === 0 && userProfile?.branch_id) {
      branchesList.push({
        id: userProfile.branch_id,
        name: userProfile.branch_name || 'Default Branch',
      })
    }

    setBranches(branchesList)
    return branchesList
  }, [])

  // Switch active branch
  const switchBranch = useCallback(async (branch) => {
    if (!branch || branch.id === currentBranch?.id) return

    console.log('[AppContext] Switching branch to:', branch.name)
    setIsLoadingBranchData(true)
    setCurrentBranch(branch)

    // Clear old branch data to prevent flash of wrong data
    setTransactions([])
    setRequests([])
    setDemands([])
    setAssignments([])
    setAssignmentCompletions([])
    setInventory([])
    setTemplates([])
    setSuppliers([])
    setProcurements([])
    setPurchaseOrders([])
    setFinancialTransactions([])
    setActivityLogs([])
    setCategories([])

    // Load new branch data
    await loadBranchData(branch.id)
    setIsLoadingBranchData(false)
  }, [currentBranch])

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // RBAC: LOAD USER ROLE
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  const loadUserRole = useCallback(async (profileUser) => {
    console.log('[RBAC] loadUserRole called for user:', profileUser?.email, 'role:', profileUser?.role)

    if (profileUser?.role === 'Developer') {
      console.log('[RBAC] Developer role detected')
      setUserRole('Developer')
      return
    }

    if (!profileUser?.role) {
      console.log('[RBAC] No role on profile, defaulting to Store Keeper')
      setUserRole(DEFAULT_ROLE)
      return
    }

    if (!KNOWN_ROLES.includes(profileUser.role)) {
      console.warn('[RBAC] Unrecognized role on profile:', profileUser.role, 'â€” defaulting to Store Keeper')
      setUserRole(DEFAULT_ROLE)
      return
    }

    console.log('[RBAC] Setting role to:', profileUser.role)
    setUserRole(profileUser.role)
  }, [])

  // â”€â”€ Toast helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const normalizeToastMessage = useCallback((value) => {
    if (value == null) return ''
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
    if (value instanceof Error) return value.message || value.name || 'Unknown error'
    if (typeof value === 'object') {
      return value.message || value.error_description || value.details || value.hint || value.code || 'An unexpected error occurred.'
    }
    return String(value)
  }, [])

  const showToast = useCallback((type, title, msg, duration = 4500) => {
    const id = Date.now() + Math.random()
    const safeTitle = normalizeToastMessage(title)
    const safeMsg = normalizeToastMessage(msg)
    setToasts(prev => [...prev.slice(-4), { id, type, title: safeTitle, msg: safeMsg }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [normalizeToastMessage])

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

  // â”€â”€ Clear data on logout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const clearData = useCallback(() => {
    setTransactions([])
    setRequests([])
    setAssignments([])
    setAssignmentCompletions([])
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
    setBranches([])
    setCurrentBranch(null)
  }, [])

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // DATA FETCHING (branch-scoped)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  const getBranchId = useCallback((u) => {
    // Prefer currentBranch if set, fallback to user's default branch
    return currentBranch?.id ?? u?.branch_id ?? u?.branchId ?? null
  }, [currentBranch])

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

  // â”€â”€ Load branch-specific data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadBranchData = useCallback(async (branchId) => {
    if (!branchId) {
      console.warn('[AppContext] loadBranchData: no branchId')
      setDataLoaded(true)
      return
    }

    console.log('[AppContext] loadBranchData start â€” branch:', branchId)
    setLoading(true)
    try {
      const [
        txnRes, demandRes, invRes, tmplRes, supRes,
        usrRes, procRes, poRes, finRes, actRes,
      ] = await Promise.all([
        transactionsApi.getAll(branchId),
        demandsApi.getAll(branchId),
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
      if (demandRes.error) console.error('[AppContext] demands:', demandRes.error.message)
      if (invRes.error)  console.error('[AppContext] inventory:', invRes.error.message)
      if (tmplRes.error) console.error('[AppContext] templates:', tmplRes.error.message)
      if (supRes.error)  console.error('[AppContext] suppliers:', supRes.error.message)
      if (usrRes.error)  console.error('[AppContext] users:', usrRes.error.message)
      if (procRes.error) console.error('[AppContext] procurement:', procRes.error.message)
      if (poRes.error)   console.error('[AppContext] purchase orders:', poRes.error.message)
      if (finRes.error)  console.error('[AppContext] financials:', finRes.error.message)
      if (actRes.error)  console.error('[AppContext] activity logs:', actRes.error.message)

      if (txnRes.data)  setTransactions(txnRes.data)
      if (demandRes.data) setDemands(demandRes.data)
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
      console.log('[AppContext] loadBranchData complete âœ“')
    } catch (err) {
      console.error('[AppContext] loadBranchData error:', err)
      showToast('error', 'Load Failed', 'Could not load branch data. Check console for details.')
      setDataLoaded(true)
    } finally {
      setLoading(false)
    }
  }, [showToast, fetchRequests, fetchCategories])

  // â”€â”€ Legacy loadAllData (redirects to loadBranchData) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadAllData = useCallback(async (loggedInUser) => {
    if (!loggedInUser) {
      console.warn('[AppContext] loadAllData: no user provided')
      setDataLoaded(true)
      return
    }

    const branchId = getBranchId(loggedInUser)

    if (!branchId) {
      console.warn('[AppContext] loadAllData: no branch_id â€” user:', loggedInUser)
      showToast('error', 'Branch Error', 'No branch assigned to your account. Please contact administrator.')
      setDataLoaded(true)
      return
    }

    await loadBranchData(branchId)
  }, [getBranchId, loadBranchData, showToast])

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // REAL-TIME SUBSCRIPTIONS (branch-scoped)
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  useEffect(() => {
    if (!currentBranch?.id) return

    const channels = []

    const invChannel = supabase
      .channel(`inventory:${currentBranch.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'inventory',
        filter: `branch_id=eq.${currentBranch.id}`,
      }, () => { fetchInventory(currentBranch.id) })
      .subscribe()
    channels.push(invChannel)

    const txnChannel = supabase
      .channel(`transactions:${currentBranch.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'transactions',
        filter: `branch_id=eq.${currentBranch.id}`,
      }, (payload) => {
        setTransactions(prev => [payload.new, ...prev])
      })
      .subscribe()
    channels.push(txnChannel)

    const reqChannel = supabase
      .channel(`requests:${currentBranch.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'requests',
        filter: `branch_id=eq.${currentBranch.id}`,
      }, () => { fetchRequests(currentBranch.id) })
      .subscribe()
    channels.push(reqChannel)

    return () => { channels.forEach(ch => supabase.removeChannel(ch)) }
  }, [currentBranch?.id, fetchInventory, fetchRequests])

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // AUTH LISTENER
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  const loadAllDataRef  = useRef(loadAllData)
  const clearDataRef    = useRef(clearData)
  const fetchUserBranchesRef = useRef(fetchUserBranches)
  // Set while login() is actively running its own profile/branch/data cascade.
  // signInWithPassword() (called from login()) fires a 'SIGNED_IN' auth event
  // on its own; without this guard, the listener below would run finishAuth()
  // a second time for the *same* login, doubling every Supabase request the
  // login flow makes (profile lookup, branch lookup, and the ~11 parallel
  // queries in loadBranchData) and making a 429 rate-limit response â€” and the
  // resulting "stuck on the login screen" race â€” much more likely.
  const loginInProgressRef = useRef(false)

  useEffect(() => { loadAllDataRef.current = loadAllData }, [loadAllData])
  useEffect(() => { clearDataRef.current   = clearData   }, [clearData])
  useEffect(() => { fetchUserBranchesRef.current = fetchUserBranches }, [fetchUserBranches])

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

      await loadUserRole(restoredUser)

      // NEW: Fetch user's branches and set default
      const userBranches = await fetchUserBranchesRef.current(restoredUser.id, restoredUser)
      if (userBranches.length > 0) {
        // Set current branch to user's default or first available
        const defaultBranch = userBranches.find(b => b.id === restoredUser.branch_id) || userBranches[0]
        setCurrentBranch(defaultBranch)
        await loadAllDataRef.current(restoredUser)
      } else {
        showToast('warning', 'No Branches', 'You have not been assigned to any branches.')
      }

      setAuthReady(true)
    }

    // â”€â”€ HMR-proof singleton guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // AppContext.jsx exports both a hook (useApp) and a component
    // (AppProvider), which is a known React Fast Refresh boundary problem:
    // Vite's dev-server hot-reload can't always cleanly remount this
    // provider on save, so a stale onAuthStateChange listener from a
    // *previous* version of this module can stay attached in memory while
    // this effect adds a new one â€” stacking multiple listeners across a dev
    // session and causing buildUser()/fetchProfile() to fire multiple times
    // per login. This never happens in a production build (no HMR), but we
    // guard it here defensively by keeping the single active subscription
    // on `window` and explicitly tearing down any previous one before
    // registering a new one.
    if (typeof window !== 'undefined' && window.__stockoAuthSub) {
      try { window.__stockoAuthSub.unsubscribe() } catch { /* already gone */ }
      window.__stockoAuthSub = null
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Auth] auth event:', event)

        if (event === 'INITIAL_SESSION') {
          setTimeout(() => { void finishAuth(session) }, 0)
          return
        }

        if (event === 'SIGNED_IN') {
          if (loginInProgressRef.current) {
            console.log('[Auth] SIGNED_IN skipped â€” login() already handling this session')
            return
          }
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

    if (typeof window !== 'undefined') window.__stockoAuthSub = subscription

    return () => {
      subscription.unsubscribe()
      if (typeof window !== 'undefined' && window.__stockoAuthSub === subscription) {
        window.__stockoAuthSub = null
      }
    }
  }, [loadUserRole, showToast])

  // â”€â”€ Login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const login = useCallback(async (email, password) => {
    console.log('[Auth] login:', email)
    setAuthError(null)
    loginInProgressRef.current = true

    try {
      const { data: loggedInUser, error } = await authApi.login(email, password)

      if (error) {
        setAuthError(error.message)
        return { error }
      }

      if (loggedInUser) {
        console.log('[Auth] login success, profile:', loggedInUser)
        setUser(loggedInUser)
        await loadUserRole(loggedInUser)

        // NEW: Fetch branches and set default
        const userBranches = await fetchUserBranches(loggedInUser.id, loggedInUser)
        if (userBranches.length > 0) {
          const defaultBranch = userBranches.find(b => b.id === loggedInUser.branch_id) || userBranches[0]
          setCurrentBranch(defaultBranch)
          await loadAllData(loggedInUser)
        }
      }

      return { data: loggedInUser }
    } finally {
      // login() is the single source of truth for this session now that the
      // listener skipped its own SIGNED_IN handling â€” so it must be the one
      // to flip authReady, whether login succeeded or failed.
      setAuthReady(true)
      loginInProgressRef.current = false
    }
  }, [loadAllData, loadUserRole, fetchUserBranches])

  // â”€â”€ Logout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const logout = useCallback(async () => {
    await authApi.logout()
  }, [])

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ACTION LOCK
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // STOCK OPERATIONS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
      showToast('success', 'Stock IN Recorded', `${formData.item} â€” ${formData.qty} ${formData.unit}`)
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
      showToast('success', `${formData.type || 'Stock OUT'} Recorded`, `${formData.item} â€” ${formData.qty} ${formData.unit}`)
      return { success: true, data }
    })
  }, [user, getBranchId, withActionLock, addNotification, showToast])

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // REQUESTS SYSTEM
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

  const createDemand = useCallback(async ({ department, notes, items }) => {
    const branchId = getBranchId(user)
    if (!branchId) {
      showToast('error', 'Branch Error', 'No branch assigned')
      return { success: false, error: new Error('No branch') }
    }
    try {
      const created = []
      for (const item of (Array.isArray(items) ? items : [])) {
        const { data, error } = await demandsApi.create({
          branch_id: branchId,
          department,
          notes: item.notes || notes || null,
          item_name: item.name,
          category: item.category || null,
          unit: item.unit || 'pcs',
          quantity: Number(item.qty) || 0,
          qty: Number(item.qty) || 0,
          created_by: user?.id || null,
          created_by_name: user?.name || user?.full_name || user?.email || null,
        })
        if (error) throw error
        if (data) created.push(data)
      }
      setDemands(prev => [...created, ...prev])
      return { success: true, data: created }
    } catch (error) {
      console.error('createDemand error:', error)
      showToast('error', 'Create Failed', error.message)
      return { success: false, error }
    }
  }, [user, getBranchId, showToast])

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

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // NOTIFICATIONS & ACTIVITY LOGS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // CRUD OPERATIONS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  // â”€â”€ Templates â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Suppliers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Users â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Categories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Procurement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Purchase orders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€ Financial â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const updateFinancialTxnStatus = useCallback(async (id, paymentStatus) => {
    const { data, error } = await financialApi.updatePaymentStatus(id, paymentStatus)
    if (error) { showToast('error', 'Failed', error.message); return }
    setFinancialTransactions(prev => prev.map(f => f.id === id ? { ...f, ...data } : f))
  }, [showToast])

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  const getLocalDate = useCallback((date = new Date()) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  }, [])

  const isAssignmentScheduledForDate = useCallback((assignment, date = new Date()) => {
    if (!assignment || assignment.active === false) return false
    const key = getLocalDate(date)
    if (assignment.start_date && key < assignment.start_date) return false
    if (assignment.end_date && key > assignment.end_date) return false
    const recurrence = assignment.recurrence || 'daily'
    if (recurrence === 'one_time' || recurrence === 'scheduled') return !assignment.scheduled_date || assignment.scheduled_date === key
    if (recurrence === 'weekly' && Array.isArray(assignment.days_of_week) && assignment.days_of_week.length) {
      const names = ['sun','mon','tue','wed','thu','fri','sat']
      const selected = assignment.days_of_week.map(x => String(x).toLowerCase())
      return selected.includes(names[date.getDay()]) || selected.includes(String(date.getDay()))
    }
    return true
  }, [getLocalDate])

  /* ============================================================
     ASSIGNMENTS
  ============================================================ */

  const normalizeAssigneeIds = useCallback((value) => {
    const raw = Array.isArray(value) ? value : value ? [value] : []
    return [...new Set(raw.map(item => {
      if (item && typeof item === 'object') return item.id || item.user_id || item.assignee_id || ''
      return String(item || '')
    }).map(String).map(v => v.trim()).filter(Boolean))]
  }, [])

  // Legacy alias kept so older assignment components continue to work.
  const normalizeManagerIds = normalizeAssigneeIds

  // Every recurring assignment is a TASK TEMPLATE.
  // The task itself is never consumed by completing it. Completion belongs to
  // one occurrence date + one assignee. This is what makes a daily task such
  // as "Is the floor clean?" appear again automatically tomorrow.
  const getAssignmentDateForOccurrence = useCallback((assignment, date = new Date()) => {
    if ((assignment?.recurrence === 'one_time' || assignment?.recurrence === 'scheduled') && assignment?.scheduled_date) {
      return String(assignment.scheduled_date).slice(0, 10)
    }
    return getLocalDate(date)
  }, [getLocalDate])

  const getCompletionDateKey = useCallback((completion) => {
    if (!completion?.scheduled_date) return ''
    return String(completion.scheduled_date).slice(0, 10)
  }, [])

  const getAssignmentStatus = useCallback((assignment, completion = null, now = new Date()) => {
    if (!assignment) return 'Pending'
    if (!assignment.active) return 'Inactive'
    const today = getLocalDate(now)
    if (!isAssignmentScheduledForDate(assignment, now)) {
      if (assignment.end_date && today > assignment.end_date) return 'Inactive'
      return 'Upcoming'
    }
    if (completion?.status === 'in_progress') return 'In Progress'
    if (completion?.status === 'completed') {
      const deadline = assignment.deadline_time || assignment.scheduled_time
      if (deadline && completion.completed_at) {
        const completed = new Date(completion.completed_at)
        const due = new Date(`${today}T${String(deadline).slice(0,5)}:00`)
        if (!Number.isNaN(due.getTime()) && completed.getTime() > due.getTime()) return 'Completed late'
      }
      return 'Completed'
    }
    if (completion?.status === 'missed') return 'Overdue'
    const deadline = assignment.deadline_time || assignment.scheduled_time
    if (deadline) {
      const due = new Date(`${today}T${String(deadline).slice(0,5)}:00`)
      if (!Number.isNaN(due.getTime()) && now.getTime() > due.getTime()) return 'Overdue'
      const diff = due.getTime() - now.getTime()
      if (diff <= 60 * 60 * 1000) return 'Due soon'
    }
    return 'Pending'
  }, [getLocalDate, isAssignmentScheduledForDate])

  const ensureTaskOccurrences = useCallback(async (branchId = currentBranch?.id, forDate = getLocalDate()) => {
    if (!branchId) return { success: false, count: 0 }
    const { data, error } = await supabase.rpc('ensure_task_occurrences', {
      p_branch_id: branchId,
      p_for_date: forDate,
    })
    if (error) {
      console.error('[Assignments] Occurrence generation:', error)
      return { success: false, count: 0, error }
    }
    return { success: true, count: Number(data || 0) }
  }, [currentBranch?.id, getLocalDate])

  const fetchAssignments = useCallback(async (branchId = currentBranch?.id, options = {}) => {
    const targetUser = options.assignedTo ? String(options.assignedTo) : null

    if (!branchId && !targetUser) {
      setAssignments([])
      setAssignmentCompletions([])
      return []
    }

    try {
      const requestedDate = options.forDate || getLocalDate()

      // A user can receive an assignment whose home branch is different from
      // their own branch, so fetch assignment links first for personal views.
      let crossBranchAssignmentIds = []
      if (targetUser) {
        const assignedResult = await supabase
          .from('assignment_assignees')
          .select('assignment_id')
          .eq('user_id', targetUser)

        if (assignedResult.error) throw assignedResult.error
        crossBranchAssignmentIds = [...new Set((assignedResult.data || []).map(x => String(x.assignment_id)).filter(Boolean))]
      }

      let query = supabase
        .from('assignments')
        .select('*')
        .order('created_at', { ascending: false })

      if (targetUser) {
        const clauses = []
        if (branchId) clauses.push(`branch_id.eq.${branchId}`)
        if (crossBranchAssignmentIds.length) clauses.push(`id.in.(${crossBranchAssignmentIds.join(',')})`)
        if (clauses.length === 1) query = query.or(clauses[0])
        else if (clauses.length > 1) query = query.or(clauses.join(','))
        else query = query.limit(0)
      } else {
        query = query.eq('branch_id', branchId)
      }

      if (options.activeOnly) query = query.eq('active', true)

      const { data, error } = await query
      if (error) throw error

      const rows = Array.isArray(data) ? data : []
      const ids = rows.map(r => r.id).filter(Boolean)

      // Generate today's occurrence for every assignment home branch, including
      // cross-branch tasks loaded for a staff member.
      const occurrenceBranches = [...new Set(rows.map(r => r.branch_id).filter(Boolean).map(String))]
      await Promise.all(occurrenceBranches.map(id => ensureTaskOccurrences(id, requestedDate)))

      let links = []
      let occurrences = []
      let reports = []

      if (ids.length) {
        const linkResult = await supabase
          .from('assignment_assignees')
          .select('assignment_id,user_id')
          .in('assignment_id', ids)

        if (linkResult.error) throw linkResult.error
        links = linkResult.data || []

        const occurrenceResult = await supabase
          .from('task_occurrences')
          .select('*')
          .in('assignment_id', ids)
          .eq('scheduled_date', requestedDate)
          .order('scheduled_at', { ascending: true })

        if (occurrenceResult.error) throw occurrenceResult.error
        occurrences = occurrenceResult.data || []

        const occurrenceIds = occurrences.map(x => x.id).filter(Boolean)
        if (occurrenceIds.length) {
          const reportResult = await supabase
            .from('task_reports')
            .select('*')
            .in('task_occurrence_id', occurrenceIds)

          if (reportResult.error) throw reportResult.error
          reports = reportResult.data || []
        }
      }

      const assigneeMap = new Map()
      links.forEach(link => {
        const key = String(link.assignment_id)
        if (!assigneeMap.has(key)) assigneeMap.set(key, [])
        assigneeMap.get(key).push(String(link.user_id))
      })

      const reportMap = new Map(reports.map(report => [String(report.task_occurrence_id), report]))

      const occurrenceToCompletion = (occurrence) => {
        if (!occurrence) return null
        const report = reportMap.get(String(occurrence.id))
        return {
          ...occurrence,
          occurrence_id: occurrence.id,
          note: report?.report_text || null,
          report_text: report?.report_text || null,
          proof_url: report?.proof_url || null,
          report,
        }
      }

      let enriched = rows.map(row => {
        const assignees = [...new Set([
          ...(assigneeMap.get(String(row.id)) || []),
          ...(row.assigned_to ? [String(row.assigned_to)] : []),
        ])]

        const taskOccurrences = occurrences.filter(
          occ => String(occ.assignment_id) === String(row.id)
        )

        const targetOccurrence =
          taskOccurrences.find(occ => !targetUser || String(occ.assigned_to) === targetUser) || null

        const completedCount = taskOccurrences.filter(occ => occ.status === 'completed').length
        const pendingCount = Math.max(assignees.length - completedCount, 0)

        return {
          ...row,
          assigned_to: assignees,
          assignee_ids: assignees,
          assigned_manager_ids: assignees,
          manager_ids: assignees,
          occurrences: taskOccurrences,
          occurrence: targetOccurrence,
          completion: occurrenceToCompletion(targetOccurrence),
          today_completion: occurrenceToCompletion(targetOccurrence),
          completed_assignees: completedCount,
          pending_assignees: pendingCount,
          calculated_status: targetUser
            ? getAssignmentStatus(row, occurrenceToCompletion(targetOccurrence))
            : (assignees.length && pendingCount === 0
                ? 'Completed'
                : getAssignmentStatus(row, occurrenceToCompletion(targetOccurrence))),
        }
      })

      if (targetUser) {
        enriched = enriched.filter(task => (task.assignee_ids || []).includes(targetUser))
      }

      setAssignments(enriched)

      // Keep legacy completion state populated for older UI consumers. New
      // history/reporting uses task_occurrences + task_reports.
      setAssignmentCompletions(
        occurrences.map(occ => ({
          ...occ,
          assignment_id: occ.assignment_id,
          assigned_to: occ.assigned_to,
          scheduled_date: occ.scheduled_date,
          scheduled_time: occ.scheduled_at,
          completed_at: occ.completed_at,
          status: occ.status,
          occurrence_id: occ.id,
          report: reportMap.get(String(occ.id)) || null,
          note: reportMap.get(String(occ.id))?.report_text || null,
        }))
      )

      return enriched
    } catch (error) {
      console.error('[Assignments] Fetch:', error)
      showToast('error', 'Assignments', error?.message || 'Unable to load assignments.')
      return []
    }
  }, [
    currentBranch?.id,
    ensureTaskOccurrences,
    getAssignmentStatus,
    getLocalDate,
    showToast,
  ])

  /*
   * Keep assignment_assignees synchronized without ever blindly deleting and
   * reinserting the complete set. The unique key is intentionally kept in
   * Supabase: (assignment_id, user_id). Upsert makes this operation idempotent
   * and safe when the same manager is submitted more than once.
   */
  const syncAssignmentAssignees = useCallback(async (assignmentId, assigneeIds = []) => {
    if (!assignmentId) throw new Error('Assignment ID is required.')

    const wanted = normalizeAssigneeIds(assigneeIds)

    if (!wanted.length) {
      throw new Error('Select at least one user.')
    }

    const existingResult = await supabase
      .from('assignment_assignees')
      .select('user_id')
      .eq('assignment_id', assignmentId)

    if (existingResult.error) throw existingResult.error

    const existing = normalizeAssigneeIds(existingResult.data || [])
    const existingSet = new Set(existing)
    const wantedSet = new Set(wanted)

    // Insert only missing links. Upsert is intentionally used so a duplicate
    // request can never fail on assignment_assignees_assignment_id_user_id_key.
    const toAdd = wanted.filter(userId => !existingSet.has(userId))

    if (toAdd.length) {
      const insertResult = await supabase
        .from('assignment_assignees')
        .upsert(
          toAdd.map(user_id => ({
            assignment_id: assignmentId,
            user_id,
          })),
          {
            onConflict: 'assignment_id,user_id',
            ignoreDuplicates: true,
          }
        )

      if (insertResult.error) throw insertResult.error
    }

    // Remove only users that are no longer assigned. Existing/current users
    // are never deleted and reinserted during an ordinary edit.
    const toRemove = existing.filter(userId => !wantedSet.has(userId))

    if (toRemove.length) {
      const deleteResult = await supabase
        .from('assignment_assignees')
        .delete()
        .eq('assignment_id', assignmentId)
        .in('user_id', toRemove)

      if (deleteResult.error) throw deleteResult.error
    }

    return {
      assigneeIds: wanted,
      added: toAdd,
      removed: toRemove,
      existing,
    }
  }, [normalizeAssigneeIds])

  const createAssignment = useCallback(async (payload = {}) => {
    const branchId = payload.branch_id || currentBranch?.id || user?.branch_id || null
    if (!branchId) return { success: false, error: { message: 'No branch selected.' } }
    if (!payload.title?.trim()) return { success: false, error: { message: 'Task title is required.' } }

    const assigneeIds = normalizeAssigneeIds(
      payload.assignee_ids ?? payload.assigned_to ?? payload.assigned_manager_ids
    )
    if (!assigneeIds.length) {
      return { success: false, error: { message: 'Select at least one user.' } }
    }

    try {
      const recurrence = payload.recurrence || 'daily'
      const insertPayload = {
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        // Keep the legacy owner column populated for compatibility. The real
        // multi-user source of truth is assignment_assignees.
        assigned_to: assigneeIds[0],
        branch_id: branchId,
        created_by: user?.id || null,
        priority: payload.priority || 'Medium',
        recurrence,
        scheduled_date: ['one_time', 'scheduled'].includes(recurrence)
          ? payload.scheduled_date || null
          : null,
        scheduled_time: payload.scheduled_time || payload.start_time || null,
        start_time: payload.start_time || payload.scheduled_time || null,
        deadline_time: payload.deadline_time || null,
        time_limit_minutes: Number(payload.time_limit_minutes) || 30,
        start_date: payload.start_date || null,
        end_date: payload.end_date || null,
        days_of_week: Array.isArray(payload.days_of_week) ? payload.days_of_week : [],
        task_timezone: payload.task_timezone || timezone || 'Asia/Karachi',
        require_note: Boolean(payload.require_note),
        require_photo: Boolean(payload.require_photo),
        active: payload.active !== false,
      }

      const { data, error } = await supabase
        .from('assignments')
        .insert(insertPayload)
        .select()
        .single()

      if (error) throw error

      try {
        await syncAssignmentAssignees(data.id, assigneeIds)
      } catch (linkError) {
        // Do not leave an orphaned assignment if the initial assignee links
        // cannot be created.
        await supabase.from('assignments').delete().eq('id', data.id)
        throw linkError
      }

      await ensureTaskOccurrences(branchId, getLocalDate())

      await Promise.all(assigneeIds.map(userId =>
        supabase.from('notifications').insert({
          user_id: userId,
          branch_id: branchId,
          type: 'assignment',
          title: recurrence === 'daily' ? 'New recurring task assigned' : 'New task assigned',
          message: `You have been assigned: ${insertPayload.title}`,
          link: 'my-assignments',
          read: false,
        })
      ))

      await createActivityLog({
        action: 'Recurring Task Created',
        description: `Created ${recurrence} assignment: ${insertPayload.title}`,
        metadata: {
          assignment_id: data.id,
          assignee_ids: assigneeIds,
          recurrence,
          scheduled_time: insertPayload.scheduled_time,
          start_date: insertPayload.start_date,
          end_date: insertPayload.end_date,
        },
      })

      await fetchAssignments(branchId)
      showToast('success', 'Task Created', 'The task has been assigned.')
      return { success: true, data: { ...data, assignee_ids: assigneeIds } }
    } catch (error) {
      console.error('[Assignments] Create:', error)
      showToast('error', 'Create Failed', error?.message || 'Could not create assignment.')
      return { success: false, error }
    }
  }, [
    currentBranch?.id,
    user,
    timezone,
    normalizeAssigneeIds,
    syncAssignmentAssignees,
    ensureTaskOccurrences,
    getLocalDate,
    createActivityLog,
    fetchAssignments,
    showToast,
  ])

  const updateAssignment = useCallback(async (id, payload = {}) => {
    if (!id) return { success: false, error: { message: 'Assignment ID is required.' } }

    const assigneeIds = normalizeAssigneeIds(
      payload.assignee_ids ?? payload.assigned_to ?? payload.assigned_manager_ids
    )
    if (!assigneeIds.length) {
      return { success: false, error: { message: 'Select at least one user.' } }
    }

    try {
      const existingResult = await supabase
        .from('assignments')
        .select('id,branch_id,title,recurrence,scheduled_time,start_time,task_timezone')
        .eq('id', id)
        .maybeSingle()

      if (existingResult.error) throw existingResult.error
      if (!existingResult.data) throw new Error('Assignment not found.')

      const branchId = payload.branch_id || currentBranch?.id || user?.branch_id || existingResult.data.branch_id
      const updatePayload = {
        title: payload.title?.trim(),
        description: payload.description?.trim() || null,
        assigned_to: assigneeIds[0],
        branch_id: branchId,
        priority: payload.priority || 'Medium',
        recurrence: payload.recurrence || 'daily',
        scheduled_date: ['one_time', 'scheduled'].includes(payload.recurrence)
          ? payload.scheduled_date || null
          : null,
        scheduled_time: payload.scheduled_time || payload.start_time || null,
        start_time: payload.start_time || payload.scheduled_time || null,
        deadline_time: payload.deadline_time || null,
        time_limit_minutes: Number(payload.time_limit_minutes) || 30,
        start_date: payload.start_date || null,
        end_date: payload.end_date || null,
        days_of_week: Array.isArray(payload.days_of_week) ? payload.days_of_week : [],
        task_timezone: payload.task_timezone || existingResult.data.task_timezone || timezone || 'Asia/Karachi',
        require_note: Boolean(payload.require_note),
        require_photo: Boolean(payload.require_photo),
        active: payload.active !== false,
      }

      const { data, error } = await supabase
        .from('assignments')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Synchronize links incrementally. We never delete Manager 1 just to
      // reinsert Manager 1 when Manager 2 is added. This is the key fix for
      // assignment_assignees_assignment_id_user_id_key violations.
      const sync = await syncAssignmentAssignees(id, assigneeIds)

      await ensureTaskOccurrences(branchId, getLocalDate())

      // Notify only newly added users. Existing assignees should not receive a
      // duplicate notification every time another manager is added.
      await Promise.all(sync.added.map(userId =>
        supabase.from('notifications').insert({
          user_id: userId,
          branch_id: branchId,
          type: 'assignment',
          title: 'Task assigned',
          message: `You have been assigned: ${updatePayload.title}`,
          link: 'my-assignments',
          read: false,
        })
      ))

      await fetchAssignments(branchId)
      await createActivityLog({
        action: updatePayload.active ? 'Recurring Task Updated' : 'Recurring Task Disabled',
        description: `${updatePayload.active ? 'Updated' : 'Disabled'} assignment: ${updatePayload.title}`,
        metadata: {
          assignment_id: id,
          assignee_ids: assigneeIds,
          added_assignees: sync.added,
          removed_assignees: sync.removed,
          recurrence: updatePayload.recurrence,
        },
      })

      showToast(
        'success',
        updatePayload.active ? 'Task Updated' : 'Recurring Task Disabled',
        updatePayload.active
          ? 'Changes have been saved. Historical occurrences remain unchanged.'
          : 'Future occurrences will stop; history is preserved.'
      )

      return { success: true, data: { ...data, assignee_ids: assigneeIds } }
    } catch (error) {
      console.error('[Assignments] Update:', error)
      showToast('error', 'Update Failed', error?.message || 'Could not update assignment.')
      return { success: false, error }
    }
  }, [
    currentBranch?.id,
    user,
    timezone,
    normalizeAssigneeIds,
    syncAssignmentAssignees,
    ensureTaskOccurrences,
    getLocalDate,
    fetchAssignments,
    createActivityLog,
    showToast,
  ])

  const deleteAssignment = useCallback(async id => {
    if (!id) return { success: false }
    try {
      const { data: existing, error: readError } = await supabase
        .from('assignments')
        .select('id,branch_id,title')
        .eq('id', id)
        .maybeSingle()

      if (readError) throw readError
      if (!existing) throw new Error('Assignment not found.')

      const occurrenceCheck = await supabase
        .from('task_occurrences')
        .select('id', { count: 'exact', head: true })
        .eq('assignment_id', id)

      if (occurrenceCheck.error) throw occurrenceCheck.error

      if ((occurrenceCheck.count || 0) > 0) {
        // Never delete a template that already has execution history.
        // Deactivate it so historical occurrences/reports remain immutable.
        const { error } = await supabase
          .from('assignments')
          .update({ active: false })
          .eq('id', id)

        if (error) throw error

        await fetchAssignments(existing.branch_id)
        await createActivityLog({
          action: 'Recurring Task Disabled',
          description: `Disabled assignment with preserved history: ${existing.title}`,
          metadata: { assignment_id: id, preserved_occurrences: true },
        })
        showToast('success', 'Task Disabled', 'History was preserved and future occurrences were stopped.')
        return { success: true, deactivated: true }
      }

      const { error } = await supabase.from('assignments').delete().eq('id', id)
      if (error) throw error

      await fetchAssignments(existing.branch_id)
      await createActivityLog({
        action: 'Assignment Deleted',
        description: `Deleted assignment: ${existing.title}`,
        metadata: { assignment_id: id },
      })
      showToast('success', 'Task Deleted', 'The task has been removed.')
      return { success: true }
    } catch (error) {
      showToast('error', 'Delete Failed', error?.message || 'Could not delete assignment.')
      return { success: false, error }
    }
  }, [fetchAssignments, createActivityLog, showToast])

  const startAssignment = useCallback(async assignment => {
    if (!assignment?.occurrence?.id) {
      return { success: false, error: { message: 'Today\'s task occurrence is not available yet.' } }
    }

    const { data, error } = await supabase.rpc('start_task_occurrence', {
      p_occurrence_id: assignment.occurrence.id,
    })

    if (error) {
      showToast('error', 'Start Failed', error.message)
      return { success: false, error }
    }

    await fetchAssignments(assignment.branch_id || currentBranch?.id, {
      forDate: assignment.occurrence.scheduled_date,
      assignedTo: user?.id,
    })

    await createActivityLog({
      action: 'Task Started',
      description: `Started task: ${assignment.title || 'Task'}`,
      metadata: { assignment_id: assignment.id, occurrence_id: data?.id },
    })

    return { success: true, data }
  }, [currentBranch?.id, user?.id, fetchAssignments, createActivityLog, showToast])

  const completeAssignment = useCallback(async (assignment, payload = {}) => {
    if (!assignment?.id) {
      return { success: false, error: { message: 'Assignment ID is required.' } }
    }

    const branchId = assignment.branch_id || currentBranch?.id || user?.branch_id || null
    const scheduledDate = payload.scheduled_date || getAssignmentDateForOccurrence(assignment)
    const assigneeId = String(payload.assigned_to || user?.id || '')

    try {
      let occurrence = assignment.occurrence

      if (!occurrence?.id) {
        await ensureTaskOccurrences(branchId, scheduledDate)
        const lookup = await supabase
          .from('task_occurrences')
          .select('*')
          .eq('assignment_id', assignment.id)
          .eq('assigned_to', assigneeId)
          .eq('scheduled_date', scheduledDate)
          .maybeSingle()

        if (lookup.error) throw lookup.error
        occurrence = lookup.data
      }

      if (!occurrence?.id) {
        throw new Error('No task occurrence exists for this date/user.')
      }

      let proofUrl = payload.proof_url || null
      if (payload.photo instanceof File) {
        const ext = payload.photo.name.split('.').pop() || 'jpg'
        const path = `${branchId}/${assignment.id}/${assigneeId}/${scheduledDate}-${Date.now()}.${ext}`
        const upload = await supabase.storage
          .from('assignment-proofs')
          .upload(path, payload.photo, { upsert: true })

        if (upload.error) throw upload.error
        proofUrl = supabase.storage.from('assignment-proofs').getPublicUrl(path)?.data?.publicUrl || null
      }

      const result = await supabase.rpc('complete_task_occurrence', {
        p_occurrence_id: occurrence.id,
        p_report_text: payload.report_text || payload.note || '',
        p_proof_url: proofUrl,
      })

      if (result.error) throw result.error

      const completedRow = Array.isArray(result.data) ? result.data[0] : result.data
      await createActivityLog({
        action: 'Task Completed',
        description: `Completed task and submitted daily report: ${assignment.title || 'Task'}`,
        metadata: {
          assignment_id: assignment.id,
          occurrence_id: occurrence.id,
          scheduled_date: scheduledDate,
          assigned_to: assigneeId,
          report_id: completedRow?.report?.id || null,
        },
      })

      await fetchAssignments(branchId, {
        forDate: scheduledDate,
        assignedTo: assigneeId,
      })

      showToast('success', 'Task Completed', "Today's task and daily report have been recorded.")
      return { success: true, data: completedRow }
    } catch (error) {
      console.error('[Assignments] Complete:', error)
      showToast('error', 'Completion Failed', error?.message || 'Could not complete task.')
      return { success: false, error }
    }
  }, [
    currentBranch?.id,
    user,
    getAssignmentDateForOccurrence,
    ensureTaskOccurrences,
    fetchAssignments,
    createActivityLog,
    showToast,
  ])

  const markAssignmentMissed = useCallback(async (assignment, scheduledDate) => {
    if (!assignment?.id || !user?.id) return { success: false }
    try {
      const branchId = assignment.branch_id || currentBranch?.id || user?.branch_id || null
      const date = scheduledDate || getAssignmentDateForOccurrence(assignment)

      await ensureTaskOccurrences(branchId, date)

      const lookup = await supabase
        .from('task_occurrences')
        .select('id,status')
        .eq('assignment_id', assignment.id)
        .eq('assigned_to', user.id)
        .eq('scheduled_date', date)
        .maybeSingle()

      if (lookup.error) throw lookup.error
      if (!lookup.data) throw new Error('Task occurrence not found.')

      if (lookup.data.status === 'pending' || lookup.data.status === 'in_progress') {
        const result = await supabase.rpc('mark_task_occurrence_missed', {
          p_occurrence_id: lookup.data.id,
        })
        if (result.error) throw result.error
      }

      await fetchAssignments(branchId, { forDate: date, assignedTo: user.id })
      return { success: true }
    } catch (error) {
      console.error('[Assignments] Missed:', error)
      return { success: false, error }
    }
  }, [
    currentBranch?.id,
    user,
    getAssignmentDateForOccurrence,
    ensureTaskOccurrences,
    fetchAssignments,
  ])

  const fetchAssignmentHistory = useCallback(async (options = {}) => {
    try {
      let query = supabase
        .from('task_occurrences')
        .select('*, assignments(title,description,branch_id), task_reports(*)')
        .order('scheduled_date', { ascending: false })
        .order('scheduled_at', { ascending: false })

      const branchId = options.branchId || currentBranch?.id
      if (branchId) query = query.eq('branch_id', branchId)
      if (options.assignedTo) query = query.eq('assigned_to', options.assignedTo)
      if (options.startDate) query = query.gte('scheduled_date', options.startDate)
      if (options.endDate) query = query.lte('scheduled_date', options.endDate)

      const { data, error } = await query
      if (error) throw error

      const rows = Array.isArray(data) ? data.map(row => {
        const report = Array.isArray(row.task_reports) ? row.task_reports[0] : row.task_reports
        return {
          ...row,
          assignment: row.assignments || {},
          report,
          report_text: report?.report_text || null,
          completed_at: row.completed_at || report?.completion_time || null,
          note: report?.report_text || null,
          occurrence_id: row.id,
        }
      }) : []

      setAssignmentCompletions(rows)
      return rows
    } catch (error) {
      console.error('[Assignments] History:', error)
      showToast('error', 'Assignment history', error?.message || 'Unable to load assignment history.')
      return []
    }
  }, [currentBranch?.id, showToast])

  // STATS
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // CONTEXT VALUE
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

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
    notificationsEnabled, setNotificationsEnabled, lowStockAlerts, setLowStockAlerts,
    requestAlerts, setRequestAlerts, fulfillmentAlerts, setFulfillmentAlerts,
    browserNotifs, setBrowserNotifs, autoRefresh, setAutoRefresh, lowThreshold, setLowThreshold,
    restaurantName, setRestaurantName, branchName, setBranchName, language, setLanguage, timezone, setTimezone,
    // Data
    transactions, setTransactions,
    requests, setRequests,
    demands, setDemands, createDemand,
    assignments, setAssignments, assignmentCompletions, setAssignmentCompletions,
    fetchAssignments, createAssignment, updateAssignment, deleteAssignment, startAssignment, completeAssignment, markAssignmentMissed,
    fetchAssignmentHistory, getAssignmentStatus, isAssignmentScheduledForDate,
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

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // BRANCH EXPORTS (NEW)
    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    currentBranch,
    branches,
    switchBranch,
    isLoadingBranchData,

    // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
    // RBAC EXPORTS â€” backed by userCan / ROLE_CAN from constants.js
    userRole,
    isAdmin: () => userRole === 'Admin',
    isManager: () => userRole === 'Manager',
    isChief: () => userRole === 'Chief',
    isStoreKeeper: () => userRole === 'Store Keeper',
    isDeveloper: () => userRole === 'Developer',
    hasRole: (role) => userRole === role,
    hasAnyRole: (roles) => Array.isArray(roles) && roles.includes(userRole),
    canCreateUsers: () => userCan('manageUsers', userRole),
    canDeleteUsers: () => userCan('manageUsers', userRole),
    canAssignRoles: () => userCan('manageUsers', userRole),
    canApproveRequests: () => userCan('approveRequest', userRole),
    canRejectRequests: () => userCan('rejectRequest', userRole),
    canFulfillRequests: () => userCan('fulfillRequest', userRole),
    canCreateDemand: () => userCan('createDemand', userRole),
    canManageInventory: () => userCan('stockIn', userRole),
    canManageSuppliers: () => userCan('manageSuppliers', userRole),
    canManageProcurement: () => userCan('createProcurement', userRole) || userCan('closeProcurement', userRole),
    canManagePurchaseOrders: () => userCan('createPO', userRole) || userCan('markPOStatus', userRole),
    canManageFinancials: () => userCan('viewFinancials', userRole),
    canViewReports: () => !!userRole,
    canAccessSettings: () => userCan('manageSettings', userRole) || !!userRole,
    canAccessUserManagement: () => userCan('manageUsers', userRole),
    canAccessSuppliers: () => userCan('manageSuppliers', userRole) || !!userRole,
    canAccessProcurement: () => userCan('createProcurement', userRole) || userCan('closeProcurement', userRole),
    canAccessPurchaseOrders: () => userCan('createPO', userRole) || userCan('markPOStatus', userRole),
    canAccessFinancials: () => userCan('viewFinancials', userRole),
    canAccessInventory: () => !!userRole,
    canAccessStockMovement: () => userCan('stockIn', userRole),
    canAccessFulfillment: () => userCan('fulfillDemand', userRole) || userCan('fulfillRequest', userRole),
    canAccessDemands: () => userCan('createDemand', userRole),
    canAccessDashboard: () => true,
    canAccessAssignments: () => ['Master', 'Developer', 'Admin', 'Manager', 'Owner'].includes(userRole),
    canAccessActivityLog: () => !!userRole,
    canAccessItemTemplates: () => userCan('createTemplate', userRole) || userCan('deleteTemplate', userRole),
    canAccessLedger: () => ['Admin', 'Manager', 'Chief', 'Developer'].includes(userRole),
    canAccessPOS: () => !!userRole,
    userCan: (action) => userCan(action, userRole),
  }

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}