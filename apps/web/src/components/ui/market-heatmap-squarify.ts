export interface SquarifiedTile<T> {
  x: number
  y: number
  w: number
  h: number
  item: T
  /** the item's rank by size, largest first (0 = largest) */
  rank: number
}

export function squarify<T>(items: T[], size: (item: T) => number, w: number, h: number): SquarifiedTile<T>[] {
  const sorted = items.filter((it) => size(it) > 0).sort((a, b) => size(b) - size(a))
  const total = sorted.reduce((s, it) => s + size(it), 0) || 1
  const queue = sorted.map((item, rank) => ({ item, rank, area: (size(item) / total) * w * h }))
  const sum = (row: { area: number }[]) => row.reduce((s, r) => s + r.area, 0)
  const worst = (row: { area: number }[], side: number) => {
    const s = sum(row)
    const areas = row.map((r) => r.area)
    return Math.max((side * side * Math.max(...areas)) / (s * s), (s * s) / (side * side * Math.min(...areas)))
  }

  const out: SquarifiedTile<T>[] = []
  let box = { x: 0, y: 0, w, h }
  let i = 0
  while (i < queue.length) {
    const side = Math.min(box.w, box.h)
    const row = [queue[i]]
    let k = i + 1
    while (k < queue.length && worst([...row, queue[k]], side) <= worst(row, side)) {
      row.push(queue[k])
      k += 1
    }
    const depth = sum(row) / side
    let run = 0
    for (const r of row) {
      const len = r.area / depth
      const tile = box.w >= box.h ? { x: box.x, y: box.y + run, w: depth, h: len } : { x: box.x + run, y: box.y, w: len, h: depth }
      out.push({ ...tile, item: r.item, rank: r.rank })
      run += len
    }
    box = box.w >= box.h ? { x: box.x + depth, y: box.y, w: box.w - depth, h: box.h } : { x: box.x, y: box.y + depth, w: box.w, h: box.h - depth }
    i = k
  }
  return out
}

/** Where a readout card of `cw` × `ch` parks beside a tile inside a `bw` × `bh` box, all in px:
 *  above the tile, else below, else to its right, else to its left, else the far corner;
 *  always clamped inside the box, so the card never covers the tile it reads. */
export function parkBeside(
  t: { x: number; y: number; w: number; h: number },
  cw: number,
  ch: number,
  bw: number,
  bh: number,
  gap = 8,
): { left: number; top: number } {
  const cx = Math.max(0, Math.min(bw - cw, t.x + t.w / 2 - cw / 2))
  const cy = Math.max(0, Math.min(bh - ch, t.y + t.h / 2 - ch / 2))
  const above = t.y - gap - ch
  if (above >= 0) return { left: cx, top: above }
  const below = t.y + t.h + gap
  if (below + ch <= bh) return { left: cx, top: below }
  const right = t.x + t.w + gap
  if (right + cw <= bw) return { left: right, top: cy }
  const left = t.x - gap - cw
  if (left >= 0) return { left, top: cy }
  return { left: t.x < bw / 2 ? bw - cw : 0, top: t.y < bh / 2 ? bh - ch : 0 }
}
