import {
  Cartesian3,
  Color,
  HeadingPitchRange,
  JulianDate,
  Math as CesiumMath,
  Matrix4,
  SampledPositionProperty,
  ClockRange,
  LinearApproximation,
} from 'cesium'
import type { Viewer as CesiumViewerType, Entity } from 'cesium'

import type { Track } from '#/lib/parsers/index.ts'
import { PLANE_ICON_DATA_URL } from './plane-icon.ts'
import { headingAt, lerpAngle, precomputeHeadings } from './heading.ts'

export type PlaybackHandle = {
  start: JulianDate
  stop: JulianDate
  durationSeconds: number
  isUserOverridden: () => boolean
  recenter: () => void
  dispose: () => void
  // Detach live follow + input listeners so the caller can drive the clock
  // and render frames deterministically (used by the video export path).
  setExportMode: (enabled: boolean) => void
  // Snap the camera to the user's current relative pose at the given track
  // time and force a synchronous render. Caller is responsible for then
  // reading viewer.canvas pixels (e.g. via CanvasSource.add()).
  renderFrameAt: (time: JulianDate) => void
}

const ORANGE = Color.fromCssColorString('#fb923c')
const ORANGE_OUTLINE = Color.fromCssColorString('#7c2d12')

const DEFAULT_CAMERA_RANGE = 700
const DEFAULT_CAMERA_PITCH = CesiumMath.toRadians(-22)
// Per-frame smoothing alpha — higher = snappier, lower = silkier but laggier.
const FOLLOW_SMOOTH_ALPHA = 0.12

