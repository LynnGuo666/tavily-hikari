import { Icon } from '../lib/icons'
import type React from 'react'

import { languageOptions, type Language, useLanguage, useTranslate } from '../i18n'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuGroup } from '@/components/ui/dropdown-menu'

const LANGUAGE_META: Record<Language, { icon: string; short: string }> = {
  en: { icon: 'circle-flags:gb', short: 'EN' },
  zh: { icon: 'circle-flags:cn', short: '中文' },
}

function LanguageSwitcher(): React.JSX.Element {
  const { language, setLanguage } = useLanguage()
  const strings = useTranslate()
  const activeMeta = LANGUAGE_META[language]

  const handleSelect = (next: Language) => {
    if (next === language) return
    setLanguage(next)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="language-switcher-trigger"
          aria-label={`${strings.common.languageLabel}: ${strings.common[language === 'en' ? 'englishLabel' : 'chineseLabel']}`}
          title={strings.common.languageLabel}
        >
          <span className="sr-only">{strings.common.languageLabel}</span>
          <span aria-hidden="true">
            <Icon icon={activeMeta.icon} width={18} height={18} />
          </span>
          <span>{activeMeta.short}</span>
          <Icon icon="mdi:chevron-down" width={16} height={16} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 p-1">
        <DropdownMenuGroup>
          {languageOptions.map((option) => {
            const meta = LANGUAGE_META[option.value]
            const isActive = option.value === language
            return (
              <DropdownMenuItem
                key={option.value}
                className={`cursor-pointer ${isActive ? 'active' : ''}`}
                onClick={() => handleSelect(option.value as Language)}
              >
                <span aria-hidden="true">
                  <Icon icon={meta.icon} width={18} height={18} />
                </span>
                <span>{strings.common[option.labelKey]}</span>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default LanguageSwitcher
