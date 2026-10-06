import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, CopyIcon, EyeIcon, EyeOffIcon, KeyRoundIcon } from 'lucide-react'
import { StatusBadge, type StatusTone } from './components/StatusBadge'
import {
  buildPublicEventsUrl,
  createBrowserTodayWindow,
  fetchPublicMetrics,
  fetchProfile,
  fetchSummary,
  fetchTokenMetrics,
  fetchUserToken,
  fetchPublicLogs,
  millisecondsUntilNextBrowserDayBoundary,
  type Profile,
  type PublicMetrics,
  type Summary,
  type TokenMetrics,
  type PublicTokenLog,
} from './api'
import LanguageSwitcher from './components/LanguageSwitcher'
import OfflineStatusBanner from './components/OfflineStatusBanner'
import ThemeToggle from './components/ThemeToggle'
import UpdateAvailableBanner from './components/UpdateAvailableBanner'
import useUpdateAvailable from './hooks/useUpdateAvailable'
import PublicHomeFooter from './components/PublicHomeFooter'
import PublicHomeHeroCard from './components/PublicHomeHeroCard'
import TokenSecretField from './components/TokenSecretField'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLanguage, useTranslate, type Language } from './i18n'
import { copyText, selectAllReadonlyText } from './lib/clipboard'
import { useOfflineState } from './pwa/useOfflineState'

type GuideLanguage = 'toml' | 'json' | 'bash'

type GuideKey = 'codex' | 'hikariCli' | 'claude' | 'vscode' | 'claudeDesktop' | 'cursor' | 'windsurf' | 'cherryStudio' | 'other'

interface GuideReference {
  label: string
  url: string
}

interface GuideSample {
  title: string
  language?: GuideLanguage
  snippet: string
  reference?: GuideReference
}

interface GuideContent {
  title: string
  steps: ReactNode[]
  sampleTitle?: string
  snippetLanguage?: GuideLanguage
  snippet?: string
  reference?: GuideReference
  samples?: GuideSample[]
}

const CODEX_DOC_URL = 'https://github.com/openai/codex/blob/main/docs/config.md'
const CLAUDE_DOC_URL = 'https://code.claude.com/docs/en/mcp'
const MCP_SPEC_URL = 'https://modelcontextprotocol.io/introduction'
const TAVILY_SEARCH_DOC_URL = 'https://docs.tavily.com/documentation/api-reference/endpoint/search'
const VSCODE_DOC_URL = 'https://code.visualstudio.com/docs/copilot/customization/mcp-servers'
const NOCODB_DOC_URL = 'https://nocodb.com/docs/product-docs/mcp'
const REPO_URL = 'https://github.com/IvanLi-CN/tavily-hikari'
const STORAGE_LAST_TOKEN = 'tavily-hikari-last-token'
const STORAGE_TOKEN_MAP = 'tavily-hikari-token-map'
// Keep in sync with backend constants in src/lib.rs
const TOKEN_HOURLY_LIMIT = 100
const TOKEN_DAILY_LIMIT = 500
const TOKEN_MONTHLY_LIMIT = 5000

const GUIDE_KEY_ORDER: GuideKey[] = [
  'codex',
  'hikariCli',
  'claude',
  'vscode',
  'claudeDesktop',
  'cursor',
  'windsurf',
  'cherryStudio',
  'other',
]

const numberFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
})

function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

