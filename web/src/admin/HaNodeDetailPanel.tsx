import { ArrowLeft, RotateCcw, Server } from 'lucide-react'

import type { HaNodeDetail, HaTimelineEvent } from '../api'
import type { AdminTranslations } from '../i18n'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge, type StatusTone } from '../components/StatusBadge'
import {
  formatHaPeerMessage,
  formatHaRecoveryStatus,
  formatHaTimelineDetail,
  formatHaTimelineStatusLabel,
  formatHaTimelineSummary,
} from '../lib/haCopy'

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

function formatLag(value: number | null, language: 'en' | 'zh'): string {
  if (value == null) return '—'
  if (value < 60) return language === 'zh' ? `${value}秒` : `${value}s`
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  if (language === 'zh') return seconds === 0 ? `${minutes}分` : `${minutes}分${seconds}秒`
  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`
}

function numberFormat(value: number, language: 'en' | 'zh'): string {
  return new Intl.NumberFormat(localeFor(language), { maximumFractionDigits: 1 }).format(value)
}

function formatSignedNumber(value: number | null | undefined, language: 'en' | 'zh'): string {
  if (value == null) return '—'
  return `${value > 0 ? '+' : ''}${numberFormat(value, language)}`
}

function channelLabel(channel: string, language: 'en' | 'zh'): string {
  if (language === 'zh') {
    return channel === 'control' ? 'Control' : channel === 'billing' ? 'Billing' : 'Runtime'
  }
  return channel.charAt(0).toUpperCase() + channel.slice(1)
}

function channelStateLabel(state: string, language: 'en' | 'zh'): string {
  const labels: Record<string, [string, string]> = {
    healthy: ['健康', 'Healthy'],
    catching_up: ['追赶中', 'Catching up'],
    baseline_required: ['需要 baseline', 'Baseline required'],
    expired_backlog: ['存在过期积压', 'Expired backlog'],
    unavailable: ['源端不可用', 'Source unavailable'],
    source: ['源端', 'Source'],
    unknown: ['未知', 'Unknown'],
  }
  const normalizedState = state.trim() || 'unknown'
  return labels[normalizedState]?.[language === 'zh' ? 0 : 1] ?? normalizedState
}

function gcStateLabel(state: string | null | undefined, language: 'en' | 'zh'): string {
  const labels: Record<string, [string, string]> = {
    eligible: ['可执行', 'Eligible'],
    idle: ['空闲', 'Idle'],
    draining: ['清理中', 'Draining'],
    deferred: ['已让步', 'Deferred'],
    recovering: ['恢复中', 'Recovering'],
    stalled: ['停滞', 'Stalled'],
    stale: ['已过期', 'Stale'],
    unknown: ['未知', 'Unknown'],
  }
  const normalizedState = state?.trim() || 'unknown'
  return labels[normalizedState]?.[language === 'zh' ? 0 : 1] ?? normalizedState
}

function gcStateTone(state: string | null | undefined): StatusTone {
  switch (state ?? 'unknown') {
    case 'eligible':
    case 'idle':
      return 'success'
    case 'draining':
    case 'deferred':
    case 'recovering':
      return 'warning'
    case 'stalled':
      return 'error'
    default:
      return 'neutral'
  }
}

function gcSloLabel(state: string, language: 'en' | 'zh'): string {
  const labels: Record<string, [string, string]> = {
    clear: ['已清除', 'Clear'],
    on_track: ['按 SLO 推进', 'On track'],
    breached: ['已超 SLO', 'SLO breached'],
    not_applicable: ['不适用', 'N/A'],
    unknown: ['未知', 'Unknown'],
  }
  return labels[state]?.[language === 'zh' ? 0 : 1] ?? state
}

function formatRetention(value: number, language: 'en' | 'zh'): string {
  const days = Math.round(value / 86_400)
  return language === 'zh' ? `${days} 天` : `${days} days`
}

function roleLabel(
  role: HaNodeDetail['node']['role'],
  strings: AdminTranslations['systemSettings']['ha'],
): string {
  if (role === 'full_master') return strings.roleFullMaster
  if (role === 'provisional_master') return strings.roleProvisionalMaster
  if (role === 'standby') return strings.roleStandby
  if (role === 'recovery') return strings.roleRecovery
  return '—'
}

function timelineStatusTone(status: HaTimelineEvent['status']): StatusTone {
  if (status === 'success') return 'success'
  if (status === 'running' || status === 'warning') return 'warning'
  if (status === 'error') return 'error'
  return 'neutral'
}

function roleTone(role: HaNodeDetail['node']['role']): StatusTone {
  if (role === 'full_master') return 'success'
  if (role === 'provisional_master' || role === 'recovery') return 'warning'
  if (role === 'standby') return 'neutral'
  return 'neutral'
}

function cutoverTone(node: HaNodeDetail['node']): StatusTone {
  if (node.plannedCutoverEligible) return 'success'
  if (node.stale) return 'warning'
  return 'neutral'
}

function cutoverLabel(
  node: HaNodeDetail['node'],
  strings: AdminTranslations['systemSettings']['ha'],
): string {
  if (node.plannedCutoverEligible) return strings.nodeDetailEligible
  if (node.stale) return strings.healthStale
  if (node.roleHint === 'standby_candidate') return strings.actionNotEligibleNow
  return strings.actionObserveOnly
}

function trafficAuthority(
  node: HaNodeDetail['node'],
  strings: AdminTranslations['systemSettings']['ha'],
): { tone: StatusTone; label: string } {
  if (node.allowsFullWrites) {
    return { tone: 'success', label: strings.authorityFullWrites }
  }
  if (node.allowsBasicBusiness) {
    return { tone: 'neutral', label: strings.authorityBasicTraffic }
  }
  return { tone: 'warning', label: strings.authorityWritesBlocked }
}

function writeAuthority(
  node: HaNodeDetail['node'],
  strings: AdminTranslations['systemSettings']['ha'],
): { tone: StatusTone; label: string } {
  if (node.allowsFullWrites) {
    return { tone: 'success', label: strings.authorityFullWrites }
  }
  return { tone: 'warning', label: strings.authorityWritesBlocked }
}

export interface HaNodeDetailPanelProps {
  detail: HaNodeDetail | null
  strings: AdminTranslations['systemSettings']['ha']
  language: 'en' | 'zh'
  loading?: boolean
  onBack: () => void
  onLoadMoreTimeline?: (() => void) | null
  hasMoreTimeline?: boolean
}

export default function HaNodeDetailPanel({
  detail,
  strings,
  language,
  loading = false,
  onBack,
  onLoadMoreTimeline = null,
  hasMoreTimeline = false,
}: HaNodeDetailPanelProps): JSX.Element {
  const node = detail?.node ?? null
  const timeline = detail?.timeline.events ?? []
  const cutoverStatus = node ? { tone: cutoverTone(node), label: cutoverLabel(node, strings) } : null
  const trafficStatus = node ? trafficAuthority(node, strings) : null
  const writeStatus = node ? writeAuthority(node, strings) : null
  const nodeMessage = node ? formatHaPeerMessage(node, strings) : null
  const channelHealth = node?.channelHealth ?? []
  return (
    <section className="ha-node-panel flex min-w-0 flex-col gap-6" aria-labelledby="ha-node-detail-title">
      <div className="ha-node-panel-head flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="ha-node-panel-title-group min-w-0 space-y-2 [&_h2]:text-lg [&_h2]:font-semibold [&_p]:text-sm [&_p]:text-muted-foreground">
          <Button type="button" variant="outline" size="sm" className="ha-node-detail-back" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>{strings.nodeDetailBack}</span>
          </Button>
          <div className="ha-node-panel-kicker text-xs font-medium text-muted-foreground">{strings.nodeDetailKicker}</div>
          <h2 id="ha-node-detail-title">
            {node ? strings.nodeDetailTitle.replace('{nodeId}', node.nodeId) : strings.nodeDetailLoading}
          </h2>
          <p>
            {node
              ? strings.nodeDetailDescription
                .replace('{nodeId}', node.nodeId)
                .replace('{currentNodeId}', detail?.currentNodeId ?? '—')
              : strings.nodeDetailLoading}
          </p>
        </div>
        {node && (
          <div className="ha-node-panel-state">
            {cutoverStatus ? <StatusBadge tone={cutoverStatus.tone}>{cutoverStatus.label}</StatusBadge> : null}
          </div>
        )}
      </div>

      <div className="ha-node-detail-summary grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <Card className="ha-node-detail-card min-w-0 ha-node-detail-card--overview" aria-label={strings.nodeDetailInfoTitle}>
          <CardHeader className="ha-node-detail-card-head flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="ha-node-list-title flex items-center gap-2 font-medium">
              <Server size={18} aria-hidden="true" />
              <span>{strings.nodeDetailInfoTitle}</span>
            </CardTitle>
            {node ? <StatusBadge tone={roleTone(node.role)}>{roleLabel(node.role, strings)}</StatusBadge> : null}
          </CardHeader>
          <CardContent className="min-w-0">
          {node ? (
            <>
              <div className="ha-node-detail-overview-grid grid gap-6">
                <div className="ha-node-detail-primary flex min-w-0 flex-col gap-4">
                  <div className="ha-node-detail-primary-block flex min-w-0 flex-col gap-1">
                    <span className="ha-node-detail-primary-label text-xs text-muted-foreground">{strings.nodeHeader}</span>
                    <strong className="ha-node-detail-primary-value break-all text-lg">{node.nodeId}</strong>
                  </div>
                  <div className="ha-node-detail-primary-block flex min-w-0 flex-col gap-1">
                    <span className="ha-node-detail-primary-label text-xs text-muted-foreground">{strings.originHeader}</span>
                    <code className="ha-node-detail-code break-all text-xs">{node.publicOrigin ?? '—'}</code>
                  </div>
                  <div className="ha-node-detail-primary-badges flex flex-wrap gap-2">
                    {trafficStatus ? <StatusBadge tone={trafficStatus.tone}>{trafficStatus.label}</StatusBadge> : null}
                    {writeStatus ? <StatusBadge tone={writeStatus.tone}>{writeStatus.label}</StatusBadge> : null}
                  </div>
                </div>
                <dl className="ha-node-detail-overview-facts grid grid-cols-1 gap-4 sm:grid-cols-2 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-all [&_dd]:tabular-nums">
                  <div>
                    <dt>{strings.summarySyncLag}</dt>
                    <dd>{formatLag(node.syncLagSeconds, language)}</dd>
                  </div>
                  <div>
                    <dt>{strings.lastSyncHeader}</dt>
                    <dd>{formatTimestamp(node.lastSyncAt, language)}</dd>
                  </div>
                  <div>
                    <dt>{strings.nodeDetailLastSeenLabel}</dt>
                    <dd>{formatTimestamp(node.lastSeenAt, language)}</dd>
                  </div>
                  <div>
                    <dt>{strings.summaryRecovery}</dt>
                    <dd>{formatHaRecoveryStatus(node.recoveryStatus, strings) ?? '—'}</dd>
                  </div>
                  <div className="ha-node-detail-overview-fact-wide sm:col-span-2">
                    <dt>{strings.nodeDetailRoleHintLabel}</dt>
                    <dd>
                      <code className="ha-node-detail-code break-all text-xs">{node.roleHint}</code>
                    </dd>
                  </div>
                </dl>
              </div>
              {nodeMessage ? (
                <div className="ha-status-message flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                  <RotateCcw size={16} aria-hidden="true" />
                  <span>{nodeMessage}</span>
                </div>
              ) : null}
            </>
          ) : (
            <div className="ha-status-message flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              <span>{strings.nodeDetailLoading}</span>
            </div>
          )}
        </CardContent>
        </Card>

        <Card className="ha-node-detail-card min-w-0 ha-node-detail-card--channels" aria-label="HA channel health">
          <CardHeader className="ha-node-detail-card-head flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="ha-node-list-title flex items-center gap-2 font-medium">
              <Server size={18} aria-hidden="true" />
              <span>{language === 'zh' ? '复制 ACK 与 GC 健康' : 'Replication ACK and GC health'}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="min-w-0">
          {channelHealth.length === 0 ? (
            <div className="ha-status-message flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground"><span>—</span></div>
          ) : (
            <div className="ha-channel-health-list flex min-w-0 flex-col gap-4">
              {channelHealth.map((health) => (
                <div key={health.channel} className="ha-channel-health-row space-y-4 rounded-lg border p-3 [&_dl]:grid [&_dl]:grid-cols-1 [&_dl]:gap-3 sm:[&_dl]:grid-cols-2 [&_dt]:text-xs [&_dt]:text-muted-foreground [&_dd]:mt-1 [&_dd]:break-all [&_dd]:tabular-nums">
                  <div className="ha-channel-health-heading flex flex-wrap items-center justify-between gap-2">
                    <strong>{channelLabel(health.channel, language)}</strong>
                    <div className="ha-channel-health-badges flex flex-wrap gap-2">
                      <StatusBadge tone={health.cursorState === 'healthy' ? 'success' : 'warning'}>
                        {channelStateLabel(health.cursorState, language)}
                      </StatusBadge>
                      <StatusBadge tone={gcStateTone(health.gcState)}>
                        {gcStateLabel(health.gcState, language)}
                      </StatusBadge>
                    </div>
                  </div>
                  <dl>
                    <div><dt>{language === 'zh' ? 'ACK 序号' : 'ACK'}</dt><dd>{health.ackedSeq ?? '—'}</dd></div>
                    <div><dt>{language === 'zh' ? '高水位' : 'High watermark'}</dt><dd>{health.highWatermark}</dd></div>
                    <div><dt>{language === 'zh' ? 'ACK 延迟' : 'ACK lag'}</dt><dd>{health.ackLag ?? '—'}</dd></div>
                    <div><dt>{language === 'zh' ? '保留期' : 'Retention'}</dt><dd>{formatRetention(health.retentionSecs, language)}</dd></div>
                    <div><dt>{language === 'zh' ? '过期积压' : 'Expired backlog'}</dt><dd>{health.expiredBacklog ? (language === 'zh' ? '是' : 'Yes') : (language === 'zh' ? '否' : 'No')}</dd></div>
                    <div><dt>{language === 'zh' ? 'GC 状态' : 'GC state'}</dt><dd>{gcStateLabel(health.gcState, language)}</dd></div>
                    <div><dt>{language === 'zh' ? '最老事件' : 'Oldest event'}</dt><dd>{formatLag(health.oldestAgeSecs, language)}</dd></div>
                    <div><dt>{language === 'zh' ? '批量' : 'Batch'}</dt><dd>{health.batchSize ?? '—'}</dd></div>
                    <div><dt>{language === 'zh' ? '最近进展' : 'Last progress'}</dt><dd>{formatTimestamp(health.lastProgressAt, language)}</dd></div>
                    <div><dt>{language === 'zh' ? '让步原因' : 'Defer reason'}</dt><dd>{health.lastDeferReason ?? '—'}</dd></div>
                    <div><dt>{language === 'zh' ? '下次重试' : 'Next retry'}</dt><dd>{formatTimestamp(health.nextRetryAt, language)}</dd></div>
                    <div><dt>{language === 'zh' ? '债务模式' : 'Debt mode'}</dt><dd>{health.gcDebtMode || '—'}</dd></div>
                    <div><dt>{language === 'zh' ? '入流增量' : 'Ingress delta'}</dt><dd>{formatSignedNumber(health.lastIngressSeqDelta, language)}</dd></div>
                    <div><dt>{language === 'zh' ? '净回收' : 'Net recovery'}</dt><dd>{formatSignedNumber(health.lastNetRowsDeltaEstimate == null ? null : -health.lastNetRowsDeltaEstimate, language)}</dd></div>
                    <div><dt>{language === 'zh' ? '删除速率' : 'Delete rate'}</dt><dd>{numberFormat(health.gcDeletedRowsPerMinute, language)} / min</dd></div>
                    <div><dt>{language === 'zh' ? '前台 RPS' : 'Foreground RPS'}</dt><dd>{numberFormat(health.gcForegroundRps, language)}</dd></div>
                    <div><dt>{language === 'zh' ? 'GC SLO' : 'GC SLO'}</dt><dd>{gcSloLabel(health.gcSloState, language)}</dd></div>
                    <div><dt>{language === 'zh' ? '恢复截止' : 'Recovery deadline'}</dt><dd>{formatTimestamp(health.gcRecoveryDeadlineAt, language)}</dd></div>
                    <div><dt>{language === 'zh' ? '观测时间' : 'Observed at'}</dt><dd>{formatTimestamp(health.gcObservedAt, language)}</dd></div>
                  </dl>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        </Card>
      </div>

      <div className="ha-node-list flex min-w-0 flex-col gap-3 rounded-xl border p-4" aria-label={strings.nodeDetailInteractionsTitle}>
        <div className="ha-node-list-title flex items-center gap-2 font-medium">
          <RotateCcw size={18} aria-hidden="true" />
          <span>{strings.nodeDetailInteractionsTitle}</span>
        </div>
        {timeline.length === 0 ? (
          <div className="ha-status-message flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <span>{loading ? strings.timelineLoading : strings.nodeDetailTimelineEmpty}</span>
          </div>
        ) : (
          <div className="ha-timeline-list flex min-w-0 flex-col gap-2">
            {timeline.map((event) => (
              <details key={event.id} className="ha-timeline-item rounded-lg border p-3 [&_summary]:cursor-pointer [&_summary]:space-x-2">
                <summary>
                  <span>{formatHaTimelineSummary(event, strings, { currentNodeId: detail?.currentNodeId ?? null })}</span>
                  <StatusBadge tone={timelineStatusTone(event.status)}>
                    {formatHaTimelineStatusLabel(event.status, strings)}
                  </StatusBadge>
                </summary>
                <div className="ha-timeline-meta mt-3 flex flex-col gap-2 text-xs text-muted-foreground [&_pre]:max-w-full [&_pre]:overflow-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:whitespace-pre-wrap [&_pre]:break-all">
                  <div>{formatTimestamp(event.createdAt, language)}</div>
                  {formatHaTimelineDetail(event, strings, { currentNodeId: detail?.currentNodeId ?? null })
                    ? <p>{formatHaTimelineDetail(event, strings, { currentNodeId: detail?.currentNodeId ?? null })}</p>
                    : null}
                  {event.technicalDetails ? <pre>{JSON.stringify(event.technicalDetails, null, 2)}</pre> : null}
                </div>
              </details>
            ))}
            {hasMoreTimeline && onLoadMoreTimeline && (
              <Button type="button" variant="outline" size="sm" onClick={onLoadMoreTimeline} disabled={loading}>
                {loading ? strings.timelineLoading : strings.timelineLoadMore}
              </Button>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
