import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import type React from 'react'

import { useTheme } from 'next-themes'

import { useLanguage } from '../i18n'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuGroup } from '@/components/ui/dropdown-menu'

type ThemeMode = 'light' | 'dark' | 'system'

function asThemeMode(theme: string | undefined): ThemeMode {
  return theme === 'dark' || theme === 'light' || theme === 'system' ? theme : 'light'
}

const labels = {
  en: {
    trigger: 'Theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
  },
  zh: {
    trigger: '主题',
    light: '浅色',
    dark: '深色',
    system: '跟随系统',
  },
} as const

function ThemeIcon({ mode }: { mode: ThemeMode }): React.JSX.Element {
  if (mode === 'dark') return <MoonIcon aria-hidden="true" />
  if (mode === 'light') return <SunIcon aria-hidden="true" />
  return <MonitorIcon aria-hidden="true" />
}

export default function ThemeToggle(): React.JSX.Element {
  const { language } = useLanguage()
  const copy = labels[language]
  const { theme, setTheme } = useTheme()
  const mode = asThemeMode(theme)
  const setMode = (next: ThemeMode) => setTheme(next)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="theme-toggle-trigger"
          aria-label={copy.trigger}
          title={copy.trigger}
        >
          <ThemeIcon mode={mode} />
          <span>{copy.trigger}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => setMode('light')} className="cursor-pointer">
            <SunIcon aria-hidden="true" />
            <span>{copy.light}</span>
            {mode === 'light' ? <CheckIcon className="ml-auto" aria-hidden="true" /> : null}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMode('dark')} className="cursor-pointer">
            <MoonIcon aria-hidden="true" />
            <span>{copy.dark}</span>
            {mode === 'dark' ? <CheckIcon className="ml-auto" aria-hidden="true" /> : null}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setMode('system')} className="cursor-pointer">
            <MonitorIcon aria-hidden="true" />
            <span>{copy.system}</span>
            {mode === 'system' ? <CheckIcon className="ml-auto" aria-hidden="true" /> : null}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