function PublicHome(): React.JSX.Element {
  // No default token on public page. Start empty.
  const strings = useTranslate()
  const publicStrings = strings.public
  const { language } = useLanguage()
  const [token, setToken] = useState('')
  const [tokenDraft, setTokenDraft] = useState('')
  const [tokenVisible, setTokenVisible] = useState(false)
  const [isTokenAccessDialogOpen, setIsTokenAccessDialogOpen] = useState(false)
  const [metrics, setMetrics] = useState<PublicMetrics | null>(null)
  const [tokenMetrics, setTokenMetrics] = useState<TokenMetrics | null>(null)
  const [publicLogs, setPublicLogs] = useState<PublicTokenLog[]>([])
  const [expandedPublicLogs, setExpandedPublicLogs] = useState<Set<number>>(() => new Set())
  const [publicLogsLoading, setPublicLogsLoading] = useState(false)
  const [invalidToken, setInvalidToken] = useState(false)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileUnavailable, setProfileUnavailable] = useState(false)
  const [activeGuide, setActiveGuide] = useState<GuideKey>('codex')
  const [revealedGuideToken, setRevealedGuideToken] = useState<string | null>(null)
  const [guideCopyState, setGuideCopyState] = useState<Record<string, 'idle' | 'copied' | 'error'>>({})
  const updateBanner = useUpdateAvailable()
  const offline = useOfflineState()
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle')
  const pageRef = useRef<HTMLElement>(null)
  const accessTokenFieldRef = useRef<HTMLInputElement | null>(null)
  const accessTokenModalFieldRef = useRef<HTMLInputElement | null>(null)
  const [recentTokenUsage, setRecentTokenUsage] = useState<TokenMetrics | null>(null)
  const [userTokenHydrationDone, setUserTokenHydrationDone] = useState(false)
  const [todayWindow, setTodayWindow] = useState(() => createBrowserTodayWindow())

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTodayWindow(createBrowserTodayWindow())
    }, millisecondsUntilNextBrowserDayBoundary())
    return () => window.clearTimeout(timer)
  }, [todayWindow.todayEnd])

  useEffect(() => {
    const controller = new AbortController()
    setProfileLoading(true)
    setProfileUnavailable(false)
    fetchProfile(controller.signal)
      .then((profileResult) => {
        setProfile(profileResult)
        setProfileUnavailable(false)
      })
      .catch((reason: Error & { name?: string }) => {
        if (reason?.name !== 'AbortError') {
          setProfile(null)
          setProfileUnavailable(true)
          setError((prev) => prev ?? publicStrings.errors.profile)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setProfileLoading(false)
        }
      })
    return () => controller.abort()
  }, [publicStrings.errors.profile])

  useEffect(() => {
    const tokenStore = loadTokenMap()
    const lastToken = loadLastToken()

    let initialToken = resolveInitialTokenFromHash(window.location.hash, tokenStore)

    if (!initialToken && lastToken) {
      initialToken = lastToken
    }

    // Do not set any default token when none is provided
    if (initialToken) {
      persistToken(initialToken)
    }

    const controller = new AbortController()
    setMetricsLoading(true)
    setSummaryLoading(true)

    fetchPublicMetrics(todayWindow, controller.signal)
      .then((metricsResult) => {
        setMetrics(metricsResult)
        setError(null)
      })
      .catch((reason: Error & { name?: string }) => {
        if (reason?.name !== 'AbortError') {
          setError(reason instanceof Error ? reason.message : publicStrings.errors.metrics)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setMetricsLoading(false)
        }
      })

    fetchSummary(controller.signal)
      .then((summaryResult) => {
        setSummary(summaryResult)
      })
      .catch((reason: Error & { name?: string }) => {
        if (reason?.name !== 'AbortError') {
          setError((prev) => prev ?? (reason instanceof Error ? reason.message : publicStrings.errors.summary))
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setSummaryLoading(false)
        }
      })

    if (initialToken && isFullToken(initialToken)) {
      setInvalidToken(false)
      fetchTokenMetrics(initialToken, todayWindow, controller.signal)
        .then((tokenMetricsResult) => {
          setTokenMetrics(tokenMetricsResult)
          setRecentTokenUsage(tokenMetricsResult)
          setError(null)
        })
        .catch((reason: Error & { name?: string }) => {
          if (reason?.name !== 'AbortError') {
            setTokenMetrics(null)
            setRecentTokenUsage(null)
          }
        })
      setPublicLogsLoading(true)
      fetchPublicLogs(initialToken, 20, controller.signal)
        .then((ls) => {
          setPublicLogs(ls)
          setInvalidToken(false)
        })
        .catch((err: any) => {
          setPublicLogs([])
          setInvalidToken(Boolean(err?.status) && err.status >= 400 && err.status < 500)
        })
        .finally(() => setPublicLogsLoading(false))
    }
    return () => controller.abort()
  }, [publicStrings.errors.metrics, publicStrings.errors.summary, todayWindow])

  // Realtime metrics via public SSE
  useEffect(() => {
    // build URL with optional token
    const url = buildPublicEventsUrl(token && isFullToken(token) ? token : undefined, todayWindow)
    const es = new EventSource(url)
    const onMetrics = (ev: MessageEvent) => {
      try {
        const data = JSON.parse(ev.data)
        if (data?.public) {
          setMetrics({ monthlySuccess: data.public.monthlySuccess, dailySuccess: data.public.dailySuccess })
        }
        if (data?.token) {
          const next: TokenMetrics = {
            monthlySuccess: data.token.monthlySuccess,
            dailySuccess: data.token.dailySuccess,
            dailyFailure: data.token.dailyFailure,
            quotaHourlyUsed: data.token.quotaHourlyUsed ?? 0,
            quotaHourlyLimit: data.token.quotaHourlyLimit ?? TOKEN_HOURLY_LIMIT,
            quotaDailyUsed: data.token.quotaDailyUsed ?? 0,
            quotaDailyLimit: data.token.quotaDailyLimit ?? TOKEN_DAILY_LIMIT,
            quotaMonthlyUsed: data.token.quotaMonthlyUsed ?? 0,
            quotaMonthlyLimit: data.token.quotaMonthlyLimit ?? TOKEN_MONTHLY_LIMIT,
          }
          setTokenMetrics(next)
          setRecentTokenUsage(next)
        }
      } catch {
        // ignore parse errors
      }
    }
    es.addEventListener('metrics', onMetrics as unknown as EventListener)
    return () => {
      es.removeEventListener('metrics', onMetrics as unknown as EventListener)
      es.close()
    }
  }, [token, todayWindow])

  // Fallback polling: if token metrics not ready or SSE lacks the token segment, refresh periodically
  useEffect(() => {
    if (!token || !isFullToken(token)) return
    let active = true
    const tick = async () => {
      try {
        const tm = await fetchTokenMetrics(token, todayWindow)
        if (!active) return
        setTokenMetrics(tm)
        setRecentTokenUsage(tm)
      } catch {
        // ignore
      }
    }
    tick()
    const id = window.setInterval(tick, 6000)
    return () => {
      active = false
      window.clearInterval(id)
    }
  }, [token, todayWindow])

  const isAdmin = profile?.isAdmin ?? false
  const builtinAuthEnabled = profile?.builtinAuthEnabled ?? false
  const passkeyAuthEnabled = profile?.passkeyAuthEnabled ?? false
  const isLoggedOut = profile?.userLoggedIn === false
  const showAuthStatusLoading = profileLoading
  const showAuthStatusUnavailable = !profileLoading && profileUnavailable
  const showLinuxDoLogin = isLoggedOut
  const showRegistrationPausedNotice = isLoggedOut && profile?.allowRegistration === false
  const hasTokenInfo = token.trim().length > 0
  const canRevealGuideToken = isFullToken(token)
  const guideTokenVisible = shouldRevealPublicGuideToken(token, revealedGuideToken)
  const guideTokenToggleLabel = guideTokenVisible
    ? publicStrings.guide.tokenVisibility.hide
    : publicStrings.guide.tokenVisibility.show
  const hasValidTokenForLogs = isFullToken(token) && !invalidToken
  const tokenMetricsPending = hasValidTokenForLogs && tokenMetrics === null
  const hideTokenPanels = !hasTokenInfo && (showAuthStatusLoading || isLoggedOut)
  const availableKeys = summary?.active_keys ?? null
  const exhaustedKeys = summary?.exhausted_keys ?? null
  const totalKeys = availableKeys != null && exhaustedKeys != null ? availableKeys + exhaustedKeys : null

  const exampleToken = resolvePublicGuideToken(token, publicStrings.accessToken.placeholder, guideTokenVisible)

  const guideDescription = useMemo<GuideContent>(() => {
    const baseUrl = window.location.origin
    const guides = buildGuideContent(language, baseUrl, exampleToken)
    return guides[activeGuide]
  }, [activeGuide, exampleToken, language])

  const guideTabs = useMemo(
    () => GUIDE_KEY_ORDER.map((id) => ({ id, label: publicStrings.guide.tabs[id] ?? id })),
    [publicStrings.guide.tabs],
  )

  const copyGuideSample = useCallback(async (sampleKey: string, snippet: string) => {
    const result = await copyText(guideSnippetToPlainText(snippet))
    setGuideCopyState((previous) => ({
      ...previous,
      [sampleKey]: result.ok ? 'copied' : 'error',
    }))
    window.setTimeout(() => {
      setGuideCopyState((previous) => {
        if (previous[sampleKey] !== (result.ok ? 'copied' : 'error')) return previous
        const next = { ...previous }
        delete next[sampleKey]
        return next
      })
    }, 1600)
  }, [])

  const focusManualTokenField = useCallback(() => {
    window.requestAnimationFrame(() => {
      const target = isTokenAccessDialogOpen ? accessTokenModalFieldRef.current : accessTokenFieldRef.current
      selectAllReadonlyText(target)
    })
  }, [isTokenAccessDialogOpen])

  const handleCopyToken = useCallback(async (value: string) => {
    const normalizedValue = value.trim()
    const result = await copyText(normalizedValue, { preferExecCommand: true })
    if (result.ok) {
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 2500)
      return
    }
    if (normalizedValue.length > 0) {
      if (isTokenAccessDialogOpen) {
        setTokenDraft(normalizedValue)
      } else {
        setToken(normalizedValue)
        setTokenDraft(normalizedValue)
      }
      setTokenVisible(true)
      focusManualTokenField()
    }
    setCopyState('error')
    window.setTimeout(() => setCopyState('idle'), 2500)
  }, [focusManualTokenField, isTokenAccessDialogOpen])

  const startLinuxDoLogin = useCallback((candidateToken?: string) => {
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = '/auth/linuxdo'
    form.style.display = 'none'

    const trimmed = candidateToken?.trim() ?? ''
    if (isFullToken(trimmed)) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = 'token'
      input.value = trimmed
      form.appendChild(input)
    }

    document.body.appendChild(form)
    form.submit()
  }, [])

  const persistToken = useCallback((next: string) => {
    setToken(next)
    const normalizedHash = normalizeTokenHash(next)
    window.location.hash = encodeURIComponent(normalizedHash)

    if (!isFullToken(next)) {
      setTokenMetrics(null)
      setPublicLogs([])
      setInvalidToken(true)
      return
    }
    setInvalidToken(false)

    const tokenId = extractTokenId(next)
    if (!tokenId) return

    const map = loadTokenMap()
    map[tokenId] = next
    saveTokenMap(map)
    try {
      localStorage.setItem(STORAGE_LAST_TOKEN, next)
    } catch {
      /* noop */
    }
    // Fetch token-scoped metrics and recent logs
    void fetchTokenMetrics(next, todayWindow)
      .then((tm) => {
        setTokenMetrics(tm)
        setRecentTokenUsage(tm)
      })
      .catch(() => {
        setTokenMetrics(null)
        setRecentTokenUsage(null)
      })
    setPublicLogsLoading(true)
    void fetchPublicLogs(next, 20)
      .then((ls) => { setPublicLogs(ls); setInvalidToken(false) })
      .catch((err: any) => { setPublicLogs([]); setInvalidToken(Boolean(err?.status) && err.status >= 400 && err.status < 500) })
      .finally(() => setPublicLogsLoading(false))
  }, [todayWindow])

  const openTokenAccessDialog = useCallback(() => {
    setTokenDraft(token)
    // Ensure the modal starts masked and doesn't leak into the main input after confirm.
    setTokenVisible(false)
    setCopyState('idle')
    setIsTokenAccessDialogOpen(true)
  }, [token])

  const closeTokenAccessDialog = useCallback(() => {
    setIsTokenAccessDialogOpen(false)
    setTokenVisible(false)
    setCopyState('idle')
  }, [])

  const confirmTokenAccessDialog = useCallback(() => {
    const next = tokenDraft.trim()
    if (!isFullToken(next)) return
    persistToken(next)
    setIsTokenAccessDialogOpen(false)
    setTokenVisible(false)
    setCopyState('idle')
  }, [persistToken, tokenDraft])

  useEffect(() => {
    if (!profile?.userLoggedIn) {
      setUserTokenHydrationDone(false)
      return
    }
    if (userTokenHydrationDone) return

    const controller = new AbortController()
    fetchUserToken(controller.signal)
      .then(({ token: userToken }) => {
        if (isFullToken(userToken)) {
          persistToken(userToken)
        }
      })
      .catch(() => {
        // Keep manual token entry available when user token lookup fails.
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setUserTokenHydrationDone(true)
        }
      })

    return () => controller.abort()
  }, [profile?.userLoggedIn, persistToken, userTokenHydrationDone])

  const togglePublicLog = useCallback((id: number) => {
    setExpandedPublicLogs((prev) => {
      const copy = new Set(prev)
      if (copy.has(id)) copy.delete(id)
      else copy.add(id)
      return copy
    })
  }, [])

  const formatTimestamp = (ts: number): string => {
    try {
      const d = new Date(ts * 1000)
      return d.toLocaleString()
    } catch {
      return String(ts)
    }
  }

  const statusTone = (status: string): StatusTone => {
    const normalized = status.toLowerCase()
    if (normalized === 'active' || normalized === 'success') return 'success'
    if (normalized === 'exhausted' || normalized === 'quota_exhausted') return 'warning'
    if (normalized === 'error') return 'error'
    return 'neutral'
  }

  const renderLogDetails = (log: PublicTokenLog): React.JSX.Element => (
    <div className="flex flex-col gap-1.5 px-4 py-3 text-sm">
      <div className="flex flex-wrap gap-2">
        <span className="font-medium text-muted-foreground">{publicStrings.logs.details.request}</span>
        <span className="font-mono text-xs leading-5">{`${log.method} ${log.path}${log.query ? `?${log.query}` : ''}`}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="font-medium text-muted-foreground">{publicStrings.logs.details.response}</span>
        <span className="text-xs leading-5">{`${publicStrings.logs.table.httpStatus}: ${log.http_status ?? '—'} · ${publicStrings.logs.table.mcpStatus}: ${log.mcp_status ?? '—'}`}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="font-medium text-muted-foreground">{publicStrings.logs.details.outcome}</span>
        <span className="text-xs leading-5">{log.result_status}</span>
      </div>
      {log.error_message ? (
        <div className="flex flex-wrap gap-2">
          <span className="font-medium text-muted-foreground">{publicStrings.logs.details.error}</span>
          <span className="text-xs leading-5 text-destructive">{log.error_message}</span>
        </div>
      ) : null}
    </div>
  )

  const renderLogsEmptyState = (): React.JSX.Element => {
    if (!hasTokenInfo) {
      return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{publicStrings.logs.empty.noToken}</p>
    }
    if (invalidToken) {
      return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{publicStrings.logs.empty.hint}</p>
    }
    if (publicLogsLoading) {
      return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{publicStrings.logs.empty.loading}</p>
    }
    return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{publicStrings.logs.empty.none}</p>
  }

  return (
    <main ref={pageRef} className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        {updateBanner.visible ? (
          <UpdateAvailableBanner
            strings={publicStrings.updateBanner}
            currentVersion={updateBanner.currentVersion}
            availableVersion={updateBanner.availableVersion}
            status={updateBanner.status}
            loading={updateBanner.loading}
            onUpdate={updateBanner.applyUpdate}
            onDismiss={updateBanner.dismiss}
          />
        ) : null}
        <PublicHomeHeroCard
          publicStrings={publicStrings}
          metrics={metrics}
          availableKeys={availableKeys}
          totalKeys={totalKeys}
          error={error}
          showLinuxDoLogin={showLinuxDoLogin}
          showRegistrationPausedNotice={showRegistrationPausedNotice}
          showTokenAccessButton={hideTokenPanels && !showAuthStatusLoading && !showAuthStatusUnavailable}
          showAdminAction={isAdmin || builtinAuthEnabled || passkeyAuthEnabled}
          adminActionLabel={isAdmin ? publicStrings.adminButton : publicStrings.adminLoginButton}
          topControls={(
            <>
              <ThemeToggle />
              <LanguageSwitcher />
            </>
          )}
          metricsLoading={metricsLoading}
          summaryLoading={summaryLoading}
          showAuthStatusLoading={showAuthStatusLoading}
          showAuthStatusUnavailable={showAuthStatusUnavailable}
          onLinuxDoLogin={() => startLinuxDoLogin(token)}
          onTokenAccessClick={openTokenAccessDialog}
          onAdminActionClick={() => { window.location.href = isAdmin ? '/admin' : '/login' }}
        />
        {offline.isOffline ? (
          <OfflineStatusBanner
            title="Offline shell loaded"
            description="The page frame is available, but live metrics, profile checks, and sign-in actions need the network."
          />
        ) : null}
        {!hideTokenPanels && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{publicStrings.accessPanel.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{publicStrings.accessPanel.stats.dailySuccess}</p>
                    {tokenMetricsPending ? (
                      <Skeleton className="h-7 w-14" />
                    ) : (
                      <p className="font-mono text-xl font-semibold tabular-nums">{formatNumber(tokenMetrics?.dailySuccess ?? 0)}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{publicStrings.accessPanel.stats.dailyFailure}</p>
                    {tokenMetricsPending ? (
                      <Skeleton className="h-7 w-14" />
                    ) : (
                      <p className="font-mono text-xl font-semibold tabular-nums">{formatNumber(tokenMetrics?.dailyFailure ?? 0)}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-medium text-muted-foreground">{publicStrings.accessPanel.stats.monthlySuccess}</p>
                    {tokenMetricsPending ? (
                      <Skeleton className="h-7 w-14" />
                    ) : (
                      <p className="font-mono text-xl font-semibold tabular-nums">{formatNumber(tokenMetrics?.monthlySuccess ?? 0)}</p>
                    )}
                  </div>
                </div>

                {([
                  {
                    label: publicStrings.accessPanel.stats.hourlyLimit,
                    used: recentTokenUsage?.quotaHourlyUsed ?? 0,
                    limit: recentTokenUsage?.quotaHourlyLimit ?? TOKEN_HOURLY_LIMIT,
                    description: publicStrings.accessPanel.stats.hourlyWindow,
                  },
                  {
                    label: publicStrings.accessPanel.stats.dailyLimit,
                    used: recentTokenUsage?.quotaDailyUsed ?? 0,
                    limit: recentTokenUsage?.quotaDailyLimit ?? TOKEN_DAILY_LIMIT,
                    description: publicStrings.accessPanel.stats.dailyWindow,
                  },
                  {
                    label: publicStrings.accessPanel.stats.monthlyLimit,
                    used: recentTokenUsage?.quotaMonthlyUsed ?? 0,
                    limit: recentTokenUsage?.quotaMonthlyLimit ?? TOKEN_MONTHLY_LIMIT,
                    description: publicStrings.accessPanel.stats.monthlyWindow,
                  },
                ] as const).map((quota) => {
                  const usageRatio = quota.limit > 0 ? quota.used / quota.limit : 0
                  return (
                    <div key={quota.label} className="flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{quota.label}</p>
                        <p className="font-mono text-sm tabular-nums text-muted-foreground">
                          {formatNumber(quota.used)}
                          <span className="text-muted-foreground/70"> / {formatNumber(quota.limit)}</span>
                        </p>
                      </div>
                      <Progress
                        value={Math.min(100, usageRatio * 100)}
                        indicatorClassName={
                          usageRatio >= 0.95 ? 'bg-destructive' : usageRatio >= 0.8 ? 'bg-warning' : undefined
                        }
                      />
                      <p className="text-xs text-muted-foreground">{quota.description}</p>
                    </div>
                  )
                })}

                <TokenSecretField
                  inputId="access-token"
                  inputRef={accessTokenFieldRef}
                  name="not-a-login-field"
                  label={publicStrings.accessToken.label}
                  value={token}
                  visible={tokenVisible}
                  copyState={copyState}
                  onValueChange={(value) => { setToken(value); setTokenDraft(value); setInvalidToken(false) }}
                  onToggleVisibility={() => setTokenVisible((visible) => !visible)}
                  onCopy={(button) => void handleCopyToken(token || button.parentElement?.querySelector<HTMLInputElement>('#access-token')?.value || '')}
                  visibilityShowLabel={publicStrings.accessToken.toggle.show}
                  visibilityHideLabel={publicStrings.accessToken.toggle.hide}
                  visibilityIconAlt={publicStrings.accessToken.toggle.iconAlt}
                  copyAriaLabel={publicStrings.copyToken.copy}
                  copyLabel={publicStrings.copyToken.copy}
                  copiedLabel={publicStrings.copyToken.copied}
                  copyErrorLabel={publicStrings.copyToken.error}
                  placeholder={publicStrings.accessToken.placeholder}
                  autoComplete="off"
                  spellCheck={false}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{publicStrings.logs.title}</CardTitle>
                <CardDescription>{publicStrings.logs.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {hasValidTokenForLogs && publicLogs.length > 0 ? (
                  <>
                    {/* Desktop table */}
                    <div className="hidden overflow-hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10" />
                            <TableHead>{publicStrings.logs.table.time}</TableHead>
                            <TableHead>{publicStrings.logs.table.request}</TableHead>
                            <TableHead>{publicStrings.logs.table.result}</TableHead>
                            <TableHead className="text-right">{publicStrings.logs.table.httpStatus}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {publicLogs.map((log) => {
                            const expanded = expandedPublicLogs.has(log.id)
                            return (
                              <React.Fragment key={log.id}>
                                <TableRow
                                  className="cursor-pointer"
                                  onClick={() => togglePublicLog(log.id)}
                                  onKeyDown={(event) => {
                                    if (event.target !== event.currentTarget) return
                                    if (event.key === 'Enter' || event.key === ' ') {
                                      event.preventDefault()
                                      togglePublicLog(log.id)
                                    }
                                  }}
                                  tabIndex={0}
                                  aria-expanded={expanded}
                                >
                                  <TableCell className="w-10">
                                    <button
                                      type="button"
                                      className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                                      aria-label={expanded ? publicStrings.logs.table.rowCollapse : publicStrings.logs.table.rowExpand}
                                      aria-expanded={expanded}
                                      onClick={(event) => {
                                        event.stopPropagation()
                                        togglePublicLog(log.id)
                                      }}
                                    >
                                      {expanded ? (
                                        <ChevronDownIcon className="size-4" aria-hidden="true" />
                                      ) : (
                                        <ChevronRightIcon className="size-4" aria-hidden="true" />
                                      )}
                                    </button>
                                  </TableCell>
                                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                    {formatTimestamp(log.created_at)}
                                  </TableCell>
                                  <TableCell className="max-w-[24rem] truncate font-mono text-xs">
                                    {`${log.method} ${log.path}`}
                                  </TableCell>
                                  <TableCell>
                                    <StatusBadge tone={statusTone(log.result_status)}>{log.result_status}</StatusBadge>
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-xs tabular-nums">
                                    {log.http_status ?? '—'}
                                  </TableCell>
                                </TableRow>
                                {expanded ? (
                                  <TableRow>
                                    <TableCell colSpan={5} className="bg-muted/30 p-0">
                                      {renderLogDetails(log)}
                                    </TableCell>
                                  </TableRow>
                                ) : null}
                              </React.Fragment>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile cards */}
                    <div className="flex flex-col gap-3 md:hidden">
                      {publicLogs.map((log) => {
                        const expanded = expandedPublicLogs.has(log.id)
                        return (
                          <div key={log.id}>
                            <button
                              type="button"
                              className="flex w-full flex-col gap-2 p-3 text-left"
                              onClick={() => togglePublicLog(log.id)}
                              aria-expanded={expanded}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-mono text-xs">{`${log.method} ${log.path}`}</span>
                                <StatusBadge tone={statusTone(log.result_status)}>{log.result_status}</StatusBadge>
                              </div>
                              <span className="text-xs text-muted-foreground">{formatTimestamp(log.created_at)}</span>
                            </button>
                            {expanded ? <div className="border-t">{renderLogDetails(log)}</div> : null}
                          </div>
                        )
                      })}
                    </div>
                  </>
                ) : (
                  renderLogsEmptyState()
                )}
              </CardContent>
            </Card>
          </>
        )}

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <CardTitle>{publicStrings.guide.title}</CardTitle>
              <CardDescription>{guideDescription.title}</CardDescription>
            </div>
            {canRevealGuideToken ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setRevealedGuideToken(guideTokenVisible ? null : token)
                }}
                aria-pressed={guideTokenVisible}
              >
                {guideTokenVisible ? <EyeOffIcon data-icon="inline-start" /> : <EyeIcon data-icon="inline-start" />}
                {guideTokenToggleLabel}
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <Tabs value={activeGuide} onValueChange={(value) => setActiveGuide(value as GuideKey)}>
              <TabsList className="h-auto w-full justify-start overflow-x-auto">
                {guideTabs.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <div className="flex flex-col gap-4">
              <ol className="flex list-decimal flex-col gap-2 pl-5 text-sm leading-6 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-xs">
                {guideDescription.steps.map((step, index) => (
                  <li key={index}>{step}</li>
                ))}
              </ol>

              {resolveGuideSamples(guideDescription).map((sample) => {
                const sampleKey = `${guideDescription.title}-${sample.title}`
                const sampleCopyState = guideCopyState[sampleKey]
                return (
                  <div key={sampleKey} className="overflow-hidden">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                      <p className="text-sm font-medium">{sample.title}</p>
                      <div className="flex items-center gap-2">
                        {sample.language ? (
                          <span className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] uppercase text-muted-foreground">
                            {sample.language}
                          </span>
                        ) : null}
                        {sample.reference ? (
                          <a
                            href={sample.reference.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-primary underline-offset-4 hover:underline"
                          >
                            {sample.reference.label}
                          </a>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => void copyGuideSample(sampleKey, sample.snippet)}
                        >
                          {sampleCopyState === 'copied' ? (
                            <CheckIcon data-icon="inline-start" />
                          ) : (
                            <CopyIcon data-icon="inline-start" />
                          )}
                          {sampleCopyState === 'copied' ? publicStrings.guide.copied : publicStrings.guide.copy}
                        </Button>
                      </div>
                    </div>
                    <pre className="overflow-x-auto bg-muted/30 p-3 text-xs leading-relaxed">
                      <code dangerouslySetInnerHTML={{ __html: sample.snippet }} />
                    </pre>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <PublicHomeFooter versionLabel={publicStrings.footer.version} version={updateBanner.currentBackendVersion} />

        <Dialog
          open={isTokenAccessDialogOpen}
          onOpenChange={(open) => {
            if (open) {
              setIsTokenAccessDialogOpen(true)
              return
            }
            closeTokenAccessDialog()
          }}
        >
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{publicStrings.tokenAccess.dialog.title}</DialogTitle>
              <DialogDescription>{publicStrings.tokenAccess.dialog.description}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <TokenSecretField
                inputId="access-token-modal"
                inputRef={accessTokenModalFieldRef}
                name="not-a-login-field"
                label={publicStrings.accessToken.label}
                value={tokenDraft}
                visible={tokenVisible}
                copyState={copyState}
                onValueChange={setTokenDraft}
                onToggleVisibility={() => setTokenVisible((visible) => !visible)}
                onCopy={(button) => void handleCopyToken(tokenDraft || button.parentElement?.querySelector<HTMLInputElement>('#access-token-modal')?.value || '')}
                visibilityShowLabel={publicStrings.accessToken.toggle.show}
                visibilityHideLabel={publicStrings.accessToken.toggle.hide}
                visibilityIconAlt={publicStrings.accessToken.toggle.iconAlt}
                copyAriaLabel={publicStrings.copyToken.copy}
                copyLabel={publicStrings.copyToken.copy}
                copiedLabel={publicStrings.copyToken.copied}
                copyErrorLabel={publicStrings.copyToken.error}
                placeholder={publicStrings.accessToken.placeholder}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-sm text-muted-foreground">{publicStrings.tokenAccess.dialog.loginHint}</p>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => startLinuxDoLogin(tokenDraft)}
              >
                <KeyRoundIcon data-icon="inline-start" />
                {publicStrings.linuxDoLogin.button}
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={closeTokenAccessDialog}>
                  {publicStrings.tokenAccess.dialog.actions.cancel}
                </Button>
                <Button type="button" onClick={confirmTokenAccessDialog} disabled={!isFullToken(tokenDraft.trim())}>
                  {publicStrings.tokenAccess.dialog.actions.confirm}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  )
}

export default PublicHome

export const __testables = {
  resolvePublicGuideToken,
  resolveGuideSamples,
  resolveInitialTokenFromHash,
  shouldRevealPublicGuideToken,
  buildGuideContent,
}

function buildGuideContent(language: Language, baseUrl: string, prettyToken: string): Record<GuideKey, GuideContent> {
  const isEnglish = language === 'en'
  const codexSnippet = buildCodexSnippet(baseUrl)
  const hikariCliInstallSnippet = buildHikariCliInstallSnippet(baseUrl, prettyToken)
  const hikariSkillsSnippet = buildHikariSkillsSnippet()
  const claudeSnippet = buildClaudeSnippet(baseUrl, prettyToken, language)
  const genericJsonSnippet = buildGenericJsonSnippet(baseUrl, prettyToken)
  const genericMcpSnippet = buildGenericMcpSnippet(baseUrl, prettyToken)
  const apiSearchSnippet = buildApiSearchSnippet(baseUrl, prettyToken)
  return {
    codex: {
      title: 'Codex CLI',
      steps: isEnglish
        ? [
            <>Set <code>experimental_use_rmcp_client = true</code> inside <code>~/.codex/config.toml</code>.</>,
            <>Add <code>[mcp_servers.tavily_hikari]</code>, point <code>url</code> to <code>{baseUrl}/mcp</code>, and set <code>bearer_token_env_var = TAVILY_HIKARI_TOKEN</code>.</>,
            <>Run <code>export TAVILY_HIKARI_TOKEN="{prettyToken}"</code>, then verify with <code>codex mcp list</code> or <code>codex mcp get tavily_hikari</code>.</>,
          ]
        : [
            <>在 <code>~/.codex/config.toml</code> 设定 <code>experimental_use_rmcp_client = true</code>。</>,
            <>添加 <code>[mcp_servers.tavily_hikari]</code>，将 <code>url</code> 指向 <code>{baseUrl}/mcp</code> 并声明 <code>bearer_token_env_var = TAVILY_HIKARI_TOKEN</code>。</>,
            <>运行 <code>export TAVILY_HIKARI_TOKEN="{prettyToken}"</code> 后，执行 <code>codex mcp list</code> 或 <code>codex mcp get tavily_hikari</code> 验证。</>,
          ],
      sampleTitle: isEnglish ? 'Example: ~/.codex/config.toml' : '示例：~/.codex/config.toml',
      snippetLanguage: 'toml',
      snippet: codexSnippet,
      reference: {
        label: 'OpenAI Codex docs',
        url: CODEX_DOC_URL,
      },
    },
    hikariCli: {
      title: 'CLI + Agent Skills',
      steps: isEnglish
        ? [
            <>Install <code>tvly-hikari</code> with this Hikari origin and token; the config is stored locally with <code>0600</code> permissions.</>,
            <>Run Tavily commands through <code>tvly-hikari search/extract/crawl/map/research ... --json</code>; the wrapper injects <code>{baseUrl}/api/tavily</code> and the Hikari token.</>,
            <>Install Agent Skills separately when you want agents to discover the Hikari-specific workflows.</>,
          ]
        : [
            <>使用当前 Hikari origin 和 token 安装 <code>tvly-hikari</code>；本地配置会以 <code>0600</code> 权限保存。</>,
            <>通过 <code>tvly-hikari search/extract/crawl/map/research ... --json</code> 调用 Tavily；wrapper 会注入 <code>{baseUrl}/api/tavily</code> 与 Hikari token。</>,
            <>需要让 Agent 自动发现 Hikari 工作流时，再单独安装 Agent Skills。</>,
          ],
      samples: [
        {
          title: isEnglish ? 'Install tvly-hikari' : '安装 tvly-hikari',
          language: 'bash',
          snippet: hikariCliInstallSnippet,
        },
        {
          title: isEnglish ? 'Optional: install Agent Skills' : '可选：安装 Agent Skills',
          language: 'bash',
          snippet: hikariSkillsSnippet,
        },
      ],
      reference: {
        label: 'Tavily Hikari GitHub Releases',
        url: 'https://github.com/IvanLi-CN/tavily-hikari/releases/latest',
      },
    },
    claude: {
      title: 'Claude Code CLI',
      steps: isEnglish
        ? [
            <>Use <code>claude mcp add-json</code> to register Tavily Hikari as an HTTP MCP endpoint.</>,
            <>Run <code>claude mcp get tavily-hikari</code> to confirm the connection or troubleshoot errors.</>,
          ]
        : [
            <>参考下方命令，使用 <code>claude mcp add-json</code> 注册 Tavily Hikari HTTP MCP。</>,
            <>运行 <code>claude mcp get tavily-hikari</code> 查看状态或排查错误。</>,
          ],
      sampleTitle: isEnglish ? 'Example: claude mcp add-json' : '示例：claude mcp add-json',
      snippetLanguage: 'bash',
      snippet: claudeSnippet,
      reference: {
        label: 'Claude Code MCP docs',
        url: CLAUDE_DOC_URL,
      },
    },
    vscode: {
      title: 'VS Code / Copilot',
      steps: isEnglish
        ? [
            <>Add Tavily Hikari to VS Code Copilot <code>mcp.json</code> (or <code>.code-workspace</code>/<code>devcontainer.json</code> under <code>customizations.vscode.mcp</code>).</>,
            <>Set <code>type</code> to <code>"http"</code>, <code>url</code> to <code>{baseUrl}/mcp</code>, and place <code>Bearer {prettyToken}</code> in <code>headers.Authorization</code>.</>,
            <>Reload Copilot Chat to apply changes, keeping it aligned with the <a href={VSCODE_DOC_URL} rel="noreferrer" target="_blank">official guide</a>.</>,
          ]
        : [
            <>在 VS Code Copilot <code>mcp.json</code>（或 <code>.code-workspace</code>/<code>devcontainer.json</code> 的 <code>customizations.vscode.mcp</code>）添加服务器节点。</>,
            <>设置 <code>type</code> 为 <code>"http"</code>、<code>url</code> 为 <code>{baseUrl}/mcp</code>，并在 <code>headers.Authorization</code> 写入 <code>Bearer {prettyToken}</code>。</>,
            <>保存后重新打开 Copilot Chat，使配置与 <a href={VSCODE_DOC_URL} rel="noreferrer" target="_blank">官方指南</a> 保持一致。</>,
          ],
      sampleTitle: isEnglish ? 'Example: mcp.json' : '示例：mcp.json',
      snippetLanguage: 'json',
      snippet: buildVscodeSnippet(baseUrl, prettyToken),
      reference: {
        label: 'VS Code Copilot MCP docs',
        url: VSCODE_DOC_URL,
      },
    },
    claudeDesktop: {
      title: 'Claude Desktop',
      steps: isEnglish
        ? [
            <>Open <code>⌘+,</code> → <strong>Develop</strong> → <code>Edit Config</code>, then update <code>claude_desktop_config.json</code> following the official docs.</>,
            <>Keep the endpoint defined below, save the file, and restart Claude Desktop to load the new tool list.</>,
          ]
        : [
            <>打开 <code>⌘+,</code> → <strong>Develop</strong> → <code>Edit Config</code>，按照官方文档将 MCP JSON 写入本地 <code>claude_desktop_config.json</code>。</>,
            <>在 JSON 中保留我们提供的 endpoint，保存后重启 Claude Desktop 以载入新的工具列表。</>,
          ],
      sampleTitle: isEnglish ? 'Example: claude_desktop_config.json' : '示例：claude_desktop_config.json',
      snippetLanguage: 'json',
      snippet: genericJsonSnippet,
      reference: {
        label: 'NocoDB MCP docs',
        url: NOCODB_DOC_URL,
      },
    },
    cursor: {
      title: 'Cursor',
      steps: isEnglish
        ? [
            <>Open Cursor Settings (<code>⇧+⌘+J</code>) → <strong>MCP → Add Custom MCP</strong> and edit the global <code>mcp.json</code>.</>,
            <>Paste the configuration below, save it, and confirm “tools enabled” inside the MCP panel.</>,
          ]
        : [
            <>在 Cursor 设置（<code>⇧+⌘+J</code>）中打开 <strong>MCP → Add Custom MCP</strong>，按照官方指南编辑全局 <code>mcp.json</code>。</>,
            <>粘贴下方配置并保存，回到 MCP 面板确认条目显示 “tools enabled”。</>,
          ],
      sampleTitle: isEnglish ? 'Example: ~/.cursor/mcp.json' : '示例：~/.cursor/mcp.json',
      snippetLanguage: 'json',
      snippet: genericJsonSnippet,
      reference: {
        label: 'NocoDB MCP docs',
        url: NOCODB_DOC_URL,
      },
    },
    windsurf: {
      title: 'Windsurf',
      steps: isEnglish
        ? [
            <>In Windsurf, click the hammer icon in the MCP sidebar → <strong>Configure</strong>, then choose <strong>View raw config</strong> to open <code>mcp_config.json</code>.</>,
            <>Insert the snippet under <code>mcpServers</code>, save, and click <strong>Refresh</strong> on Manage Plugins to reload tools.</>,
          ]
        : [
            <>在 Windsurf 中点击 MCP 侧边栏的锤子图标 → <strong>Configure</strong>，再选择 <strong>View raw config</strong> 打开 <code>mcp_config.json</code>。</>,
            <>将下方片段写入 <code>mcpServers</code>，保存后在 Manage Plugins 页点击 <strong>Refresh</strong> 以加载新工具。</>,
          ],
      sampleTitle: isEnglish ? 'Example: ~/.codeium/windsurf/mcp_config.json' : '示例：~/.codeium/windsurf/mcp_config.json',
      snippetLanguage: 'json',
      snippet: genericJsonSnippet,
      reference: {
        label: 'NocoDB MCP docs',
        url: NOCODB_DOC_URL,
      },
    },
    cherryStudio: {
      title: isEnglish ? 'Cherry Studio' : 'Cherry Studio 桌面客户端',
      steps: isEnglish
        ? [
            <>1. Copy your Tavily Hikari access token (for example <code>{prettyToken}</code>) for this client.</>,
            <>2. In Cherry Studio, open <strong>Settings → Web Search</strong>.</>,
            <>3. Choose the search provider <strong>Tavily (API key)</strong>.</>,
            <>
              4. Set <strong>API URL</strong> to <code>{baseUrl}/api/tavily</code>.
            </>,
            <>
              5. Set <strong>API key</strong> to the Hikari access token from step 1 (the full <code>{prettyToken}</code> value),{' '}
              <strong>not</strong> your Tavily official API key.
            </>,
            <>
              6. Optionally tweak result count, answer/date options, etc. Cherry Studio will send these fields through to
              Tavily, while Hikari rotates Tavily keys and enforces per-token quotas.
            </>,
          ]
        : [
            <>1）准备好当前客户端要使用的 Tavily Hikari 访问令牌（例如 <code>{prettyToken}</code>）。</>,
            <>2）在 Cherry Studio 中打开 <strong>设置 → 网络搜索（Web Search）</strong>。</>,
            <>3）将搜索服务商设置为 <strong>Tavily (API key)</strong>。</>,
            <>
              4）将 <strong>API 地址 / API URL</strong> 设置为 <code>{baseUrl}/api/tavily</code>。
            </>,
            <>
              5）将 <strong>API 密钥 / API key</strong> 填写为步骤 1 中复制的 Hikari 访问令牌（完整的 <code>{prettyToken}</code>），而不是
              Tavily 官方 API key。
            </>,
            <>6）可按需在 Cherry 中调整返回条数、是否附带答案/日期等选项。</>,
          ],
    },
    other: {
      title: isEnglish ? 'Other clients' : '其他客户端',
      steps: isEnglish
        ? [
            <>If your client supports remote MCP, point it to <code>{baseUrl}/mcp</code> and attach <code>Authorization: Bearer {prettyToken}</code>.</>,
            <>If your client talks to Tavily's HTTP API instead of MCP, use the façade base URL <code>{baseUrl}/api/tavily</code> and call endpoints such as <code>/search</code>, <code>/extract</code>, <code>/crawl</code>, <code>/map</code>, or <code>/research</code>.</>,
            <>For HTTP API clients, prefer the same bearer token in the header; if headers are unavailable, send it as JSON field <code>api_key</code>.</>,
          ]
        : [
            <>如果客户端支持远程 MCP，就把地址指向 <code>{baseUrl}/mcp</code>，并附带 <code>Authorization: Bearer {prettyToken}</code>。</>,
            <>如果客户端走的是 Tavily 风格 HTTP API，而不是 MCP，就使用基础地址 <code>{baseUrl}/api/tavily</code>，再继续调用 <code>/search</code>、<code>/extract</code>、<code>/crawl</code>、<code>/map</code>、<code>/research</code> 等端点。</>,
            <>对于 HTTP API 客户端，推荐继续使用同一个 Bearer Token；如果没法自定义 Header，也可以把令牌写入 JSON 请求体字段 <code>api_key</code>。</>,
          ],
      samples: [
        {
          title: isEnglish ? 'Example 1: generic MCP client config' : '示例 1：通用 MCP 客户端配置',
          language: 'json',
          snippet: genericMcpSnippet,
          reference: {
            label: 'Model Context Protocol spec',
            url: MCP_SPEC_URL,
          },
        },
        {
          title: isEnglish ? 'Example 2: POST /api/tavily/search' : '示例 2：POST /api/tavily/search',
          language: 'bash',
          snippet: apiSearchSnippet,
          reference: {
            label: 'Tavily Search API docs',
            url: TAVILY_SEARCH_DOC_URL,
          },
        },
      ],
    },
  }
}

function buildHikariCliInstallSnippet(baseUrl: string, prettyToken: string): string {
  return `curl -fsSL "https://github.com/IvanLi-CN/tavily-hikari/releases/latest/download/install-tvly-hikari.sh" | bash -s -- \\
  --base-url "${baseUrl}" \\
  --token "${prettyToken}"`
}

function buildHikariSkillsSnippet(): string {
  return 'npx skills add https://github.com/IvanLi-CN/tavily-hikari --global'
}

function guideSnippetToPlainText(snippet: string): string {
  const template = document.createElement('template')
  template.innerHTML = snippet
  return template.content.textContent ?? ''
}

function buildCodexSnippet(baseUrl: string): string {
  return [
    '<span class="hl-comment"># ~/.codex/config.toml</span>',
    '<span class="hl-key">experimental_use_rmcp_client</span> = <span class="hl-boolean">true</span>',
    '',
    '[<span class="hl-section">mcp_servers.tavily_hikari</span>]',
    `<span class="hl-key">url</span> = <span class="hl-string">"${baseUrl}/mcp"</span>`,
    '<span class="hl-key">bearer_token_env_var</span> = <span class="hl-string">"TAVILY_HIKARI_TOKEN"</span>',
  ].join('\n')
}

function buildClaudeSnippet(baseUrl: string, prettyToken: string, language: Language): string {
  const verifyLabel = language === 'en' ? '# Verify' : '# 验证'
  return [
    '<span class="hl-comment"># claude mcp add-json</span>',
    `claude mcp add-json tavily-hikari '{`,
    `  <span class="hl-key">"type"</span>: <span class="hl-string">"http"</span>,`,
    `  <span class="hl-key">"url"</span>: <span class="hl-string">"${baseUrl}/mcp"</span>,`,
    '  <span class="hl-key">"headers"</span>: {',
    `    <span class="hl-key">"Authorization"</span>: <span class="hl-string">"Bearer ${prettyToken}"</span>`,
    '  }',
    "}'",
    '',
    verifyLabel,
    'claude mcp get tavily-hikari',
  ].join('\n')
}

function buildVscodeSnippet(baseUrl: string, prettyToken: string): string {
  return [
    '{',
    '  <span class="hl-key">"servers"</span>: {',
    '    <span class="hl-key">"tavily-hikari"</span>: {',
    '      <span class="hl-key">"type"</span>: <span class="hl-string">"http"</span>,',
    `      <span class="hl-key">"url"</span>: <span class="hl-string">"${baseUrl}/mcp"</span>,`,
    '      <span class="hl-key">"headers"</span>: {',
    `        <span class="hl-key">"Authorization"</span>: <span class="hl-string">"Bearer ${prettyToken}"</span>`,
    '      }',
    '    }',
    '  }',
    '}',
  ].join('\n')
}

function buildGenericJsonSnippet(baseUrl: string, prettyToken: string): string {
  return `{
  <span class="hl-key">"mcpServers"</span>: {
    <span class="hl-key">"tavily-hikari"</span>: {
      <span class="hl-key">"type"</span>: <span class="hl-string">"http"</span>,
      <span class="hl-key">"url"</span>: <span class="hl-string">"${baseUrl}/mcp"</span>,
      <span class="hl-key">"headers"</span>: {
        <span class="hl-key">"Authorization"</span>: <span class="hl-string">"Bearer ${prettyToken}"</span>
      }
    }
  }
}`
}

function buildGenericMcpSnippet(baseUrl: string, prettyToken: string): string {
  return `{
  <span class="hl-key">"type"</span>: <span class="hl-string">"http"</span>,
  <span class="hl-key">"url"</span>: <span class="hl-string">"${baseUrl}/mcp"</span>,
  <span class="hl-key">"headers"</span>: {
    <span class="hl-key">"Authorization"</span>: <span class="hl-string">"Bearer ${prettyToken}"</span>
  }
}`
}

function buildApiSearchSnippet(baseUrl: string, prettyToken: string): string {
  return `curl -X POST "${baseUrl}/api/tavily/search" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${prettyToken}" \\
  -d '{
    "query": "latest AI agent news",
    "topic": "general",
    "search_depth": "basic",
    "include_answer": true,
    "max_results": 5
  }'`
}

function resolveGuideSamples(content: GuideContent): GuideSample[] {
  if (content.samples && content.samples.length > 0) return content.samples
  if (content.sampleTitle && content.snippet) {
    return [{
      title: content.sampleTitle,
      language: content.snippetLanguage,
      snippet: content.snippet,
      reference: content.reference,
    }]
  }
  return []
}

function resolvePublicGuideToken(token: string, placeholder: string, revealed: boolean): string {
  return revealed && isFullToken(token) ? token : placeholder
}

function resolveInitialTokenFromHash(hashValue: string, tokenStore: Record<string, string>): string | null {
  const normalizedHash = hashValue.startsWith('#') ? hashValue.slice(1) : hashValue
  const decodedHash = normalizedHash ? decodeURIComponent(normalizedHash) : null
  if (decodedHash && isFullToken(decodedHash)) {
    return decodedHash
  }
  if (!decodedHash) return null

  const id = extractTokenId(decodedHash)
  if (id && tokenStore[id]) {
    return tokenStore[id]
  }
  return null
}

function shouldRevealPublicGuideToken(token: string, revealedToken: string | null): boolean {
  return isFullToken(token) && revealedToken === token
}

function normalizeTokenHash(value: string): string {
  const maybeId = extractTokenId(value)
  return maybeId ?? value
}

function extractTokenId(value: string): string | null {
  const fullTokenMatch = /^th-([a-zA-Z0-9]{4})-[a-zA-Z0-9]+$/.exec(value)
  if (fullTokenMatch) return fullTokenMatch[1]
  if (/^[a-zA-Z0-9]{4}$/.test(value)) return value
  return null
}

function isFullToken(value: string): boolean {
  return /^th-[a-zA-Z0-9]{4}-[a-zA-Z0-9]+$/.test(value)
}

function loadTokenMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_TOKEN_MAP)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed ? parsed : {}
  } catch {
    return {}
  }
}

function saveTokenMap(map: Record<string, string>): void {
  try {
    localStorage.setItem(STORAGE_TOKEN_MAP, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

function loadLastToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_LAST_TOKEN)
  } catch {
    return null
  }
}
