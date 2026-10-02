import { CircleAlertIcon, HouseIcon } from 'lucide-react'
import type React from 'react'

import BrandLockup from '../components/BrandLockup'
import ThemeToggle from '../components/ThemeToggle'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { ConnectedUpdateAvailableBanner } from '../components/UpdateAvailableBanner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useTranslate } from '../i18n'

function RegistrationPaused(): React.JSX.Element {
  const translations = useTranslate()
  const strings = translations.public.registrationPaused

  return (
    <div className="min-h-svh bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-2">
            <BrandLockup title="Tavily Hikari" variant="responsive" />
            <Badge variant="outline" className="w-fit border-warning/40 bg-warning/10 text-warning">
              {strings.badge}
            </Badge>
            <h1 className="text-3xl font-semibold tracking-tight">{strings.title}</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">{strings.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>

        <ConnectedUpdateAvailableBanner strings={translations.public.updateBanner} />

        <Card>
          <CardHeader>
            <CardTitle>{strings.badge}</CardTitle>
            <CardDescription>{strings.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Alert className="border-warning/40 bg-warning/10">
              <CircleAlertIcon />
              <AlertTitle className="text-warning">{strings.badge}</AlertTitle>
              <AlertDescription className="text-warning">{strings.continueHint}</AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter className="justify-end">
            <Button asChild>
              <a href="/">
                <HouseIcon data-icon="inline-start" />
                {strings.returnHome}
              </a>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

export default RegistrationPaused
