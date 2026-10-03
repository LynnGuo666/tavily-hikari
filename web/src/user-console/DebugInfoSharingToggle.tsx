import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type React from 'react'

export default function DebugInfoSharingToggle({
  shared,
  disabled,
  saving,
  error,
  text,
  onChange,
}: {
  shared: boolean
  disabled: boolean
  saving: boolean
  error: string | null
  text: {
    debugSharing: string
    debugSharingHint: string
    debugSharingSaving: string
  }
  onChange: (shared: boolean) => void
}): React.JSX.Element {
  return (
    <div className="access-stat user-console-debug-sharing bg-card p-4">
      <div className="flex items-start gap-3 text-sm">
        <Switch
          id="user-console-debug-info-sharing"
          name="user_console_debug_info_sharing"
          checked={shared}
          disabled={disabled}
          onCheckedChange={onChange}
        />
        <Label
          htmlFor="user-console-debug-info-sharing"
          className="flex-1 cursor-pointer flex-col items-start gap-0.5 font-normal"
        >
          <span className="access-stat-title font-medium text-foreground">{text.debugSharing}</span>
          <span className="block text-xs font-normal text-muted-foreground">{text.debugSharingHint}</span>
        </Label>
      </div>
      {(saving || error) && (
        <p
          className={`mt-2 text-xs ${error && !saving ? 'text-destructive' : 'text-muted-foreground'}`}
          role="status"
          aria-live="polite"
        >
          {saving ? text.debugSharingSaving : error}
        </p>
      )}
    </div>
  )
}
