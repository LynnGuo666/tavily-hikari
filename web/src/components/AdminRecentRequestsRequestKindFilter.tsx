import { useCallback, useId, useMemo, useState } from 'react'
import type React from 'react'

import type { AdminTranslations } from '../i18n'
import { Icon } from '../lib/icons'
import {
  buildRequestKindQuickFilterSelection,
  buildVisibleRequestKindOptions,
  hasActiveRequestKindQuickFilters,
  mergeRequestKindCatalog,
  summarizeRequestKindQuickFilters,
  summarizeSelectedRequestKinds,
  type TokenLogRequestKindOption,
  type TokenLogRequestKindQuickBilling,
  type TokenLogRequestKindQuickProtocol,
} from '../tokenLogRequestKinds'

import RequestKindBadge from './RequestKindBadge'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerClose,
  DrawerFooter,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel, FieldSet, FieldLegend } from '@/components/ui/field'
import SegmentedTabs from '@/components/SegmentedTabs'

type Language = 'en' | 'zh'
type RequestKindContainer = 'dropdown' | 'drawer'

function requestKindBillingQuickFilterOptions(language: Language) {
  return language === 'zh'
    ? ([
        { value: 'all', label: '全部' },
        { value: 'billable', label: '计费' },
        { value: 'non_billable', label: '免费' },
      ] as const)
    : ([
        { value: 'all', label: 'Any' },
        { value: 'billable', label: 'Paid' },
        { value: 'non_billable', label: 'Free' },
      ] as const)
}

function requestKindProtocolQuickFilterOptions(language: Language) {
  return language === 'zh'
    ? ([
        { value: 'all', label: '全部' },
        { value: 'mcp', label: 'MCP' },
        { value: 'api', label: 'API' },
      ] as const)
    : ([
        { value: 'all', label: 'Any' },
        { value: 'mcp', label: 'MCP' },
        { value: 'api', label: 'API' },
      ] as const)
}

function resolveRequestKindProtocolGroup(
  option: TokenLogRequestKindOption,
): 'api' | 'mcp' {
  if (option.protocol_group === 'api' || option.key.startsWith('api:')) {
    return 'api'
  }
  return 'mcp'
}

function summarizeRequestKindTrigger(
  effectiveSelectedRequestKinds: string[],
  hasActiveQuickRequestKindFilters: boolean,
  requestKindQuickSummary: string,
  requestKindSummary: string,
  language: Language,
  allLabel: string,
): string {
  if (hasActiveQuickRequestKindFilters) return requestKindQuickSummary
  if (effectiveSelectedRequestKinds.length === 0) return allLabel
  if (effectiveSelectedRequestKinds.length <= 2) return requestKindSummary
  return language === 'zh'
    ? `已选 ${effectiveSelectedRequestKinds.length} 项`
    : `${effectiveSelectedRequestKinds.length} selected`
}

interface AdminRecentRequestsRequestKindFilterProps {
  language: Language
  isSmallViewport: boolean
  strings: AdminTranslations
  requestKindOptions: TokenLogRequestKindOption[]
  requestKindQuickBilling: TokenLogRequestKindQuickBilling
  requestKindQuickProtocol: TokenLogRequestKindQuickProtocol
  selectedRequestKinds: string[]
  onRequestKindQuickFiltersChange: (
    billing: TokenLogRequestKindQuickBilling,
    protocol: TokenLogRequestKindQuickProtocol,
  ) => void
  onToggleRequestKind: (key: string) => void
  onClearRequestKinds: () => void
}

