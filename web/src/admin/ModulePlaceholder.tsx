import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type React from 'react'
interface ModulePlaceholderProps {
  title: string
  description: string
  sections: string[]
  comingSoonLabel: string
}

export default function ModulePlaceholder({
  title,
  description,
  sections,
  comingSoonLabel,
}: ModulePlaceholderProps): React.JSX.Element {
  return (
    <Card className="surface panel module-placeholder">
      <CardHeader className="panel-header border-b">
        <div>
          <CardTitle role="heading" aria-level={2}>{title}</CardTitle>
          <CardDescription className="panel-description">{description}</CardDescription>
        </div>
      </CardHeader>
      <div className="module-placeholder-grid">
        {sections.map((section) => (
          <article key={section} className="module-placeholder-card">
            <h3>{section}</h3>
            <p className="panel-description text-sm text-muted-foreground">{comingSoonLabel}</p>
          </article>
        ))}
      </div>
    </Card>
  )
}
