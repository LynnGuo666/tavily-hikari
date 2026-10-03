import { ArrowRight, CircleAlert, Crown, RotateCcw, Server, ShieldCheck } from 'lucide-react'
import type React from 'react'

import type { HaStatus, HaTimelineEvent } from '../api'
import type { AdminTranslations } from '../i18n'
import { useLanguage, useTranslate } from '../i18n'
import {
  formatHaPeerMessage,
  formatHaRecoveryStatus,
  formatHaStatusMessage,
  formatHaTimelineDetail,
  formatHaTimelineStatusLabel,
  formatHaTimelineSummary,
} from '../lib/haCopy'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { StatusBadge, type StatusTone } from './StatusBadge'

interface HaStatusBannerProps {
  status: HaStatus | null
  audience: 'admin' | 'user'
  strings?: AdminTranslations['systemSettings']['ha']
  language?: 'en' | 'zh'
  adminVariant?: 'panel' | 'compact'
  onConfigureSource?: () => void
  onPromote?: () => void
  onFinalize?: () => void
  onPlannedCutover?: (targetNodeId: string) => void
  busy?: boolean
  compactHref?: string
  compactTitle?: string
  compactDescription?: string
  compactActionLabel?: string
  onCompactClick?: () => void
  onOpenNodeDetails?: (nodeId: string) => void
  timeline?: HaTimelineEvent[]
  timelineLoading?: boolean
  onLoadMoreTimeline?: (() => void) | null
  hasMoreTimeline?: boolean
}

function localeFor(language: 'en' | 'zh'): string {
  return language === 'zh' ? 'zh-CN' : 'en-US'
}

function formatTimestamp(value: number | null, language: 'en' | 'zh'): string {
  if (value == null) return '—'
  return new Intl.DateTimeFormat(localeFor(language), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value * 1000))
}

function formatCompactTimestamp(value: number | null, language: 'en' | 'zh'): string {
  if (value == null) return '—'
  return new Intl.DateTimeFormat(localeFor(language), {
    month: language === 'zh' ? 'numeric' : 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value * 1000))
}

function formatDateTimeAttr(value: number | null): string | undefined {
  if (value == null) return undefined
  return new Date(value * 1000).toISOString()
}

