import { useEffect, useState } from 'react'
import {
  BellRingIcon,
  CheckIcon,
  ChevronDownIcon,
  CrownIcon,
  LoaderCircleIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
} from 'lucide-react'

import BrandLockup from './BrandLockup'
import { Icon } from '../lib/icons'

import { languageOptions, type Language, useLanguage, useTranslate } from '../i18n'
import { type ThemeMode, useTheme } from '../theme'
import LanguageSwitcher from './LanguageSwitcher'
import ThemeToggle from './ThemeToggle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface UserConsoleHeaderProps {
  title: string
  subtitle: string
  eyebrow: string
  currentViewLabel: string
  currentViewTitle: string
  currentViewDescription: string
  sessionLabel: string
  sessionDisplayName?: string | null
  sessionProviderLabel?: string | null
  sessionAvatarUrl?: string | null
  adminLabel: string
  isAdmin: boolean
  adminHref?: string | null
  adminActionLabel?: string | null
  adminMenuLabel?: string | null
  announcementsLabel?: string | null
  announcementCount?: number
  onOpenAnnouncements?: () => void
  logoutVisible: boolean
  isLoggingOut: boolean
  logoutLabel: string
  loggingOutLabel: string
  onLogout: () => void
}

interface UserConsoleAvatarProps {
  avatarUrl?: string | null
  displayName: string
  className: string
  imageClassName: string
}

interface UserConsoleAccountMenuProps {
  sessionLabel: string
  sessionDisplayName?: string | null
  sessionProviderLabel?: string | null
  sessionAvatarUrl?: string | null
  adminLabel: string
  isAdmin: boolean
  adminHref?: string | null
  adminActionLabel?: string | null
  adminMenuLabel?: string | null
  logoutVisible: boolean
  isLoggingOut: boolean
  logoutLabel: string
  loggingOutLabel: string
  onLogout: () => void
}

const LANGUAGE_META: Record<Language, { icon: string; short: string }> = {
  en: { icon: 'circle-flags:gb', short: 'EN' },
  zh: { icon: 'circle-flags:cn', short: '中文' },
}

const UTILITY_COPY = {
  en: {
    menu: 'Preferences',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
  },
  zh: {
    menu: '偏好',
    theme: '主题',
    light: '浅色',
    dark: '深色',
    system: '跟随系统',
  },
} as const

function ThemeModeIcon({ mode }: { mode: ThemeMode }): JSX.Element {
  if (mode === 'dark') return <MoonIcon aria-hidden="true" />
  if (mode === 'light') return <SunIcon aria-hidden="true" />
  return <MonitorIcon aria-hidden="true" />
}

function UserConsoleAvatar(props: UserConsoleAvatarProps): JSX.Element {
  const [broken, setBroken] = useState(false)
  const initial = props.displayName.trim().charAt(0).toUpperCase() || '?'

  useEffect(() => {
    setBroken(false)
  }, [props.avatarUrl])

  if (props.avatarUrl && !broken) {
    return (
      <img
        src={props.avatarUrl}
        alt=""
        aria-hidden="true"
        className={props.imageClassName}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    )
  }

  return (
    <span className={props.className} aria-hidden="true">
      {initial}
    </span>
  )
}

const AVATAR_BASE_CLASS = 'user-console-account-avatar-image size-6 shrink-0 overflow-hidden rounded-full'
const AVATAR_FALLBACK_CLASS = `${AVATAR_BASE_CLASS} user-console-account-avatar-fallback flex items-center justify-center bg-muted text-xs font-semibold text-muted-foreground`

