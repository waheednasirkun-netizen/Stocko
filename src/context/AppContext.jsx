
import {
  ROLES,
  ALL_ROLES,
  ALL_ROLES_UI,
  isAdmin,
  isManager,
  isChief,
  isStoreKeeper,
  isDeveloper,
  isMaster,
  hasRole,
  hasAnyRole,
  canCreateUsers,
  canDeleteUsers,
  canAssignRoles,
  canApproveRequests,
  canRejectRequests,
  canFulfillRequests,
  canCreateDemand,
  canManageInventory,
  canManageSuppliers,
  canManageProcurement,
  canManagePurchaseOrders,
  canManageFinancials,
  canViewReports,
  canAccessSettings,
  canAccessUserManagement,
  canAccessSuppliers,
  canAccessProcurement,
  canAccessPurchaseOrders,
  canAccessFinancials,
  canAccessInventory,
  canAccessStockMovement,
  canAccessFulfillment,
  canAccessDemands,
  canAccessDashboard,
  canAccessActivityLog,
  canAccessItemTemplates,
  canAccessLedger,
  canAccessComplaints,
  SIDEBAR_PERMISSIONS,
  lightTheme,
  darkTheme,
  DEFAULT_UNITS,
} from '../lib/constants'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from 'react'

import {
  authApi,
  usersApi,
  templatesApi,
  suppliersApi,
  transactionsApi,
  procurementApi,
  purchaseOrdersApi,
  financialApi,
  activityApi,
  inventoryApi,
} from '../lib/api'

import { supabase } from '../lib/supabase'

const AppContext = createContext(null)

export const useApp = () => {
  const ctx = useContext(AppContext)

  if (!ctx) {
    throw new Error('useApp must be used inside AppProvider')
  }

  return ctx
}

/* ═══════════════════════════════════════════════════════════════════════════
   APPCONTEXT PROVIDER
   ═══════════════════════════════════════════════════════════════════════════ */

