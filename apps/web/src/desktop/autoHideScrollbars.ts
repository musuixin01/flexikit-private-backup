/** Auto-hide visual scrollbar thumbs without disabling native scrolling.
 * Desktop only: normal scroll, wheel, touch and keyboard input still work.
 * Existing scrollbar track widths stay fixed, avoiding layout shift.
 */
const VISIBLE_CLASS = 'scrollbar-visible'
const ROOT_CLASS = 'auto-hide-scrollbars'
const IDLE_MS = 1100
const EDGE_HOVER_PX = 16

export function initAutoHideScrollbars(): () => void {
  const root = document.documentElement
  root.classList.add(ROOT_CLASS)
  const timers = new Map<Element, ReturnType<typeof setTimeout>>()

  function reveal(element: Element): void {
    element.classList.add(VISIBLE_CLASS)
    const previous = timers.get(element)
    if (previous !== undefined) clearTimeout(previous)
    timers.set(element, setTimeout(() => {
      element.classList.remove(VISIBLE_CLASS)
      timers.delete(element)
    }, IDLE_MS))
  }

  function onScroll(event: Event): void {
    const target = event.target
    const element = target === document
      ? (document.scrollingElement ?? root)
      : target instanceof Element ? target : null
    if (element) reveal(element)
  }

  function onPointerMove(event: PointerEvent): void {
    if (event.pointerType === 'touch') return
    let element = event.target instanceof Element ? event.target : null
    while (element) {
      const rect = element.getBoundingClientRect()
      const nearRight = event.clientX >= rect.right - EDGE_HOVER_PX && event.clientX <= rect.right
      const nearBottom = event.clientY >= rect.bottom - EDGE_HOVER_PX && event.clientY <= rect.bottom
      if ((nearRight && element.scrollHeight > element.clientHeight + 1) ||
          (nearBottom && element.scrollWidth > element.clientWidth + 1)) {
        const style = getComputedStyle(element)
        const vertical = nearRight && /^(auto|scroll|overlay)$/.test(style.overflowY)
        const horizontal = nearBottom && /^(auto|scroll|overlay)$/.test(style.overflowX)
        if (vertical || horizontal) {
          reveal(element)
          return
        }
      }
      element = element.parentElement
    }
  }

  // Scroll events from nested containers do not bubble. Capture handles all
  // of them without attaching observers to every modal/sidebar/widget.
  document.addEventListener('scroll', onScroll, { capture: true, passive: true })
  document.addEventListener('pointermove', onPointerMove, { passive: true })

  return () => {
    document.removeEventListener('scroll', onScroll, true)
    document.removeEventListener('pointermove', onPointerMove)
    for (const [element, timer] of timers) {
      clearTimeout(timer)
      element.classList.remove(VISIBLE_CLASS)
    }
    timers.clear()
    root.classList.remove(ROOT_CLASS)
  }
}
