import type React from 'react'

import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'

type SwitchProps = React.ComponentProps<typeof Switch>

export interface LoadingSwitchProps extends SwitchProps {
  loading?: boolean
}

export function LoadingSwitch({ loading = false, disabled, className, ...props }: LoadingSwitchProps): React.JSX.Element {
  return (
    <span className="relative inline-flex shrink-0 items-center">
      <Switch {...props} disabled={disabled || loading} className={className} />
      {loading ? (
        <span className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
          <Spinner className="size-3 text-muted-foreground" />
        </span>
      ) : null}
    </span>
  )
}

export default LoadingSwitch
