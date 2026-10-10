<template>
  <!-- Chromium paints all the way to the HWND edge; therefore native
       WM_NCHITTEST does not receive the first pointer hit at these pixels.
       Explicit transparent handles bridge pointer-down to the OS resize loop. -->
  <div class="native-window-resize-handles" aria-hidden="true">
    <div v-for="handle in handles" :key="handle.direction"
      :class="['native-resize-handle', `native-resize-${handle.direction}`]"
      @pointerdown="startResize($event, handle.direction)"
      @contextmenu.prevent
    ></div>
  </div>
</template>

<script setup lang="ts">
import { invokeDesktop } from '@/api/runtime'

type ResizeEdge =
  | 'north' | 'south' | 'east' | 'west'
  | 'northeast' | 'northwest' | 'southeast' | 'southwest'

const handles: { direction: ResizeEdge }[] = [
  { direction: 'north' }, { direction: 'south' },
  { direction: 'east' }, { direction: 'west' },
  { direction: 'northeast' }, { direction: 'northwest' },
  { direction: 'southeast' }, { direction: 'southwest' },
]

function startResize(event: PointerEvent, direction: ResizeEdge): void {
  if (event.button !== 0 || !event.isPrimary) return
  event.preventDefault()
  event.stopPropagation()
  // The native side accepts only a fixed direction allowlist. This must be
  // triggered directly by the initial pointer press, not a resize observer.
  void invokeDesktop('start_main_window_resize', { direction }).catch(error => {
    console.warn('Unable to start native window resize', error)
  })
}
</script>

<style scoped>
.native-window-resize-handles {
  position: fixed;
  inset: 0;
  z-index: 4500;
  pointer-events: none;
}
.native-resize-handle {
  position: absolute;
  pointer-events: auto;
  user-select: none;
  touch-action: none;
  background: transparent;
}
.native-resize-east, .native-resize-west {
  top: 14px;
  bottom: 14px;
  width: 8px;
  cursor: ew-resize;
}
/* Leave the inner half of the 8px native scrollbar thumb accessible. */
.native-resize-east { right: 0; width: 4px; }
.native-resize-west { left: 0; }
.native-resize-north, .native-resize-south {
  left: 14px;
  right: 14px;
  height: 8px;
  cursor: ns-resize;
}
.native-resize-north { top: 0; }
.native-resize-south { bottom: 0; }
.native-resize-northeast, .native-resize-northwest,
.native-resize-southeast, .native-resize-southwest {
  width: 14px;
  height: 14px;
}
.native-resize-northeast, .native-resize-southwest { cursor: nesw-resize; }
.native-resize-northwest, .native-resize-southeast { cursor: nwse-resize; }
.native-resize-northeast, .native-resize-northwest { top: 0; }
.native-resize-southeast, .native-resize-southwest { bottom: 0; }
.native-resize-northeast, .native-resize-southeast { right: 0; }
.native-resize-northwest, .native-resize-southwest { left: 0; }
</style>
