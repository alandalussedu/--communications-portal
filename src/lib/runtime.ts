/**
 * Claude serves the platform inside a frame and injects `window.claude`. A page
 * opened on its own (the public copy on GitHub Pages, or an app built from it)
 * never gets the runtime, so callers skip waiting for it.
 */
export function standalonePage(): boolean {
  try {
    return window.self === window.top && !/(^|\.)claude(usercontent)?\.(ai|com)$/i.test(location.hostname)
  } catch {
    return false // cross-origin parent: we are framed
  }
}
