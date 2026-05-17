import { JulianDate } from 'cesium'
import type { Viewer as CesiumViewerType } from 'cesium'
import {
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  QUALITY_HIGH,
  canEncode,
} from 'mediabunny'

import type { PlaybackHandle } from '#/lib/playback/playback.ts'

export type ExportResolution =
  | '720p-landscape'
  | '1080p-landscape'
  | '720p-portrait'
  | '1080p-portrait'

export type ExportFps = 25 | 30

export type ExportOptions = {
  resolution: ExportResolution
  fps: ExportFps
  // Track-to-video speedup. A 60-min track at multiplier 10 yields a 6-min
  // video. The exported MP4 plays at 1× — the speedup is baked into the
  // sampling cadence.
  multiplier: number
  onProgress?: (fraction: number, frame: number, totalFrames: number) => void
  signal?: AbortSignal
}

const RESOLUTIONS: Record<ExportResolution, { width: number; height: number }> =
  {
    '720p-landscape': { width: 1280, height: 720 },
    '1080p-landscape': { width: 1920, height: 1080 },
    '720p-portrait': { width: 720, height: 1280 },
    '1080p-portrait': { width: 1080, height: 1920 },
  }

export class VideoExportUnsupportedError extends Error {
  constructor() {
    super(
      "Your browser doesn't support MP4 video export. Use a recent Chrome, Edge, Safari 16.4+, or Firefox 130+.",
    )
    this.name = 'VideoExportUnsupportedError'
  }
}

type ViewerInternals = CesiumViewerType & {
  useBrowserRecommendedResolution?: boolean
}

export async function exportVideo(
  viewer: CesiumViewerType,
  handle: PlaybackHandle,
  opts: ExportOptions,
): Promise<Blob> {
  if (!(await canEncode('avc'))) throw new VideoExportUnsupportedError()

  const { width, height } = RESOLUTIONS[opts.resolution]
  const totalFrames = Math.max(
    1,
    Math.ceil((handle.durationSeconds / opts.multiplier) * opts.fps),
  )

  const v = viewer as ViewerInternals
  const container = viewer.container as HTMLElement
  const clock = viewer.clock

  // Snapshot everything we touch so the finally block can put it back.
  const saved = {
    containerStyle: {
      position: container.style.position,
      left: container.style.left,
      top: container.style.top,
      width: container.style.width,
      height: container.style.height,
      zIndex: container.style.zIndex,
    },
    useBrowserRecommendedResolution: v.useBrowserRecommendedResolution,
    resolutionScale: viewer.resolutionScale,
    useDefaultRenderLoop: viewer.useDefaultRenderLoop,
    shouldAnimate: clock.shouldAnimate,
    currentTime: clock.currentTime.clone(),
  }

  // Stop the rAF-driven render loop so Cesium doesn't fight our manual frame
  // pacing. Pause playback so the clock doesn't auto-advance.
  viewer.useDefaultRenderLoop = false
  clock.shouldAnimate = false
  handle.setExportMode(true)

  // Move the viewer off-screen at the target pixel size. Position fixed so
  // it doesn't reflow the rest of the page (the modal stays where it is).
  container.style.position = 'fixed'
  container.style.left = '-99999px'
  container.style.top = '0'
  container.style.width = `${width}px`
  container.style.height = `${height}px`
  container.style.zIndex = '-1'

  v.useBrowserRecommendedResolution = false
  viewer.resolutionScale = 1
  viewer.resize()
  // One rAF tick so Cesium settles on the new size before we grab pixels.
  await new Promise((r) => requestAnimationFrame(() => r(null)))
  viewer.resize()

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  })
  const videoSource = new CanvasSource(viewer.canvas, {
    codec: 'avc',
    bitrate: QUALITY_HIGH,
    keyFrameInterval: 2,
  })
  output.addVideoTrack(videoSource, { frameRate: opts.fps })

  try {
    await output.start()

    const frameDuration = 1 / opts.fps
    const trackStepSeconds = opts.multiplier / opts.fps

    for (let i = 0; i < totalFrames; i++) {
      if (opts.signal?.aborted)
        throw new DOMException('Export aborted', 'AbortError')

      const trackSeconds = Math.min(
        i * trackStepSeconds,
        handle.durationSeconds,
      )
      const t = JulianDate.addSeconds(
        handle.start,
        trackSeconds,
        new JulianDate(),
      )
      handle.renderFrameAt(t)

      await videoSource.add(i * frameDuration, frameDuration)
      opts.onProgress?.((i + 1) / totalFrames, i + 1, totalFrames)
    }

    videoSource.close()
    await output.finalize()

    const buffer = output.target.buffer
    if (!buffer)
      throw new Error('Mediabunny finalized without producing a buffer')
    return new Blob([buffer], { type: 'video/mp4' })
  } finally {
    // Restore in reverse order. Best-effort — swallow restore errors so the
    // original failure (if any) propagates.
    try {
      videoSource.close()
    } catch {
      // ignore
    }
    handle.setExportMode(false)
    container.style.position = saved.containerStyle.position
    container.style.left = saved.containerStyle.left
    container.style.top = saved.containerStyle.top
    container.style.width = saved.containerStyle.width
    container.style.height = saved.containerStyle.height
    container.style.zIndex = saved.containerStyle.zIndex
    v.useBrowserRecommendedResolution = saved.useBrowserRecommendedResolution
    viewer.resolutionScale = saved.resolutionScale
    clock.currentTime = saved.currentTime
    clock.shouldAnimate = saved.shouldAnimate
    viewer.useDefaultRenderLoop = saved.useDefaultRenderLoop
    viewer.resize()
  }
}
