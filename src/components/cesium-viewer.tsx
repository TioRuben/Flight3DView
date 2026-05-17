import { useCallback, useEffect, useState } from 'react'
import {
  Cartesian3,
  Ion,
  IonWorldImageryStyle,
  Math as CesiumMath,
  createWorldImageryAsync,
  createWorldTerrainAsync,
} from 'cesium'
import { Viewer } from 'resium'
import type { CesiumComponentRef } from 'resium'
import type { Viewer as CesiumViewerType } from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

type Coords = { latitude: number; longitude: number }

type Props = {
  ionToken: string
  // null  = fly to a default world view
  // value = fly to those coords
  // undefined = caller is managing the camera (e.g. track playback); do not auto-fly
  target: Coords | null | undefined
  onReady?: (viewer: CesiumViewerType) => void
}

const DEFAULT_VIEW: Coords = { latitude: 20, longitude: 0 }
const ALTITUDE_METERS = 2500
const PITCH_DEGREES = -35

export function CesiumViewer({ ionToken, target, onReady }: Props) {
  Ion.defaultAccessToken = ionToken

  const [viewer, setViewer] = useState<CesiumViewerType | null>(null)

  const handleRef = useCallback(
    (component: CesiumComponentRef<CesiumViewerType> | null) => {
      const next = component?.cesiumElement ?? null
      setViewer((prev) => (prev === next ? prev : next))
    },
    [],
  )

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return
    onReady?.(viewer)
  }, [viewer, onReady])

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return
    const v = viewer
    const ac = new AbortController()
    const isAborted = () => ac.signal.aborted

    async function setupBaseLayers() {
      try {
        const imagery = await createWorldImageryAsync({
          style: IonWorldImageryStyle.AERIAL_WITH_LABELS,
        })
        if (isAborted() || v.isDestroyed()) return
        v.imageryLayers.removeAll()
        v.imageryLayers.addImageryProvider(imagery)

        const terrain = await createWorldTerrainAsync()
        if (isAborted() || v.isDestroyed()) return
        v.terrainProvider = terrain
      } catch (err) {
        console.error('Failed to load Cesium Ion assets — token may be invalid.', err)
      }
    }

    void setupBaseLayers()

    return () => {
      ac.abort()
    }
  }, [viewer, ionToken])

  useEffect(() => {
    if (!viewer || viewer.isDestroyed()) return
    if (target === undefined) return

    const view = target ?? DEFAULT_VIEW
    const altitude = target ? ALTITUDE_METERS : 12_000_000

    viewer.camera.flyTo({
      destination: Cartesian3.fromDegrees(view.longitude, view.latitude, altitude),
      orientation: {
        heading: 0,
        pitch: CesiumMath.toRadians(target ? PITCH_DEGREES : -90),
        roll: 0,
      },
      duration: target ? 2 : 0,
    })
  }, [viewer, target])

  return (
    <Viewer
      full
      ref={handleRef}
      timeline={false}
      animation={false}
      baseLayerPicker={false}
      geocoder={false}
      homeButton={false}
      sceneModePicker={false}
      navigationHelpButton={false}
      fullscreenButton={false}
      infoBox={false}
      selectionIndicator={false}
    />
  )
}
