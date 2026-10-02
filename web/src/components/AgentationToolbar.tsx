import { lazy, Suspense } from 'react'

const Toolbar = import.meta.env.DEV || import.meta.env.VITE_AGENTATION_ENABLED === 'true'
  ? lazy(() => import('agentation').then(({ Agentation }) => ({ default: Agentation })))
  : null

export default function AgentationToolbar(): JSX.Element | null {
  if (!Toolbar) return null

  return (
    <Suspense fallback={null}>
      <Toolbar />
    </Suspense>
  )
}
