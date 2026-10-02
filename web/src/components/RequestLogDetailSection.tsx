import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export default function RequestLogDetailSection({ title, children, className }: {
  title: ReactNode
  children: ReactNode
  className?: string
}): JSX.Element {
  return (
    <Card size="sm" className={cn('min-w-0 gap-3 shadow-none', className)}>
      <CardHeader className="border-b">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0 text-xs [&_pre]:max-h-80 [&_pre]:overflow-auto [&_pre]:whitespace-pre-wrap [&_pre]:break-all [&_pre]:font-mono [&_pre]:leading-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1 [&_li]:break-all">
        {children}
      </CardContent>
    </Card>
  )
}
