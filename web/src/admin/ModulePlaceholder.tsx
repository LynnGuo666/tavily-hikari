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
}: ModulePlaceholderProps): JSX.Element {
  return (
    <section className="surface panel flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-card-foreground ring-1 ring-foreground/10 module-placeholder">
      <div className="panel-header flex flex-col gap-1.5 border-b px-4 pb-4">
        <div>
          <h2>{title}</h2>
          <p className="panel-description text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="module-placeholder-grid">
        {sections.map((section) => (
          <article key={section} className="module-placeholder-card">
            <h3>{section}</h3>
            <p className="panel-description text-sm text-muted-foreground">{comingSoonLabel}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
