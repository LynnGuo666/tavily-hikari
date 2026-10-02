import type { FormEvent, ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { EyeIcon, EyeOffIcon, HouseIcon, KeyRoundIcon } from 'lucide-react'
import type React from 'react'

import {
  fetchProfile,
  loginWithAdminPasskey,
  registerAdminPasskeyWithResetToken,
  requestJson,
} from '../api'
import { isDemoMode } from '../api/demo'
import BrandLockup from '../components/BrandLockup'
import LanguageSwitcher from '../components/LanguageSwitcher'
import OfflineStatusBanner from '../components/OfflineStatusBanner'
import ThemeToggle from '../components/ThemeToggle'
import { ConnectedUpdateAvailableBanner } from '../components/UpdateAvailableBanner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Spinner } from '@/components/ui/spinner'
import { useTranslate } from '../i18n'
import { useOfflineState } from '../pwa/useOfflineState'

type LoginState = 'checking' | 'ready' | 'submitting'
type SubmitAction = 'password' | 'passkey' | 'reset'

function HintAlert({ title, children }: { title?: string; children: ReactNode }): React.JSX.Element {
  return (
    <Alert className="border-warning/40 bg-warning/10 text-warning-foreground">
      {title ? <AlertTitle className="text-warning">{title}</AlertTitle> : null}
      <AlertDescription className="text-warning">{children}</AlertDescription>
    </Alert>
  )
}

function AdminLogin({ updateBanner }: { updateBanner?: ReactNode } = {}): React.JSX.Element {
  const strings = useTranslate()
  const ui = strings.public.adminLogin
  const offline = useOfflineState()

  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<LoginState>('checking')
  const [submittingAction, setSubmittingAction] = useState<SubmitAction | null>(null)
  const [builtinEnabled, setBuiltinEnabled] = useState<boolean | null>(null)
  const [passkeyEnabled, setPasskeyEnabled] = useState(false)
  const [totpRequired, setTotpRequired] = useState(false)
  const [totpCode, setTotpCode] = useState('')
  const [profileUnavailable, setProfileUnavailable] = useState(false)
  const resetToken = useMemo(() => {
    if (typeof window === 'undefined') return ''
    return new URLSearchParams(window.location.search).get('adminPasskeyResetToken')?.trim() ?? ''
  }, [])
  const resetRegistered = useMemo(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('adminPasskeyRegistered') === '1'
  }, [])
  const resetMode = resetToken.length > 0

  useEffect(() => {
    let alive = true
    fetchProfile()
      .then((profile) => {
        if (!alive) return
        setBuiltinEnabled(profile.builtinAuthEnabled ?? false)
        setPasskeyEnabled(profile.passkeyAuthEnabled ?? false)
        setTotpRequired(profile.adminLoginTotpRequired ?? false)
        setProfileUnavailable(false)
        if (profile.isAdmin && !resetMode && !isDemoMode()) {
          window.location.href = '/admin'
          return
        }
      })
      .catch(() => {
        if (!alive) return
        setBuiltinEnabled(null)
        setPasskeyEnabled(false)
        setTotpRequired(false)
        setProfileUnavailable(true)
      })
      .finally(() => {
        if (!alive) return
        setState('ready')
      })
    return () => {
      alive = false
    }
  }, [resetMode])

  const showPasswordForm = !resetMode && builtinEnabled !== false
  const showPasskeyLogin = !resetMode && (passkeyEnabled || profileUnavailable)
  const showTotpInput = totpRequired && (showPasswordForm || showPasskeyLogin)
  const noLoginMethods = !resetMode && builtinEnabled === false && !passkeyEnabled

  const canSubmit = useMemo(
    () => showPasswordForm && state === 'ready' && password.trim().length > 0 && (!totpRequired || totpCode.length === 6),
    [password, showPasswordForm, state, totpCode.length, totpRequired],
  )
  const canUsePasskey = showPasskeyLogin && state === 'ready' && !offline.isOffline && (!totpRequired || totpCode.length === 6)
  const canRegisterResetPasskey = resetMode && state === 'ready' && !offline.isOffline

  const finishWithErrorHandling = async (
    submitAction: SubmitAction,
    action: () => Promise<unknown>,
    onSuccess: () => void = () => {
      window.location.href = '/admin'
    },
  ) => {
    setError(null)
    setState('submitting')
    setSubmittingAction(submitAction)
    try {
      await action()
      onSuccess()
    } catch (err) {
      const status = typeof err === 'object' && err && 'status' in err ? (err as { status?: unknown }).status : undefined
      if (status === 404) {
        setError(ui.errors.disabled)
      } else if (status === 401) {
        setError(ui.errors.invalid)
      } else if (status === 403) {
        setError(ui.errors.totpInvalid)
      } else if (err instanceof Error && err.message) {
        setError(err.message)
      } else {
        setError(ui.errors.generic)
      }
    } finally {
      setState('ready')
      setSubmittingAction(null)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    await finishWithErrorHandling('password', () => requestJson('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: password.trim(),
        ...(totpRequired ? { totpCode } : {}),
      }),
    }))
  }

  const submitPasskey = async () => {
    if (!canUsePasskey) return
    await finishWithErrorHandling('passkey', () => (
      isDemoMode()
        ? Promise.resolve({ ok: true })
        : loginWithAdminPasskey(totpRequired ? totpCode : undefined)
    ))
  }

  const submitResetRegistration = async () => {
    if (!canRegisterResetPasskey) return
    await finishWithErrorHandling('reset', () => (
      isDemoMode()
        ? Promise.resolve({ ok: true })
        : registerAdminPasskeyWithResetToken(resetToken, 'Admin passkey')
    ), () => {
      window.location.href = '/login?adminPasskeyRegistered=1'
    })
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-10 lg:py-16">
        <div className="flex items-center justify-between gap-3">
          <BrandLockup title="Tavily Hikari" variant="responsive" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>

        {updateBanner ?? (
          <ConnectedUpdateAvailableBanner strings={strings.public.updateBanner} />
        )}

        <main className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">{ui.title}</CardTitle>
              <CardDescription>{ui.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {offline.isOffline ? (
                <OfflineStatusBanner
                  title="Offline shell loaded"
                  description="Admin sign-in needs the network. Reconnect before submitting your password."
                />
              ) : null}

              {profileUnavailable ? <HintAlert>{ui.hints.profileUnavailable}</HintAlert> : null}
              {noLoginMethods ? <HintAlert>{ui.hints.disabled}</HintAlert> : null}
              {resetMode ? <HintAlert>{ui.hints.resetEnrollment}</HintAlert> : null}
              {resetRegistered && !resetMode ? <HintAlert>{ui.hints.resetRegistered}</HintAlert> : null}

              {state === 'checking' ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Spinner className="size-4" />
                  {ui.hints.checking}
                </div>
              ) : (
                <FieldGroup>
                  {showTotpInput ? (
                    <Field>
                      <FieldLabel htmlFor="admin-totp-code-input">{ui.totp.label}</FieldLabel>
                      <Input
                        id="admin-totp-code-input"
                        type="text"
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder={ui.totp.placeholder}
                        aria-label={ui.totp.label}
                        autoComplete="one-time-code"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        disabled={state !== 'ready'}
                      />
                      <FieldDescription>{ui.totp.hint}</FieldDescription>
                    </Field>
                  ) : null}

                  {resetMode ? (
                    <Field>
                      <Button
                        type="button"
                        className="w-full"
                        disabled={!canRegisterResetPasskey}
                        onClick={submitResetRegistration}
                      >
                        {submittingAction === 'reset' ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <KeyRoundIcon data-icon="inline-start" />
                        )}
                        {submittingAction === 'reset' ? ui.passkey.registering : ui.passkey.register}
                      </Button>
                    </Field>
                  ) : null}

                  {showPasskeyLogin ? (
                    <Field>
                      <Button type="button" variant="outline" className="w-full" disabled={!canUsePasskey} onClick={submitPasskey}>
                        {submittingAction === 'passkey' ? (
                          <Spinner data-icon="inline-start" />
                        ) : (
                          <KeyRoundIcon data-icon="inline-start" />
                        )}
                        {submittingAction === 'passkey' ? ui.passkey.signingIn : ui.passkey.signIn}
                      </Button>
                    </Field>
                  ) : null}

                  {showPasskeyLogin && showPasswordForm ? (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="h-px flex-1 bg-border" aria-hidden="true" />
                      {ui.passkey.orPassword}
                      <span className="h-px flex-1 bg-border" aria-hidden="true" />
                    </div>
                  ) : null}

                  {showPasswordForm ? (
                    <form onSubmit={submit} className="flex flex-col gap-4">
                      <Field>
                        <FieldLabel htmlFor="admin-password-input">{ui.password.label}</FieldLabel>
                        <InputGroup>
                          <InputGroupInput
                            id="admin-password-input"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={ui.password.placeholder}
                            aria-label={ui.password.label}
                            autoComplete="current-password"
                            disabled={state !== 'ready'}
                          />
                          <InputGroupAddon align="inline-end">
                            <InputGroupButton
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                              onClick={() => setShowPassword((visible) => !visible)}
                            >
                              {showPassword ? <EyeOffIcon data-icon="exclusive-end" /> : <EyeIcon data-icon="exclusive-end" />}
                            </InputGroupButton>
                          </InputGroupAddon>
                        </InputGroup>
                      </Field>
                      <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
                        {submittingAction === 'password' ? <Spinner data-icon="inline-start" /> : null}
                        {submittingAction === 'password' ? ui.submit.loading : ui.submit.label}
                      </Button>
                    </form>
                  ) : null}
                </FieldGroup>
              )}

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
            <CardFooter>
              <Button asChild variant="ghost" size="sm">
                <a href="/">
                  <HouseIcon data-icon="inline-start" />
                  {ui.backHome}
                </a>
              </Button>
            </CardFooter>
          </Card>
        </main>
      </div>
    </div>
  )
}

export default AdminLogin
