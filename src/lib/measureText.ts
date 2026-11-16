// Width of a piece of text in px, for laying out legend and slider labels.
// Uses the same font as the page at the current text size, so labels still
// space out right when the phone's text size is larger (Week 7).

let canvas: HTMLCanvasElement | undefined

export function textMeasurer(
  sizeRem: number,
  weight = 500,
): (text: string, bold?: boolean) => number {
  canvas ??= document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize)
  const family = getComputedStyle(document.body).fontFamily
  const px = sizeRem * (Number.isFinite(root) ? root : 16)
  return (text, bold = false) => {
    if (!ctx) return text.length * px * 0.6
    ctx.font = `${bold ? 700 : weight} ${px}px ${family}`
    return ctx.measureText(text).width
  }
}
