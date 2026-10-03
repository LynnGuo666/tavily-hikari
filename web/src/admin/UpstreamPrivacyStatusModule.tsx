import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription } from '@/components/ui/empty'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useId, useMemo } from 'react'
import type React from 'react'

import type { QueryLoadState } from './queryLoadState'
import type { Language, AdminTranslations } from '../i18n'
import type {
  DailyReconciliationKeyProgress,
  UpstreamKeyActivityPoint,
  UpstreamPrivacyGate,
  UpstreamPrivacyStatus,
  UpstreamProjectIdMode,
} from '../api'
import AdminLoadingRegion from '../components/AdminLoadingRegion'
import { StatusBadge } from '../components/StatusBadge'
import { Switch } from '@/components/ui/switch'

interface UpstreamPrivacyStatusModuleProps {
  strings: AdminTranslations['systemSettings']['privacy']
  formStrings: AdminTranslations['systemSettings']['form']
  language: Language
  status: UpstreamPrivacyStatus | null
  loadState: QueryLoadState
  error: string | null
  autoRefreshEnabled: boolean
  onAutoRefreshChange: (next: boolean) => void
  onOpenMcpSessionBindings: () => void
}

function phaseTone(phase: UpstreamPrivacyStatus['phase']): 'neutral' | 'info' | 'success' | 'warning' | 'error' {
  switch (phase) {
    case 'active':
      return 'success'
    case 'active_paused':
      return 'error'
    case 'pending':
    case 'compare':
      return 'info'
    case 'draining':
      return 'warning'
    case 'degraded':
      return 'error'
    default:
      return 'neutral'
  }
}

type ReconciliationRunState =
  | 'healthy'
  | 'local_backoff'
  | 'upstream_backoff'
  | 'budget_exhausted'
  | 'no_adjustment'

function reconciliationRunState(status: UpstreamPrivacyStatus): ReconciliationRunState {
  if (status.reconciliationLastBudgetExhausted) return 'budget_exhausted'
  if (
    status.reconciliationLocalBackoff.level > 0
    && status.reconciliationLocalBackoff.availableAt != null
  ) {
    return 'local_backoff'
  }
  if (status.reconciliationBackoffUntil != null) return 'upstream_backoff'

  const noAdjustment = status.reconciliationLastNoAdjustment ?? 0
  if (noAdjustment > 0 && noAdjustment === (status.reconciliationLastSettled ?? 0)) {
    return 'no_adjustment'
  }
  return 'healthy'
}

function reconciliationRunStateLabel(state: ReconciliationRunState, language: Language): string {
  const labels: Record<ReconciliationRunState, [string, string]> = {
    healthy: ['健康', 'Healthy'],
    local_backoff: ['本地退避', 'Local backoff'],
    upstream_backoff: ['上游退避', 'Upstream backoff'],
    budget_exhausted: ['预算耗尽', 'Budget exhausted'],
    no_adjustment: ['无需调整', 'No adjustment'],
  }
  return labels[state][language === 'zh' ? 0 : 1]
}

function formatOptionalValue(value: string | null | undefined, emptyLabel: string): string {
  return value && value.length > 0 ? value : emptyLabel
}

function formatSignedCount(value: number): string {
  if (value > 0) return `+${value}`
  return String(value)
}

function formatOptionalTimestamp(
  value: number | null,
  formatter: Intl.DateTimeFormat,
  emptyLabel: string,
): string {
  return value == null ? emptyLabel : formatter.format(new Date(value * 1000))
}

function formatAge(value: number | null, language: Language): string {
  if (value == null) return language === 'zh' ? '未知' : 'Unknown'
  if (value < 60) return language === 'zh' ? `${value} 秒` : `${value}s`
  const minutes = Math.floor(value / 60)
  if (minutes < 60) return language === 'zh' ? `${minutes} 分` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return language === 'zh' ? `${hours} 小时` : `${hours}h`
}

interface StatusIssue {
  key: string
  title: string
  detail: string
  tone: 'warning' | 'error' | 'info'
}

const KEY_ACTIVITY_VISIBLE_ROWS = 12

function compactKeyActivityPoints(
  points: UpstreamKeyActivityPoint[],
  remainderLabel: (count: number) => string,
): UpstreamKeyActivityPoint[] {
  const positivePoints = points.filter((point) => point.count > 0)
  if (positivePoints.length <= KEY_ACTIVITY_VISIBLE_ROWS) return positivePoints

  const visiblePoints = positivePoints.slice(0, KEY_ACTIVITY_VISIBLE_ROWS)
  const remainderPoints = positivePoints.slice(KEY_ACTIVITY_VISIBLE_ROWS)
  return [
    ...visiblePoints,
    {
      keyIdHint: remainderLabel(remainderPoints.length),
      count: remainderPoints.reduce((total, point) => total + point.count, 0),
    },
  ]
}

function compactDailyKeyProgress(
  rows: DailyReconciliationKeyProgress[],
  remainderLabel: (count: number) => string,
): DailyReconciliationKeyProgress[] {
  if (rows.length <= KEY_ACTIVITY_VISIBLE_ROWS) return rows
  const visibleRows = rows.slice(0, KEY_ACTIVITY_VISIBLE_ROWS)
  const remainingRows = rows.slice(KEY_ACTIVITY_VISIBLE_ROWS)
  return [
    ...visibleRows,
    {
      keyIdHint: remainderLabel(remainingRows.length),
      terminalResearch: remainingRows.reduce((total, row) => total + row.terminalResearch, 0),
      pendingResearch: remainingRows.reduce((total, row) => total + row.pendingResearch, 0),
      pendingProjectIds: remainingRows.reduce((total, row) => total + row.pendingProjectIds, 0),
      cooldownUntil: null,
      cooldownReason: null,
    },
  ]
}

function gateLabel(
  strings: AdminTranslations['systemSettings']['privacy'],
  language: Language,
  gate: UpstreamPrivacyGate,
): string {
  switch (gate.key) {
    case 'accessTokenMode':
      return strings.gateAccessTokenMode
    case 'apiRebalance':
      return language === 'zh' ? 'API Rebalance 已启用' : 'API Rebalance enabled'
    case 'mcpRebalance':
      return language === 'zh' ? 'Rebalance MCP 已启用' : 'Rebalance MCP enabled'
    case 'controlSessionsDrained':
      return language === 'zh' ? '`upstream_mcp` session 已排空' : '`upstream_mcp` sessions drained'
    default:
      return gate.key
  }
}