function formatLag(value: number | null, language: 'en' | 'zh'): string {
  if (value == null) return '—'
  if (value < 60) return language === 'zh' ? `${value}秒` : `${value}s`
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  if (language === 'zh') return seconds === 0 ? `${minutes}分` : `${minutes}分${seconds}秒`
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`
}

function roleLabel(role: HaStatus['role'], strings: AdminTranslations['systemSettings']['ha']): string {
  if (role === 'full_master') return strings.roleFullMaster
  if (role === 'provisional_master') return strings.roleProvisionalMaster
  if (role === 'standby') return strings.roleStandby
  return strings.roleRecovery
}

function sourceKindLabel(kind: string | null, strings: AdminTranslations['systemSettings']['ha']): string {
  if (kind === 'direct') return strings.sourceKindDirect
  if (kind === 'origin_group') return strings.sourceKindOriginGroup
  return '—'
}

interface HaNodeRow {
  key: string
  nodeId: string
  relation: string
  isLocalNode: boolean
  role: string
  origin: string
  health: string
  healthTone: StatusTone
  lastSync: string
  lastSyncTitle?: string
  lastSyncDateTime?: string
  promotedAt: string
  promotedAtTitle?: string
  promotedAtDateTime?: string
  actionKind: 'promote' | 'finalize' | 'serving' | 'blocked' | 'planned_cutover' | 'observe'
  targetNodeId?: string
}

function buildNodeRows(status: HaStatus, strings: AdminTranslations['systemSettings']['ha'], language: 'en' | 'zh'): HaNodeRow[] {
  const rows: HaNodeRow[] = [
    {
      key: 'local',
      nodeId: status.nodeId,
      relation: strings.thisAdminNodeLabel,
      isLocalNode: true,
      role: roleLabel(status.role, strings),
      origin: status.haSourceEffective?.target ?? status.haSourceOverride?.target ?? status.haSourceDefaults?.target ?? '—',
      health:
        status.role === 'full_master'
          ? strings.healthServingWrites
          : status.role === 'provisional_master'
            ? strings.healthFinalizeRequired
            : status.role === 'standby'
              ? strings.healthReadyStandby
              : strings.healthRecoveryRequired,
      healthTone:
        status.role === 'full_master'
          ? 'success'
          : status.role === 'provisional_master'
            ? 'warning'
            : status.role === 'standby'
              ? 'info'
              : 'error',
      lastSync: formatCompactTimestamp(status.lastSyncAt, language),
      lastSyncTitle: formatTimestamp(status.lastSyncAt, language),
      lastSyncDateTime: formatDateTimeAttr(status.lastSyncAt),
      promotedAt:
        status.role === 'full_master' || status.role === 'provisional_master'
          ? formatCompactTimestamp(status.lastEdgeoneCheckAt, language)
          : '—',
      promotedAtTitle:
        status.role === 'full_master' || status.role === 'provisional_master'
          ? formatTimestamp(status.lastEdgeoneCheckAt, language)
          : undefined,
      promotedAtDateTime:
        status.role === 'full_master' || status.role === 'provisional_master'
          ? formatDateTimeAttr(status.lastEdgeoneCheckAt)
          : undefined,
      actionKind:
        status.role === 'standby'
          ? 'promote'
          : status.role === 'provisional_master'
            ? 'finalize'
            : status.role === 'full_master'
              ? 'serving'
              : 'blocked',
    },
  ]
  for (const peer of status.peerNodes ?? []) {
    const relation = peer.roleHint === 'standby_candidate'
      ? strings.relationStandbyCandidate
      : strings.relationObserver
    const healthTone: StatusTone = peer.stale
      ? 'warning'
      : peer.role === 'full_master'
        ? 'success'
        : peer.role === 'standby'
          ? 'info'
          : peer.role === 'recovery'
            ? 'error'
            : 'neutral'
    const health = peer.stale
      ? strings.healthStale
      : peer.recoveryStatus
        ? strings.healthRecoveryRequired
        : peer.plannedCutoverEligible
          ? strings.healthReadyStandby
          : peer.role === 'full_master'
            ? strings.healthServingWrites
            : formatHaPeerMessage(peer, strings)
              ?? (peer.role === 'standby' ? strings.healthConfigured : '—')
    rows.push({
      key: `peer-${peer.nodeId}`,
      nodeId: peer.nodeId,
      relation,
      isLocalNode: false,
      role: peer.role ? roleLabel(peer.role, strings) : '—',
      origin: peer.sourceConfigTarget ?? '—',
      health,
      healthTone,
      lastSync: formatCompactTimestamp(peer.lastSyncAt, language),
      lastSyncTitle: formatTimestamp(peer.lastSyncAt, language),
      lastSyncDateTime: formatDateTimeAttr(peer.lastSyncAt),
      promotedAt: formatCompactTimestamp(peer.lastSeenAt, language),
      promotedAtTitle: formatTimestamp(peer.lastSeenAt, language),
      promotedAtDateTime: formatDateTimeAttr(peer.lastSeenAt),
      actionKind: peer.plannedCutoverEligible ? 'planned_cutover' : 'observe',
      targetNodeId: peer.nodeId,
    })
  }

  return rows
}

function adminNeedsAttention(status: HaStatus): boolean {
  return status.mode !== 'single'
    && (status.degraded || status.role !== 'full_master' || !status.allowsFullWrites || status.syncDisabledReason != null)
}

function syncDisabledMessage(
  reason: string | null,
  strings: AdminTranslations['systemSettings']['ha'],
): string | null {
  if (!reason) return null
  return reason === 'no_configured_peers'
    ? strings.syncDisabledNoConfiguredPeers
    : strings.syncDisabledUnknown
}

export default function HaStatusBanner({
  status,
  audience,
  strings,
  language,
  adminVariant = 'panel',
  onConfigureSource,
  onPromote,
  onFinalize,
  onPlannedCutover,
  busy = false,
  compactHref,
  compactTitle,
  compactDescription,
  compactActionLabel,
  onCompactClick,
  timeline = [],
  timelineLoading = false,
  onLoadMoreTimeline = null,
  hasMoreTimeline = false,
  onOpenNodeDetails,
}: HaStatusBannerProps): React.JSX.Element | null {
  const fallbackStrings = useTranslate().admin.systemSettings.ha
  const fallbackLanguage = useLanguage().language
  const admin = audience === 'admin'
  if (!status || status.mode === 'single' || (!admin && !status.degraded)) return null
  const labels = strings ?? fallbackStrings
  const lang = language ?? fallbackLanguage

  const title =
    status.role === 'provisional_master'
      ? labels.panelTitle
      : status.role === 'standby'
        ? labels.panelTitle
        : status.role === 'recovery'
          ? labels.panelTitle
          : labels.panelTitle
  const detail =
    status.role === 'provisional_master'
      ? labels.panelDescriptionProvisionalMaster
      : status.role === 'standby'
        ? labels.panelDescriptionStandby
        : status.role === 'recovery'
          ? labels.panelDescriptionRecovery
          : labels.panelDescriptionFullMaster
  const toneClass = status.role === 'full_master' ? 'ha-status-banner-active' : ''
  const rows = buildNodeRows(status, labels, lang)
  const syncDiagnostic = syncDisabledMessage(status.syncDisabledReason, labels)
  const authorityLabel = status.allowsFullWrites
    ? labels.authorityFullWrites
    : status.allowsBasicBusiness
      ? labels.authorityBasicTraffic
      : labels.authorityWritesBlocked
  const authorityTone: StatusTone = status.allowsFullWrites ? 'success' : status.allowsBasicBusiness ? 'warning' : 'neutral'

  if (admin && adminVariant === 'compact') {
    if (!adminNeedsAttention(status)) return null
    return (
      <section className="ha-status-banner ha-status-banner-compact rounded-xl border border-warning/30 bg-warning/10 p-4" role="status" aria-live="polite">
        <div className="ha-status-banner-head flex flex-wrap items-start gap-3">
          <div className="ha-status-banner-icon shrink-0 text-warning" aria-hidden="true">
            <CircleAlert size={20} strokeWidth={2.4} />
          </div>
          <div className="ha-status-banner-copy min-w-0 flex-1 space-y-1 text-sm">
            <div className="ha-status-banner-title font-medium">{compactTitle ?? labels.compactTitle}</div>
            <p>{syncDiagnostic ?? compactDescription ?? labels.compactDescription}</p>
          </div>
          {compactHref && compactActionLabel && (
            <Button asChild size="sm" variant="outline" className="ha-status-banner-action">
              <a
                href={compactHref}
                onClick={(event) => {
                  if (!onCompactClick) return
                  event.preventDefault()
                  onCompactClick()
                }}
              >
                <span>{compactActionLabel}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </Button>
          )}
        </div>
      </section>
    )
  }

  if (admin) {
    return (
      <Card className="ha-node-panel min-w-0" aria-labelledby="ha-node-panel-title">
        <CardHeader className="ha-node-panel-head flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="ha-node-panel-title-group min-w-0 space-y-1">
            <div className="ha-node-panel-kicker text-xs font-medium text-muted-foreground">{labels.panelKicker}</div>
            <CardTitle><h2 id="ha-node-panel-title">{title}</h2></CardTitle>
            <CardDescription>{detail}</CardDescription>
          </div>
          <div className="ha-node-panel-head-actions flex shrink-0 flex-wrap items-center gap-2">
            {onConfigureSource ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="ha-node-configure-button"
                onClick={onConfigureSource}
              >
                {labels.configureSource}
              </Button>
            ) : null}
            <StatusBadge tone={authorityTone}>{authorityLabel}</StatusBadge>
          </div>
        </CardHeader>

        <CardContent className="flex min-w-0 flex-col gap-6">
        <dl className="ha-status-summary grid grid-cols-2 gap-4 sm:grid-cols-2 xl:grid-cols-3 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-all [&_dd]:font-medium [&_dd]:tabular-nums" aria-label={labels.title}>
          <div><dt>{labels.summaryCoreMode}</dt><dd>{status.dualActiveEnabled ? labels.coreModeDualActive : labels.coreModeActiveStandby}</dd></div>
          <div><dt>{labels.summaryControlLeader}</dt><dd>{status.fullMasterNodeId ?? '—'}</dd></div>
          <div><dt>{labels.summaryConfiguredPeers}</dt><dd>{status.peerCount}</dd></div>
          <div><dt>{labels.summaryEdgeoneDomain}</dt><dd>{status.edgeoneDomain ?? '—'}</dd></div>
          <div><dt>{labels.summaryCurrentOrigin}</dt><dd>{status.edgeoneCurrentTarget ?? status.edgeoneOrigin ?? '—'}</dd></div>
          <div><dt>{labels.summaryExpectedOrigin}</dt><dd>{status.edgeoneExpectedOrigin ?? '—'}</dd></div>
          <div><dt>{labels.summaryCurrentSource}</dt><dd>{sourceKindLabel(status.edgeoneCurrentSourceKind, labels)}</dd></div>
          <div><dt>{labels.summaryExpectedSource}</dt><dd>{sourceKindLabel(status.edgeoneExpectedSourceKind, labels)}</dd></div>
          <div><dt>{labels.summarySyncLag}</dt><dd>{formatLag(status.syncLagSeconds, lang)}</dd></div>
          <div><dt>{labels.summaryEdgeoneApi}</dt><dd>{status.edgeoneApiConfigured ? labels.healthServingEdgeone : labels.healthNotRouted}</dd></div>
          <div><dt>{labels.summaryRecovery}</dt><dd>{formatHaRecoveryStatus(status.recoveryStatus, labels) ?? '—'}</dd></div>
        </dl>

        {syncDiagnostic && (
          <div className="ha-status-message ha-status-message-warning flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-sm [&_svg]:shrink-0" role="alert">
            <CircleAlert size={16} aria-hidden="true" />
            <span>{syncDiagnostic}</span>
          </div>
        )}

        <div className="ha-node-list flex min-w-0 flex-col gap-3" aria-label={labels.nodeInventoryTitle}>
          <div className="ha-node-list-title flex items-center gap-2 font-medium">
            <Server size={18} aria-hidden="true" />
            <span>{labels.nodeInventoryTitle}</span>
          </div>
          <Table className="ha-node-grid block lg:table"  aria-label={labels.nodeInventoryTitle}>
            <TableHeader className="hidden lg:table-header-group"><TableRow className="ha-node-grid-row ha-node-grid-head hidden lg:table-row" >
              <TableHead className="ha-node-cell ha-node-cell--identity" >{labels.nodeHeader}</TableHead>
              <TableHead className="ha-node-cell ha-node-cell--role" >{labels.roleHeader}</TableHead>
              <TableHead className="ha-node-cell ha-node-cell--origin" >{labels.originHeader}</TableHead>
              <TableHead className="ha-node-cell ha-node-cell--health" >{labels.healthHeader}</TableHead>
              <TableHead className="ha-node-cell ha-node-cell--time" >{labels.lastSyncHeader}</TableHead>
              <TableHead className="ha-node-cell ha-node-cell--time" >{labels.promotedAtHeader}</TableHead>
              <TableHead className="ha-node-cell ha-node-cell--action" >{labels.actionHeader}</TableHead>
            </TableRow></TableHeader>
            <TableBody className="block lg:table-row-group">{rows.map((row) => (
              <TableRow className="ha-node-grid-row flex flex-col gap-3 py-4 lg:table-row lg:py-0"  key={row.key}>
                <TableCell

                  className="ha-node-cell ha-node-cell--identity ha-node-identity flex min-w-0 items-start justify-between gap-4 whitespace-normal p-0 before:shrink-0 before:text-xs before:text-muted-foreground before:content-[attr(data-label)] lg:table-cell lg:p-2 lg:before:hidden"
                  data-label={labels.nodeHeader}
                >
                  <div className="flex min-w-0 flex-col gap-1 text-right lg:text-left">{onOpenNodeDetails && !row.isLocalNode ? (
                    <Button variant="link"
                      type="button"
                      className="ha-node-link h-auto justify-start p-0 text-left whitespace-normal break-all"
                      onClick={() => onOpenNodeDetails(row.nodeId)}
                    >
                      <strong>{row.nodeId}</strong>
                    </Button>
                  ) : (
                    <strong>{row.nodeId}</strong>
                  )}
                  <span className="text-xs text-muted-foreground">{row.relation}</span></div>
                </TableCell>
                <TableCell  className="ha-node-cell ha-node-cell--role lg:whitespace-nowrap flex min-w-0 items-start justify-between gap-4 whitespace-normal p-0 before:shrink-0 before:text-xs before:text-muted-foreground before:content-[attr(data-label)] lg:table-cell lg:p-2 lg:before:hidden" data-label={labels.roleHeader}>
                  {row.role}
                </TableCell>
                <TableCell  className="ha-node-cell ha-node-cell--origin flex min-w-0 items-start justify-between gap-4 whitespace-normal p-0 before:shrink-0 before:text-xs before:text-muted-foreground before:content-[attr(data-label)] lg:table-cell lg:p-2 lg:before:hidden" data-label={labels.originHeader}>
                  <code className="max-w-[16rem] break-all text-right text-xs lg:text-left">{row.origin}</code>
                </TableCell>
                <TableCell  className="ha-node-cell ha-node-cell--health flex min-w-0 items-start justify-between gap-4 whitespace-normal p-0 before:shrink-0 before:text-xs before:text-muted-foreground before:content-[attr(data-label)] lg:table-cell lg:p-2 lg:before:hidden" data-label={labels.healthHeader}>
                  <StatusBadge className="h-auto max-w-[15rem] justify-start whitespace-normal text-left" tone={row.healthTone}>{row.health}</StatusBadge>
                </TableCell>
                <TableCell  className="ha-node-cell ha-node-cell--time lg:whitespace-nowrap flex min-w-0 items-start justify-between gap-4 whitespace-normal p-0 before:shrink-0 before:text-xs before:text-muted-foreground before:content-[attr(data-label)] lg:table-cell lg:p-2 lg:before:hidden" data-label={labels.lastSyncHeader}>
                  <time dateTime={row.lastSyncDateTime} title={row.lastSyncTitle}>
                    {row.lastSync}
                  </time>
                </TableCell>
                <TableCell  className="ha-node-cell ha-node-cell--time lg:whitespace-nowrap flex min-w-0 items-start justify-between gap-4 whitespace-normal p-0 before:shrink-0 before:text-xs before:text-muted-foreground before:content-[attr(data-label)] lg:table-cell lg:p-2 lg:before:hidden" data-label={labels.promotedAtHeader}>
                  <time dateTime={row.promotedAtDateTime} title={row.promotedAtTitle}>
                    {row.promotedAt}
                  </time>
                </TableCell>
                <TableCell

                  className="ha-node-cell ha-node-cell--action ha-node-action flex min-w-0 items-start justify-between gap-4 whitespace-normal p-0 before:shrink-0 before:text-xs before:text-muted-foreground before:content-[attr(data-label)] lg:table-cell lg:p-2 lg:before:hidden"
                  data-label={labels.actionHeader}
                >
                  {row.actionKind === 'promote' && onPromote && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="ha-node-action-button border-warning/40 bg-warning/10 text-warning hover:bg-warning/20"
                      onClick={onPromote}
                      disabled={busy}
                    >
                      <Crown className="h-4 w-4" aria-hidden="true" />
                      {labels.promoteToMaster}
                    </Button>
                  )}
                  {row.actionKind === 'finalize' && onFinalize && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="ha-node-action-button border-success/40 bg-success/10 text-success hover:bg-success/20"
                      onClick={onFinalize}
                      disabled={busy}
                    >
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      {labels.finalizeMaster}
                    </Button>
                  )}
                  {row.actionKind === 'serving' && (
                    <span className="ha-node-action-note">{labels.actionServing}</span>
                  )}
                  {row.actionKind === 'blocked' && (
                    <span className="ha-node-action-note">{labels.actionRecoverFirst}</span>
                  )}
                  {row.actionKind === 'planned_cutover' && row.targetNodeId && onPlannedCutover && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="ha-node-action-button border-warning/40 bg-warning/10 text-warning hover:bg-warning/20"
                      onClick={() => onPlannedCutover(row.targetNodeId!)}
                      disabled={busy}
                    >
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      {labels.actionPlannedCutover}
                    </Button>
                  )}
                  {row.actionKind === 'observe' && (
                    <span className="ha-node-action-note">
                      {row.relation === labels.relationStandbyCandidate
                        ? labels.actionNotEligibleNow
                        : labels.actionObserveOnly}
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        </div>

        <div className="ha-node-list flex min-w-0 flex-col gap-3" aria-label={labels.plannedCutoverTitle}>
          <div className="ha-node-list-title flex items-center gap-2 font-medium">
            <Crown size={18} aria-hidden="true" />
            <span>{labels.plannedCutoverTitle}</span>
          </div>
          <div className="ha-status-message flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground [&_svg]:shrink-0">
            <span>{labels.plannedCutoverDescription}</span>
          </div>
        </div>

        <div className="ha-node-list flex min-w-0 flex-col gap-3" aria-label={labels.timelineTitle}>
          <div className="ha-node-list-title flex items-center gap-2 font-medium">
            <RotateCcw size={18} aria-hidden="true" />
            <span>{labels.timelineTitle}</span>
          </div>
          {timeline.length === 0 ? (
            <div className="ha-status-message flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground [&_svg]:shrink-0">
              <span>{timelineLoading ? labels.timelineLoading : labels.timelineEmpty}</span>
            </div>
          ) : (
            <div className="ha-timeline-list flex min-w-0 flex-col divide-y divide-border">
              {timeline.map((event) => (
                <details key={event.id} className="ha-timeline-item py-3 [&_summary]:cursor-pointer [&_summary]:space-x-2 [&_summary]:text-sm">
                  <summary>
                    <span>{formatHaTimelineSummary(event, labels)}</span>
                    <StatusBadge
                      tone={
                        event.status === 'success'
                          ? 'success'
                          : event.status === 'running'
                            ? 'warning'
                            : event.status === 'error'
                              ? 'error'
                            : 'neutral'
                      }
                    >
                      {formatHaTimelineStatusLabel(event.status, labels)}
                    </StatusBadge>
                  </summary>
                  <div className="ha-timeline-meta mt-3 flex flex-col gap-2 text-xs text-muted-foreground [&_pre]:max-w-full [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:whitespace-pre-wrap [&_pre]:break-all">
                    <div>{formatTimestamp(event.createdAt, lang)}</div>
                    {formatHaTimelineDetail(event, labels) ? <p>{formatHaTimelineDetail(event, labels)}</p> : null}
                    {event.technicalDetails ? (
                      <pre>{JSON.stringify(event.technicalDetails, null, 2)}</pre>
                    ) : null}
                  </div>
                </details>
              ))}
              {hasMoreTimeline && onLoadMoreTimeline && (
                <Button type="button" variant="outline" size="sm" onClick={onLoadMoreTimeline} disabled={timelineLoading}>
                  {timelineLoading ? labels.timelineLoading : labels.timelineLoadMore}
                </Button>
              )}
            </div>
          )}
        </div>

        {formatHaStatusMessage(status, labels) && (
          <div className="ha-status-message flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground [&_svg]:shrink-0">
            <RotateCcw size={16} aria-hidden="true" />
            <span>{formatHaStatusMessage(status, labels)}</span>
          </div>
        )}
        </CardContent>
      </Card>
    )
  }

  return (
    <section className={`ha-status-banner ${toneClass} rounded-xl border border-warning/30 bg-warning/10 p-4`} role="status" aria-live="polite">
      <div className="ha-status-banner-head flex flex-wrap items-start gap-3">
        <div className="ha-status-banner-icon shrink-0 text-warning" aria-hidden="true">
          <CircleAlert size={22} strokeWidth={2.4} />
        </div>
        <div className="ha-status-banner-copy min-w-0 flex-1 space-y-1 text-sm">
          <div className="ha-status-banner-title font-medium">{title}</div>
          <p>{detail}</p>
        </div>
      </div>
    </section>
  )
}