function UserConsoleUtilityMenu(): JSX.Element {
  const { language, setLanguage } = useLanguage()
  const { mode, setMode } = useTheme()
  const strings = useTranslate()
  const copy = UTILITY_COPY[language]

  const handleThemeSelect = (next: ThemeMode) => {
    if (next === mode) return
    setMode(next)
  }

  const handleLanguageSelect = (next: Language) => {
    if (next === language) return
    setLanguage(next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="user-console-utility-trigger"
          aria-label={`${copy.menu}: ${copy.theme} / ${strings.common.languageLabel}`}
        >
          <SettingsIcon data-icon="inline-start" />
          {copy.menu}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}>
        <DropdownMenuLabel>{copy.theme}</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleThemeSelect('light')}>
          <SunIcon aria-hidden="true" />
          {copy.light}
          {mode === 'light' ? <CheckIcon className="ml-auto" aria-hidden="true" /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleThemeSelect('dark')}>
          <MoonIcon aria-hidden="true" />
          {copy.dark}
          {mode === 'dark' ? <CheckIcon className="ml-auto" aria-hidden="true" /> : null}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleThemeSelect('system')}>
          <ThemeModeIcon mode="system" />
          {copy.system}
          {mode === 'system' ? <CheckIcon className="ml-auto" aria-hidden="true" /> : null}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuLabel>{strings.common.languageLabel}</DropdownMenuLabel>
        {languageOptions.map((option) => {
          const meta = LANGUAGE_META[option.value]
          const isActive = option.value === language
          return (
            <DropdownMenuItem key={option.value} onClick={() => handleLanguageSelect(option.value)}>
              <span className="language-flag" aria-hidden="true">
                <Icon icon={meta.icon} width={18} height={18} />
              </span>
              {strings.common[option.labelKey]}
              {isActive ? <CheckIcon className="ml-auto" aria-hidden="true" /> : null}
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function UserConsoleAnnouncementsTrigger({
  announcementsLabel,
  announcementCount,
  onOpenAnnouncements,
}: {
  announcementsLabel?: string | null
  announcementCount?: number
  onOpenAnnouncements?: () => void
}): JSX.Element | null {
  if (!onOpenAnnouncements || !announcementsLabel) {
    return null
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="user-console-announcements-trigger"
      aria-label={announcementsLabel}
      onClick={onOpenAnnouncements}
    >
      <BellRingIcon data-icon="inline-start" />
      {announcementCount && announcementCount > 0 ? (
        <Badge variant="secondary" className="px-1.5 tabular-nums">{announcementCount}</Badge>
      ) : null}
    </Button>
  )
}

function UserConsoleAccountMenu(props: UserConsoleAccountMenuProps): JSX.Element | null {
  const hasAdminAction = Boolean(props.adminHref && props.adminActionLabel)
  const accountName = props.sessionDisplayName ?? props.adminLabel
  const accountMeta = [props.sessionProviderLabel, props.isAdmin ? props.adminLabel : null]
    .filter((value): value is string => Boolean(value))
    .join(' · ')
  const showAccountMenu = Boolean(
    props.sessionDisplayName || props.sessionProviderLabel || props.isAdmin || hasAdminAction || props.logoutVisible,
  )

  if (!showAccountMenu) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="user-console-account-trigger"
          aria-label={`${props.sessionLabel}: ${accountName}`}
        >
          <UserConsoleAvatar
            avatarUrl={props.sessionAvatarUrl}
            displayName={accountName}
            className={AVATAR_FALLBACK_CLASS}
            imageClassName={AVATAR_BASE_CLASS}
          />
          <span className="max-w-32 truncate">{accountName}</span>
          <ChevronDownIcon data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56">
        <div className="flex items-center gap-2.5 px-2 py-2">
          <UserConsoleAvatar
            avatarUrl={props.sessionAvatarUrl}
            displayName={accountName}
            className={`${AVATAR_FALLBACK_CLASS} size-8`}
            imageClassName={`${AVATAR_BASE_CLASS} size-8`}
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{accountName}</span>
            {accountMeta ? <span className="truncate text-xs text-muted-foreground">{accountMeta}</span> : null}
          </div>
        </div>

        {(hasAdminAction || props.logoutVisible) && <DropdownMenuSeparator />}

        {hasAdminAction && (
          <DropdownMenuItem
            onSelect={() => {
              if (props.adminHref) {
                window.location.href = props.adminHref
              }
            }}
          >
            <CrownIcon aria-hidden="true" />
            {props.adminMenuLabel ?? props.adminActionLabel}
          </DropdownMenuItem>
        )}

        {props.logoutVisible && (
          <DropdownMenuItem
            variant="destructive"
            onSelect={(event) => {
              event.preventDefault()
              if (!props.isLoggingOut) {
                props.onLogout()
              }
            }}
            disabled={props.isLoggingOut}
          >
            {props.isLoggingOut ? (
              <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
            ) : (
              <LogOutIcon aria-hidden="true" />
            )}
            {props.isLoggingOut ? props.loggingOutLabel : props.logoutLabel}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function UserConsoleHeader(props: UserConsoleHeaderProps): JSX.Element {
  const desktopSummary = props.subtitle

  return (
    <section className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="user-console-header-topline user-console-header-main flex min-w-0 items-center gap-3">
          <BrandLockup title="Tavily Hikari" variant="responsive" />
          <span className="hidden rounded-full border bg-muted px-2 py-0.5 text-xs text-muted-foreground sm:inline">
            {props.eyebrow}
          </span>
          <span className="hidden min-w-0 truncate text-sm text-muted-foreground lg:inline">
            {desktopSummary}
          </span>
        </div>

        <div
          className="user-console-header-actions-desktop hidden items-center gap-2 md:flex"
          aria-label={props.sessionLabel}
        >
          <ThemeToggle />
          <LanguageSwitcher />
          <UserConsoleAnnouncementsTrigger
            announcementsLabel={props.announcementsLabel}
            announcementCount={props.announcementCount}
            onOpenAnnouncements={props.onOpenAnnouncements}
          />
          <UserConsoleAccountMenu {...props} />
        </div>

        <div
          className="user-console-header-actions-compact flex w-full items-center justify-between gap-2 md:hidden"
          aria-label={props.sessionLabel}
        >
          <span className="min-w-0 truncate text-sm text-muted-foreground">{desktopSummary}</span>
          <div className="user-console-header-compact-tools flex items-center gap-2">
            <UserConsoleAnnouncementsTrigger
              announcementsLabel={props.announcementsLabel}
              announcementCount={props.announcementCount}
              onOpenAnnouncements={props.onOpenAnnouncements}
            />
            <UserConsoleUtilityMenu />
          </div>
          <div className="user-console-header-compact-account flex items-center">
            <UserConsoleAccountMenu {...props} />
          </div>
        </div>
      </div>
    </section>
  )
}