export default function AdminRecentRequestsRequestKindFilter({
  language,
  isSmallViewport,
  strings,
  requestKindOptions,
  requestKindQuickBilling,
  requestKindQuickProtocol,
  selectedRequestKinds,
  onRequestKindQuickFiltersChange,
  onToggleRequestKind,
  onClearRequestKinds,
}: AdminRecentRequestsRequestKindFilterProps): React.JSX.Element {
  const [requestKindFilterOpen, setRequestKindFilterOpen] = useState(false)
  const triggerId = useId()

  const normalizedSelectedRequestKinds = useMemo(
    () => Array.from(new Set(selectedRequestKinds.map((value) => value.trim()).filter(Boolean))),
    [selectedRequestKinds],
  )

  const requestKindCatalog = useMemo(
    () => mergeRequestKindCatalog(requestKindOptions),
    [requestKindOptions],
  )

  const requestKindQuickFilters = useMemo(
    () => ({
      billing: requestKindQuickBilling,
      protocol: requestKindQuickProtocol,
    }),
    [requestKindQuickBilling, requestKindQuickProtocol],
  )

  const hasActiveQuickRequestKindFilters = useMemo(
    () => hasActiveRequestKindQuickFilters(requestKindQuickFilters),
    [requestKindQuickFilters],
  )

  const quickSelection = useMemo(
    () => buildRequestKindQuickFilterSelection(requestKindOptions, requestKindQuickFilters),
    [requestKindOptions, requestKindQuickFilters],
  )

  const effectiveSelectedRequestKinds = useMemo(
    () => (hasActiveQuickRequestKindFilters ? quickSelection : normalizedSelectedRequestKinds),
    [hasActiveQuickRequestKindFilters, normalizedSelectedRequestKinds, quickSelection],
  )

  const visibleRequestKindOptions = useMemo(
    () =>
      buildVisibleRequestKindOptions(
        effectiveSelectedRequestKinds,
        requestKindCatalog,
        Object.fromEntries(requestKindCatalog.map((option) => [option.key, option])),
      ),
    [effectiveSelectedRequestKinds, requestKindCatalog],
  )

  const requestKindSummary = useMemo(
    () =>
      summarizeSelectedRequestKinds(
        effectiveSelectedRequestKinds,
        visibleRequestKindOptions,
        strings.logs.filters.requestTypeAll,
      ),
    [effectiveSelectedRequestKinds, strings.logs.filters.requestTypeAll, visibleRequestKindOptions],
  )

  const requestKindQuickSummary = useMemo(
    () => summarizeRequestKindQuickFilters(requestKindQuickFilters, language),
    [language, requestKindQuickFilters],
  )

  const requestKindClearDisabled =
    effectiveSelectedRequestKinds.length === 0 && !hasActiveQuickRequestKindFilters

  const requestKindColumnGroups = useMemo(() => {
    const api: TokenLogRequestKindOption[] = []
    const mcp: TokenLogRequestKindOption[] = []

    for (const option of visibleRequestKindOptions) {
      if (resolveRequestKindProtocolGroup(option) === 'api') {
        api.push(option)
      } else {
        mcp.push(option)
      }
    }

    return { api, mcp }
  }, [visibleRequestKindOptions])

  const requestKindTriggerSummary = useMemo(
    () =>
      summarizeRequestKindTrigger(
        effectiveSelectedRequestKinds,
        hasActiveQuickRequestKindFilters,
        requestKindQuickSummary,
        requestKindSummary,
        language,
        strings.logs.filters.requestTypeAll,
      ),
    [
      effectiveSelectedRequestKinds,
      hasActiveQuickRequestKindFilters,
      language,
      requestKindQuickSummary,
      requestKindSummary,
      strings.logs.filters.requestTypeAll,
    ],
  )

  const handleClearRequestKinds = useCallback(() => {
    if (requestKindClearDisabled) return
    onClearRequestKinds()
  }, [onClearRequestKinds, requestKindClearDisabled])

  const renderRequestKindOptionsList = useCallback(
    (
      options: TokenLogRequestKindOption[],
      groupLabel: string,
      container: RequestKindContainer,
    ) => (
      <FieldSet className="gap-3">
        <FieldLegend variant="label">{groupLabel}</FieldLegend>
        {options.length === 0 ? (
          <div>{strings.logs.filters.requestTypeEmpty}</div>
        ) : (
          <FieldGroup className="gap-2">
            {options.map((option) => {
              const checked = effectiveSelectedRequestKinds.includes(option.key)
              const content = (
                <span className="flex flex-1 items-center justify-between gap-3">
                  <RequestKindBadge
                    requestKindKey={option.key}
                    requestKindLabel={option.label}
                    size="sm"
                  />
                  <span className="text-xs text-muted-foreground">{`x${option.count ?? 0}`}</span>
                </span>
              )

              return (
                <Field key={option.key} orientation="horizontal" className="gap-2">
                  <Checkbox id={`${triggerId}-${container}-${option.key}`} aria-label={option.label} checked={checked} onCheckedChange={() => onToggleRequestKind(option.key)} />
                  <FieldLabel htmlFor={`${triggerId}-${container}-${option.key}`} className="min-w-0 flex-1">{content}</FieldLabel>
                </Field>
              )
            })}
          </FieldGroup>
        )}
      </FieldSet>
    ),
    [effectiveSelectedRequestKinds, onToggleRequestKind, strings.logs.filters.requestTypeEmpty, triggerId],
  )

  const renderRequestKindFiltersContent = useCallback(
    (container: RequestKindContainer) => (
      <div
        className={[
          'token-request-kind-panel flex flex-col gap-4',
          `token-request-kind-panel--${container}`,
        ].join(' ')}
      >
        <div className="flex items-center justify-between gap-2">
          <div>{strings.logs.filters.requestType}</div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={requestKindClearDisabled}
            onClick={handleClearRequestKinds}
          >
            {strings.users.clear}
          </Button>
        </div>
        <div className="flex flex-col gap-4">
          <FieldGroup className="grid gap-3 sm:grid-cols-2">
            <FieldSet className="gap-2">
              <FieldLegend variant="label">
                {strings.logs.filters.billingGroup}
              </FieldLegend>
              <SegmentedTabs<TokenLogRequestKindQuickBilling>
                value={requestKindQuickBilling}
                onChange={(next) =>
                  onRequestKindQuickFiltersChange(next, requestKindQuickProtocol)
                }
                options={requestKindBillingQuickFilterOptions(language)}
                ariaLabel={strings.logs.filters.billingGroup}
                smallViewportBehavior="buttons"
              />
            </FieldSet>
            <FieldSet className="gap-2">
              <FieldLegend variant="label">
                {strings.logs.filters.protocolGroup}
              </FieldLegend>
              <SegmentedTabs<TokenLogRequestKindQuickProtocol>
                value={requestKindQuickProtocol}
                onChange={(next) =>
                  onRequestKindQuickFiltersChange(requestKindQuickBilling, next)
                }
                options={requestKindProtocolQuickFilterOptions(language)}
                ariaLabel={strings.logs.filters.protocolGroup}
                smallViewportBehavior="buttons"
              />
            </FieldSet>
          </FieldGroup>
          <div className="grid gap-4 sm:grid-cols-2">
            {renderRequestKindOptionsList(requestKindColumnGroups.api, 'API', container)}
            {renderRequestKindOptionsList(requestKindColumnGroups.mcp, 'MCP', container)}
          </div>
        </div>
      </div>
    ),
    [
      handleClearRequestKinds,
      language,
      onRequestKindQuickFiltersChange,
      renderRequestKindOptionsList,
      requestKindClearDisabled,
      requestKindColumnGroups.api,
      requestKindColumnGroups.mcp,
      requestKindQuickBilling,
      requestKindQuickProtocol,
      strings.logs.filters.billingGroup,
      strings.logs.filters.protocolGroup,
      strings.logs.filters.requestType,
      strings.users.clear,
    ],
  )

  return (
    <Field className="min-w-0">
      <FieldLabel htmlFor={triggerId}>{strings.logs.filters.requestType}</FieldLabel>
      {isSmallViewport ? (
        <Drawer
          open={requestKindFilterOpen}
          onOpenChange={setRequestKindFilterOpen}
          shouldScaleBackground={false}
        >
          <DrawerTrigger asChild><Button
            type="button"
            id={triggerId}
            variant="outline" className="w-full justify-between"
            aria-label={`${strings.logs.filters.requestType}: ${requestKindTriggerSummary}`}
          >
            <span className="truncate">{requestKindTriggerSummary}</span>
            <Icon icon="mdi:chevron-down" data-icon="inline-end" aria-hidden="true" />
          </Button></DrawerTrigger>
          <DrawerContent className="max-h-[85dvh]">
            <DrawerHeader className="sr-only">
              <DrawerTitle>{strings.logs.filters.requestType}</DrawerTitle>
              <DrawerDescription>{strings.logs.descriptionFallback}</DrawerDescription>
            </DrawerHeader>
            <div className="min-h-0 overflow-y-auto p-4">
              {renderRequestKindFiltersContent('drawer')}
            </div>
            <DrawerFooter>
              <DrawerClose asChild><Button variant="outline">{language === 'zh' ? '完成' : 'Done'}</Button></DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Popover open={requestKindFilterOpen} onOpenChange={setRequestKindFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              id={triggerId}
              variant="outline" className="w-full justify-between"
              aria-label={`${strings.logs.filters.requestType}: ${requestKindTriggerSummary}`}
            >
              <span className="truncate">{requestKindTriggerSummary}</span>
              <Icon icon="mdi:chevron-down" data-icon="inline-end" aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            aria-label={strings.logs.filters.requestType}
            className="w-[min(36rem,calc(100vw-2rem))] max-h-[70dvh] overflow-y-auto p-4"
          >
            {renderRequestKindFiltersContent('dropdown')}
          </PopoverContent>
        </Popover>
      )}
    </Field>
  )
}
