import { useCallback, useEffect, useRef, useState } from 'react'
import type { Viewer as CesiumViewerType } from 'cesium'

import { CesiumViewer } from '#/components/cesium-viewer.tsx'
import { IonTokenSetup } from '#/components/ion-token-setup.tsx'
import { SettingsButton } from '#/components/settings-button.tsx'
import { TrackUploadDialog } from '#/components/track-upload-dialog.tsx'
import { TransportControls } from '#/components/transport-controls.tsx'
import { UploadFab } from '#/components/upload-fab.tsx'
import { useIonToken } from '#/hooks/use-ion-token.ts'
import { usePlaybackState } from '#/hooks/use-playback-state.ts'
import { attachTrack } from '#/lib/playback/playback.ts'
import type { PlaybackHandle } from '#/lib/playback/playback.ts'
import type { Track } from '#/lib/parsers/index.ts'

export function App() {
  const { token, hydrated, save } = useIonToken()
  const [showSettings, setShowSettings] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [viewer, setViewer] = useState<CesiumViewerType | null>(null)
  const [track, setTrack] = useState<Track | null>(null)
  const [handle, setHandle] = useState<PlaybackHandle | null>(null)

  const handleRef = useRef<PlaybackHandle | null>(null)
  handleRef.current = handle

  const onViewerReady = useCallback((v: CesiumViewerType) => {
    setViewer(v)
  }, [])

  // Attach (and re-attach) the track to the viewer whenever either changes.
  useEffect(() => {
    if (!viewer || !track) return
    const next = attachTrack(viewer, track)
    setHandle(next)
    return () => {
      next.dispose()
      setHandle(null)
    }
  }, [viewer, track])

  const playback = usePlaybackState(viewer, handle)

  if (!hydrated) return <LoadingScreen />

  if (!token) {
    return <IonTokenSetup onSave={save} />
  }

  // While a track is loaded, take over the camera (target=undefined).
  // Otherwise show the default world view (target=null).
  const cameraTarget = track ? undefined : null

  return (
    <div className="h-screen w-screen">
      <CesiumViewer
        key={token}
        ionToken={token}
        target={cameraTarget}
        onReady={onViewerReady}
      />

      <SettingsButton onClick={() => setShowSettings(true)} />

      {!track ? <UploadFab onClick={() => setShowUpload(true)} /> : null}

      {track && handle ? (
        <TransportControls
          state={playback.state}
          durationSeconds={handle.durationSeconds}
          trackName={track.meta.name}
          onToggle={playback.toggle}
          onSetMultiplier={playback.setMultiplier}
          onSeekSeconds={playback.seekSeconds}
          onUploadAnother={() => setShowUpload(true)}
          onRecenter={playback.recenter}
        />
      ) : null}

      <TrackUploadDialog
        open={showUpload}
        onOpenChange={setShowUpload}
        onLoaded={(next) => {
          setTrack(next)
        }}
      />

      {showSettings ? (
        <IonTokenSetup
          initialValue={token}
          onSave={(next) => {
            save(next)
            setShowSettings(false)
          }}
          onCancel={() => setShowSettings(false)}
        />
      ) : null}
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center text-muted-foreground">
      Loading…
    </div>
  )
}
