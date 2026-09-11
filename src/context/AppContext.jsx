
import {
  ROLES,
  ALL_ROLES,
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
  lightTheme,
  darkTheme,
  DEFAULT_UNITS,
} from '../lib/constants'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  const context = useContext(AppContext)

  if (!context) {
    throw new Error('useApp must be used inside AppProvider')
  }

  return context
}

const EMPTY_ARRAY = []

export function AppProvider({ children }) {
  /* ============================================================
     AUTH
  ============================================================ */

  const [user, setUser] = useState(null)
  const [userRole, setUserRole] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState(null)

  /* ============================================================
     BRANCHES
  ============================================================ */

  const [branches, setBranches] = useState([])
  const [currentBranch, setCurrentBranch] = useState(null)
  const [isLoadingBranchData, setIsLoadingBranchData] = useState(false)

  /* ============================================================
     UI
  ============================================================ */

  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('rs_dark') === 'true'
    } catch {
      return false
    }
  })

  const [tab, setTab] = useState('dashboard')
  const [sidebarOpen, setSidebar] = useState(() =>
    typeof window !== 'undefined'
      ? window.innerWidth > 768
      : true
  )

  const [toasts, setToasts] = useState([])
  const [notifications, setNotifications] = useState([])
  const [systemEnabled, setSystemEnabled] = useState(true)
  const [systemMsg, setSystemMsg] = useState(
    'System is currently under maintenance.'
  )

  const [customUnits, setCustomUnits] = useState([])
  const [categories, setCategories] = useState([])

  /* ============================================================
     DATA
  ============================================================ */

  const [loading, setLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)

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

  /* ============================================================
     THEME
  ============================================================ */

  const theme = dark ? darkTheme : lightTheme

  useEffect(() => {
    try {
      localStorage.setItem('rs_dark', String(dark))
    } catch {
      // Ignore localStorage failures.
    }
  }, [dark])

  /* ============================================================
     UNITS
  ============================================================ */

  const allUnits = useMemo(() => {
    return [...new Set([
      ...(Array.isArray(DEFAULT_UNITS) ? DEFAULT_UNITS : []),
      ...(Array.isArray(customUnits) ? customUnits : []),
    ])]
  }, [customUnits])

  /* ============================================================
     TOASTS
  ============================================================ */

  const toastTimers = useRef(new Map())

  const showToast = useCallback(
    (type, title, msg = '', duration = 4500) => {
      const id = `${Date.now()}-${Math.random()}`

      setToasts((previous) => [
        ...previous.slice(-4),
        {
          id,
          type,
          title,
          msg,
        },
      ])

      const timer = window.setTimeout(() => {
        setToasts((previous) =>
          previous.filter((toast) => toast.id !== id)
        )

        toastTimers.current.delete(id)
      }, duration)

      toastTimers.current.set(id, timer)

      return id
    },
    []
  )

  const dismissToast = useCallback((id) => {
    const timer = toastTimers.current.get(id)

    if (timer) {
      window.clearTimeout(timer)
      toastTimers.current.delete(id)
    }

    setToasts((previous) =>
      previous.filter((toast) => toast.id !== id)
    )
  }, [])

  useEffect(() => {
    return () => {
      toastTimers.current.forEach((timer) => {
        window.clearTimeout(timer)
      })

      toastTimers.current.clear()
    }
  }, [])

  /* ============================================================
     NOTIFICATIONS
  ============================================================ */

  const addNotification = useCallback((notification) => {
    const time = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })

    setNotifications((previous) => [
      {
        id: notification?.id || `${Date.now()}-${Math.random()}`,
        time: `Just now (${time})`,
        read: false,
        ...notification,
      },
      ...previous.slice(0, 29),
    ])
  }, [])

  const markAllRead = useCallback(() => {
    setNotifications((previous) =>
      previous.map((notification) => ({
        ...notification,
        read: true,
      }))
    )
  }, [])

  /* ============================================================
     RBAC
  ============================================================ */

  const loadUserRole = useCallback(async (profile) => {
    const role = profile?.role

    if (!role) {
      setUserRole(ROLES.STORE_KEEPER)
      return ROLES.STORE_KEEPER
    }

    if (role === 'Developer') {
      setUserRole('Developer')
      return 'Developer'
    }

    if (!ALL_ROLES.includes(role)) {
      console.warn(
        '[RBAC] Unknown role:',
        role,
        'Defaulting to Store Keeper.'
      )

      setUserRole(ROLES.STORE_KEEPER)
      return ROLES.STORE_KEEPER
    }

    setUserRole(role)
    return role
  }, [])

  /* ============================================================
     BRANCH HELPERS
  ============================================================ */

  const getBranchId = useCallback(
    (account = user) => {
      return (
        currentBranch?.id ||
        account?.branch_id ||
        account?.branchId ||
        null
      )
    },
    [currentBranch, user]
  )

  const fetchUserBranches = useCallback(
    async (userId, profile) => {
      if (!userId) {
        setBranches([])
        return []
      }

      const branchList = []

      /* Master can access every branch. */
      if (profile?.role === 'Master') {
        try {
          const { data, error } = await supabase
            .from('branches')
            .select('id, name, address')
            .order('name', { ascending: true })

          if (!error && Array.isArray(data)) {
            setBranches(data)
            return data
          }

          if (error) {
            console.warn(
              '[Branches] Master branch query failed:',
              error.message
            )
          }
        } catch (error) {
          console.warn(
            '[Branches] Master branch query exception:',
            error
          )
        }
      }

      /* branch_members */
      try {
        const { data, error } = await supabase
          .from('branch_members')
          .select(`
            branch_id,
            branches (
              id,
              name,
              address
            )
          `)
          .eq('user_id', userId)

        if (!error && Array.isArray(data)) {
          data.forEach((membership) => {
            if (!membership?.branches) return

            branchList.push({
              id: membership.branch_id,
              ...membership.branches,
            })
          })
        }
      } catch (error) {
        console.warn(
          '[Branches] branch_members unavailable:',
          error
        )
      }

      /* profile.branch_id */
      if (
        branchList.length === 0 &&
        profile?.branch_id
      ) {
        try {
          const { data, error } = await supabase
            .from('branches')
            .select('id, name, address')
            .eq('id', profile.branch_id)
            .maybeSingle()

          if (!error && data) {
            branchList.push(data)
          }
        } catch (error) {
          console.warn(
            '[Branches] Could not load profile branch:',
            error
          )
        }
      }

      /* Fallback branch */
      if (
        branchList.length === 0 &&
        profile?.branch_id
      ) {
        branchList.push({
          id: profile.branch_id,
          name: profile.branch_name || 'Default Branch',
        })
      }

      /* Remove duplicates */
      const uniqueBranches = Array.from(
        new Map(
          branchList
            .filter((branch) => branch?.id)
            .map((branch) => [branch.id, branch])
        ).values()
      )

      setBranches(uniqueBranches)

      return uniqueBranches
    },
    []
  )

  /* ============================================================
     CLEAR DATA
  ============================================================ */

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

    setBranches([])
    setCurrentBranch(null)

    setNotifications([])
    setDataLoaded(false)
    setUserRole(null)
  }, [])

  /* ============================================================
     DATA FETCHING
  ============================================================ */

  const fetchInventory = useCallback(async (branchId) => {
    if (!branchId) return []

    try {
      const { data, error } =
        await inventoryApi.getAll(branchId)

      if (error) {
        console.error(
          '[Inventory]',
          error.message
        )
        return []
      }

      const result = Array.isArray(data)
        ? data
        : []

      setInventory(result)

      return result
    } catch (error) {
      console.error(
        '[Inventory] Exception:',
        error
      )

      return []
    }
  }, [])

  const fetchRequests = useCallback(
    async (branchId) => {
      if (!branchId) {
        setRequests([])
        return []
      }

      try {
        const { data, error } = await supabase
          .from('requests')
          .select(`
            *,
            request_items (*)
          `)
          .eq('branch_id', branchId)
          .order('created_at', {
            ascending: false,
          })

        if (error) throw error

        const flattened = (
          Array.isArray(data) ? data : []
        ).map((request) => {
          const primaryItem =
            request?.request_items?.[0] || {}

          return {
            ...request,

            item_name:
              primaryItem.name ??
              request.item_name ??
              '',

            name:
              primaryItem.name ??
              request.name ??
              '',

            category:
              primaryItem.category ??
              request.category ??
              '',

            unit:
              primaryItem.unit ??
              request.unit ??
              '',

            quantity:
              primaryItem.qty ??
              request.quantity ??
              0,

            qty:
              primaryItem.qty ??
              request.qty ??
              0,
          }
        })

        setRequests(flattened)

        return flattened
      } catch (error) {
        console.error(
          '[Requests] Fetch error:',
          error
        )

        showToast(
          'error',
          'Error loading requests',
          error?.message || 'Unable to load requests.'
        )

        return []
      }
    },
    [showToast]
  )

  const fetchCategories = useCallback(
    async (branchId) => {
      if (!branchId) {
        setCategories([])
        return []
      }

      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('branch_id', branchId)
          .order('name', {
            ascending: true,
          })

        if (error) throw error

        const result = Array.isArray(data)
          ? data
          : []

        setCategories(result)

        return result
      } catch (error) {
        console.error(
          '[Categories] Fetch error:',
          error
        )

        showToast(
          'error',
          'Error loading categories',
          error?.message || 'Unable to load categories.'
        )

        return []
      }
    },
    [showToast]
  )

  const loadBranchData = useCallback(
    async (branchId) => {
      if (!branchId) {
        setDataLoaded(true)
        return
      }

      setLoading(true)
      setDataLoaded(false)

      try {
        /*
         * Promise.allSettled prevents one failed API
         * from stopping every other section.
         */
        const results = await Promise.allSettled([
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

        const [
          txnResult,
          invResult,
          tmplResult,
          supResult,
          usrResult,
          procResult,
          poResult,
          finResult,
          actResult,
        ] = results

        const readApiResult = (
          result,
          name
        ) => {
          if (result.status === 'rejected') {
            console.error(
              `[AppContext] ${name}:`,
              result.reason
            )

            return {
              data: null,
              error: result.reason,
            }
          }

          if (result.value?.error) {
            console.error(
              `[AppContext] ${name}:`,
              result.value.error.message
            )
          }

          return result.value || {
            data: null,
            error: null,
          }
        }

        const txnRes = readApiResult(
          txnResult,
          'transactions'
        )

        const invRes = readApiResult(
          invResult,
          'inventory'
        )

        const tmplRes = readApiResult(
          tmplResult,
          'templates'
        )

        const supRes = readApiResult(
          supResult,
          'suppliers'
        )

        const usrRes = readApiResult(
          usrResult,
          'users'
        )

        const procRes = readApiResult(
          procResult,
          'procurement'
        )

        const poRes = readApiResult(
          poResult,
          'purchase orders'
        )

        const finRes = readApiResult(
          finResult,
          'financials'
        )

        const actRes = readApiResult(
          actResult,
          'activity logs'
        )

        if (Array.isArray(txnRes.data)) {
          setTransactions(txnRes.data)
        }

        if (Array.isArray(invRes.data)) {
          setInventory(invRes.data)
        }

        if (Array.isArray(tmplRes.data)) {
          setTemplates(tmplRes.data)
        }

        if (Array.isArray(supRes.data)) {
          setSuppliers(supRes.data)
        }

        if (Array.isArray(usrRes.data)) {
          setUsers(usrRes.data)
        }

        if (Array.isArray(procRes.data)) {
          setProcurements(procRes.data)
        }

        if (Array.isArray(poRes.data)) {
          setPurchaseOrders(poRes.data)
        }

        if (Array.isArray(finRes.data)) {
          setFinancialTransactions(finRes.data)
        }

        if (Array.isArray(actRes.data)) {
          setActivityLogs(actRes.data)
        }

        await Promise.allSettled([
          fetchRequests(branchId),
          fetchCategories(branchId),
        ])
      } catch (error) {
        console.error(
          '[AppContext] loadBranchData:',
          error
        )

        showToast(
          'error',
          'Load Failed',
          'Some branch data could not be loaded.'
        )
      } finally {
        setDataLoaded(true)
        setLoading(false)
      }
    },
    [
      fetchRequests,
      fetchCategories,
      showToast,
    ]
  )

  /* ============================================================
     SWITCH BRANCH
  ============================================================ */

  const switchBranch = useCallback(
    async (branch) => {
      if (!branch?.id) return

      if (branch.id === currentBranch?.id) {
        return
      }

      setIsLoadingBranchData(true)

      /*
       * Change branch first.
       * Clear old branch data so the UI never mixes branches.
       */
      setCurrentBranch(branch)

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

      setDataLoaded(false)

      try {
        await loadBranchData(branch.id)

        setUser((previous) => {
          if (!previous) return previous

          return {
            ...previous,
            branch_id: branch.id,
            branch_name: branch.name,
          }
        })
      } finally {
        setIsLoadingBranchData(false)
      }
    },
    [
      currentBranch?.id,
      loadBranchData,
    ]
  )

  /* ============================================================
     LEGACY LOAD ALL DATA
  ============================================================ */

  const loadAllData = useCallback(
    async (account) => {
      if (!account) {
        setDataLoaded(true)
        return
      }

      const branchId =
        currentBranch?.id ||
        account.branch_id ||
        account.branchId

      if (!branchId) {
        setDataLoaded(true)

        showToast(
          'warning',
          'Branch Required',
          'No branch is assigned to your account.'
        )

        return
      }

      await loadBranchData(branchId)
    },
    [
      currentBranch?.id,
      loadBranchData,
      showToast,
    ]
  )

  /* ============================================================
     NOTIFICATION DATABASE
  ============================================================ */

  const createNotification = useCallback(
    async ({
      type,
      title,
      message,
      link = null,
    }) => {
      if (!user?.id) return null

      try {
        const payload = {
          type,
          title,
          message,
          link,
          user_id: user.id,
          branch_id: getBranchId(user),
          read: false,
        }

        const { data, error } = await supabase
          .from('notifications')
          .insert(payload)
          .select()
          .maybeSingle()

        if (error) {
          console.error(
            '[Notifications] Create:',
            error
          )

          return null
        }

        return data
      } catch (error) {
        console.error(
          '[Notifications] Exception:',
          error
        )

        return null
      }
    },
    [user, getBranchId]
  )

  const createActivityLog = useCallback(
    async ({
      action,
      description,
      metadata = {},
    }) => {
      if (!user?.id) return null

      try {
        const payload = {
          action,
          description,
          metadata,
          user_id: user.id,
          user_name:
            user.name ||
            user.full_name ||
            'Unknown',
          branch_id: getBranchId(user),
        }

        const { data, error } = await supabase
          .from('activity_logs')
          .insert(payload)
          .select()
          .maybeSingle()

        if (error) {
          console.error(
            '[Activity] Create:',
            error
          )

          return null
        }

        return data
      } catch (error) {
        console.error(
          '[Activity] Exception:',
          error
        )

        return null
      }
    },
    [user, getBranchId]
  )

  /* ============================================================
     AUTH INITIALIZATION
  ============================================================ */

  const authRunRef = useRef(0)
  // Auth uid we have already fully bootstrapped. Used to ignore redundant
  // SIGNED_IN events (e.g. POS password re-verification via signInWithPassword).
  const bootstrappedAuthUidRef = useRef(null)
  const initializeSessionRef = useRef(null)
  const clearDataRef = useRef(clearData)

  useEffect(() => {
    clearDataRef.current = clearData
  }, [clearData])

  const initializeSession = useCallback(
    async (session, { force = false } = {}) => {
      const runId = ++authRunRef.current
      const authUid = session?.user?.id ?? null

      if (!authUid) {
        bootstrappedAuthUidRef.current = null
        clearData()
        setUser(null)
        setAuthReady(true)

        // If GoTrue recovered to "no usable session" (expired/invalid refresh,
        // or refresh 429 treated as failure), clear local persisted auth so
        // auto-refresh cannot keep hammering /auth/v1/token.
        if (force) {
          try {
            await supabase.auth.signOut({
              scope: 'local',
            })
          } catch (signOutError) {
            console.warn(
              '[Auth] local signOut on empty session:',
              signOutError
            )
          }
        }

        return
      }

      // Same auth user already loaded — do not reload profile/branches/data.
      // Re-running here was a major amplifier: TOKEN_REFRESHED / duplicate
      // SIGNED_IN → setUser → realtime remount → getSession → refresh → ...
      if (
        !force &&
        bootstrappedAuthUidRef.current === authUid
      ) {
        setAuthReady(true)
        return
      }

      try {
        const {
          data: profile,
          error,
        } = await authApi.userFromSession(session)

        if (runId !== authRunRef.current) {
          return
        }

        if (error || !profile) {
          console.error(
            '[Auth] Could not restore profile:',
            error?.message
          )

          setAuthError(
            error?.message ||
              'Could not load your profile.'
          )

          setUser(null)
          bootstrappedAuthUidRef.current = null
          setAuthReady(true)

          // Clear unusable persisted auth so GoTrue stops retrying refresh.
          try {
            await supabase.auth.signOut({
              scope: 'local',
            })
          } catch (signOutError) {
            console.warn(
              '[Auth] local signOut after profile failure:',
              signOutError
            )
          }

          return
        }

        setAuthError(null)

        await loadUserRole(profile)

        if (runId !== authRunRef.current) {
          return
        }

        const accessibleBranches =
          await fetchUserBranches(
            profile.id,
            profile
          )

        if (runId !== authRunRef.current) {
          return
        }

        if (accessibleBranches.length === 0) {
          setUser(profile)
          setCurrentBranch(null)
          setDataLoaded(true)
          bootstrappedAuthUidRef.current = authUid

          showToast(
            'warning',
            'No Branches',
            'You have not been assigned to any branches.'
          )

          return
        }

        const selectedBranch =
          accessibleBranches.find(
            (branch) =>
              branch.id === profile.branch_id
          ) ||
          accessibleBranches[0]

        const sessionUser =
          profile.role === 'Master'
            ? {
                ...profile,
                branch_id: selectedBranch.id,
                branch_name: selectedBranch.name,
              }
            : profile

        setUser(sessionUser)
        setCurrentBranch(selectedBranch)
        bootstrappedAuthUidRef.current = authUid

        await loadBranchData(
          selectedBranch.id
        )
      } catch (error) {
        console.error(
          '[Auth] Initialization error:',
          error
        )

        if (runId === authRunRef.current) {
          setAuthError(
            error?.message ||
              'Authentication initialization failed.'
          )

          setUser(null)
          bootstrappedAuthUidRef.current = null
        }
      } finally {
        if (runId === authRunRef.current) {
          setAuthReady(true)
        }
      }
    },
    [
      clearData,
      fetchUserBranches,
      loadBranchData,
      loadUserRole,
      showToast,
    ]
  )

  useEffect(() => {
    initializeSessionRef.current = initializeSession
  }, [initializeSession])

  useEffect(() => {
    let mounted = true

    /*
     * Single auth subscription. Do NOT also call getSession() here.
     * getSession() triggers token refresh when the access token is inside
     * EXPIRY_MARGIN; combining that with TOKEN_REFRESHED → initializeSession
     * (and Realtime's own getSession) produced the refresh_token 429 loop:
     *   refresh → notify → app work → getSession → refresh → ...
     *
     * INITIAL_SESSION covers bootstrap after GoTrue finishes recovery.
     */
    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (event, session) => {
          if (!mounted) return

          if (event === 'INITIAL_SESSION') {
            window.setTimeout(() => {
              if (mounted) {
                void initializeSessionRef.current?.(
                  session,
                  { force: true }
                )
              }
            }, 0)
            return
          }

          if (event === 'SIGNED_IN') {
            window.setTimeout(() => {
              if (mounted) {
                // force:false skips reload when auth uid already bootstrapped
                // (POS password verify also calls signInWithPassword).
                void initializeSessionRef.current?.(
                  session,
                  { force: false }
                )
              }
            }, 0)
            return
          }

          if (event === 'TOKEN_REFRESHED') {
            // Supabase already refreshed the JWT. Do not re-bootstrap the app.
            return
          }

          if (event === 'SIGNED_OUT') {
            authRunRef.current += 1
            bootstrappedAuthUidRef.current = null

            setUser(null)
            setAuthError(null)
            setAuthReady(true)

            clearDataRef.current()
            setTab('dashboard')
          }
        }
      )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  /* ============================================================
     DATABASE NOTIFICATIONS
  ============================================================ */

  useEffect(() => {
    if (!user?.id) {
      setNotifications([])
      return undefined
    }

    let active = true

    const loadNotifications = async () => {
      try {
        const {
          data,
          error,
        } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', {
            ascending: false,
          })
          .limit(50)

        if (!active) return

        if (error) {
          console.error(
            '[Notifications] Load:',
            error
          )
          return
        }

        setNotifications(
          (Array.isArray(data) ? data : []).map(
            (notification) => ({
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
            })
          )
        )
      } catch (error) {
        console.error(
          '[Notifications] Exception:',
          error
        )
      }
    }

    void loadNotifications()

    const intervalId = window.setInterval(
      loadNotifications,
      20000
    )

    const channel = supabase
      .channel(
        `app-notifications-${user.id}`
      )
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

          const notification =
            payload?.new || {}

          setNotifications((previous) => [
            {
              ...notification,

              msg:
                notification.message ||
                notification.msg ||
                '',

              time: 'Just now',
              read: false,
            },
            ...previous,
          ].slice(0, 50))
        }
      )
      .subscribe()

    return () => {
      active = false

      window.clearInterval(intervalId)

      void supabase.removeChannel(channel)
    }
  }, [user?.id])

  /* ============================================================
     REALTIME BRANCH DATA
  ============================================================ */

  useEffect(() => {
    const branchId = currentBranch?.id

    if (!branchId) {
      return undefined
    }

    const channels = []

    const inventoryChannel = supabase
      .channel(
        `inventory-${branchId}`
      )
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

    channels.push(inventoryChannel)

    const transactionChannel = supabase
      .channel(
        `transactions-${branchId}`
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `branch_id=eq.${branchId}`,
        },
        (payload) => {
          const record =
            payload?.new ||
            payload?.old

          if (!record) return

          if (
            payload.eventType === 'INSERT'
          ) {
            setTransactions((previous) => [
              record,
              ...previous,
            ])

            return
          }

          if (
            payload.eventType === 'UPDATE'
          ) {
            setTransactions((previous) =>
              previous.map((transaction) =>
                transaction.id === record.id
                  ? {
                      ...transaction,
                      ...record,
                    }
                  : transaction
              )
            )

            return
          }

          if (
            payload.eventType === 'DELETE'
          ) {
            setTransactions((previous) =>
              previous.filter(
                (transaction) =>
                  transaction.id !== record.id
              )
            )
          }
        }
      )
      .subscribe()

    channels.push(transactionChannel)

    const requestChannel = supabase
      .channel(
        `requests-${branchId}`
      )
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

    channels.push(requestChannel)

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

  /* ============================================================
     ACTION LOCK
  ============================================================ */

  const actionInProgress = useRef(false)

  const withActionLock = useCallback(
    async (callback) => {
      if (actionInProgress.current) {
        showToast(
          'info',
          'Please wait',
          'An operation is already in progress.'
        )

        return {
          locked: true,
          success: false,
        }
      }

      actionInProgress.current = true

      try {
        const result = await callback()

        return {
          locked: false,
          ...(result || {}),
        }
      } catch (error) {
        console.error(
          '[ActionLock]',
          error
        )

        return {
          locked: false,
          success: false,
          error,
        }
      } finally {
        actionInProgress.current = false
      }
    },
    [showToast]
  )

  /* ============================================================
     STOCK IN
  ============================================================ */

  const handleStockIn = useCallback(
    async (formData = {}) => {
      const branchId = getBranchId(user)

      if (!branchId) {
        showToast(
          'error',
          'Branch Error',
          'No branch is assigned to your account.'
        )

        return {
          success: false,
        }
      }

      return withActionLock(async () => {
        const {
          data,
          error,
        } =
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

        if (data) {
          setTransactions((previous) => [
            data,
            ...previous,
          ])
        }

        await fetchInventory(branchId)

        await createNotification({
          type: 'stock_in',
          title: 'Stock IN',
          message: `${formData.qty || 0} ${
            formData.unit || ''
          } of ${formData.item || 'item'}`,
        })

        await createActivityLog({
          action: 'STOCK_IN',
          description: `Stock IN: ${
            formData.item || 'Item'
          }`,
          metadata: {
            quantity: formData.qty,
            unit: formData.unit,
            item: formData.item,
          },
        })

        showToast(
          'success',
          'Stock IN Recorded',
          `${formData.item || 'Item'} — ${
            formData.qty || 0
          } ${formData.unit || ''}`
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
      fetchInventory,
      createNotification,
      createActivityLog,
      showToast,
    ]
  )

  /* ============================================================
     STOCK OUT
  ============================================================ */

  const handleStockOut = useCallback(
    async (formData = {}) => {
      const branchId = getBranchId(user)

      if (!branchId) {
        showToast(
          'error',
          'Branch Error',
          'No branch is assigned to your account.'
        )

        return {
          success: false,
        }
      }

      return withActionLock(async () => {
        const {
          data,
          error,
        } =
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

        if (data) {
          setTransactions((previous) => [
            data,
            ...previous,
          ])
        }

        await fetchInventory(branchId)

        await createNotification({
          type: 'stock_out',
          title:
            formData.type ||
            'Stock OUT',
          message: `${formData.qty || 0} ${
            formData.unit || ''
          } of ${formData.item || 'item'}`,
        })

        await createActivityLog({
          action:
            formData.type === 'Wastage'
              ? 'WASTAGE'
              : 'STOCK_OUT',
          description: `${
            formData.type || 'Stock OUT'
          }: ${formData.item || 'Item'}`,
          metadata: {
            quantity: formData.qty,
            unit: formData.unit,
            item: formData.item,
          },
        })

        showToast(
          'success',
          `${
            formData.type || 'Stock OUT'
          } Recorded`,
          `${formData.item || 'Item'} — ${
            formData.qty || 0
          } ${formData.unit || ''}`
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
      fetchInventory,
      createNotification,
      createActivityLog,
      showToast,
    ]
  )

  /* ============================================================
     REQUESTS
  ============================================================ */

  const createRequest = useCallback(
    async ({
      department,
      notes,
      items = [],
    } = {}) => {
      const branchId = getBranchId(user)

      if (!branchId) {
        showToast(
          'error',
          'Branch Error',
          'No branch is assigned.'
        )

        return {
          success: false,
          error: new Error('No branch assigned'),
        }
      }

      if (!Array.isArray(items) || items.length === 0) {
        showToast(
          'error',
          'Invalid Request',
          'Please add at least one item.'
        )

        return {
          success: false,
          error: new Error(
            'No request items provided'
          ),
        }
      }

      try {
        const {
          data: request,
          error: requestError,
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

        if (requestError) {
          throw requestError
        }

        const requestItems = items.map(
          (item) => ({
            request_id: request.id,
            name: item.name,
            category: item.category,
            unit: item.unit,
            qty: Number(item.qty) || 0,
            notes: item.notes || null,
          })
        )

        const {
          error: itemsError,
        } = await supabase
          .from('request_items')
          .insert(requestItems)

        if (itemsError) {
          /*
           * Remove the parent request if item insertion fails.
           * This keeps the database cleaner.
           */
          await supabase
            .from('requests')
            .delete()
            .eq('id', request.id)

          throw itemsError
        }

        await createNotification({
          type: 'request_created',
          title: 'New Request',
          message: `${department || 'Department'} requested ${items.length} item(s).`,
          link: '/requests',
        })

        await createActivityLog({
          action: 'REQUEST_CREATED',
          description: `${
            department || 'Department'
          } created a request with ${
            items.length
          } item(s).`,
          metadata: {
            department,
            itemCount: items.length,
            requestId: request.id,
          },
        })

        await fetchRequests(branchId)

        return {
          success: true,
          data: request,
        }
      } catch (error) {
        console.error(
          '[Request] Create:',
          error
        )

        showToast(
          'error',
          'Create Failed',
          error?.message ||
            'Could not create request.'
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
      createNotification,
      createActivityLog,
      fetchRequests,
      showToast,
    ]
  )

  const updateRequestStatus = useCallback(
    async (
      id,
      status
    ) => {
      if (!id) {
        return {
          success: false,
          error: new Error(
            'Request ID is required'
          ),
        }
      }

      try {
        const update = {
          status,
        }

        if (
          status === 'Approved' ||
          status === 'Rejected'
        ) {
          update.approved_by = user?.id
          update.approved_by_name =
            user?.name ||
            user?.full_name ||
            'Unknown'
          update.approved_at =
            new Date().toISOString()
        }

        if (status === 'Completed') {
          update.completed_at =
            new Date().toISOString()
        }

        const { error } =
          await supabase
            .from('requests')
            .update(update)
            .eq('id', id)

        if (error) throw error

        await fetchRequests(
          getBranchId(user)
        )

        return {
          success: true,
        }
      } catch (error) {
        console.error(
          '[Request] Status update:',
          error
        )

        showToast(
          'error',
          'Update Failed',
          error?.message ||
            'Could not update request.'
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
      fetchRequests,
      showToast,
    ]
  )

  const approveRequest = useCallback(
    (id) =>
      updateRequestStatus(
        id,
        'Approved'
      ),
    [updateRequestStatus]
  )

  const rejectRequest = useCallback(
    (id) =>
      updateRequestStatus(
        id,
        'Rejected'
      ),
    [updateRequestStatus]
  )

  /* ============================================================
     FULFILL REQUEST
  ============================================================ */

  const fulfillRequest = useCallback(
    async (id) => {
      const branchId = getBranchId(user)

      if (!branchId) {
        return {
          success: false,
          error: new Error(
            'No branch assigned'
          ),
        }
      }

      try {
        const {
          data: request,
          error,
        } = await supabase
          .from('requests')
          .select(`
            *,
            request_items (*)
          `)
          .eq('id', id)
          .eq('branch_id', branchId)
          .single()

        if (error) throw error

        const items =
          request?.request_items || []

        if (items.length === 0) {
          throw new Error(
            'No items found on this request.'
          )
        }

        for (const item of items) {
          const quantity =
            Number(item.qty) || 0

          const fulfilled =
            Number(
              item.fulfilled_qty || 0
            )

          const remaining = Math.max(
            0,
            quantity - fulfilled
          )

          if (remaining <= 0) {
            continue
          }

          const {
            data: transaction,
            error: stockError,
          } =
            await transactionsApi.stockOut({
              item: item.name,
              qty: remaining,
              unit:
                item.unit || 'pcs',
              type: 'Fulfillment',
              notes: `Fulfilled request from ${
                request.department ||
                'department'
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
              `Failed to deduct ${
                item.name
              }: ${stockError.message}`
            )
          }

          if (transaction) {
            setTransactions(
              (previous) => [
                transaction,
                ...previous,
              ]
            )
          }

          const {
            error: itemError,
          } = await supabase
            .from('request_items')
            .update({
              fulfilled_qty: quantity,
            })
            .eq('id', item.id)

          if (itemError) {
            throw new Error(
              `Failed to update ${
                item.name
              }: ${itemError.message}`
            )
          }
        }

        const { error: requestError } =
          await supabase
            .from('requests')
            .update({
              status: 'Completed',
              completed_at:
                new Date().toISOString(),
            })
            .eq('id', id)
            .eq('branch_id', branchId)

        if (requestError) {
          throw requestError
        }

        await createNotification({
          type: 'request_fulfilled',
          title: 'Request Fulfilled',
          message:
            'Request has been fulfilled and inventory updated.',
          link: '/requests',
        })

        await createActivityLog({
          action: 'REQUEST_FULFILLED',
          description:
            'Request was fulfilled and inventory updated.',
          metadata: {
            requestId: id,
          },
        })

        await Promise.all([
          fetchRequests(branchId),
          fetchInventory(branchId),
        ])

        showToast(
          'success',
          'Request Fulfilled',
          'Inventory has been updated.'
        )

        return {
          success: true,
        }
      } catch (error) {
        console.error(
          '[Request] Fulfill:',
          error
        )

        showToast(
          'error',
          'Fulfill Failed',
          error?.message ||
            'Could not fulfill request.'
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
      fetchRequests,
      fetchInventory,
      createNotification,
      createActivityLog,
      showToast,
    ]
  )

  /* ============================================================
     PARTIAL FULFILLMENT
  ============================================================ */

  const partialFulfillRequest =
    useCallback(
      async (
        id,
        fulfilledItems = []
      ) => {
        const branchId =
          getBranchId(user)

        if (!branchId) {
          return {
            success: false,
            error: new Error(
              'No branch assigned'
            ),
          }
        }

        if (
          !Array.isArray(
            fulfilledItems
          ) ||
          fulfilledItems.length === 0
        ) {
          showToast(
            'error',
            'Invalid Fulfillment',
            'No fulfilled items were provided.'
          )

          return {
            success: false,
          }
        }

        try {
          const {
            data: request,
            error,
          } = await supabase
            .from('requests')
            .select(`
              *,
              request_items (*)
            `)
            .eq('id', id)
            .eq('branch_id', branchId)
            .single()

          if (error) throw error

          const requestItems =
            request.request_items || []

          for (const entry of fulfilledItems) {
            const item = requestItems.find(
              (requestItem) =>
                requestItem.id ===
                entry.itemId
            )

            if (!item) {
              throw new Error(
                'Request item not found.'
              )
            }

            const qty =
              Number(entry.qty) || 0

            if (qty <= 0) continue

            const currentFulfilled =
              Number(
                item.fulfilled_qty || 0
              )

            const requestedQty =
              Number(item.qty) || 0

            const remaining =
              Math.max(
                0,
                requestedQty -
                  currentFulfilled
              )

            if (qty > remaining) {
              throw new Error(
                `Fulfillment quantity for ${item.name} exceeds the remaining quantity.`
              )
            }

            const {
              data: transaction,
              error: stockError,
            } =
              await transactionsApi.stockOut({
                item: item.name,
                qty,
                unit:
                  item.unit || 'pcs',
                type: 'Fulfillment',
                notes: `Partially fulfilled request from ${
                  request.department ||
                  'department'
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
                `Failed to deduct ${
                  item.name
                }: ${stockError.message}`
              )
            }

            if (transaction) {
              setTransactions(
                (previous) => [
                  transaction,
                  ...previous,
                ]
              )
            }

            await supabase
              .from('request_items')
              .update({
                fulfilled_qty:
                  currentFulfilled +
                  qty,
              })
              .eq('id', item.id)
          }

          /*
           * Re-fetch request after updates so completion
           * is calculated from actual database values.
           */
          const {
            data: refreshedRequest,
            error: refreshError,
          } = await supabase
            .from('requests')
            .select(`
              *,
              request_items (*)
            `)
            .eq('id', id)
            .eq('branch_id', branchId)
            .single()

          if (refreshError) {
            throw refreshError
          }

          const allFulfilled = (
            refreshedRequest.request_items ||
            []
          ).every(
            (item) =>
              Number(
                item.fulfilled_qty || 0
              ) >=
              Number(item.qty || 0)
          )

          const status = allFulfilled
            ? 'Completed'
            : 'Partially Fulfilled'

          const {
            error: updateError,
          } = await supabase
            .from('requests')
            .update({
              status,
              completed_at:
                allFulfilled
                  ? new Date().toISOString()
                  : null,
            })
            .eq('id', id)
            .eq('branch_id', branchId)

          if (updateError) {
            throw updateError
          }

          await createNotification({
            type: 'request_partial',
            title: allFulfilled
              ? 'Request Fulfilled'
              : 'Request Partially Fulfilled',
            message: allFulfilled
              ? 'Request has been fully fulfilled.'
              : 'Request has been partially fulfilled.',
            link: '/requests',
          })

          await createActivityLog({
            action: allFulfilled
              ? 'REQUEST_FULFILLED'
              : 'REQUEST_PARTIAL',
            description:
              allFulfilled
                ? 'Request fulfilled.'
                : 'Request partially fulfilled.',
            metadata: {
              requestId: id,
            },
          })

          await Promise.all([
            fetchRequests(branchId),
            fetchInventory(branchId),
          ])

          showToast(
            'success',
            allFulfilled
              ? 'Request Fulfilled'
              : 'Partially Fulfilled',
            'Inventory has been updated.'
          )

          return {
            success: true,
          }
        } catch (error) {
          console.error(
            '[Request] Partial fulfillment:',
            error
          )

          showToast(
            'error',
            'Fulfillment Failed',
            error?.message ||
              'Could not fulfill request.'
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
        fetchRequests,
        fetchInventory,
        createNotification,
        createActivityLog,
        showToast,
      ]
    )

  /* ============================================================
     DELETE REQUEST
  ============================================================ */

  const deleteRequest = useCallback(
    async (id) => {
      const branchId =
        getBranchId(user)

      if (!branchId) {
        return {
          success: false,
          error: new Error(
            'No branch assigned'
          ),
        }
      }

      try {
        const { error } =
          await supabase
            .from('requests')
            .delete()
            .eq('id', id)
            .eq('branch_id', branchId)

        if (error) throw error

        await fetchRequests(branchId)

        showToast(
          'success',
          'Request Deleted',
          'The request was deleted successfully.'
        )

        return {
          success: true,
        }
      } catch (error) {
        console.error(
          '[Request] Delete:',
          error
        )

        showToast(
          'error',
          'Delete Failed',
          error?.message ||
            'Could not delete request.'
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
      fetchRequests,
      showToast,
    ]
  )

  /* ============================================================
     TEMPLATES
  ============================================================ */

  const createTemplate = useCallback(
    async (template) => {
      try {
        const {
          data,
          error,
        } =
          await templatesApi.create({
            ...template,
            branch_id:
              getBranchId(user),
            created_by: user?.id,
          })

        if (error) throw error

        if (data) {
          setTemplates((previous) => [
            ...previous,
            data,
          ])
        }

        return data
      } catch (error) {
        showToast(
          'error',
          'Template Failed',
          error?.message ||
            'Could not create template.'
        )

        return null
      }
    },
    [
      user,
      getBranchId,
      showToast,
    ]
  )

  const updateTemplate = useCallback(
    async (id, updates) => {
      try {
        const {
          data,
          error,
        } =
          await templatesApi.update(
            id,
            updates
          )

        if (error) throw error

        setTemplates((previous) =>
          previous.map((template) =>
            template.id === id
              ? {
                  ...template,
                  ...data,
                }
              : template
          )
        )

        return data
      } catch (error) {
        showToast(
          'error',
          'Template Failed',
          error?.message ||
            'Could not update template.'
        )

        return null
      }
    },
    [showToast]
  )

  const deleteTemplate = useCallback(
    async (id) => {
      try {
        const { error } =
          await templatesApi.remove(id)

        if (error) throw error

        setTemplates((previous) =>
          previous.filter(
            (template) =>
              template.id !== id
          )
        )

        return {
          success: true,
        }
      } catch (error) {
        showToast(
          'error',
          'Template Failed',
          error?.message ||
            'Could not delete template.'
        )

        return {
          success: false,
          error,
        }
      }
    },
    [showToast]
  )

  /* ============================================================
     SUPPLIERS
  ============================================================ */

  const createSupplier = useCallback(
    async (supplier) => {
      try {
        const {
          data,
          error,
        } =
          await suppliersApi.create({
            ...supplier,
            branch_id:
              getBranchId(user),
          })

        if (error) throw error

        if (data) {
          setSuppliers((previous) => [
            ...previous,
            data,
          ])
        }

        return data
      } catch (error) {
        showToast(
          'error',
          'Supplier Failed',
          error?.message ||
            'Could not create supplier.'
        )

        return null
      }
    },
    [
      user,
      getBranchId,
      showToast,
    ]
  )

  const updateSupplier = useCallback(
    async (id, updates) => {
      try {
        const {
          data,
          error,
        } =
          await suppliersApi.update(
            id,
            updates
          )

        if (error) throw error

        setSuppliers((previous) =>
          previous.map((supplier) =>
            supplier.id === id
              ? {
                  ...supplier,
                  ...data,
                }
              : supplier
          )
        )

        return data
      } catch (error) {
        showToast(
          'error',
          'Supplier Failed',
          error?.message ||
            'Could not update supplier.'
        )

        return null
      }
    },
    [showToast]
  )

  const deleteSupplier = useCallback(
    async (id) => {
      try {
        const { error } =
          await suppliersApi.remove(id)

        if (error) throw error

        setSuppliers((previous) =>
          previous.filter(
            (supplier) =>
              supplier.id !== id
          )
        )

        return {
          success: true,
        }
      } catch (error) {
        showToast(
          'error',
          'Supplier Failed',
          error?.message ||
            'Could not delete supplier.'
        )

        return {
          success: false,
          error,
        }
      }
    },
    [showToast]
  )

  /* ============================================================
     USERS
  ============================================================ */

  const createUser = useCallback(
    async (userData) => {
      try {
        const payload = {
          ...userData,
          branch_id:
            getBranchId(user),
        }

        const {
          data,
          error,
        } =
          await usersApi.create(payload)

        if (error) throw error

        if (data) {
          setUsers((previous) => [
            ...previous,
            data,
          ])
        }

        return data
      } catch (error) {
        showToast(
          'error',
          'User Creation Failed',
          error?.message ||
            'Could not create user.'
        )

        return null
      }
    },
    [
      user,
      getBranchId,
      showToast,
    ]
  )

  const updateUser = useCallback(
    async (id, updates) => {
      try {
        const {
          data,
          error,
        } =
          await usersApi.update(
            id,
            updates
          )

        if (error) throw error

        setUsers((previous) =>
          previous.map(
            (existingUser) =>
              existingUser.id === id
                ? {
                    ...existingUser,
                    ...data,
                  }
                : existingUser
          )
        )

        return data
      } catch (error) {
        showToast(
          'error',
          'User Update Failed',
          error?.message ||
            'Could not update user.'
        )

        return null
      }
    },
    [showToast]
  )

  const deleteUser = useCallback(
    async (id) => {
      try {
        const { error } =
          await usersApi.remove(id)

        if (error) throw error

        setUsers((previous) =>
          previous.filter(
            (existingUser) =>
              existingUser.id !== id
          )
        )

        return {
          success: true,
        }
      } catch (error) {
        showToast(
          'error',
          'User Delete Failed',
          error?.message ||
            'Could not delete user.'
        )

        return {
          success: false,
          error,
        }
      }
    },
    [showToast]
  )

  /* ============================================================
     CATEGORIES
  ============================================================ */

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

        setCategories((previous) => [
          ...previous,
          data,
        ])

        showToast(
          'success',
          'Category Created',
          data?.name || ''
        )

        return data
      } catch (error) {
        showToast(
          'error',
          'Category Failed',
          error?.message ||
            'Could not create category.'
        )

        return null
      }
    },
    [
      user,
      getBranchId,
      showToast,
    ]
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

        setCategories((previous) =>
          previous.map((category) =>
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
          data?.name || ''
        )

        return data
      } catch (error) {
        showToast(
          'error',
          'Category Failed',
          error?.message ||
            'Could not update category.'
        )

        return null
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

        setCategories((previous) =>
          previous.filter(
            (category) =>
              category.id !== id
          )
        )

        showToast(
          'success',
          'Category Deleted',
          ''
        )

        return {
          success: true,
        }
      } catch (error) {
        showToast(
          'error',
          'Category Failed',
          error?.message ||
            'Could not delete category.'
        )

        return {
          success: false,
          error,
        }
      }
    },
    [showToast]
  )

  /* ============================================================
     PROCUREMENT
  ============================================================ */

  const createProcurement = useCallback(
    async (request) => {
      try {
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

        if (error) throw error

        if (data) {
          setProcurements(
            (previous) => [
              data,
              ...previous,
            ]
          )
        }

        return data
      } catch (error) {
        showToast(
          'error',
          'Procurement Failed',
          error?.message ||
            'Could not create procurement.'
        )

        return null
      }
    },
    [
      user,
      getBranchId,
      showToast,
    ]
  )

  const updateProcurementStatus =
    useCallback(
      async (id, status) => {
        try {
          const {
            data,
            error,
          } =
            await procurementApi.updateStatus(
              id,
              status,
              user?.id
            )

          if (error) throw error

          setProcurements((previous) =>
            previous.map(
              (procurement) =>
                procurement.id === id
                  ? {
                      ...procurement,
                      ...data,
                    }
                  : procurement
            )
          )

          return data
        } catch (error) {
          showToast(
            'error',
            'Procurement Failed',
            error?.message ||
              'Could not update procurement.'
          )

          return null
        }
      },
      [user, showToast]
    )

  const deleteProcurement = useCallback(
    async (id) => {
      try {
        const { error } =
          await procurementApi.remove(id)

        if (error) throw error

        setProcurements((previous) =>
          previous.filter(
            (procurement) =>
              procurement.id !== id
          )
        )

        return {
          success: true,
        }
      } catch (error) {
        showToast(
          'error',
          'Procurement Failed',
          error?.message ||
            'Could not delete procurement.'
        )

        return {
          success: false,
          error,
        }
      }
    },
    [showToast]
  )

  /* ============================================================
     PURCHASE ORDERS
  ============================================================ */

  const createPurchaseOrder =
    useCallback(
      async ({ po, items = [] }) => {
        try {
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

          if (error) throw error

          if (data) {
            setPurchaseOrders(
              (previous) => [
                data,
                ...previous,
              ]
            )
          }

          return data
        } catch (error) {
          showToast(
            'error',
            'Purchase Order Failed',
            error?.message ||
              'Could not create purchase order.'
          )

          return null
        }
      },
      [
        user,
        getBranchId,
        showToast,
      ]
    )

  const updatePOStatus = useCallback(
    async (id, status) => {
      try {
        const {
          data,
          error,
        } =
          await purchaseOrdersApi.updateStatus(
            id,
            status,
            user?.id
          )

        if (error) throw error

        setPurchaseOrders((previous) =>
          previous.map((po) =>
            po.id === id
              ? {
                  ...po,
                  ...data,
                }
              : po
          )
        )

        return data
      } catch (error) {
        showToast(
          'error',
          'Purchase Order Failed',
          error?.message ||
            'Could not update purchase order.'
        )

        return null
      }
    },
    [user, showToast]
  )

  /* ============================================================
     FINANCIAL
  ============================================================ */

  const updateFinancialTxnStatus =
    useCallback(
      async (
        id,
        paymentStatus
      ) => {
        try {
          const {
            data,
            error,
          } =
            await financialApi.updatePaymentStatus(
              id,
              paymentStatus
            )

          if (error) throw error

          setFinancialTransactions(
            (previous) =>
              previous.map(
                (transaction) =>
                  transaction.id === id
                    ? {
                        ...transaction,
                        ...data,
                      }
                    : transaction
              )
          )

          return data
        } catch (error) {
          showToast(
            'error',
            'Financial Update Failed',
            error?.message ||
              'Could not update payment status.'
          )

          return null
        }
      },
      [showToast]
    )

  /* ============================================================
     LOGIN
  ============================================================ */

  const login = useCallback(
    async (
      email,
      password
    ) => {
      setAuthError(null)

      try {
        const {
          data,
          error,
        } = await authApi.login(
          email,
          password
        )

        if (error) {
          setAuthError(
            error.message ||
              'Login failed.'
          )

          return {
            error,
          }
        }

        /*
         * Do not manually load all branch data here.
         * Supabase SIGNED_IN will trigger initializeSession() once.
         * authApi.login must not call setSession() (duplicate auth events).
         */
        return {
          data,
        }
      } catch (error) {
        console.error(
          '[Auth] Login exception:',
          error
        )

        setAuthError(
          error?.message ||
            'Login failed.'
        )

        return {
          error,
        }
      }
    },
    []
  )

  /* ============================================================
     LOGOUT
  ============================================================ */

  const logout = useCallback(
    async () => {
      try {
        const { error } =
          await authApi.logout()

        /*
         * Clear UI immediately.
         * SIGNED_OUT will also run clearData().
         */
        authRunRef.current += 1

        setUser(null)
        setUserRole(null)
        setCurrentBranch(null)
        setBranches([])
        setAuthError(null)
        setAuthReady(true)

        clearData()

        setTab('dashboard')

        if (error) {
          console.error(
            '[Auth] Logout:',
            error
          )

          return {
            success: false,
            error,
          }
        }

        return {
          success: true,
        }
      } catch (error) {
        console.error(
          '[Auth] Logout exception:',
          error
        )

        return {
          success: false,
          error,
        }
      }
    },
    [clearData]
  )

  /* ============================================================
     STATS
  ============================================================ */

  const stats = useMemo(() => {
    const safeInventory =
      Array.isArray(inventory)
        ? inventory
        : EMPTY_ARRAY

    const safeTransactions =
      Array.isArray(transactions)
        ? transactions
        : EMPTY_ARRAY

    const safeSuppliers =
      Array.isArray(suppliers)
        ? suppliers
        : EMPTY_ARRAY

    const lowStock =
      safeInventory.filter((item) => {
        const quantity =
          Number(item?.quantity) || 0

        const threshold =
          Number(
            item?.min_threshold ??
              item?.min_stock ??
              item?.threshold ??
              0
          )

        return (
          threshold > 0 &&
          quantity <= threshold
        )
      })

    const critical =
      safeInventory.filter(
        (item) =>
          (Number(item?.quantity) ||
            0) <= 0
      )

    const stockInTotal =
      safeTransactions
        .filter(
          (transaction) =>
            transaction?.type ===
            'Stock IN'
        )
        .reduce(
          (total, transaction) =>
            total +
            Math.abs(
              Number(
                transaction?.quantity ??
                  transaction?.qty ??
                  0
              )
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
            transaction?.type
          )
        )
        .reduce(
          (total, transaction) =>
            total +
            Math.abs(
              Number(
                transaction?.quantity ??
                  transaction?.qty ??
                  0
              )
            ),
          0
        )

    const inventoryValue =
      safeInventory.reduce(
        (total, item) => {
          const quantity =
            Number(item?.quantity) || 0

          const price =
            Number(
              item?.cost ??
                item?.price ??
                0
            ) || 0

          return (
            total +
            quantity * price
          )
        },
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

  /* ============================================================
     CONTEXT VALUE
  ============================================================ */

  const value = useMemo(
    () => ({
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

      /* Stock */
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

      /* Notifications */
      createNotification,
      createActivityLog,

      /* Templates */
      createTemplate,
      updateTemplate,
      deleteTemplate,

      /* Suppliers */
      createSupplier,
      updateSupplier,
      deleteSupplier,

      /* Users */
      createUser,
      updateUser,
      deleteUser,

      /* Procurement */
      createProcurement,
      updateProcurementStatus,
      deleteProcurement,

      /* Purchase Orders */
      createPurchaseOrder,
      updatePOStatus,

      /* Financial */
      updateFinancialTxnStatus,

      /* Utilities */
      withActionLock,
      loadAllData,

      /* Branch */
      currentBranch,
      branches,
      switchBranch,
      isLoadingBranchData,

      /* RBAC */
      userRole,

      isAdmin: () =>
        isAdmin(userRole),

      isManager: () =>
        isManager(userRole),

      isChief: () =>
        isChief(userRole),

      isStoreKeeper: () =>
        isStoreKeeper(userRole),

      isDeveloper: () =>
        isDeveloper(userRole),

      isMaster: () =>
        isMaster(userRole),

      hasRole: (role) =>
        hasRole(
          userRole,
          role
        ),

      hasAnyRole: (roles) =>
        hasAnyRole(
          userRole,
          roles
        ),

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
    }),
    [
      user,
      login,
      logout,
      authReady,
      authError,

      dark,
      theme,

      tab,
      sidebarOpen,

      loading,
      dataLoaded,

      toasts,
      showToast,
      dismissToast,

      notifications,
      addNotification,
      markAllRead,

      systemEnabled,
      systemMsg,

      transactions,
      requests,
      inventory,
      templates,
      suppliers,
      users,
      procurements,
      purchaseOrders,
      financialTransactions,
      activityLogs,

      stats,

      customUnits,
      allUnits,

      categories,
      fetchCategories,
      createCategory,
      updateCategory,
      deleteCategory,

      handleStockIn,
      handleStockOut,

      createRequest,
      approveRequest,
      rejectRequest,
      fulfillRequest,
      partialFulfillRequest,
      deleteRequest,
      fetchRequests,

      createNotification,
      createActivityLog,

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

      withActionLock,
      loadAllData,

      currentBranch,
      branches,
      switchBranch,
      isLoadingBranchData,

      userRole,
    ]
  )

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  )
}
