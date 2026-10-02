import { cn } from '@/lib/utils'

export type BrandLockupVariant = 'full' | 'compact' | 'responsive'

interface BrandLockupProps {
  title?: string
  variant?: BrandLockupVariant
  className?: string
  markClassName?: string
}

function BrandAsset({
  stem,
  sizeClassName,
  className,
}: {
  stem: string
  sizeClassName: string
  className?: string
}): JSX.Element {
  return (
    <>
      <img
        src={`/assets/${stem}-light.svg`}
        alt=""
        className={cn(sizeClassName, 'w-auto dark:hidden', className)}
        loading="eager"
        decoding="async"
      />
      <img
        src={`/assets/${stem}-dark.svg`}
        alt=""
        className={cn(sizeClassName, 'hidden w-auto dark:block', className)}
        loading="eager"
        decoding="async"
      />
    </>
  )
}

export default function BrandLockup({
  title = 'Tavily Hikari',
  variant = 'full',
  className,
  markClassName,
}: BrandLockupProps): JSX.Element {
  return (
    <span className={cn('inline-flex items-center', className)} role="img" aria-label={title}>
      {variant === 'compact' ? (
        <span className="inline-flex items-center">
          <BrandAsset stem="relay-mesh-mobile-logo" sizeClassName="h-7" className={markClassName} />
        </span>
      ) : variant === 'responsive' ? (
        <>
          <span className="hidden items-center sm:inline-flex">
            <BrandAsset stem="relay-mesh-lockup" sizeClassName="h-6" className={markClassName} />
          </span>
          <span className="inline-flex items-center sm:hidden">
            <BrandAsset stem="relay-mesh-mobile-logo" sizeClassName="h-7" className={markClassName} />
          </span>
        </>
      ) : (
        <span className="inline-flex items-center">
          <BrandAsset stem="relay-mesh-lockup" sizeClassName="h-6" className={markClassName} />
        </span>
      )}
    </span>
  )
}