export function attachTrack(
  viewer: CesiumViewerType,
  track: Track,
): PlaybackHandle {
  const samples = track.samples
  if (samples.length < 2) {
    throw new Error('Track has fewer than 2 samples; cannot play')
  }

  const startMs = samples[0].time
  const stopMs = samples[samples.length - 1].time
  const durationSeconds = (stopMs - startMs) / 1000

  const start = JulianDate.fromDate(new Date(startMs))
  const stop = JulianDate.fromDate(new Date(stopMs))

  const positionProperty = new SampledPositionProperty()
  positionProperty.setInterpolationOptions({
    interpolationDegree: 1,
    interpolationAlgorithm: LinearApproximation,
  })
  for (const s of samples) {
    positionProperty.addSample(
      JulianDate.fromDate(new Date(s.time)),
      Cartesian3.fromDegrees(s.longitude, s.latitude, s.altitude),
    )
  }

  const aircraft: Entity = viewer.entities.add({
    id: 'flight-aircraft',
    position: positionProperty,
    point: {
      pixelSize: 12,
      color: ORANGE,
      outlineColor: ORANGE_OUTLINE,
      outlineWidth: 2,
    },
    billboard: {
      image: PLANE_ICON_DATA_URL,
      width: 36,
      height: 36,
      eyeOffset: new Cartesian3(0, 0, -10),
    },
    path: {
      leadTime: 0,
      trailTime: durationSeconds + 1,
      width: 3,
      material: ORANGE,
      resolution: 1,
    },
  })

  const clock = viewer.clock
  clock.startTime = start.clone()
  clock.stopTime = stop.clone()
  clock.currentTime = start.clone()
  clock.clockRange = ClockRange.CLAMPED
  clock.multiplier = 1
  clock.shouldAnimate = false

  const headings = precomputeHeadings(track)
  let smoothedHeading = headings[0]
  let userPitch = DEFAULT_CAMERA_PITCH
  let userRange = DEFAULT_CAMERA_RANGE
  // Camera heading minus aircraft heading at the moment the user last
  // positioned the view. While in manual mode we re-apply this offset every
  // frame so the camera keeps showing the same side of the aircraft through
  // turns, instead of holding an absolute compass heading.
  let headingOffset = 0
  let flyToActive = true
  let userOverride = false
  // First-frame snap flag for export mode; reset by setExportMode(true).
  let exportSmoothPrimed = false

  // Tracking "is the user actively manipulating the camera right now". This
  // is distinct from userOverride (a sticky "manual mode" flag) — we need
  // it because once the user releases, we must STOP resampling the camera
  // every frame. Otherwise distance(camera, aircraft) drifts as the aircraft
  // moves between frames, and the camera appears to slowly zoom out.
  let activePointers = 0
  let wheelingUntil = 0
  const WHEEL_BURST_MS = 150
  const isInteracting = () => activePointers > 0 || Date.now() < wheelingUntil

  const camera = viewer.scene.camera

  const onPointerDown = () => {
    activePointers += 1
  }
  const onPointerUp = () => {
    activePointers = Math.max(0, activePointers - 1)
  }
  // Only actual drag / pinch flips into manual mode. A bare pointerdown
  // without movement shouldn't lock the view away from auto-heading.
  const onPointerMove = (e: PointerEvent) => {
    if (e.buttons > 0) userOverride = true
  }
  const onWheel = () => {
    userOverride = true
    wheelingUntil = Date.now() + WHEEL_BURST_MS
  }
  const onTouchMove = () => {
    userOverride = true
  }
  const canvas = viewer.canvas

  let listenersAttached = false
  const attachListeners = () => {
    if (listenersAttached) return
    listenersAttached = true
    viewer.scene.preRender.addEventListener(followListener)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('wheel', onWheel, { passive: true })
    canvas.addEventListener('touchmove', onTouchMove, { passive: true })
    // pointerup/cancel on window so we still catch the release even if the
    // pointer leaves the canvas mid-drag.
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  }
  const detachListeners = () => {
    if (!listenersAttached) return
    listenersAttached = false
    viewer.scene.preRender.removeEventListener(followListener)
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('wheel', onWheel)
    canvas.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
  }

  const followListener = () => {
    // Don't fight the initial flyTo — let it finish before we lock onto
    // the entity. flyToActive flips to false in the complete callback.
    if (flyToActive) return

    const t = clock.currentTime
    const tMs = JulianDate.toDate(t).getTime()
    const targetPos = positionProperty.getValue(t)
    if (!targetPos) return

    if (userOverride) {
      const aircraftHeading = headingAt(samples, headings, tMs)
      // Only resample the camera while the user is actively dragging/zooming.
      // Once they release, freeze the chosen pitch/range — otherwise distance
      // to the moving aircraft would creep up each frame and the view would
      // drift outward. Heading is the exception: we keep it locked relative
      // to the aircraft (via headingOffset) so the same side stays visible
      // through turns.
      if (isInteracting()) {
        const range = Cartesian3.distance(camera.positionWC, targetPos)
        if (Number.isFinite(range) && range > 0) userRange = range
        userPitch = camera.pitch
        smoothedHeading = camera.heading
        headingOffset = camera.heading - aircraftHeading
      } else {
        const targetHeading = aircraftHeading + headingOffset
        smoothedHeading = lerpAngle(
          smoothedHeading,
          targetHeading,
          FOLLOW_SMOOTH_ALPHA,
        )
      }
    } else {
      const targetHeading = headingAt(samples, headings, tMs)
      smoothedHeading = lerpAngle(
        smoothedHeading,
        targetHeading,
        FOLLOW_SMOOTH_ALPHA,
      )
      // After a recenter, ease pitch/range back to defaults instead of
      // snapping (heading is already eased by lerpAngle above).
      userPitch = CesiumMath.lerp(
        userPitch,
        DEFAULT_CAMERA_PITCH,
        FOLLOW_SMOOTH_ALPHA,
      )
      userRange = CesiumMath.lerp(
        userRange,
        DEFAULT_CAMERA_RANGE,
        FOLLOW_SMOOTH_ALPHA,
      )
    }

    camera.lookAt(
      targetPos,
      new HeadingPitchRange(smoothedHeading, userPitch, userRange),
    )
  }

  attachListeners()

  // Initial framing: fly to where the track starts. The follow listener
  // ignores its frames during this flight via flyToActive.
  camera.flyTo({
    destination: Cartesian3.fromDegrees(
      samples[0].longitude,
      samples[0].latitude,
      Math.max(samples[0].altitude + 600, 800),
    ),
    orientation: {
      heading: smoothedHeading,
      pitch: CesiumMath.toRadians(-25),
      roll: 0,
    },
    duration: 1.5,
    complete: () => {
      flyToActive = false
    },
  })

  return {
    start,
    stop,
    durationSeconds,
    isUserOverridden: () => userOverride,
    recenter: () => {
      userOverride = false
    },
    setExportMode: (enabled) => {
      if (enabled) {
        detachListeners()
        // Reset on the next frame so it snaps to the desired target and then
        // smooths from there. Without this the first export frame would
        // inherit whatever residual smoothing state live mode left behind.
        exportSmoothPrimed = false
      } else {
        attachListeners()
      }
    },
    renderFrameAt: (time) => {
      clock.currentTime = time.clone()
      const targetPos = positionProperty.getValue(time)
      if (!targetPos) return
      const tMs = JulianDate.toDate(time).getTime()
      const aircraftHeading = headingAt(samples, headings, tMs)
      const targetHeading = userOverride
        ? aircraftHeading + headingOffset
        : aircraftHeading
      // Match live-playback smoothing so headings table noise / sample-boundary
      // inflections don't manifest as per-frame tremor in the exported video.
      if (!exportSmoothPrimed) {
        smoothedHeading = targetHeading
        exportSmoothPrimed = true
      } else {
        smoothedHeading = lerpAngle(
          smoothedHeading,
          targetHeading,
          FOLLOW_SMOOTH_ALPHA,
        )
      }
      camera.lookAt(
        targetPos,
        new HeadingPitchRange(smoothedHeading, userPitch, userRange),
      )
      // viewer.render() advances DataSourceDisplay so the aircraft entity
      // (billboard/point/path) snaps to the new clock time. scene.render()
      // alone would leave entities frozen at their previous position.
      viewer.render()
    },
    dispose: () => {
      detachListeners()
      camera.lookAtTransform(Matrix4.IDENTITY)
      viewer.entities.remove(aircraft)
      clock.shouldAnimate = false
    },
  }
}