function modeLabel(
  strings: AdminTranslations['systemSettings']['form'],
  mode: UpstreamProjectIdMode,
): string {
  switch (mode) {
    case 'passthrough':
      return strings.upstreamProjectIdModePassthrough
    case 'fixed':
      return strings.upstreamProjectIdModeFixed
    case 'accessToken':
      return strings.upstreamProjectIdModeAccessToken
    default:
      return mode
  }
}

export default function UpstreamPrivacyStatusModule({
  strings,
  formStrings,
  language,
  status,
  loadState,
  error,
  autoRefreshEnabled,
  onAutoRefreshChange,
  onOpenMcpSessionBindings,
}: UpstreamPrivacyStatusModuleProps): React.JSX.Element {
  const autoRefreshLabelId = useId()
  const timestampFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    [language],
  )
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(language === 'zh' ? 'zh-CN' : 'en-US'),
    [language],
  )
  const sessionBindingCardLabel =
    language === 'zh' ? '活跃 upstream_mcp session' : 'Active upstream_mcp sessions'
  const sessionBindingSummaryLabel = sessionBindingCardLabel
  const latestReconciliationState = status ? reconciliationRunState(status) : 'healthy'

  const phaseLabel = status
    ? ({
        configured: strings.phaseConfigured,
        draining: strings.phaseDraining,
        pending: strings.phasePending,
        compare: strings.phaseCompare,
        active: strings.phaseActive,
        active_paused: language === 'zh' ? '精确对账已暂停' : 'Precise reconciliation paused',
        degraded: strings.phaseDegraded,
      } satisfies Record<UpstreamPrivacyStatus['phase'], string>)[status.phase]
    : strings.phaseConfigured

  const phaseDescription = status
    ? ({
        configured: strings.phaseConfiguredDescription,
        draining: strings.phaseDrainingDescription,
        pending: strings.phasePendingDescription,
        compare: strings.phaseCompareDescription,
        active: strings.phaseActiveDescription,
        active_paused: language === 'zh'
          ? '检测到持续性完整性问题，真实账务写入已暂停。再次开启旧开关后才会恢复。'
          : 'A durable integrity issue paused actual billing. Writing the existing switch true is required to resume.',
        degraded: strings.phaseDegradedDescription,
      } satisfies Record<UpstreamPrivacyStatus['phase'], string>)[status.phase]
    : strings.phaseConfiguredDescription

  const statusIssues = useMemo<StatusIssue[]>(() => {
    if (!status) return []

    const issues: StatusIssue[] = []
    const pendingGates = status.gates.filter((gate) => !gate.ready)

    pendingGates.forEach((gate) => {
      issues.push({
        key: `gate:${gate.key}`,
        title: gateLabel(strings, language, gate),
        detail: gate.detail,
        tone: 'warning',
      })
    })

    if (status.pendingResearch != null && status.pendingResearch > 0) {
      issues.push({
        key: 'pendingResearch',
        title: strings.issuePendingResearch,
        detail: numberFormatter.format(status.pendingResearch),
        tone: 'info',
      })
    }

    const pollDiagnostics = status.reconciliationResearchPollDiagnostics
    if (pollDiagnostics?.unavailable && pollDiagnostics.unavailable > 0) {
      issues.push({
        key: 'researchUnavailable',
        title: language === 'zh' ? 'Research 任务不存在，已停止轮询' : 'Research task unavailable; polling stopped',
        detail: numberFormatter.format(pollDiagnostics.unavailable),
        tone: 'info',
      })
    }
    if (pollDiagnostics?.credentialsCoolingKeys && pollDiagnostics.credentialsCoolingKeys > 0) {
      issues.push({
        key: 'researchCredentialsCooldown',
        title: language === 'zh' ? 'Research 凭据冷却中' : 'Research credentials cooling down',
        detail: formatOptionalTimestamp(pollDiagnostics.earliestCredentialsRetryAt, timestampFormatter, strings.statusMissing),
        tone: 'warning',
      })
    }

    if (status.queuedSettlements != null && status.queuedSettlements > 0) {
      issues.push({
        key: 'queuedSettlements',
        title: strings.issueQueuedSettlements,
        detail: numberFormatter.format(status.queuedSettlements),
        tone: 'info',
      })
    }

    if (status.reconciliationBackoffUntil != null) {
      issues.push({
        key: 'upstreamReconciliationBackoff',
        title: language === 'zh' ? '对账上游退避' : 'Upstream reconciliation backoff',
        detail: `${language === 'zh' ? '级别' : 'Level'} ${status.reconciliationBackoffLevel ?? 0} · ${formatOptionalTimestamp(status.reconciliationBackoffUntil, timestampFormatter, '-')}`,
        tone: 'warning',
      })
    }

    if (
      status.reconciliationLocalBackoff.level > 0
      && status.reconciliationLocalBackoff.availableAt != null
    ) {
      issues.push({
        key: 'localReconciliationBackoff',
        title: language === 'zh' ? '对账本地退避' : 'Local reconciliation backoff',
        detail: `${language === 'zh' ? '级别' : 'Level'} ${status.reconciliationLocalBackoff.level} · ${formatOptionalTimestamp(status.reconciliationLocalBackoff.availableAt, timestampFormatter, '-')}`,
        tone: 'warning',
      })
    }

    if (status.reconciliationLastBudgetExhausted) {
      issues.push({
        key: 'reconciliationBudgetExhausted',
        title: language === 'zh' ? '对账预算已耗尽' : 'Reconciliation budget exhausted',
        detail: status.reconciliationLastDurationMs == null
          ? '-'
          : `${numberFormatter.format(status.reconciliationLastDurationMs)} ms`,
        tone: 'warning',
      })
    }

    if (status.degradedSettlements > 0) {
      issues.push({
        key: 'degradedSettlements',
        title: strings.issueDegradedSettlements,
        detail: `${numberFormatter.format(status.degradedSettlements)}${status.degradedSettlementsCapped ? '+' : ''}`,
        tone: 'error',
      })
    }

    return issues
  }, [language, numberFormatter, status, strings, timestampFormatter])

  const summarySignals = useMemo(
    () =>
      !status
        ? []
        : [
            ...(status.activeUpstreamMcpSessions > 0
              ? [{ label: sessionBindingSummaryLabel, value: numberFormatter.format(status.activeUpstreamMcpSessions) }]
              : []),
            ...(status.pendingResearch != null && status.pendingResearch > 0
              ? [{ label: strings.counterPendingResearch, value: numberFormatter.format(status.pendingResearch) }]
              : []),
            ...(status.reconciliationResearchPollDiagnostics?.unavailable
              ? [{
                  label: language === 'zh' ? '已停止轮询' : 'Polling stopped',
                  value: numberFormatter.format(status.reconciliationResearchPollDiagnostics.unavailable),
                }]
              : []),
            ...(status.queuedSettlements != null && status.queuedSettlements > 0
              ? [{ label: strings.counterQueuedSettlements, value: numberFormatter.format(status.queuedSettlements) }]
              : []),
            ...(status.degradedSettlements > 0
              ? [{ label: strings.counterDegradedSettlements, value: `${numberFormatter.format(status.degradedSettlements)}${status.degradedSettlementsCapped ? '+' : ''}` }]
              : []),
          ],
    [numberFormatter, sessionBindingSummaryLabel, status, strings],
  )

  const configurationDriftCount = status
    ? Number(status.configuredProjectIdMode !== status.effectiveProjectIdMode)
      + Number(formatOptionalValue(status.configuredMcpUserAgent, strings.statusOmitted)
        !== formatOptionalValue(status.effectiveMcpUserAgent, strings.statusOmitted))
    : 0

  const showFixedProjectIdState = status
    ? status.configuredProjectIdMode === 'fixed' || status.effectiveProjectIdMode === 'fixed'
    : false
  const sessionBindingCardDescription = status?.activeUpstreamMcpSessions
    ? language === 'zh'
      ? '这些会话仍会阻塞 precise cutover。点击进入绑定记录页后可逐条、批量或按当前筛选全部释放。'
      : 'These sessions still block precise cutover. Open the binding records page to release one, selected, or all active matches.'
    : language === 'zh'
      ? '当前没有待处理的 legacy `upstream_mcp` session，precise cutover 不再受该门禁阻塞。'
      : 'No legacy `upstream_mcp` sessions are pending. This gate no longer blocks precise cutover.'
  const reconciliationModeLabel = status
    ? status.phase === 'active'
      ? strings.statusActive
      : status.phase === 'compare'
        ? strings.statusCompareOnly
        : status.phase === 'active_paused'
          ? strings.statusPaused
          : strings.statusConfigured
    : strings.statusConfigured
  const diagnosticsLabels = language === 'zh'
      ? {
        lastRun: '最近对账运行',
        lastOutcome: '最近对账结果',
        lastShadowAdjustment: '最近 shadow 调整',
        lastEnqueueError: '最近入队失败',
        lastResearchSweep: '最近 Research 轮询',
        lastResearchTerminal: '最近 Research 完成',
        retryBucketsTitle: '重试原因分布',
        retryBucketsDescription: '仅统计当前仍在等待的结算窗口，区分上游 429、本地 usage 限流与缺少可用上游 Key。',
        retryBucketUpstream429: '429 上游限流',
        retryBucketLocalUsageRateLimit: '本地 usage 限流',
        retryBucketMissingEligibleUpstreamKey: '缺少可用上游 Key',
        retryBucketOther: '其他重试',
        keyActivityTitle: '当前时段 Key 活动',
        keyActivityDescription: '按上游 Key 聚合当前时段内的绑定用户数与待查询 Project ID 数，默认展示 Top 12。',
        boundUsersByKeyTitle: '绑定用户数',
        pendingProjectIdsByKeyTitle: '待查询 Project ID 数',
        keyActivityEmpty: '当前时段暂无可展示的 Key 活动。',
        keyActivityRemainder: (count: number) => `其余 ${numberFormatter.format(count)} 个 Key`,
        progressTitle: '今日对账收敛进度',
        progressDescription: '只统计当天已观测到账期的账号；标准成功不包含降级账期。',
        accountCoverage: '账号标准覆盖',
        periodCoverage: '账期 terminal 覆盖',
        researchCoverage: 'Research terminal 覆盖',
        keyProgressTitle: '按 Key 收敛状态',
        pendingResearch: '待完成 Research',
        pendingProjectIds: '待查询 Project ID',
        cooldown: '冷却',
        cooldownNone: '可查询',
        keyProgressEmpty: '当天暂无待收敛的 Key。',
        keyProgressRemainder: (count: number) => `其余 ${numberFormatter.format(count)} 个 Key`,
      }
    : {
        lastRun: 'Last reconciliation run',
        lastOutcome: 'Last reconciliation outcome',
        lastShadowAdjustment: 'Last shadow adjustment',
        lastEnqueueError: 'Last enqueue error',
        lastResearchSweep: 'Last Research sweep',
        lastResearchTerminal: 'Last Research terminal',
        retryBucketsTitle: 'Retry reason distribution',
        retryBucketsDescription: 'Counts settlement windows still awaiting retry, split by upstream 429, local usage throttling, and missing eligible upstream keys.',
        retryBucketUpstream429: 'Upstream 429',
        retryBucketLocalUsageRateLimit: 'Local usage throttle',
        retryBucketMissingEligibleUpstreamKey: 'Missing eligible upstream key',
        retryBucketOther: 'Other retry',
        keyActivityTitle: 'Current-period key activity',
        keyActivityDescription: 'Groups current-period bound users and pending Project IDs by upstream key. Top 12 keys are shown by default.',
        boundUsersByKeyTitle: 'Bound users',
        pendingProjectIdsByKeyTitle: 'Pending Project IDs',
        keyActivityEmpty: 'No key activity is available for the current period.',
        keyActivityRemainder: (count: number) => `${numberFormatter.format(count)} other keys`,
        progressTitle: 'Today\'s reconciliation convergence',
        progressDescription: 'Only accounts with observed periods today are included. Standard success excludes degraded periods.',
        accountCoverage: 'Account standard coverage',
        periodCoverage: 'Terminal period coverage',
        researchCoverage: 'Terminal Research coverage',
        keyProgressTitle: 'Convergence by key',
        pendingResearch: 'Pending Research',
        pendingProjectIds: 'Pending Project IDs',
        cooldown: 'Cooldown',
        cooldownNone: 'Ready',
        keyProgressEmpty: 'No keys need convergence today.',
        keyProgressRemainder: (count: number) => `${numberFormatter.format(count)} other keys`,
      }
  const boundUsersByKeyRows = status
    ? compactKeyActivityPoints(status.currentPeriodBoundUsersByKey, diagnosticsLabels.keyActivityRemainder)
    : []
  const pendingProjectIdsByKeyRows = status
    ? compactKeyActivityPoints(status.currentPeriodPendingProjectIdsByKey, diagnosticsLabels.keyActivityRemainder)
    : []
  const dailyKeyProgressRows = status
    ? compactDailyKeyProgress(status.dailyReconciliationByKey, diagnosticsLabels.keyProgressRemainder)
    : []

  return (
    <Card className="surface panel">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        {status ? (
          <p className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {strings.generatedAt} · {timestampFormatter.format(new Date(status.generatedAt * 1000))}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-sm" role="group" aria-labelledby={autoRefreshLabelId}>
            <span id={autoRefreshLabelId}>{strings.autoRefresh}</span>
            <Switch
              aria-labelledby={autoRefreshLabelId}
              checked={autoRefreshEnabled}
              onCheckedChange={onAutoRefreshChange}
            />
          </div>
        </div>
      </div>

      <AdminLoadingRegion
        loadState={loadState}
        loadingLabel={strings.loading}
        errorLabel={error ?? strings.loadFailed}
        minHeight={280}
      >
        {!status ? (
          <Empty><EmptyDescription>{strings.empty}</EmptyDescription></Empty>
        ) : (
          <div className="flex min-w-0 flex-col gap-6 px-4">
            <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <div className="flex min-w-0 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={phaseTone(status.phase)}>{phaseLabel}</StatusBadge>
                  <StatusBadge tone={status.completedGates === status.totalGates ? 'success' : 'warning'}>
                    {numberFormatter.format(status.completedGates)}/{numberFormatter.format(status.totalGates)}
                  </StatusBadge>
                </div>
                <p className="text-sm text-muted-foreground">{phaseDescription}</p>
                {summarySignals.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {summarySignals.map((signal) => (
                      <article key={signal.label} className="flex items-start gap-2 text-sm">
                        <span>{signal.label}</span>
                        <strong>{signal.value}</strong>
                      </article>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                <PrivacyStat
                  label={strings.projectIdModeEffective}
                  value={modeLabel(formStrings, status.effectiveProjectIdMode)}
                />
                <PrivacyStat
                  label={strings.currentPeriod}
                  value={status.currentPeriodCode}
                  supportingText={`${strings.currentPeriodEndsAt} · ${timestampFormatter.format(new Date(status.currentPeriodEndsAt * 1000))}`}
                  monospace
                />
                <PrivacyStat
                  label={strings.nextEpochAt}
                  value={
                    status.nextEpochAt == null
                      ? strings.statusMissing
                      : timestampFormatter.format(new Date(status.nextEpochAt * 1000))
                  }
                />
                <PrivacyStat
                  label={strings.reconciliationMode}
                  value={reconciliationModeLabel}
                />
                <PrivacyStat
                  label={language === 'zh' ? '对账控制器' : 'Reconciliation controller'}
                  value={status.reconciliationController?.mode ?? strings.statusMissing}
                  supportingText={
                    status.reconciliationController?.activationPeriodStart == null
                      ? undefined
                      : `${language === 'zh' ? '账务边界' : 'Billing boundary'} · ${timestampFormatter.format(new Date(status.reconciliationController.activationPeriodStart * 1000))}`
                  }
                />
                <PrivacyStat
                  label={language === 'zh' ? '告警投影覆盖' : 'Alert projection coverage'}
                  value={status.dashboardAlertProjection?.coverage ?? strings.statusMissing}
                  supportingText={
                    status.dashboardAlertProjection?.observedAt == null
                      ? undefined
                      : timestampFormatter.format(new Date(status.dashboardAlertProjection.observedAt * 1000))
                  }
                />
                <PrivacyStat
                  label={language === 'zh' ? '隐私状态新鲜度' : 'Privacy status freshness'}
                  value={status.coverage || strings.statusMissing}
                  supportingText={
                    status.staleReason
                      ? `${status.staleReason} · ${formatOptionalTimestamp(status.observedAt ?? null, timestampFormatter, '-')}`
                      : formatOptionalTimestamp(status.observedAt ?? null, timestampFormatter, '-')
                  }
                />
                <PrivacyStat
                  label={strings.userAgentEffective}
                  value={formatOptionalValue(status.effectiveMcpUserAgent, strings.statusOmitted)}
                />
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <Button variant="ghost"
                type="button"
                className="h-auto w-full items-stretch justify-start whitespace-normal text-left flex min-w-0 flex-col gap-1 px-0 py-1 [&_span]:text-xs [&_span]:text-muted-foreground [&_strong]:break-all [&_strong]:text-lg [&_strong]:font-semibold [&_strong]:tabular-nums [&_small]:break-all [&_small]:text-xs [&_small]:text-muted-foreground"

                onClick={onOpenMcpSessionBindings}
              >
                <span>{sessionBindingCardLabel}</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <strong>{numberFormatter.format(status.activeUpstreamMcpSessions)}</strong>
                  <StatusBadge tone={status.activeUpstreamMcpSessions > 0 ? 'warning' : 'success'}>
                    {status.activeUpstreamMcpSessions > 0 ? strings.gateWaiting : strings.gateReady}
                  </StatusBadge>
                </div>
                <small>{sessionBindingCardDescription}</small>
              </Button>
            </section>

            <section className="min-w-0">
              <div className="panel-header flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">{strings.attentionTitle}</h3>
                  <p className="text-sm text-muted-foreground">
                    {statusIssues.length === 0 ? strings.attentionClear : strings.attentionDescription}
                  </p>
                </div>
                <StatusBadge tone={phaseTone(status.phase)}>{phaseLabel}</StatusBadge>
              </div>
              <Separator className="my-3" />
              <div className="min-w-0">
              {statusIssues.length === 0 ? (
                <div className="text-sm text-muted-foreground">{strings.attentionClear}</div>
              ) : (
                <div className="flex min-w-0 flex-col divide-y divide-border">
                  {statusIssues.map((issue) => (
                    <article key={issue.key} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 space-y-1 [&_p]:text-sm [&_p]:text-muted-foreground">
                        <strong>{issue.title}</strong>
                        <p>{issue.detail}</p>
                      </div>
                      <StatusBadge tone={issue.tone === 'error' ? 'error' : 'warning'}>
                        {issue.tone === 'error' ? strings.phaseDegraded : strings.gateWaiting}
                      </StatusBadge>
                    </article>
                  ))}
                </div>
              )}
            </div>
            </section>

            <section className="min-w-0">
              <div className="panel-header space-y-1">
                <h3 className="text-sm font-medium">{strings.countersTitle}</h3>
              </div>
              <Separator className="my-3" />
              <div className="min-w-0">
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <PrivacyStat label={sessionBindingSummaryLabel} value={numberFormatter.format(status.activeUpstreamMcpSessions)} />
                <PrivacyStat
                  label={strings.counterPendingResearch}
                  value={status.pendingResearch == null ? strings.statusMissing : numberFormatter.format(status.pendingResearch)}
                />
                <PrivacyStat
                  label={strings.counterQueuedSettlements}
                  value={status.queuedSettlements == null ? strings.statusMissing : numberFormatter.format(status.queuedSettlements)}
                />
                <PrivacyStat label={strings.counterDegradedSettlements} value={`${numberFormatter.format(status.degradedSettlements)}${status.degradedSettlementsCapped ? '+' : ''}`} />
                <PrivacyStat
                  label={diagnosticsLabels.lastRun}
                  value={formatOptionalTimestamp(status.lastReconciliationRunAt, timestampFormatter, strings.statusMissing)}
                />
                <PrivacyStat
                  label={diagnosticsLabels.lastOutcome}
                  value={reconciliationRunStateLabel(latestReconciliationState, language)}
                />
                <PrivacyStat
                  label={language === 'zh' ? '最近轮耗时' : 'Last run duration'}
                  value={status.reconciliationLastDurationMs == null ? strings.statusMissing : `${numberFormatter.format(status.reconciliationLastDurationMs)} ms`}
                />
                <PrivacyStat
                  label={language === 'zh' ? '尝试 / 完成 / 无调整 / 429' : 'Attempted / completed / no adjustment / 429'}
                  value={`${numberFormatter.format(status.reconciliationLastAttempted ?? 0)} / ${numberFormatter.format(status.reconciliationLastSettled ?? 0)} / ${numberFormatter.format(status.reconciliationLastNoAdjustment ?? 0)} / ${numberFormatter.format(status.reconciliationLastUpstream429 ?? 0)}`}
                />
                <PrivacyStat
                  label={language === 'zh' ? '投影状态 / 批量' : 'Projection / batch'}
                  value={status.reconciliationRunObservation == null
                    ? strings.statusMissing
                    : `${status.reconciliationRunObservation.projectionState} · ${numberFormatter.format(status.reconciliationRunObservation.projectionBatchSize)}`}
                />
                <PrivacyStat
                  label={language === 'zh' ? '投影累计 / 事务 P95' : 'Projection rows / transaction P95'}
                  value={status.reconciliationRunObservation == null
                    ? strings.statusMissing
                    : `${numberFormatter.format(status.reconciliationRunObservation.projectionScannedRows)} · ${numberFormatter.format(status.reconciliationRunObservation.projectionTransactionP95Ms)} ms`}
                />
                <PrivacyStat
                  label={language === 'zh' ? '结算 / 无调整 / 仅观测' : 'Settled / no adjustment / observed'}
                  value={status.reconciliationRunObservation == null
                    ? strings.statusMissing
                    : `${numberFormatter.format(status.reconciliationRunObservation.settled)} / ${numberFormatter.format(status.reconciliationRunObservation.noAdjustment)} / ${numberFormatter.format(status.reconciliationRunObservation.observed)}`}
                />
                <PrivacyStat
                  label={language === 'zh' ? '多 key 观测 / 待续跑' : 'Multi-key observed / pending'}
                  value={status.reconciliationRunObservation == null
                    ? strings.statusMissing
                    : `${numberFormatter.format(status.reconciliationRunObservation.partialKeyObservations)} / ${numberFormatter.format(status.reconciliationRunObservation.multiKeyPending)}`}
                />
                <PrivacyStat
                  label={language === 'zh' ? '远端预算让步 / 恢复 / 终态' : 'Remote budget defers / resumed / terminal'}
                  value={status.reconciliationRunObservation == null
                    ? strings.statusMissing
                    : `${numberFormatter.format(status.reconciliationRunObservation.remoteAttemptBudgetDefers)} / ${numberFormatter.format(status.reconciliationRunObservation.resumedRuns)} / ${numberFormatter.format(status.reconciliationRunObservation.terminalRuns)}`}
                />
                <PrivacyStat
                  label={language === 'zh' ? '429 / 传输 / 语义 / 本地压力' : '429 / transport / semantic / local pressure'}
                  value={status.reconciliationRunObservation == null
                    ? strings.statusMissing
                    : `${numberFormatter.format(status.reconciliationRunObservation.upstream429)} / ${numberFormatter.format(status.reconciliationRunObservation.transportFailure)} / ${numberFormatter.format(status.reconciliationRunObservation.semanticFailure)} / ${numberFormatter.format(status.reconciliationRunObservation.localPressure)}`}
                />
                <PrivacyStat
                  label={language === 'zh' ? '最近传输失败类别' : 'Last transport failure'}
                  value={status.reconciliationRunObservation?.lastTransportKind ?? (language === 'zh' ? '无' : 'None')}
                  supportingText={status.reconciliationRunObservation?.lastTransportKindAt == null
                    ? undefined
                    : formatOptionalTimestamp(status.reconciliationRunObservation.lastTransportKindAt, timestampFormatter, '-')}
                />
                <PrivacyStat
                  label={language === 'zh' ? '最近可重试结果' : 'Last retryable outcome'}
                  value={status.reconciliationRunObservation?.lastRetryableOutcome ?? (language === 'zh' ? '无' : 'None')}
                />
                <PrivacyStat
                  label={language === 'zh' ? '阶段耗时（准备 / 首次远端 / 远端）' : 'Phase ms (hydrate / first remote / remote)'}
                  value={status.reconciliationRunObservation == null
                    ? strings.statusMissing
                    : `${numberFormatter.format(status.reconciliationRunObservation.hydrateMs)} / ${status.reconciliationRunObservation.firstRemoteMs == null ? '-' : numberFormatter.format(status.reconciliationRunObservation.firstRemoteMs)} / ${numberFormatter.format(status.reconciliationRunObservation.remoteMs)}`}
                />
                <PrivacyStat
                  label={language === 'zh' ? '收尾 / Research / 续跑' : 'Finalization / research / continuation'}
                  value={status.reconciliationRunObservation == null
                    ? strings.statusMissing
                    : `${numberFormatter.format(status.reconciliationRunObservation.finalizationMs)} / ${numberFormatter.format(status.reconciliationRunObservation.researchMs)} ms · ${status.reconciliationRunObservation.continuationReason ?? (language === 'zh' ? '无' : 'None')}`}
                />
                <PrivacyStat
                  label={language === 'zh' ? '下次引擎尝试' : 'Next engine attempt'}
                  value={formatOptionalTimestamp(status.reconciliationRunObservation?.nextRetryAt ?? null, timestampFormatter, strings.statusMissing)}
                />
                <PrivacyStat
                  label={language === 'zh' ? '预算状态' : 'Budget status'}
                  value={status.reconciliationLastBudgetExhausted ? (language === 'zh' ? '已耗尽' : 'Exhausted') : (language === 'zh' ? '正常' : 'Within budget')}
                />
                <PrivacyStat
                  label={language === 'zh' ? '候选观测覆盖' : 'Candidate observation'}
                  value={status.reconciliationObservation.coverage === 'unknown'
                    ? (language === 'zh' ? '未知' : 'Unknown')
                    : `${status.reconciliationObservation.hasEligible ? (language === 'zh' ? '有候选' : 'Eligible') : (language === 'zh' ? '无候选' : 'None')} · ${formatAge(status.reconciliationObservation.oldestCandidateAgeSecs, language)}`}
                />
                <PrivacyStat
                  label={language === 'zh' ? '告警投影状态' : 'Alert projection state'}
                  value={status.dashboardAlertProjection?.staleReason ?? (status.dashboardAlertProjection?.coverage ?? strings.statusMissing)}
                />
                <PrivacyStat
                  label={language === 'zh' ? '本地退避' : 'Local backoff'}
                  value={status.reconciliationLocalBackoff.level > 0
                    ? `${language === 'zh' ? '级别' : 'Level'} ${status.reconciliationLocalBackoff.level} · ${language === 'zh' ? '压力轮' : 'streak'} ${status.reconciliationLocalBackoff.pressureStreak}`
                    : (language === 'zh' ? '无' : 'None')}
                />
                <PrivacyStat
                  label={language === 'zh' ? '下次本地尝试' : 'Next local attempt'}
                  value={formatOptionalTimestamp(status.reconciliationLocalBackoff.availableAt, timestampFormatter, strings.statusMissing)}
                />
                <PrivacyStat
                  label={diagnosticsLabels.lastShadowAdjustment}
                  value={formatOptionalTimestamp(status.lastShadowAdjustmentAt, timestampFormatter, strings.statusMissing)}
                />
                <PrivacyStat
                  label={diagnosticsLabels.lastEnqueueError}
                  value={formatOptionalTimestamp(
                    status.lastReconciliationEnqueueErrorAt,
                    timestampFormatter,
                    strings.statusMissing,
                  )}
                />
                <PrivacyStat
                  label={diagnosticsLabels.lastResearchSweep}
                  value={formatOptionalTimestamp(status.lastResearchSweepAt, timestampFormatter, strings.statusMissing)}
                />
                <PrivacyStat
                  label={diagnosticsLabels.lastResearchTerminal}
                  value={formatOptionalTimestamp(status.lastResearchTerminalAt, timestampFormatter, strings.statusMissing)}
                />
                <PrivacyStat
                  label={language === 'zh' ? '最近 Research 轮询结果' : 'Latest Research poll outcome'}
                  value={status.reconciliationResearchPollDiagnostics?.lastPollOutcome ?? strings.statusMissing}
                />
                <PrivacyStat
                  label={language === 'zh' ? 'Research 凭据冷却 Key' : 'Research credential cooldown keys'}
                  value={numberFormatter.format(status.reconciliationResearchPollDiagnostics?.credentialsCoolingKeys ?? 0)}
                />
                <PrivacyStat
                  label={language === 'zh' ? '最长 Research 等待' : 'Longest eligible Research wait'}
                  value={formatAge(
                    status.reconciliationResearchPollDiagnostics?.longestEligibleWaitSecs ?? 0,
                    language,
                  )}
                />
                <PrivacyStat
                  label={language === 'zh' ? 'Research 延后' : 'Research defers'}
                  value={language === 'zh'
                    ? `前台 ${numberFormatter.format(status.reconciliationResearchPollDiagnostics?.foregroundPressureDefers ?? 0)} · lease ${numberFormatter.format(status.reconciliationResearchPollDiagnostics?.remoteLeaseDefers ?? 0)} · 读取 ${numberFormatter.format(status.reconciliationResearchPollDiagnostics?.readBudgetDefers ?? 0)} · 控制 ${numberFormatter.format(status.reconciliationResearchPollDiagnostics?.controlDefers ?? 0)}`
                    : `Foreground ${numberFormatter.format(status.reconciliationResearchPollDiagnostics?.foregroundPressureDefers ?? 0)} · Lease ${numberFormatter.format(status.reconciliationResearchPollDiagnostics?.remoteLeaseDefers ?? 0)} · Read ${numberFormatter.format(status.reconciliationResearchPollDiagnostics?.readBudgetDefers ?? 0)} · Control ${numberFormatter.format(status.reconciliationResearchPollDiagnostics?.controlDefers ?? 0)}`}
                />
              </div>
            </div>
            </section>

            <section className="min-w-0" data-testid="system-status-reconciliation-progress">
              <div className="panel-header space-y-1">
                <h3 className="text-sm font-medium">{diagnosticsLabels.progressTitle}</h3>
                <p className="text-sm text-muted-foreground">{diagnosticsLabels.progressDescription}</p>
              </div>
              <Separator className="my-3" />
              <div className="min-w-0">
              <div className="grid min-w-0 gap-3 md:grid-cols-3">
                <ReconciliationProgressMeter
                  label={diagnosticsLabels.accountCoverage}
                  completed={status.dailyReconciliationProgress.accountsWithSettledPeriod}
                  total={status.dailyReconciliationProgress.observedAccounts}
                  numberFormatter={numberFormatter}
                />
                <ReconciliationProgressMeter
                  label={diagnosticsLabels.periodCoverage}
                  completed={status.dailyReconciliationProgress.observedPeriods - status.dailyReconciliationProgress.pendingPeriods}
                  total={status.dailyReconciliationProgress.observedPeriods}
                  supportingText={`${language === 'zh' ? '降级' : 'Degraded'} ${numberFormatter.format(status.dailyReconciliationProgress.degradedPeriods)}`}
                  numberFormatter={numberFormatter}
                />
                <ReconciliationProgressMeter
                  label={diagnosticsLabels.researchCoverage}
                  completed={status.dailyReconciliationProgress.researchTerminal}
                  total={status.dailyReconciliationProgress.researchTotal}
                  supportingText={`${diagnosticsLabels.pendingResearch} ${numberFormatter.format(status.dailyReconciliationProgress.researchPending)} · ${language === 'zh' ? '不可用' : 'Unavailable'} ${numberFormatter.format(status.dailyReconciliationProgress.researchUnavailable ?? status.reconciliationResearchPollDiagnostics?.unavailable ?? 0)}`}
                  numberFormatter={numberFormatter}
                />
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{diagnosticsLabels.keyProgressTitle}</strong>
                  <span>{numberFormatter.format(dailyKeyProgressRows.length)}</span>
                </div>
                {dailyKeyProgressRows.length === 0 ? (
                  <div className="text-sm text-muted-foreground">{diagnosticsLabels.keyProgressEmpty}</div>
                ) : (
                  <div className="flex flex-col divide-y divide-border">
                    {dailyKeyProgressRows.map((key) => (
                      <article key={key.keyIdHint} className="flex flex-wrap items-center gap-3 py-3 text-xs">
                        <code>{key.keyIdHint}</code>
                        <span>{diagnosticsLabels.pendingResearch} {numberFormatter.format(key.pendingResearch)}</span>
                        <span>{diagnosticsLabels.pendingProjectIds} {numberFormatter.format(key.pendingProjectIds)}</span>
                        <StatusBadge tone={key.cooldownUntil ? 'warning' : 'success'}>
                          {key.cooldownUntil
                            ? `${diagnosticsLabels.cooldown} · ${formatOptionalTimestamp(key.cooldownUntil, timestampFormatter, strings.statusMissing)}`
                            : diagnosticsLabels.cooldownNone}
                        </StatusBadge>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </div>
            </section>

            <section className="min-w-0" data-testid="system-status-retry-buckets">
              <div className="panel-header space-y-1">
                <h3 className="text-sm font-medium">{diagnosticsLabels.retryBucketsTitle}</h3>
                <p className="text-sm text-muted-foreground">{diagnosticsLabels.retryBucketsDescription}</p>
              </div>
              <Separator className="my-3" />
              <div className="min-w-0">
              <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <PrivacyStat
                  label={diagnosticsLabels.retryBucketUpstream429}
                  value={numberFormatter.format(status.retryBuckets.upstream429)}
                />
                <PrivacyStat
                  label={diagnosticsLabels.retryBucketLocalUsageRateLimit}
                  value={numberFormatter.format(status.retryBuckets.localUsageRateLimit)}
                />
                <PrivacyStat
                  label={diagnosticsLabels.retryBucketMissingEligibleUpstreamKey}
                  value={numberFormatter.format(status.retryBuckets.missingEligibleUpstreamKey ?? 0)}
                />
                <PrivacyStat
                  label={diagnosticsLabels.retryBucketOther}
                  value={numberFormatter.format(status.retryBuckets.other)}
                />
              </div>
            </div>
            </section>

            <section className="min-w-0" data-testid="system-status-key-activity">
              <div className="panel-header flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <h3 className="text-sm font-medium">{diagnosticsLabels.keyActivityTitle}</h3>
                  <p className="text-sm text-muted-foreground">{diagnosticsLabels.keyActivityDescription}</p>
                </div>
                <StatusBadge tone="info">{status.currentPeriodCode}</StatusBadge>
              </div>
              <Separator className="my-3" />
              <div className="min-w-0">
              <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                <KeyActivityChart
                  title={diagnosticsLabels.boundUsersByKeyTitle}
                  points={boundUsersByKeyRows}
                  emptyLabel={diagnosticsLabels.keyActivityEmpty}
                  numberFormatter={numberFormatter}
                />
                <KeyActivityChart
                  title={diagnosticsLabels.pendingProjectIdsByKeyTitle}
                  points={pendingProjectIdsByKeyRows}
                  emptyLabel={diagnosticsLabels.keyActivityEmpty}
                  numberFormatter={numberFormatter}
                />
              </div>
            </div>
            </section>

            <details className="min-w-0" data-testid="system-status-technical-details">
              <summary className="cursor-pointer space-y-2 py-3 [&_p]:text-sm [&_p]:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <div>
                  <strong>{strings.detailsTitle}</strong>
                  <p>{strings.detailsDescription}</p>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>
                    {strings.configurationTitle} · {numberFormatter.format(configurationDriftCount)}
                  </span>
                  <span>
                    {strings.adjustmentsTitle} · {numberFormatter.format(status.recentAdjustments.length)}
                  </span>
                </div>
              </summary>
              <div className="flex min-w-0 flex-col gap-4 border-t pt-4">
                <section className="min-w-0">
                  <div className="panel-header space-y-1">
                    <h3 className="text-sm font-medium">{strings.configurationTitle}</h3>
                    <p className="text-sm text-muted-foreground">
                      {configurationDriftCount === 0 ? strings.configurationAligned : strings.detailsDescription}
                    </p>
                  </div>
                  <Separator className="my-3" />
              <div className="min-w-0">
                  <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <PrivacyStat
                      label={strings.projectIdModeConfigured}
                      value={modeLabel(formStrings, status.configuredProjectIdMode)}
                    />
                    <PrivacyStat
                      label={strings.projectIdModeEffective}
                      value={modeLabel(formStrings, status.effectiveProjectIdMode)}
                    />
                    {showFixedProjectIdState ? (
                      <PrivacyStat
                        label={strings.fixedConfigured}
                        value={status.fixedProjectIdConfigured ? strings.statusConfigured : strings.statusMissing}
                      />
                    ) : null}
                    <PrivacyStat
                      label={strings.userAgentConfigured}
                      value={formatOptionalValue(status.configuredMcpUserAgent, strings.statusOmitted)}
                    />
                    <PrivacyStat
                      label={strings.userAgentEffective}
                      value={formatOptionalValue(status.effectiveMcpUserAgent, strings.statusOmitted)}
                    />
                    <PrivacyStat
                      label={strings.reconciliationMode}
                      value={reconciliationModeLabel}
                    />
                    <PrivacyStat label={strings.generatedAt} value={timestampFormatter.format(new Date(status.generatedAt * 1000))} />
                  </div>
                </div>
            </section>

                <section className="min-w-0">
                  <div className="panel-header space-y-1">
                    <h3 className="text-sm font-medium">{strings.gateTitle}</h3>
                    <p className="text-sm text-muted-foreground">{strings.gateDescription}</p>
                  </div>
                  <Separator className="my-3" />
              <div className="min-w-0">
                  <div className="flex min-w-0 flex-col divide-y divide-border">
                    {status.gates.map((gate) => (
                      <article key={gate.key} className="min-w-0 space-y-2 py-3 [&_code]:block [&_code]:break-all [&_code]:text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong>{gateLabel(strings, language, gate)}</strong>
                          <StatusBadge tone={gate.ready ? 'success' : 'warning'}>
                            {gate.ready ? strings.gateReady : strings.gateWaiting}
                          </StatusBadge>
                        </div>
                        <code>{gate.detail}</code>
                      </article>
                    ))}
                  </div>
                </div>
            </section>

                <section className="min-w-0">
                  <div className="panel-header space-y-1">
                    <h3 className="text-sm font-medium">{strings.headersTitle}</h3>
                  </div>
                  <Separator className="my-3" />
              <div className="min-w-0">
                  <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                    <HeaderList title={strings.headersHttpTitle} items={status.httpAllowedHeaders} />
                    <HeaderList title={strings.headersControlTitle} items={status.controlMcpAllowedHeaders} />
                  </div>
                </div>
            </section>

                <section className="min-w-0">
                  <div className="panel-header space-y-1">
                    <h3 className="text-sm font-medium">{strings.adjustmentsTitle}</h3>
                  </div>
                  <Separator className="my-3" />
              <div className="min-w-0">
                  {status.recentAdjustments.length === 0 ? (
                    <Empty><EmptyDescription>{strings.adjustmentsEmpty}</EmptyDescription></Empty>
                  ) : (
                    <div className="flex min-w-0 flex-col divide-y divide-border">
                      {status.recentAdjustments.map((adjustment) => (
                        <article key={adjustment.settlementKey} className="min-w-0 space-y-3 py-3 [&_dl]:space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <strong>{adjustment.periodCode}</strong>
                            <StatusBadge tone={adjustment.deltaCredits >= 0 ? 'warning' : 'success'}>
                              {formatSignedCount(adjustment.deltaCredits)}
                            </StatusBadge>
                          </div>
                          <dl>
                            <PrivacyDetail label={strings.adjustmentSubject} value={`${adjustment.billingSubjectKind}:${adjustment.tokenIdHint}`} />
                            <PrivacyDetail label={strings.adjustmentCreatedAt} value={timestampFormatter.format(new Date(adjustment.createdAt * 1000))} />
                            <PrivacyDetail label={strings.adjustmentSettlementKey} value={adjustment.settlementKey} monospace />
                            {adjustment.degradedReason ? (
                              <PrivacyDetail label={strings.degradedReason} value={adjustment.degradedReason} />
                            ) : null}
                          </dl>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
            </section>
              </div>
            </details>
          </div>
        )}
      </AdminLoadingRegion>
    </Card>
  )
}

function HeaderList({ title, items }: { title: string; items: string[] }): React.JSX.Element {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <strong>{title}</strong>
      {items.length === 0 ? (
        <span className="text-sm text-muted-foreground">—</span>
      ) : (
        <div className="flex flex-wrap gap-2 [&_code]:break-all [&_code]:rounded-md [&_code]:bg-muted [&_code]:px-2 [&_code]:py-1 [&_code]:text-xs">
          {items.map((item) => (
            <code key={item}>{item}</code>
          ))}
        </div>
      )}
    </div>
  )
}

function KeyActivityChart({
  title,
  points,
  emptyLabel,
  numberFormatter,
}: {
  title: string
  points: UpstreamKeyActivityPoint[]
  emptyLabel: string
  numberFormatter: Intl.NumberFormat
}): React.JSX.Element {
  const maxCount = points.reduce((max, point) => Math.max(max, point.count), 0)

  return (
    <article className="min-w-0 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <strong>{title}</strong>
        <span>{numberFormatter.format(points.length)}</span>
      </div>
      {points.length === 0 ? (
        <div className="text-sm text-muted-foreground">{emptyLabel}</div>
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          {points.map((point) => {
            const percentage = maxCount <= 0 ? 0 : Math.max(4, Math.round((point.count / maxCount) * 100))
            return (
              <div key={point.keyIdHint} className="min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <code>{point.keyIdHint}</code>
                  <strong>{numberFormatter.format(point.count)}</strong>
                </div>
                <Progress value={percentage} aria-label={`${title} · ${point.keyIdHint}`} />
              </div>
            )
          })}
        </div>
      )}
    </article>
  )
}

function ReconciliationProgressMeter({
  label,
  completed,
  total,
  supportingText,
  numberFormatter,
}: {
  label: string
  completed: number
  total: number
  supportingText?: string
  numberFormatter: Intl.NumberFormat
}): React.JSX.Element {
  const boundedCompleted = Math.max(0, Math.min(completed, total))
  const percentage = total <= 0 ? 0 : Math.round((boundedCompleted / total) * 100)
  return (
    <article className="flex min-w-0 flex-col gap-2 [&>div:first-child]:flex [&>div:first-child]:flex-wrap [&>div:first-child]:justify-between [&>div:first-child]:gap-2 [&_small]:text-xs [&_small]:text-muted-foreground">
      <div>
        <span>{label}</span>
        <strong>{numberFormatter.format(boundedCompleted)}/{numberFormatter.format(total)}</strong>
      </div>
      <Progress value={percentage} aria-label={label} />
      <small>{supportingText ?? `${numberFormatter.format(percentage)}%`}</small>
    </article>
  )
}

function PrivacyStat({
  label,
  value,
  supportingText,
  monospace = false,
}: {
  label: string
  value: string
  supportingText?: string
  monospace?: boolean
}): React.JSX.Element {
  return (
    <article className="flex min-w-0 flex-col gap-1 [&_span]:text-xs [&_span]:text-muted-foreground [&_strong]:break-all [&_strong]:text-lg [&_strong]:font-semibold [&_strong]:tabular-nums [&_small]:break-all [&_small]:text-xs [&_small]:text-muted-foreground">
      <span>{label}</span>
      <strong className={monospace ? 'font-mono' : undefined}>{value}</strong>
      {supportingText ? <small>{supportingText}</small> : null}
    </article>
  )
}

function PrivacyDetail({
  label,
  value,
  monospace = false,
}: {
  label: string
  value: string
  monospace?: boolean
}): React.JSX.Element {
  return (
    <div className="min-w-0 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-all">
      <dt>{label}</dt>
      <dd className={monospace ? 'font-mono' : undefined}>{value}</dd>
    </div>
  )
}