export function AppProvider({ children }) {
  /* ── Auth state ─────────────────────────────────────────────────────────── */

  const [user, setUser] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState(null)

  /* ── RBAC state ─────────────────────────────────────────────────────────── */

  const [userRole, setUserRole] = useState(null)

  /* ── Branch state ───────────────────────────────────────────────────────── */

  const [branches, setBranches] = useState([])
  const [currentBranch, setCurrentBranch] = useState(null)
  const [isLoadingBranchData, setIsLoadingBranchData] = useState(false)

  /* ── Theme state ────────────────────────────────────────────────────────── */

  const [dark, setDark] = useState(
    () => localStorage.getItem('rs_dark') === 'true'
  )

  useEffect(() => {
    localStorage.setItem('rs_dark', dark)
  }, [dark])

  const theme = dark ? darkTheme : lightTheme

  /* ── UI state ───────────────────────────────────────────────────────────── */

  const [tab, setTab] = useState('dashboard')
  const [sidebarOpen, setSidebar] = useState(
    typeof window !== 'undefined' ? window.innerWidth > 768 : true
  )
  const [toasts, setToasts] = useState([])
  const [notifications, setNotifications] = useState([])
  const [systemEnabled, setSystemEnabled] = useState(true)
  const [systemMsg, setSystemMsg] = useState(
    'System is currently under maintenance.'
  )
  const [customUnits, setCustomUnits] = useState([])
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState([])

  /* ── Business data ──────────────────────────────────────────────────────── */

  const [transactions, setTransactions] = useState([])
  const [requests, setRequests] = useState([])
  const [inventory, setInventory] = useState([])
  const [templates, setTemplates] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [users, setUsers] = useState([])
  const [procurements, setProcurements] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [financialTransactions, setFinancialTransactions] = useState([])
  const [activityLogs, setActivityLogs] = useState([])
  const [dataLoaded, setDataLoaded] = useState(false)

  /* ── Derived: all units ─────────────────────────────────────────────────── */

  const allUnits = useMemo(
    () => [...new Set([...DEFAULT_UNITS, ...customUnits])],
    [customUnits]
  )

  /* ═══════════════════════════════════════════════════════════════════════════
     BRANCH MANAGEMENT
     ═══════════════════════════════════════════════════════════════════════════ */

  const fetchUserBranches = useCallback(async (userId, userProfile) => {
    if (!userId) return []

    const branchesList = []

    /*
     * Master is global.
     * Load every branch so Master can switch between branches.
     */
    if (userProfile?.role === 'Master') {
      try {
        const { data: allBranches, error } = await supabase
          .from('branches')
          .select('id, name, address')
          .order('name')

        if (!error && allBranches?.length) {
          setBranches(allBranches)
          return allBranches
        }
      } catch (err) {
        console.warn(
          '[AppContext] Could not load global Master branches:',
          err
        )
      }
    }

    /* ── Method 1: branch_members table ── */

    try {
      const { data: memberships, error: memError } = await supabase
        .from('branch_members')
        .select('branch_id, branches(*)')
        .eq('user_id', userId)

      if (!memError && memberships?.length > 0) {
        for (const membership of memberships) {
          if (membership.branches) {
            branchesList.push({
              id: membership.branch_id,
              ...membership.branches,
            })
          }
        }
      }
    } catch (err) {
      console.log(
        '[AppContext] branch_members not available, falling back to user.branch_id'
      )
    }

    /* ── Method 2: user.profile.branch_id ── */

    if (branchesList.length === 0 && userProfile?.branch_id) {
      try {
        const { data: branch, error: branchError } = await supabase
          .from('branches')
          .select('id, name, address')
          .eq('id', userProfile.branch_id)
          .maybeSingle()

        if (!branchError && branch) {
          branchesList.push(branch)

          console.log(
            '[AppContext] Loaded branch from user.branch_id:',
            branch.name
          )
        }
      } catch (err) {
        console.log(
          '[AppContext] Could not fetch branch by user.branch_id'
        )
      }
    }

    /* ── Method 3: default branch object ── */

    if (branchesList.length === 0 && userProfile?.branch_id) {
      branchesList.push({
        id: userProfile.branch_id,
        name: userProfile.branch_name || 'Default Branch',
      })
    }

    setBranches(branchesList)

    return branchesList
  }, [])

  /* ── Switch active branch ───────────────────────────────────────────────── */

  const switchBranch = useCallback(
    async (branch) => {
      if (!branch || branch.id === currentBranch?.id) return

      console.log('[AppContext] Switching branch to:', branch.name)

      setIsLoadingBranchData(true)
      setCurrentBranch(branch)

      /* Clear old branch data */
      setTransactions([])
      setRequests([])
      setInventory([])
      setTemplates([])
      setSuppliers([])
      setProcurements([])
      setPurchaseOrders([])
      setFinancialTransactions([])
      setActivityLogs([])
      setCategories([])

      try {
        await loadBranchData(branch.id)
      } finally {
        setIsLoadingBranchData(false)
      }
    },
    [currentBranch]
  )

  /* ═══════════════════════════════════════════════════════════════════════════
     RBAC
     ═══════════════════════════════════════════════════════════════════════════ */

  const loadUserRole = useCallback(async (profileUser) => {
    console.log(
      '[RBAC] loadUserRole called for user:',
      profileUser?.email,
      'role:',
      profileUser?.role
    )

    if (profileUser?.role === 'Developer') {
      console.log('[RBAC] Developer role detected')
      setUserRole('Developer')
      return
    }

    if (!profileUser?.role) {
      console.log(
        '[RBAC] No role on profile, defaulting to Store Keeper'
      )

      setUserRole(ROLES.STORE_KEEPER)
      return
    }

    if (!ALL_ROLES.includes(profileUser.role)) {
      console.warn(
        '[RBAC] Unrecognized role:',
        profileUser.role,
        '— defaulting to Store Keeper'
      )

      setUserRole(ROLES.STORE_KEEPER)
      return
    }

    console.log('[RBAC] Setting role to:', profileUser.role)

    setUserRole(profileUser.role)
  }, [])

  /* ═══════════════════════════════════════════════════════════════════════════
     TOASTS
     ═══════════════════════════════════════════════════════════════════════════ */

  const showToast = useCallback(
    (type, title, msg, duration = 4500) => {
      const id = Date.now() + Math.random()

      setToasts((prev) => [
        ...prev.slice(-4),
        { id, type, title, msg },
      ])

      setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id))
      }, duration)
    },
    []
  )

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const addNotification = useCallback((notif) => {
    const time = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })

    setNotifications((prev) => [
      {
        id: Date.now(),
        time: `Just now (${time})`,
        read: false,
        ...notif,
      },
      ...prev.slice(0, 29),
    ])
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        read: true,
      }))
    )
  }, [])

  /* ═══════════════════════════════════════════════════════════════════════════
     CLEAR DATA
     ═══════════════════════════════════════════════════════════════════════════ */

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
    setBranches([])
    setCurrentBranch(null)
    setNotifications([])
  }, [])

  /* ═══════════════════════════════════════════════════════════════════════════
     DATA FETCHING
     ═══════════════════════════════════════════════════════════════════════════ */

  const getBranchId = useCallback(
    (u) => {
      return (
        currentBranch?.id ??
        u?.branch_id ??
        u?.branchId ??
        null
      )
    },
    [currentBranch]
  )

  const fetchInventory = useCallback(async (branchId) => {
    if (!branchId) return

    const { data, error } = await inventoryApi.getAll(branchId)

    if (error) {
      console.error(
        '[AppContext] fetchInventory error:',
        error.message
      )
    } else {
      setInventory(data || [])
    }
  }, [])

  const fetchRequests = useCallback(
    async (branchId) => {
      if (!branchId) return []

      try {
        const { data, error } = await supabase
          .from('requests')
          .select('*, request_items (*)')
          .eq('branch_id', branchId)
          .order('created_at', { ascending: false })

        if (error) throw error

        const flattened = (data || []).map((request) => {
          const primaryItem =
            request.request_items?.[0] || {}

          return {
            ...request,
            item_name:
              primaryItem.name || request.item_name,
            name:
              primaryItem.name || request.name,
            category:
              primaryItem.category || request.category,
            unit:
              primaryItem.unit || request.unit,
            quantity:
              primaryItem.qty || request.quantity,
            qty:
              primaryItem.qty || request.qty,
          }
        })

        setRequests(flattened)

        return flattened
      } catch (error) {
        console.error(
          '[AppContext] fetchRequests error:',
          error
        )

        showToast(
          'error',
          'Error loading requests',
          error.message
        )

        return []
      }
    },
    [showToast]
  )

  const fetchCategories = useCallback(
    async (branchId) => {
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
        console.error(
          '[AppContext] fetchCategories error:',
          err
        )

        showToast(
          'error',
          'Error loading categories',
          err.message
        )
      }
    },
    [showToast]
  )

  /* ── Load branch-specific data ──────────────────────────────────────────── */

  const loadBranchData = useCallback(
    async (branchId) => {
      if (!branchId) {
        console.warn(
          '[AppContext] loadBranchData: no branchId'
        )

        setDataLoaded(true)
        return
      }

      console.log(
        '[AppContext] loadBranchData start — branch:',
        branchId
      )

      setLoading(true)

      try {
        const [
          txnRes,
          invRes,
          tmplRes,
          supRes,
          usrRes,
          procRes,
          poRes,
          finRes,
          actRes,
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

        if (txnRes.error)
          console.error(
            '[AppContext] transactions:',
            txnRes.error.message
          )

        if (invRes.error)
          console.error(
            '[AppContext] inventory:',
            invRes.error.message
          )

        if (tmplRes.error)
          console.error(
            '[AppContext] templates:',
            tmplRes.error.message
          )

        if (supRes.error)
          console.error(
            '[AppContext] suppliers:',
            supRes.error.message
          )

        if (usrRes.error)
          console.error(
            '[AppContext] users:',
            usrRes.error.message
          )

        if (procRes.error)
          console.error(
            '[AppContext] procurement:',
            procRes.error.message
          )

        if (poRes.error)
          console.error(
            '[AppContext] purchase orders:',
            poRes.error.message
          )

        if (finRes.error)
          console.error(
            '[AppContext] financials:',
            finRes.error.message
          )

        if (actRes.error)
          console.error(
            '[AppContext] activity logs:',
            actRes.error.message
          )

        if (txnRes.data) setTransactions(txnRes.data)
        if (invRes.data) setInventory(invRes.data)
        if (tmplRes.data) setTemplates(tmplRes.data)
        if (supRes.data) setSuppliers(supRes.data)
        if (usrRes.data) setUsers(usrRes.data)
        if (procRes.data) setProcurements(procRes.data)
        if (poRes.data) setPurchaseOrders(poRes.data)
        if (finRes.data)
          setFinancialTransactions(finRes.data)
        if (actRes.data) setActivityLogs(actRes.data)

        await fetchRequests(branchId)
        await fetchCategories(branchId)

        setDataLoaded(true)

        console.log(
          '[AppContext] loadBranchData complete ✓'
        )
      } catch (err) {
        console.error(
          '[AppContext] loadBranchData error:',
          err
        )

        showToast(
          'error',
          'Load Failed',
          'Could not load branch data. Check console for details.'
        )

        setDataLoaded(true)
      } finally {
        setLoading(false)
      }
    },
    [showToast, fetchRequests, fetchCategories]
  )

  /* ── Legacy loadAllData ─────────────────────────────────────────────────── */

  const loadAllData = useCallback(
    async (loggedInUser) => {
      if (!loggedInUser) {
        console.warn(
          '[AppContext] loadAllData: no user provided'
        )

        setDataLoaded(true)
        return
      }

      const branchId = getBranchId(loggedInUser)

      if (!branchId) {
        console.warn(
          '[AppContext] loadAllData: no branch_id — user:',
          loggedInUser
        )

        showToast(
          'error',
          'Branch Error',
          'No branch assigned to your account. Please contact administrator.'
        )

        setDataLoaded(true)
        return
      }

      await loadBranchData(branchId)
    },
    [getBranchId, loadBranchData, showToast]
  )

  /* ═══════════════════════════════════════════════════════════════════════════
     REAL-TIME SUBSCRIPTIONS
     ═══════════════════════════════════════════════════════════════════════════ */

  useEffect(() => {
    if (!currentBranch?.id) return undefined

    const branchId = currentBranch.id
    const channels = []

    const invChannel = supabase
      .channel(`inventory:${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'inventory',
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          void fetchInventory(branchId)
        }
      )
      .subscribe()

    channels.push(invChannel)

    const txnChannel = supabase
      .channel(`transactions:${branchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `branch_id=eq.${branchId}`,
        },
        (payload) => {
          if (payload?.new) {
            setTransactions((prev) => [
              payload.new,
              ...prev,
            ])
          }
        }
      )
      .subscribe()

    channels.push(txnChannel)

    const reqChannel = supabase
      .channel(`requests:${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'requests',
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          void fetchRequests(branchId)
        }
      )
      .subscribe()

    channels.push(reqChannel)

    return () => {
      channels.forEach((channel) => {
        void supabase.removeChannel(channel)
      })
    }
  }, [
    currentBranch?.id,
    fetchInventory,
    fetchRequests,
  ])

  /* ═══════════════════════════════════════════════════════════════════════════
     DATABASE NOTIFICATIONS
     ═══════════════════════════════════════════════════════════════════════════ */

  useEffect(() => {
    if (!user?.id) {
      setNotifications([])
      return undefined
    }

    let active = true

    const loadNotifications = async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      if (active && !error) {
        setNotifications(
          (data || []).map((notification) => ({
            ...notification,
            msg:
              notification.message ||
              notification.msg ||
              '',
            time: notification.created_at
              ? new Date(
                  notification.created_at
                ).toLocaleString()
              : 'Just now',
          }))
        )
      }
    }

    void loadNotifications()

    const poll = window.setInterval(() => {
      void loadNotifications()
    }, 20000)

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (!active) return

          const notification = payload.new || {}

          setNotifications((prev) => [
            {
              ...notification,
              msg:
                notification.message ||
                notification.msg ||
                '',
              time: 'Just now',
              read: false,
            },
            ...prev,
          ].slice(0, 50))
        }
      )
      .subscribe()

    return () => {
      active = false
      window.clearInterval(poll)
      void supabase.removeChannel(channel)
    }
  }, [user?.id])

  /* ═══════════════════════════════════════════════════════════════════════════
     AUTH LISTENER
     ═══════════════════════════════════════════════════════════════════════════ */

  const loadAllDataRef = useRef(loadAllData)
  const clearDataRef = useRef(clearData)
  const fetchUserBranchesRef = useRef(fetchUserBranches)

  useEffect(() => {
    loadAllDataRef.current = loadAllData
  }, [loadAllData])

  useEffect(() => {
    clearDataRef.current = clearData
  }, [clearData])

  useEffect(() => {
    fetchUserBranchesRef.current = fetchUserBranches
  }, [fetchUserBranches])

  useEffect(() => {
    let mounted = true

    const finishAuth = async (session) => {
      console.log(
        '[Auth] finishAuth called, session exists:',
        !!session
      )

      if (!session) {
        if (mounted) setAuthReady(true)
        return
      }

      const {
        data: restoredUser,
        error,
      } = await authApi.userFromSession(session)

      if (error || !restoredUser) {
        console.error(
          '[Auth] session profile failed:',
          error?.message
        )

        if (mounted) setAuthReady(true)
        return
      }

      console.log(
        '[Auth] authenticated:',
        restoredUser.email,
        'authId:',
        session.user?.id,
        'profileId:',
        restoredUser.id
      )

      await loadUserRole(restoredUser)

      /*
       * Fetch accessible branches.
       * Master can access all branches.
       */
      const userBranches =
        await fetchUserBranchesRef.current(
          restoredUser.id,
          restoredUser
        )

      if (!mounted) return

      if (userBranches.length > 0) {
        const defaultBranch =
          userBranches.find(
            (branch) =>
              branch.id === restoredUser.branch_id
          ) || userBranches[0]

        /*
         * Master is global, but the rest of the application
         * is branch-oriented. Give Master an initial branch.
         */
        const sessionUser =
          restoredUser.role === 'Master'
            ? {
                ...restoredUser,
                branch_id: defaultBranch.id,
                branch_name: defaultBranch.name,
              }
            : restoredUser

        setUser(sessionUser)
        setCurrentBranch(defaultBranch)

        await loadAllDataRef.current(sessionUser)
      } else {
        setUser(restoredUser)

        showToast(
          'warning',
          'No Branches',
          'You have not been assigned to any branches.'
        )
      }

      if (mounted) {
        setAuthReady(true)
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Auth] auth event:', event)

        if (event === 'INITIAL_SESSION') {
          setTimeout(() => {
            void finishAuth(session)
          }, 0)

          return
        }

        if (event === 'SIGNED_IN') {
          setTimeout(() => {
            void finishAuth(session)
          }, 0)

          return
        }

        if (event === 'SIGNED_OUT') {
          setUser(null)
          clearDataRef.current()
          setTab('dashboard')
          setAuthReady(true)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadUserRole, showToast])

  /* ═══════════════════════════════════════════════════════════════════════════
     LOGIN
     ═══════════════════════════════════════════════════════════════════════════ */

  const login = useCallback(
    async (email, password) => {
      console.log('[Auth] login:', email)

      setAuthError(null)

      const {
        data: loggedInUser,
        error,
      } = await authApi.login(email, password)

      if (error) {
        setAuthError(error.message)
        return { error }
      }

      if (loggedInUser) {
        console.log(
          '[Auth] login success, profile:',
          loggedInUser
        )

        await loadUserRole(loggedInUser)

        const userBranches =
          await fetchUserBranches(
            loggedInUser.id,
            loggedInUser
          )

        if (userBranches.length > 0) {
          const defaultBranch =
            userBranches.find(
              (branch) =>
                branch.id === loggedInUser.branch_id
            ) || userBranches[0]

          const sessionUser =
            loggedInUser.role === 'Master'
              ? {
                  ...loggedInUser,
                  branch_id: defaultBranch.id,
                  branch_name: defaultBranch.name,
                }
              : loggedInUser

          setUser(sessionUser)
          setCurrentBranch(defaultBranch)

          await loadAllData(sessionUser)

          return { data: sessionUser }
        }

        setUser(loggedInUser)

        showToast(
          'warning',
          'No Branches',
          'You have not been assigned to any branches.'
        )
      }

      return { data: loggedInUser }
    },
    [
      loadAllData,
      loadUserRole,
      fetchUserBranches,
      showToast,
    ]
  )

  /* ═══════════════════════════════════════════════════════════════════════════
     LOGOUT
     ═══════════════════════════════════════════════════════════════════════════ */

  const logout = useCallback(async () => {
    await authApi.logout()
  }, [])

  /* ═══════════════════════════════════════════════════════════════════════════
     ACTION LOCK
     ═══════════════════════════════════════════════════════════════════════════ */

  const actionInProgress = useRef(false)

  const withActionLock = useCallback(
    async (fn) => {
      if (actionInProgress.current) {
        showToast(
          'info',
          'Please wait',
          'An operation is already in progress'
        )

        return { locked: true }
      }

      actionInProgress.current = true

      try {
        const result = await fn()

        return {
          locked: false,
          result,
        }
      } catch (err) {
        console.error(
          '[AppContext] action lock error:',
          err
        )

        return {
          locked: false,
          error: err,
        }
      } finally {
        actionInProgress.current = false
      }
    },
    [showToast]
  )

  /* ═══════════════════════════════════════════════════════════════════════════
     STOCK OPERATIONS
     ═══════════════════════════════════════════════════════════════════════════ */

  const handleStockIn = useCallback(
    async (formData) => {
      const branchId = getBranchId(user)

      if (!branchId) {
        showToast(
          'error',
          'Branch Error',
          'No branch assigned to your account'
        )

        return { success: false }
      }

      return withActionLock(async () => {
        const { data, error } =
          await transactionsApi.stockIn({
            ...formData,
            branchId,
            userId: user?.id,
            userName:
              user?.name ||
              user?.full_name ||
              'Unknown',
          })

        if (error) {
          showToast(
            'error',
            'Stock IN Failed',
            error.message
          )

          return {
            success: false,
            error,
          }
        }

        setTransactions((prev) => [
          data,
          ...prev,
        ])

        setInventory((prev) => {
          const index = prev.findIndex(
            (item) =>
              item.name?.toLowerCase() ===
              formData.item?.toLowerCase()
          )

          if (index >= 0) {
            const updated = [...prev]

            updated[index] = {
              ...updated[index],
              quantity:
                (Number(
                  updated[index].quantity
                ) || 0) +
                Math.abs(
                  Number(formData.qty)
                ),
              updated_at:
                new Date().toISOString(),
            }

            return updated
          }

          return prev
        })

        addNotification({
          title: 'Stock IN',
          msg: `${formData.qty} ${formData.unit} of ${formData.item}`,
          type: 'success',
        })

        showToast(
          'success',
          'Stock IN Recorded',
          `${formData.item} — ${formData.qty} ${formData.unit}`
        )

        return {
          success: true,
          data,
        }
      })
    },
    [
      user,
      getBranchId,
      withActionLock,
      addNotification,
      showToast,
    ]
  )

  const handleStockOut = useCallback(
    async (formData) => {
      const branchId = getBranchId(user)

      if (!branchId) {
        showToast(
          'error',
          'Branch Error',
          'No branch assigned to your account'
        )

        return { success: false }
      }

      return withActionLock(async () => {
        const { data, error } =
          await transactionsApi.stockOut({
            ...formData,
            branchId,
            userId: user?.id,
            userName:
              user?.name ||
              user?.full_name ||
              'Unknown',
          })

        if (error) {
          showToast(
            'error',
            'Stock OUT Failed',
            error.message
          )

          return {
            success: false,
            error,
          }
        }

        setTransactions((prev) => [
          data,
          ...prev,
        ])

        setInventory((prev) => {
          const index = prev.findIndex(
            (item) =>
              item.name?.toLowerCase() ===
              formData.item?.toLowerCase()
          )

          if (index >= 0) {
            const updated = [...prev]

            updated[index] = {
              ...updated[index],
              quantity: Math.max(
                0,
                (Number(
                  updated[index].quantity
                ) || 0) -
                  Math.abs(
                    Number(formData.qty)
                  )
              ),
              updated_at:
                new Date().toISOString(),
            }

            return updated
          }

          return prev
        })

        addNotification({
          title:
            formData.type || 'Stock OUT',
          msg: `${formData.qty} ${formData.unit} of ${formData.item}`,
          type: 'success',
        })

        showToast(
          'success',
          `${formData.type || 'Stock OUT'} Recorded`,
          `${formData.item} — ${formData.qty} ${formData.unit}`
        )

        return {
          success: true,
          data,
        }
      })
    },
    [
      user,
      getBranchId,
      withActionLock,
      addNotification,
      showToast,
    ]
  )

  /* ═══════════════════════════════════════════════════════════════════════════
     REQUESTS SYSTEM
     ═══════════════════════════════════════════════════════════════════════════ */

  const createRequest = useCallback(
    async ({ department, notes, items }) => {
      const branchId = getBranchId(user)

      if (!branchId) {
        showToast(
          'error',
          'Branch Error',
          'No branch assigned'
        )

        return {
          success: false,
          error: new Error('No branch'),
        }
      }

      try {
        const {
          data: req,
          error: reqError,
        } = await supabase
          .from('requests')
          .insert({
            department,
            notes,
            status: 'Pending',
            branch_id: branchId,
            created_by: user?.id,
            created_by_name:
              user?.name ||
              user?.full_name ||
              'Unknown',
          })
          .select()
          .single()

        if (reqError) throw reqError

        const requestItems = items.map(
          (item) => ({
            request_id: req.id,
            name: item.name,
            category: item.category,
            unit: item.unit,
            qty: item.qty,
            notes: item.notes,
          })
        )

        const { error: itemsError } =
          await supabase
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
          metadata: {
            department,
            itemCount: items.length,
            requestId: req.id,
          },
        })

        await fetchRequests(branchId)

        return {
          success: true,
          data: req,
        }
      } catch (error) {
        console.error(
          'createRequest error:',
          error
        )

        showToast(
          'error',
          'Create Failed',
          error.message
        )

        return {
          success: false,
          error,
        }
      }
    },
    [
      user,
      getBranchId,
      showToast,
      fetchRequests,
    ]
  )

  const approveRequest = useCallback(
    async (id) => {
      try {
        const { error } = await supabase
          .from('requests')
          .update({
            status: 'Approved',
            approved_by: user?.id,
            approved_by_name:
              user?.name ||
              user?.full_name ||
              'Unknown',
            approved_at:
              new Date().toISOString(),
          })
          .eq('id', id)

        if (error) throw error

        await fetchRequests(
          getBranchId(user)
        )

        return { success: true }
      } catch (error) {
        console.error(
          'approveRequest error:',
          error
        )

        showToast(
          'error',
          'Approve Failed',
          error.message
        )

        return {
          success: false,
          error,
        }
      }
    },
    [
      user,
      getBranchId,
      showToast,
      fetchRequests,
    ]
  )

  const rejectRequest = useCallback(
    async (id) => {
      try {
        const { error } = await supabase
          .from('requests')
          .update({
            status: 'Rejected',
            approved_by: user?.id,
            approved_by_name:
              user?.name ||
              user?.full_name ||
              'Unknown',
            approved_at:
              new Date().toISOString(),
          })
          .eq('id', id)

        if (error) throw error

        await fetchRequests(
          getBranchId(user)
        )

        return { success: true }
      } catch (error) {
        console.error(
          'rejectRequest error:',
          error
        )

        showToast(
          'error',
          'Reject Failed',
          error.message
        )

        return {
          success: false,
          error,
        }
      }
    },
    [
      user,
      getBranchId,
      showToast,
      fetchRequests,
    ]
  )

  const fulfillRequest = useCallback(
    async (id) => {
      try {
        const {
          data: req,
          error: fetchError,
        } = await supabase
          .from('requests')
          .select('*, request_items (*)')
          .eq('id', id)
          .single()

        if (fetchError) throw fetchError

        const items =
          req.request_items || []

        if (items.length === 0) {
          throw new Error(
            'No items found on this request'
          )
        }

        const branchId =
          getBranchId(user)

        for (const item of items) {
          const qty =
            Number(item.qty) || 0

          if (qty <= 0) continue

          const {
            data: txnData,
            error: stockError,
          } =
            await transactionsApi.stockOut({
              item: item.name,
              qty,
              unit: item.unit || 'pcs',
              type: 'Fulfillment',
              notes: `Fulfilled request from ${
                req.department || 'department'
              }`,
              branchId,
              userId: user?.id,
              userName:
                user?.name ||
                user?.full_name ||
                'Unknown',
            })

          if (stockError) {
            throw new Error(
              `Failed to deduct ${item.name}: ${stockError.message}`
            )
          }

          if (txnData) {
            setTransactions((prev) => [
              txnData,
              ...prev,
            ])
          }

          if (item.id) {
            const {
              error: itemError,
            } = await supabase
              .from('request_items')
              .update({
                fulfilled_qty: qty,
              })
              .eq('id', item.id)

            if (itemError) {
              throw new Error(
                `Failed to update ${item.name}: ${itemError.message}`
              )
            }
          }
        }

        const { error } =
          await supabase
            .from('requests')
            .update({
              status: 'Completed',
              completed_at:
                new Date().toISOString(),
            })
            .eq('id', id)

        if (error) throw error

        await createNotification({
          type: 'request_fulfilled',
          title: 'Request Fulfilled',
          message:
            'Request has been fulfilled and inventory updated',
          link: '/requests',
        })

        await createActivityLog({
          action: 'REQUEST_FULFILLED',
          description:
            'Request was fulfilled and inventory updated',
          metadata: {
            requestId: id,
          },
        })

        await fetchRequests(branchId)

        showToast(
          'success',
          'Request Fulfilled',
          'Inventory has been updated'
        )

        return { success: true }
      } catch (error) {
        console.error(
          'fulfillRequest error:',
          error
        )

        showToast(
          'error',
          'Fulfill Failed',
          error.message
        )

        return {
          success: false,
          error,
        }
      }
    },
    [
      user,
      getBranchId,
      showToast,
      fetchRequests,
      createNotification,
      createActivityLog,
    ]
  )

  const partialFulfillRequest =
    useCallback(
      async (
        id,
        fulfilledItems = []
      ) => {
        try {
          if (
            !Array.isArray(
              fulfilledItems
            ) ||
            fulfilledItems.length === 0
          ) {
            throw new Error(
              'No fulfilled items provided'
            )
          }

          const {
            data: req,
            error: fetchError,
          } = await supabase
            .from('requests')
            .select(
              '*, request_items (*)'
            )
            .eq('id', id)
            .single()

          if (fetchError) {
            throw fetchError
          }

          const branchId =
            getBranchId(user)

          for (const {
            itemId,
            qty,
          } of fulfilledItems) {
            const item = (
              req.request_items || []
            ).find(
              (requestItem) =>
                requestItem.id === itemId
            )

            if (!item) {
              throw new Error(
                'Request item not found'
              )
            }

            const deductQty =
              Number(qty) || 0

            if (deductQty <= 0) continue

            const {
              data: txnData,
              error: stockError,
            } =
              await transactionsApi.stockOut(
                {
                  item: item.name,
                  qty: deductQty,
                  unit:
                    item.unit || 'pcs',
                  type: 'Fulfillment',
                  notes: `Partially fulfilled request from ${
                    req.department ||
                    'department'
                  }`,
                  branchId,
                  userId: user?.id,
                  userName:
                    user?.name ||
                    user?.full_name ||
                    'Unknown',
                }
              )

            if (stockError) {
              throw new Error(
                `Failed to deduct ${item.name}: ${stockError.message}`
              )
            }

            if (txnData) {
              setTransactions(
                (prev) => [
                  txnData,
                  ...prev,
                ]
              )
            }

            const newFulfilled =
              Number(
                item.fulfilled_qty || 0
              ) + deductQty

            const {
              error: itemError,
            } = await supabase
              .from('request_items')
              .update({
                fulfilled_qty:
                  newFulfilled,
              })
              .eq('id', itemId)

            if (itemError) {
              throw new Error(
                `Failed to update ${item.name}: ${itemError.message}`
              )
            }
          }

          const allFulfilled = (
            req.request_items || []
          ).every((requestItem) => {
            const fulfilled =
              fulfilledItems.find(
                (item) =>
                  item.itemId ===
                  requestItem.id
              )

            const addedQty =
              Number(
                fulfilled?.qty
              ) || 0

            return (
              Number(
                requestItem.fulfilled_qty ||
                  0
              ) +
                addedQty >=
              Number(
                requestItem.qty || 0
              )
            )
          })

          const { error } =
            await supabase
              .from('requests')
              .update({
                status: allFulfilled
                  ? 'Completed'
                  : 'Partially Fulfilled',
                completed_at:
                  allFulfilled
                    ? new Date().toISOString()
                    : null,
              })
              .eq('id', id)

          if (error) throw error

          await createNotification({
            type: 'request_partial',
            title: allFulfilled
              ? 'Request Fulfilled'
              : 'Request Partially Fulfilled',
            message: allFulfilled
              ? 'Request fulfilled'
              : 'Request partially fulfilled',
            link: '/requests',
          })

          await createActivityLog({
            action: allFulfilled
              ? 'REQUEST_FULFILLED'
              : 'REQUEST_PARTIAL',
            description: allFulfilled
              ? 'Request fulfilled'
              : 'Request partially fulfilled',
            metadata: {
              requestId: id,
            },
          })

          await fetchRequests(
            branchId
          )

          showToast(
            'success',
            allFulfilled
              ? 'Request Fulfilled'
              : 'Partially Fulfilled',
            'Inventory has been updated'
          )

          return { success: true }
        } catch (error) {
          console.error(
            'partialFulfillRequest error:',
            error
          )

          showToast(
            'error',
            'Partial Fulfill Failed',
            error.message
          )

          return {
            success: false,
            error,
          }
        }
      },
      [
        user,
        getBranchId,
        showToast,
        fetchRequests,
        createNotification,
        createActivityLog,
      ]
    )

  const deleteRequest = useCallback(
    async (id) => {
      try {
        const { error } =
          await supabase
            .from('requests')
            .delete()
            .eq('id', id)

        if (error) throw error

        await fetchRequests(
          getBranchId(user)
        )

        return { success: true }
      } catch (error) {
        console.error(
          'deleteRequest error:',
          error
        )

        showToast(
          'error',
          'Delete Failed',
          error.message
        )

        return {
          success: false,
          error,
        }
      }
    },
    [
      user,
      getBranchId,
      showToast,
      fetchRequests,
    ]
  )

  /* ═══════════════════════════════════════════════════════════════════════════
     NOTIFICATIONS & ACTIVITY LOGS
     ═══════════════════════════════════════════════════════════════════════════ */

  const createNotification = useCallback(
    async ({
      type,
      title,
      message,
      link,
    }) => {
      try {
        await supabase
          .from('notifications')
          .insert({
            type,
            title,
            message,
            link,
            user_id: user?.id,
            branch_id:
              getBranchId(user),
            read: false,
            created_at:
              new Date().toISOString(),
          })
      } catch (error) {
        console.error(
          'createNotification error:',
          error
        )
      }
    },
    [user, getBranchId]
  )

  const createActivityLog =
    useCallback(
      async ({
        action,
        description,
        metadata,
      }) => {
        try {
          await supabase
            .from('activity_logs')
            .insert({
              action,
              description,
              metadata,
              user_id: user?.id,
              user_name:
                user?.name ||
                user?.full_name ||
                'Unknown',
              branch_id:
                getBranchId(user),
              created_at:
                new Date().toISOString(),
            })
        } catch (error) {
          console.error(
            'createActivityLog error:',
            error
          )
        }
      },
      [user, getBranchId]
    )

  /* ═══════════════════════════════════════════════════════════════════════════
     CRUD OPERATIONS
     ═══════════════════════════════════════════════════════════════════════════ */

  /* ── Templates ──────────────────────────────────────────────────────────── */

  const createTemplate = useCallback(
    async (tmpl) => {
      const {
        data,
        error,
      } = await templatesApi.create({
        ...tmpl,
        branch_id:
          getBranchId(user),
        created_by: user?.id,
      })

      if (error) {
        showToast(
          'error',
          'Failed',
          error.message
        )

        return null
      }

      setTemplates((prev) => [
        ...prev,
        data,
      ])

      return data
    },
    [user, getBranchId, showToast]
  )

  const updateTemplate = useCallback(
    async (id, updates) => {
      const {
        data,
        error,
      } = await templatesApi.update(
        id,
        updates
      )

      if (error) {
        showToast(
          'error',
          'Failed',
          error.message
        )

        return
      }

      setTemplates((prev) =>
        prev.map((template) =>
          template.id === id
            ? { ...template, ...data }
            : template
        )
      )
    },
    [showToast]
  )

  const deleteTemplate = useCallback(
    async (id) => {
      const { error } =
        await templatesApi.remove(id)

      if (error) {
        showToast(
          'error',
          'Failed',
          error.message
        )

        return
      }

      setTemplates((prev) =>
        prev.filter(
          (template) =>
            template.id !== id
        )
      )
    },
    [showToast]
  )

  /* ── Suppliers ──────────────────────────────────────────────────────────── */

  const createSupplier = useCallback(
    async (supplier) => {
      const {
        data,
        error,
      } = await suppliersApi.create({
        ...supplier,
        branch_id:
          getBranchId(user),
      })

      if (error) {
        showToast(
          'error',
          'Failed',
          error.message
        )

        return null
      }

      setSuppliers((prev) => [
        ...prev,
        data,
      ])

      return data
    },
    [user, getBranchId, showToast]
  )

  const updateSupplier = useCallback(
    async (id, updates) => {
      const {
        data,
        error,
      } = await suppliersApi.update(
        id,
        updates
      )

      if (error) {
        showToast(
          'error',
          'Failed',
          error.message
        )

        return
      }

      setSuppliers((prev) =>
        prev.map((supplier) =>
          supplier.id === id
            ? { ...supplier, ...data }
            : supplier
        )
      )
    },
    [showToast]
  )

  const deleteSupplier = useCallback(
    async (id) => {
      const { error } =
        await suppliersApi.remove(id)

      if (error) {
        showToast(
          'error',
          'Failed',
          error.message
        )

        return
      }

      setSuppliers((prev) =>
        prev.filter(
          (supplier) =>
            supplier.id !== id
        )
      )
    },
    [showToast]
  )

  /* ── Users ──────────────────────────────────────────────────────────────── */

  const createUser = useCallback(
    async (userData) => {
      const payload = {
        ...userData,
        branch_id:
          getBranchId(user),
      }

      const {
        data,
        error,
      } = await usersApi.create(payload)

      if (error) {
        showToast(
          'error',
          'Failed',
          error.message
        )

        return null
      }

      setUsers((prev) => [
        ...prev,
        data,
      ])

      return data
    },
    [user, getBranchId, showToast]
  )

  const updateUser = useCallback(
    async (id, updates) => {
      const {
        data,
        error,
      } = await usersApi.update(
        id,
        updates
      )

      if (error) {
        showToast(
          'error',
          'Failed',
          error.message
        )

        return
      }

      setUsers((prev) =>
        prev.map((existingUser) =>
          existingUser.id === id
            ? {
                ...existingUser,
                ...data,
              }
            : existingUser
        )
      )
    },
    [showToast]
  )

  const deleteUser = useCallback(
    async (id) => {
      const { error } =
        await usersApi.remove(id)

      if (error) {
        showToast(
          'error',
          'Failed',
          error.message
        )

        return
      }

      setUsers((prev) =>
        prev.filter(
          (existingUser) =>
            existingUser.id !== id
        )
      )
    },
    [showToast]
  )

  /* ── Categories ─────────────────────────────────────────────────────────── */

  const createCategory = useCallback(
    async (category) => {
      try {
        const {
          data,
          error,
        } = await supabase
          .from('categories')
          .insert({
            ...category,
            branch_id:
              getBranchId(user),
            created_by: user?.id,
          })
          .select()
          .single()

        if (error) throw error

        setCategories((prev) => [
          ...prev,
          data,
        ])

        showToast(
          'success',
          'Category Created',
          data.name
        )

        return data
      } catch (err) {
        showToast(
          'error',
          'Failed',
          err.message
        )

        throw err
      }
    },
    [user, getBranchId, showToast]
  )

  const updateCategory = useCallback(
    async (id, updates) => {
      try {
        const {
          data,
          error,
        } = await supabase
          .from('categories')
          .update(updates)
          .eq('id', id)
          .select()
          .single()

        if (error) throw error

        setCategories((prev) =>
          prev.map((category) =>
            category.id === id
              ? {
                  ...category,
                  ...data,
                }
              : category
          )
        )

        showToast(
          'success',
          'Category Updated',
          data.name
        )

        return data
      } catch (err) {
        showToast(
          'error',
          'Failed',
          err.message
        )

        throw err
      }
    },
    [showToast]
  )

  const deleteCategory = useCallback(
    async (id) => {
      try {
        const { error } =
          await supabase
            .from('categories')
            .delete()
            .eq('id', id)

        if (error) throw error

        setCategories((prev) =>
          prev.filter(
            (category) =>
              category.id !== id
          )
        )

        showToast(
          'info',
          'Category Deleted',
          ''
        )
      } catch (err) {
        showToast(
          'error',
          'Failed',
          err.message
        )

        throw err
      }
    },
    [showToast]
  )

  /* ── Procurement ────────────────────────────────────────────────────────── */

  const createProcurement = useCallback(
    async (request) => {
      const {
        data,
        error,
      } =
        await procurementApi.create({
          ...request,
          branch_id:
            getBranchId(user),
          created_by: user?.id,
        })

      if (error) {
        showToast(
          'error',
          'Failed',
          error.message
        )

        return null
      }

      setProcurements((prev) => [
        data,
        ...prev,
      ])

      return data
    },
    [user, getBranchId, showToast]
  )

  const updateProcurementStatus =
    useCallback(
      async (id, status) => {
        const {
          data,
          error,
        } =
          await procurementApi.updateStatus(
            id,
            status,
            user?.id
          )

        if (error) {
          showToast(
            'error',
            'Failed',
            error.message
          )

          return
        }

        setProcurements((prev) =>
          prev.map((procurement) =>
            procurement.id === id
              ? {
                  ...procurement,
                  ...data,
                }
              : procurement
          )
        )
      },
      [user, showToast]
    )

  const deleteProcurement = useCallback(
    async (id) => {
      const { error } =
        await procurementApi.remove(id)

      if (error) {
        showToast(
          'error',
          'Failed',
          error.message
        )

        return
      }

      setProcurements((prev) =>
        prev.filter(
          (procurement) =>
            procurement.id !== id
        )
      )
    },
    [showToast]
  )

  /* ── Purchase Orders ────────────────────────────────────────────────────── */

  const createPurchaseOrder =
    useCallback(
      async ({ po, items }) => {
        const {
          data,
          error,
        } =
          await purchaseOrdersApi.create({
            po: {
              ...po,
              branch_id:
                getBranchId(user),
              created_by: user?.id,
            },
            items,
          })

        if (error) {
          showToast(
            'error',
            'Failed',
            error.message
          )

          return null
        }

        setPurchaseOrders((prev) => [
          data,
          ...prev,
        ])

        return data
      },
      [user, getBranchId, showToast]
    )

  const updatePOStatus = useCallback(
    async (id, status) => {
      const {
        data,
        error,
      } =
        await purchaseOrdersApi.updateStatus(
          id,
          status,
          user?.id
        )

      if (error) {
        showToast(
          'error',
          'Failed',
          error.message
        )

        return
      }

      setPurchaseOrders((prev) =>
        prev.map((po) =>
          po.id === id
            ? { ...po, ...data }
            : po
        )
      )
    },
    [user, showToast]
  )

  /* ── Financial ──────────────────────────────────────────────────────────── */

  const updateFinancialTxnStatus =
    useCallback(
      async (id, paymentStatus) => {
        const {
          data,
          error,
        } =
          await financialApi.updatePaymentStatus(
            id,
            paymentStatus
          )

        if (error) {
          showToast(
            'error',
            'Failed',
            error.message
          )

          return
        }

        setFinancialTransactions(
          (prev) =>
            prev.map((transaction) =>
              transaction.id === id
                ? {
                    ...transaction,
                    ...data,
                  }
                : transaction
            )
        )
      },
      [showToast]
    )

  /* ═══════════════════════════════════════════════════════════════════════════
     STATS
     ═══════════════════════════════════════════════════════════════════════════ */

  const stats = useMemo(() => {
    const safeInventory = Array.isArray(
      inventory
    )
      ? inventory
      : []

    const safeTransactions =
      Array.isArray(transactions)
        ? transactions
        : []

    const safeSuppliers =
      Array.isArray(suppliers)
        ? suppliers
        : []

    const lowStock =
      safeInventory.filter((item) => {
        const qty =
          Number(item.quantity) || 0

        const threshold =
          Number(
            item.min_threshold ||
              item.min_stock ||
              item.threshold ||
              0
          )

        return (
          threshold > 0 &&
          qty <= threshold
        )
      })

    const critical =
      safeInventory.filter(
        (item) =>
          (Number(item.quantity) ||
            0) === 0
      )

    const stockInTotal =
      safeTransactions
        .filter(
          (transaction) =>
            transaction.type ===
            'Stock IN'
        )
        .reduce(
          (sum, transaction) =>
            sum +
            Math.abs(
              Number(
                transaction.quantity ||
                  transaction.qty
              ) || 0
            ),
          0
        )

    const stockOutTotal =
      safeTransactions
        .filter((transaction) =>
          [
            'Stock OUT',
            'Wastage',
            'Fulfillment',
          ].includes(
            transaction.type
          )
        )
        .reduce(
          (sum, transaction) =>
            sum +
            Math.abs(
              Number(
                transaction.quantity ||
                  transaction.qty
              ) || 0
            ),
          0
        )

    const inventoryValue =
      safeInventory.reduce(
        (sum, item) =>
          sum +
          (Number(item.quantity) ||
            0) *
            (Number(
              item.cost ||
                item.price ||
                0
            ) || 0),
        0
      )

    return {
      totalItems:
        safeInventory.length,
      lowStockCount:
        lowStock.length,
      criticalCount:
        critical.length,
      stockInTotal,
      stockOutTotal,
      activeSuppliers:
        safeSuppliers.length,
      inventoryValue,
    }
  }, [
    inventory,
    transactions,
    suppliers,
  ])

  /* ═══════════════════════════════════════════════════════════════════════════
     CONTEXT VALUE
     ═══════════════════════════════════════════════════════════════════════════ */

  const value = {
    /* Auth */
    user,
    setUser,
    login,
    logout,
    authReady,
    authError,

    /* Theme */
    dark,
    setDark,
    theme,

    /* UI */
    tab,
    setTab,
    sidebarOpen,
    setSidebar,
    loading,
    dataLoaded,
    toasts,
    showToast,
    dismissToast,
    notifications,
    addNotification,
    markAllRead,
    systemEnabled,
    setSystemEnabled,
    systemMsg,
    setSystemMsg,

    /* Data */
    transactions,
    setTransactions,
    requests,
    setRequests,
    inventory,
    setInventory,
    templates,
    setTemplates,
    suppliers,
    setSuppliers,
    users,
    setUsers,
    procurements,
    setProcurements,
    purchaseOrders,
    setPurchaseOrders,
    financialTransactions,
    setFinancialTransactions,
    activityLogs,
    stats,

    /* Units */
    customUnits,
    setCustomUnits,
    allUnits,

    /* Categories */
    categories,
    setCategories,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,

    /* Stock operations */
    handleStockIn,
    handleStockOut,

    /* Requests */
    createRequest,
    approveRequest,
    rejectRequest,
    fulfillRequest,
    partialFulfillRequest,
    deleteRequest,
    fetchRequests,

    /* Notifications & Logs */
    createNotification,
    createActivityLog,

    /* CRUD */
    createTemplate,
    updateTemplate,
    deleteTemplate,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    createUser,
    updateUser,
    deleteUser,
    createProcurement,
    updateProcurementStatus,
    deleteProcurement,
    createPurchaseOrder,
    updatePOStatus,
    updateFinancialTxnStatus,

    /* Utils */
    withActionLock,
    loadAllData,

    /* Branch */
    currentBranch,
    branches,
    switchBranch,
    isLoadingBranchData,

    /* RBAC */
    userRole,

    isAdmin: () => isAdmin(userRole),
    isManager: () => isManager(userRole),
    isChief: () => isChief(userRole),
    isStoreKeeper: () =>
      isStoreKeeper(userRole),
    isDeveloper: () =>
      isDeveloper(userRole),
    isMaster: () =>
      isMaster(userRole),

    hasRole: (role) =>
      hasRole(userRole, role),

    hasAnyRole: (roles) =>
      hasAnyRole(userRole, roles),

    canCreateUsers: () =>
      canCreateUsers(userRole),

    canDeleteUsers: () =>
      canDeleteUsers(userRole),

    canAssignRoles: () =>
      canAssignRoles(userRole),

    canApproveRequests: () =>
      canApproveRequests(userRole),

    canRejectRequests: () =>
      canRejectRequests(userRole),

    canFulfillRequests: () =>
      canFulfillRequests(userRole),

    canCreateDemand: () =>
      canCreateDemand(userRole),

    canManageInventory: () =>
      canManageInventory(userRole),

    canManageSuppliers: () =>
      canManageSuppliers(userRole),

    canManageProcurement: () =>
      canManageProcurement(userRole),

    canManagePurchaseOrders: () =>
      canManagePurchaseOrders(userRole),

    canManageFinancials: () =>
      canManageFinancials(userRole),

    canViewReports: () =>
      canViewReports(userRole),

    canAccessSettings: () =>
      canAccessSettings(userRole),

    canAccessUserManagement: () =>
      canAccessUserManagement(userRole),

    canAccessSuppliers: () =>
      canAccessSuppliers(userRole),

    canAccessProcurement: () =>
      canAccessProcurement(userRole),

    canAccessPurchaseOrders: () =>
      canAccessPurchaseOrders(userRole),

    canAccessFinancials: () =>
      canAccessFinancials(userRole),

    canAccessInventory: () =>
      canAccessInventory(userRole),

    canAccessStockMovement: () =>
      canAccessStockMovement(userRole),

    canAccessFulfillment: () =>
      canAccessFulfillment(userRole),

    canAccessDemands: () =>
      canAccessDemands(userRole),

    canAccessDashboard: () =>
      canAccessDashboard(userRole),

    canAccessActivityLog: () =>
      canAccessActivityLog(userRole),

    canAccessItemTemplates: () =>
      canAccessItemTemplates(userRole),

    canAccessLedger: () =>
      canAccessLedger(userRole),

    canAccessComplaints: () =>
      canAccessComplaints(userRole),
  }

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}

