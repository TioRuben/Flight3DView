import { Plane } from 'lucide-react'

import { Button } from '#/components/ui/button.tsx'

export function UploadFab({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      size="icon-lg"
      onClick={onClick}
      aria-label="Load flight track"
      className="absolute right-6 bottom-6 z-10 size-14 rounded-full shadow-lg"
    >
      <Plane className="size-6" />
    </Button>
  )
}
