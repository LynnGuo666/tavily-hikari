import { useId, type ReactNode } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import type React from 'react'

import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from '@/components/ui/select'

interface AdminTablePaginationProps {
  page: number
  totalPages: number
  pageSummary?: ReactNode
  perPage?: number
  perPageLabel?: ReactNode
  perPageOptions?: number[]
  perPageAriaLabel?: string
  previousLabel?: string
  nextLabel?: string
  previousDisabled?: boolean
  nextDisabled?: boolean
  disabled?: boolean
  onPrevious: () => void | Promise<void>
  onNext: () => void | Promise<void>
  onPerPageChange?: (value: number) => void | Promise<void>
}

export default function AdminTablePagination({
  page,
  totalPages,
  pageSummary,
  perPage,
  perPageLabel = 'Per page',
  perPageOptions = [10, 20, 50, 100],
  perPageAriaLabel = 'Rows per page',
  previousLabel = 'Previous',
  nextLabel = 'Next',
  previousDisabled = false,
  nextDisabled = false,
  disabled = false,
  onPrevious,
  onNext,
  onPerPageChange,
}: AdminTablePaginationProps): React.JSX.Element {
  const perPageId = useId()
  const hasPerPageControl = typeof perPage === 'number' && typeof onPerPageChange === 'function'
  const resolvedPerPageOptions =
    typeof perPage === 'number' && !perPageOptions.includes(perPage)
      ? [...perPageOptions, perPage].sort((left, right) => left - right)
      : perPageOptions

  return (
    <div className="table-pagination flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className={cn('table-pagination-meta flex min-w-0 flex-col gap-2', !hasPerPageControl && 'table-pagination-meta-summary-only')}>
        {hasPerPageControl ? (
          <Field orientation="horizontal" className="table-pagination-per-page w-fit">
            <FieldLabel htmlFor={perPageId}>{perPageLabel}</FieldLabel>
            <Select value={String(perPage)} onValueChange={(value) => void onPerPageChange(Number(value))} disabled={disabled}>
              <SelectTrigger id={perPageId} aria-label={perPageAriaLabel} className="table-pagination-select w-20" disabled={disabled}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="start">
                <SelectGroup>
                  {resolvedPerPageOptions.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        ) : null}
        <span className="table-pagination-summary text-sm text-muted-foreground">{pageSummary ?? `Page ${page} / ${totalPages}`}</span>
      </div>
      <Pagination className="table-pagination-nav mx-0 w-auto justify-start sm:justify-end" aria-label={`${previousLabel} / ${nextLabel}`}>
        <PaginationContent>
          <PaginationItem>
            <Button
              type="button"
              variant="outline"
              className="table-pagination-button"
              onClick={() => void onPrevious()}
              disabled={disabled || previousDisabled}
            >
              <ChevronLeftIcon data-icon="inline-start" />
              {previousLabel}
            </Button>
          </PaginationItem>
          <PaginationItem>
            <Button
              type="button"
              variant="outline"
              className="table-pagination-button"
              onClick={() => void onNext()}
              disabled={disabled || nextDisabled}
            >
              {nextLabel}
              <ChevronRightIcon data-icon="inline-end" />
            </Button>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
