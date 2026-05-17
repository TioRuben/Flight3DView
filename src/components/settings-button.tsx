import { Settings } from 'lucide-react'
import { Button } from '#/components/ui/button.tsx'

export function SettingsButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="icon"
      onClick={onClick}
      aria-label="Open settings"
      className="absolute top-4 right-4 z-10 shadow-md"
    >
      <Settings />
    </Button>
  )
}
