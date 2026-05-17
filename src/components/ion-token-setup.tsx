import { useState } from 'react'
import type { FormEvent } from 'react'
import { X } from 'lucide-react'
import { Button } from '#/components/ui/button.tsx'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card.tsx'
import { Input } from '#/components/ui/input.tsx'
import { Label } from '#/components/ui/label.tsx'

type Props = {
  initialValue?: string
  onSave: (token: string) => void
  onCancel?: () => void
}

export function IonTokenSetup({ initialValue = '', onSave, onCancel }: Props) {
  const [value, setValue] = useState(initialValue)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed) onSave(trimmed)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle>Cesium Ion access token</CardTitle>
              <CardDescription>
                Required to load satellite imagery and 3D terrain. Get a free token at{' '}
                <a
                  className="underline"
                  href="https://ion.cesium.com/tokens"
                  target="_blank"
                  rel="noreferrer"
                >
                  ion.cesium.com/tokens
                </a>
                .
              </CardDescription>
            </div>
            {onCancel ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onCancel}
                aria-label="Close"
              >
                <X />
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-2">
            <Label htmlFor="ion-token">Token</Label>
            <Input
              id="ion-token"
              autoFocus
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="eyJhbGciOi..."
            />
            <p className="text-xs text-muted-foreground">
              Stored locally in your browser. Never sent anywhere except Cesium Ion.
            </p>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={!value.trim()}>
              Save
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
