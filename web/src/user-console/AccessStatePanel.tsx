import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Icon } from '../lib/icons'
import { USER_CONSOLE_LOGIN_START_PATH } from './oauthCallback'
import type { EN } from './text'

type AccessText = Pick<typeof EN, 'unavailable' | 'loggedOut' | 'loginRequired'>

interface AccessStatePanelProps {
  state: 'unavailable' | 'logged_out' | 'login_required'
  text: AccessText
  onHome: () => void
}

export default function AccessStatePanel({ state, text, onHome }: AccessStatePanelProps): JSX.Element {
  const model = state === 'unavailable'
    ? { icon: 'mdi:account-off-outline', copy: text.unavailable, action: onHome }
    : state === 'logged_out'
      ? { icon: 'mdi:logout-variant', copy: text.loggedOut, action: () => { window.location.href = USER_CONSOLE_LOGIN_START_PATH } }
      : { icon: 'mdi:account-arrow-right-outline', copy: text.loginRequired, action: () => { window.location.href = USER_CONSOLE_LOGIN_START_PATH } }

  return (
    <Card className="surface panel access-panel mx-auto w-full max-w-xl gap-0 py-0">
      <Alert className="console-unavailable-state m-4 items-start gap-4 rounded-lg border-none">
        <span
          className="console-unavailable-icon flex size-11 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-hidden="true"
        >
          <Icon icon={model.icon} width={22} height={22} />
        </span>
        <div className="console-unavailable-copy flex flex-1 flex-col gap-1 text-left">
          <AlertTitle>
            <h2 className="text-base font-semibold">{model.copy.title}</h2>
          </AlertTitle>
          <AlertDescription className="text-sm text-muted-foreground">
            <p>{model.copy.description}</p>
          </AlertDescription>
        </div>
        <AlertAction className="console-unavailable-actions self-center">
          <Button type="button" onClick={model.action}>
            {'home' in model.copy ? model.copy.home : model.copy.action}
          </Button>
        </AlertAction>
      </Alert>
    </Card>
  )
}
