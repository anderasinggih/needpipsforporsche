export function popupHost(el: Element | null | undefined): HTMLElement | null {
  if (!el) return null
  return (el.closest("[data-popup-root]") as HTMLElement | null) ?? el.ownerDocument.body
}

const isRoot = (h: HTMLElement | null | undefined): h is HTMLElement => !!h && h.hasAttribute("data-popup-root")

export function toHost(r: DOMRect, host: HTMLElement | null | undefined) {
  if (!isRoot(host)) return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
  const hr = host.getBoundingClientRect()
  const s = hr.width / (host.offsetWidth || 1) || 1
  const left = (r.left - hr.left) / s
  const top = (r.top - hr.top) / s
  const width = r.width / s
  const height = r.height / s
  return { left, top, right: left + width, bottom: top + height, width, height }
}

export function hostSize(host: HTMLElement | null | undefined) {
  /* read before the guard: its false branch narrows `host` to never */
  const view = host?.ownerDocument.defaultView ?? window
  if (isRoot(host)) return { width: host.offsetWidth, height: host.offsetHeight }
  return { width: view.innerWidth, height: view.innerHeight }
}

export function hostView(host: HTMLElement | null | undefined) {
  const view = host?.ownerDocument.defaultView ?? window
  if (!isRoot(host)) return { left: 0, top: 0, width: view.innerWidth, height: view.innerHeight }
  /* the host does not clip its fixed popups, so the room is the clipping ancestor's whole box */
  let clip = host.getBoundingClientRect()
  for (let el = host.parentElement; el && el !== host.ownerDocument.body; el = el.parentElement) {
    const cs = view.getComputedStyle(el)
    if (cs.overflowX === "visible" && cs.overflowY === "visible" && !/paint|strict|content/.test(cs.contain)) continue
    clip = el.getBoundingClientRect()
    break
  }
  const v = toHost(clip, host)
  return { left: v.left, top: v.top, width: v.width, height: v.height }
}

export function scrimStyle(host: HTMLElement | null | undefined) {
  if (!isRoot(host)) return undefined
  const v = hostView(host)
  return { left: v.left, top: v.top, width: v.width, height: v.height, right: "auto", bottom: "auto" } as const
}
