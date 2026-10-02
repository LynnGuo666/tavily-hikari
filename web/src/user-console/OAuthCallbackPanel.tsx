import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { Icon } from '../lib/icons'
import type { OAuthCallbackPanelModel, OAuthCallbackStepState, OAuthCallbackTone } from './oauthCallback'

interface OAuthCallbackPanelProps {
  model: OAuthCallbackPanelModel
  onRestart: () => void
  onHome: () => void
}

const TONE_BADGE_CLASS: Record<OAuthCallbackTone, string> = {
  info: 'border-primary/30 bg-primary/10 text-foreground',
  success: 'border-success/40 bg-success/10 text-success',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  danger: 'border-destructive/40 bg-destructive/10 text-destructive',
}

const TONE_SHELL_CLASS: Record<OAuthCallbackTone, string> = {
  info: 'bg-muted text-muted-foreground',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-destructive/15 text-destructive',
}

const TONE_DOT_CLASS: Record<OAuthCallbackTone, string> = {
  info: 'bg-muted-foreground',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
}

const TONE_TEXT_CLASS: Record<OAuthCallbackTone, string> = {
  info: 'text-muted-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
}

const STEP_STATE_ICON_CLASS: Record<OAuthCallbackStepState, string> = {
  complete: 'bg-success/15 text-success',
  active: 'bg-primary/10 text-foreground',
  error: 'bg-destructive/15 text-destructive',
  pending: 'bg-muted text-muted-foreground',
}

function stepStateIcon(state: OAuthCallbackStepState): string {
  if (state === 'complete') return 'mdi:check-circle'
  if (state === 'active') return 'mdi:progress-clock'
  if (state === 'error') return 'mdi:alert-circle'
  return 'mdi:circle-outline'
}

export default function OAuthCallbackPanel({
  model,
  onRestart,
  onHome,
}: OAuthCallbackPanelProps): JSX.Element {
  return (
    <Card
      className="surface panel flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-card-foreground ring-1 ring-foreground/10 access-panel oauth-callback-panel mx-auto w-full max-w-xl gap-0 py-0"
      role="region"
      aria-label={`${model.badge} ${model.title}`}
    >
      <CardHeader className={cn('oauth-callback-hero', `oauth-callback-hero-${model.tone}`, 'gap-4 border-b p-5')}>
        <div className="oauth-callback-hero-copy flex min-w-0 flex-1 flex-col gap-3">
          <span
            className={cn(
              'oauth-callback-badge inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
              TONE_BADGE_CLASS[model.tone],
            )}
          >
            {model.badge}
          </span>
          <div className="oauth-callback-title-row flex items-start gap-3">
            <div
              className={cn(
                'oauth-callback-icon-shell',
                `oauth-callback-icon-shell-${model.tone}`,
                'flex size-10 shrink-0 items-center justify-center rounded-full',
                TONE_SHELL_CLASS[model.tone],
              )}
            >
              <Icon
                icon={model.icon}
                width={24}
                height={24}
                aria-hidden="true"
                className={cn(model.busy && 'oauth-callback-icon-spin animate-spin')}
              />
            </div>
            <div className="oauth-callback-title-copy min-w-0 flex-1">
              <h2 className="text-base font-semibold">{model.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{model.description}</p>
            </div>
          </div>
          {model.note ? (
            <p className="oauth-callback-note text-xs text-muted-foreground">{model.note}</p>
          ) : null}
        </div>
        <div
          className={cn(
            'oauth-callback-status-pill',
            `oauth-callback-status-pill-${model.tone}`,
            'flex w-fit shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium',
            TONE_BADGE_CLASS[model.tone],
          )}
        >
          <span
            className={cn(
              'oauth-callback-status-dot',
              `oauth-callback-status-dot-${model.tone}`,
              'size-2 rounded-full',
              TONE_DOT_CLASS[model.tone],
            )}
          />
          <span>{model.liveMessage}</span>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        <ol className="oauth-callback-step-list flex list-decimal flex-col gap-3" aria-label={model.badge}>
          {model.steps.map((step, index) => (
            <li
              key={`${step.label}:${index}`}
              className={cn(
                'oauth-callback-step',
                `oauth-callback-step-${step.state}`,
                'flex list-none items-center gap-3 text-sm',
                step.state === 'error' ? 'text-destructive' : 'text-foreground',
              )}
            >
              <div
                className={cn(
                  'oauth-callback-step-icon',
                  `oauth-callback-step-icon-${step.state}`,
                  'flex size-7 shrink-0 items-center justify-center rounded-full',
                  STEP_STATE_ICON_CLASS[step.state],
                )}
              >
                <Icon
                  icon={stepStateIcon(step.state)}
                  width={18}
                  height={18}
                  aria-hidden="true"
                  className={cn(step.state === 'active' && 'oauth-callback-icon-spin animate-spin')}
                />
              </div>
              <span>{step.label}</span>
            </li>
          ))}
        </ol>
      </CardContent>

      {model.showActions ? (
        <CardFooter className="table-actions oauth-callback-actions justify-end gap-2 p-5 pt-0">
          <Button type="button" onClick={onRestart}>
            {model.primaryActionLabel}
          </Button>
          <Button type="button" variant="outline" onClick={onHome}>
            {model.secondaryActionLabel}
          </Button>
        </CardFooter>
      ) : null}

      <p className={cn('sr-only', TONE_TEXT_CLASS[model.tone])} role="status" aria-live="polite">
        {model.liveMessage}
      </p>
    </Card>
  )
}
