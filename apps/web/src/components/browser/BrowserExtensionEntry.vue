<template>
  <section class="extension-card" aria-labelledby="browser-extension-title">
    <div class="extension-card__glow" aria-hidden="true"></div>

    <div class="extension-card__icon" aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none">
        <rect x="7" y="8" width="34" height="29" rx="10" />
        <path d="M13 16.5h22" />
        <circle cx="15.5" cy="13" r="1.25" />
        <circle cx="20" cy="13" r="1.25" />
        <path d="M18.5 28.5 24 23l5.5 5.5" />
        <path d="M24 23v13" />
      </svg>
    </div>

    <div class="extension-card__body">
      <div class="extension-card__meta">
        <span class="extension-card__kicker">BROWSER COMPANION</span>
        <span class="extension-card__version">v0.2.0</span>
      </div>

      <h3 id="browser-extension-title">把常用网站，一键收进 FlexiKit</h3>
      <p>在 Chrome 或 Edge 浏览网页时，点一下扩展即可读取当前页信息，确认后保存到你的工具箱。</p>

      <div class="extension-card__chips" aria-label="浏览器扩展特性">
        <span>Chrome</span>
        <span>Edge</span>
        <span>Manifest V3</span>
        <span>按需读取当前页</span>
      </div>
    </div>

    <div class="extension-card__actions">
      <span class="extension-card__status">
        <i aria-hidden="true"></i>
        本地开发版可用
      </span>
      <button class="extension-card__button" type="button" @click="openGuide">
        <span>安装扩展</span>
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="m7.5 4.75 5.25 5.25-5.25 5.25" />
        </svg>
      </button>
    </div>
  </section>

  <Teleport to="body">
    <Transition name="extension-guide">
      <div
        v-if="guideOpen"
        class="extension-guide"
        role="presentation"
        @pointerdown.self="closeGuide"
      >
        <section
          class="extension-guide__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="extension-guide-title"
          @pointerdown.stop
        >
          <header class="extension-guide__header">
            <div class="extension-guide__brand">
              <div class="extension-guide__brand-icon" aria-hidden="true">
                <svg viewBox="0 0 48 48" fill="none">
                  <rect x="7" y="8" width="34" height="29" rx="10" />
                  <path d="M13 16.5h22" />
                  <circle cx="15.5" cy="13" r="1.25" />
                  <circle cx="20" cy="13" r="1.25" />
                  <path d="M18.5 28.5 24 23l5.5 5.5" />
                  <path d="M24 23v13" />
                </svg>
              </div>
              <div>
                <span class="extension-guide__eyebrow">FLEXIKIT BROWSER COMPANION</span>
                <h2 id="extension-guide-title">安装浏览器扩展</h2>
                <p>当前为本地开发版，约 1 分钟即可完成。</p>
              </div>
            </div>

            <button class="extension-guide__close" type="button" aria-label="关闭安装引导" @click="closeGuide">
              <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="m5 5 10 10M15 5 5 15" />
              </svg>
            </button>
          </header>

          <div class="extension-guide__notice">
            <span class="extension-guide__notice-dot" aria-hidden="true"></span>
            <div>
              <strong>还没有上架浏览器商店</strong>
              <p>浏览器不允许网页静默安装未上架扩展，所以目前需要加载一次本地开发包。上架后这里会切换成商店一键安装。</p>
            </div>
          </div>

          <ol class="extension-guide__steps">
            <li>
              <span class="extension-guide__step-index">1</span>
              <div class="extension-guide__step-copy">
                <strong>打开扩展管理页</strong>
                <p>把对应地址粘贴到浏览器地址栏。</p>
                <div class="extension-guide__browser-actions">
                  <button type="button" @click="copyText('chrome://extensions', 'chrome')">
                    <span>Chrome</span>
                    <small>{{ copiedKey === 'chrome' ? '已复制' : '复制地址' }}</small>
                  </button>
                  <button type="button" @click="copyText('edge://extensions', 'edge')">
                    <span>Edge</span>
                    <small>{{ copiedKey === 'edge' ? '已复制' : '复制地址' }}</small>
                  </button>
                </div>
              </div>
            </li>

            <li>
              <span class="extension-guide__step-index">2</span>
              <div class="extension-guide__step-copy">
                <strong>开启“开发者模式”</strong>
                <p>在扩展管理页右上角开启开发者模式，然后选择“加载已解压的扩展”。</p>
              </div>
            </li>

            <li>
              <span class="extension-guide__step-index">3</span>
              <div class="extension-guide__step-copy">
                <strong>选择 Browser Companion 目录</strong>
                <p>选择项目内已经构建好的扩展目录：</p>
                <button class="extension-guide__path" type="button" @click="copyText(extensionPath, 'path')">
                  <code>{{ extensionPath }}</code>
                  <span>{{ copiedKey === 'path' ? '已复制' : '复制路径' }}</span>
                </button>
              </div>
            </li>
          </ol>

          <footer class="extension-guide__footer">
            <div>
              <strong>安装后怎么用？</strong>
              <p>固定 FlexiKit 图标 → 打开任意网站 → 点击图标 → 登录并确认保存。</p>
            </div>
            <button class="extension-guide__done" type="button" @click="closeGuide">知道了</button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const guideOpen = ref(false)
const copiedKey = ref('')
const extensionPath = 'apps/browser-extension/dist'
let copiedTimer: ReturnType<typeof setTimeout> | undefined

function openGuide() {
  guideOpen.value = true
}

function closeGuide() {
  guideOpen.value = false
}

async function copyText(value: string, key: string) {
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    const input = document.createElement('textarea')
    input.value = value
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    input.remove()
  }

  copiedKey.value = key
  if (copiedTimer) clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copiedKey.value = ''
  }, 1600)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && guideOpen.value) closeGuide()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  if (copiedTimer) clearTimeout(copiedTimer)
})
</script>

<style scoped>
.extension-card {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
  margin: 4px 2px 18px;
  padding: 18px 20px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--glass-border) 72%, white 28%);
  border-radius: 22px;
  background:
    linear-gradient(135deg, rgb(255 255 255 / 36%), transparent 48%),
    color-mix(in srgb, var(--glass-bg) 88%, transparent);
  box-shadow:
    0 14px 38px rgb(15 23 42 / 7%),
    inset 0 1px 0 rgb(255 255 255 / 42%);
  backdrop-filter: blur(24px) saturate(155%);
  -webkit-backdrop-filter: blur(24px) saturate(155%);
}

.extension-card__glow {
  position: absolute;
  z-index: -1;
  width: 280px;
  height: 170px;
  top: -100px;
  right: 60px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--primary) 18%, transparent);
  filter: blur(42px);
  opacity: .46;
  pointer-events: none;
}

.extension-card__icon,
.extension-guide__brand-icon {
  display: grid;
  place-items: center;
  color: var(--primary);
  background:
    linear-gradient(145deg, rgb(255 255 255 / 55%), rgb(255 255 255 / 10%)),
    color-mix(in srgb, var(--primary-light) 86%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary) 15%, white 34%);
  box-shadow:
    0 10px 24px color-mix(in srgb, var(--primary) 12%, transparent),
    inset 0 1px 0 rgb(255 255 255 / 66%);
}

.extension-card__icon {
  width: 52px;
  height: 52px;
  border-radius: 17px;
}

.extension-card__icon svg,
.extension-guide__brand-icon svg {
  width: 30px;
  height: 30px;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.extension-card__body {
  min-width: 0;
}

.extension-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}

.extension-card__kicker {
  color: var(--primary);
  font-size: .61rem;
  font-weight: 780;
  letter-spacing: .1em;
}

.extension-card__version {
  padding: 2px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 8%, transparent);
  color: color-mix(in srgb, var(--primary) 76%, var(--text-secondary));
  font-size: .58rem;
  font-weight: 700;
}

.extension-card h3 {
  margin: 0;
  color: var(--text-primary);
  font-size: clamp(1rem, 1.15vw, 1.18rem);
  letter-spacing: -.025em;
  line-height: 1.3;
}

.extension-card__body > p {
  max-width: 46rem;
  margin: 5px 0 0;
  color: var(--text-secondary);
  font-size: .76rem;
  line-height: 1.55;
}

.extension-card__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 11px;
}

.extension-card__chips span {
  padding: 4px 7px;
  border: 1px solid color-mix(in srgb, var(--divider) 80%, transparent);
  border-radius: 999px;
  background: rgb(255 255 255 / 26%);
  color: var(--text-secondary);
  font-size: .61rem;
  line-height: 1;
}

.extension-card__actions {
  display: grid;
  justify-items: end;
  gap: 9px;
}

.extension-card__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-secondary);
  font-size: .64rem;
  white-space: nowrap;
}

.extension-card__status i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #34c759;
  box-shadow: 0 0 0 4px rgb(52 199 89 / 10%);
}

.extension-card__button {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 38px;
  padding: 0 14px 0 16px;
  border: 1px solid color-mix(in srgb, var(--primary) 48%, transparent);
  border-radius: 13px;
  background:
    linear-gradient(180deg, rgb(255 255 255 / 16%), transparent),
    var(--primary);
  color: white;
  font-size: .76rem;
  font-weight: 700;
  letter-spacing: -.01em;
  box-shadow:
    0 8px 22px color-mix(in srgb, var(--primary) 22%, transparent),
    inset 0 1px 0 rgb(255 255 255 / 24%);
  cursor: pointer;
  transition:
    transform 300ms cubic-bezier(.25, .1, .25, 1),
    box-shadow 300ms cubic-bezier(.25, .1, .25, 1),
    filter 300ms cubic-bezier(.25, .1, .25, 1);
}

.extension-card__button svg {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 300ms cubic-bezier(.25, .1, .25, 1);
}

.extension-card__button:hover {
  transform: scale(1.02);
  filter: brightness(1.04);
  box-shadow:
    0 11px 28px color-mix(in srgb, var(--primary) 27%, transparent),
    inset 0 1px 0 rgb(255 255 255 / 28%);
}

.extension-card__button:hover svg {
  transform: translateX(2px);
}

.extension-card__button:active {
  transform: scale(.98);
}

.extension-guide {
  position: fixed;
  z-index: 3200;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 28px;
  background: rgb(10 15 25 / 28%);
  backdrop-filter: blur(18px) saturate(120%);
  -webkit-backdrop-filter: blur(18px) saturate(120%);
}

.extension-guide__panel {
  width: min(620px, calc(100vw - 32px));
  max-height: min(760px, calc(100vh - 48px));
  overflow: auto;
  padding: 22px;
  border: 1px solid rgb(255 255 255 / 56%);
  border-radius: 26px;
  background:
    linear-gradient(145deg, rgb(255 255 255 / 84%), rgb(250 251 253 / 72%));
  box-shadow:
    0 32px 90px rgb(15 23 42 / 22%),
    0 8px 28px rgb(15 23 42 / 8%),
    inset 0 1px 0 rgb(255 255 255 / 84%);
  backdrop-filter: blur(28px) saturate(160%);
  -webkit-backdrop-filter: blur(28px) saturate(160%);
}

.extension-guide__header,
.extension-guide__brand,
.extension-guide__footer {
  display: flex;
  align-items: center;
}

.extension-guide__header {
  justify-content: space-between;
  gap: 20px;
}

.extension-guide__brand {
  align-items: flex-start;
  gap: 13px;
}

.extension-guide__brand-icon {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  border-radius: 14px;
}

.extension-guide__brand-icon svg {
  width: 26px;
  height: 26px;
}

.extension-guide__eyebrow {
  display: block;
  margin: 1px 0 4px;
  color: var(--primary);
  font-size: .6rem;
  font-weight: 780;
  letter-spacing: .11em;
}

.extension-guide__header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.24rem;
  letter-spacing: -.035em;
}

.extension-guide__header p,
.extension-guide__notice p,
.extension-guide__step-copy p,
.extension-guide__footer p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: .72rem;
  line-height: 1.55;
}

.extension-guide__close {
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid rgb(15 23 42 / 5%);
  border-radius: 11px;
  background: rgb(15 23 42 / 4%);
  color: var(--text-secondary);
  cursor: pointer;
  transition:
    transform 300ms cubic-bezier(.25, .1, .25, 1),
    background 300ms cubic-bezier(.25, .1, .25, 1);
}

.extension-guide__close:hover {
  transform: scale(1.04);
  background: rgb(15 23 42 / 7%);
}

.extension-guide__close:active {
  transform: scale(.96);
}

.extension-guide__close svg {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
}

.extension-guide__notice {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-top: 20px;
  padding: 12px 13px;
  border: 1px solid color-mix(in srgb, var(--primary) 10%, rgb(15 23 42 / 5%));
  border-radius: 15px;
  background: color-mix(in srgb, var(--primary) 5%, white 72%);
}

.extension-guide__notice-dot {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  margin-top: 5px;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 10%, transparent);
}

.extension-guide__notice strong,
.extension-guide__step-copy strong,
.extension-guide__footer strong {
  color: var(--text-primary);
  font-size: .76rem;
}

.extension-guide__steps {
  display: grid;
  gap: 0;
  margin: 18px 0 0;
  padding: 0;
  list-style: none;
}

.extension-guide__steps li {
  position: relative;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr);
  gap: 12px;
  padding: 0 0 18px;
}

.extension-guide__steps li:not(:last-child)::before {
  content: "";
  position: absolute;
  top: 30px;
  left: 14px;
  width: 1px;
  height: calc(100% - 18px);
  background: linear-gradient(180deg, color-mix(in srgb, var(--primary) 24%, transparent), var(--divider));
}

.extension-guide__step-index {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--primary) 9%, white);
  color: var(--primary);
  font-size: .67rem;
  font-weight: 800;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary) 12%, transparent);
}

.extension-guide__step-copy {
  min-width: 0;
  padding-top: 4px;
}

.extension-guide__browser-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.extension-guide__browser-actions button,
.extension-guide__path,
.extension-guide__done {
  border: 0;
  cursor: pointer;
  transition:
    transform 300ms cubic-bezier(.25, .1, .25, 1),
    background 300ms cubic-bezier(.25, .1, .25, 1),
    box-shadow 300ms cubic-bezier(.25, .1, .25, 1);
}

.extension-guide__browser-actions button {
  display: grid;
  gap: 2px;
  min-width: 116px;
  padding: 9px 11px;
  text-align: left;
  border-radius: 12px;
  background: rgb(15 23 42 / 4%);
  color: var(--text-primary);
  box-shadow: inset 0 0 0 1px rgb(15 23 42 / 5%);
}

.extension-guide__browser-actions button:hover,
.extension-guide__path:hover {
  transform: scale(1.015);
  background: rgb(15 23 42 / 6%);
}

.extension-guide__browser-actions button:active,
.extension-guide__path:active,
.extension-guide__done:active {
  transform: scale(.985);
}

.extension-guide__browser-actions span {
  font-size: .72rem;
  font-weight: 700;
}

.extension-guide__browser-actions small {
  color: var(--text-secondary);
  font-size: .61rem;
}

.extension-guide__path {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 9px;
  padding: 10px 11px;
  border-radius: 12px;
  background: rgb(15 23 42 / 4%);
  box-shadow: inset 0 0 0 1px rgb(15 23 42 / 5%);
}

.extension-guide__path code {
  min-width: 0;
  overflow: hidden;
  color: var(--text-primary);
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: .67rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.extension-guide__path span {
  flex: 0 0 auto;
  color: var(--primary);
  font-size: .64rem;
  font-weight: 700;
}

.extension-guide__footer {
  justify-content: space-between;
  gap: 18px;
  padding-top: 16px;
  border-top: 1px solid var(--divider);
}

.extension-guide__done {
  flex: 0 0 auto;
  min-height: 36px;
  padding: 0 15px;
  border-radius: 12px;
  background: var(--primary);
  color: white;
  font-size: .72rem;
  font-weight: 700;
  box-shadow: 0 7px 18px color-mix(in srgb, var(--primary) 18%, transparent);
}

.extension-guide__done:hover {
  transform: scale(1.02);
  filter: brightness(1.04);
}

.extension-guide-enter-active,
.extension-guide-leave-active {
  transition: opacity 300ms cubic-bezier(.25, .1, .25, 1);
}

.extension-guide-enter-active .extension-guide__panel,
.extension-guide-leave-active .extension-guide__panel {
  transition:
    transform 300ms cubic-bezier(.25, .1, .25, 1),
    opacity 300ms cubic-bezier(.25, .1, .25, 1);
}

.extension-guide-enter-from,
.extension-guide-leave-to {
  opacity: 0;
}

.extension-guide-enter-from .extension-guide__panel {
  opacity: 0;
  transform: translateY(10px) scale(.985);
}

.extension-guide-leave-to .extension-guide__panel {
  opacity: 0;
  transform: translateY(6px) scale(.992);
}

:global([data-theme="dark"]) .extension-card {
  border-color: rgb(255 255 255 / 7%);
  background:
    linear-gradient(135deg, rgb(255 255 255 / 4.5%), transparent 48%),
    rgb(255 255 255 / 2.2%);
  box-shadow:
    0 14px 38px rgb(0 0 0 / 14%),
    inset 0 1px 0 rgb(255 255 255 / 6%);
}

:global([data-theme="dark"]) .extension-card__chips span {
  border-color: rgb(255 255 255 / 6%);
  background: rgb(255 255 255 / 3%);
}

:global([data-theme="dark"]) .extension-guide__panel {
  border-color: rgb(255 255 255 / 9%);
  background:
    linear-gradient(145deg, rgb(31 33 38 / 92%), rgb(21 23 28 / 88%));
  box-shadow:
    0 32px 90px rgb(0 0 0 / 52%),
    0 8px 28px rgb(0 0 0 / 24%),
    inset 0 1px 0 rgb(255 255 255 / 7%);
}

:global([data-theme="dark"]) .extension-guide__notice,
:global([data-theme="dark"]) .extension-guide__step-index,
:global([data-theme="dark"]) .extension-guide__browser-actions button,
:global([data-theme="dark"]) .extension-guide__path,
:global([data-theme="dark"]) .extension-guide__close {
  background: rgb(255 255 255 / 4%);
  border-color: rgb(255 255 255 / 6%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 4%);
}

@media (max-width: 760px) {
  .extension-card {
    grid-template-columns: auto minmax(0, 1fr);
    gap: 14px;
    padding: 16px;
  }

  .extension-card__actions {
    grid-column: 1 / -1;
    width: 100%;
    grid-template-columns: 1fr auto;
    align-items: center;
    justify-items: start;
  }

  .extension-guide {
    padding: 16px;
  }

  .extension-guide__panel {
    width: min(620px, calc(100vw - 16px));
    max-height: calc(100vh - 20px);
    padding: 18px;
    border-radius: 22px;
  }
}

@media (max-width: 520px) {
  .extension-card__icon {
    width: 46px;
    height: 46px;
    border-radius: 15px;
  }

  .extension-card__actions {
    grid-template-columns: 1fr;
  }

  .extension-card__button {
    width: 100%;
    justify-content: center;
  }

  .extension-guide__browser-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  .extension-guide__browser-actions button {
    min-width: 0;
  }

  .extension-guide__footer {
    align-items: flex-end;
    flex-direction: column;
  }

  .extension-guide__done {
    width: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .extension-card__button,
  .extension-card__button svg,
  .extension-guide__close,
  .extension-guide__browser-actions button,
  .extension-guide__path,
  .extension-guide__done,
  .extension-guide-enter-active,
  .extension-guide-leave-active,
  .extension-guide-enter-active .extension-guide__panel,
  .extension-guide-leave-active .extension-guide__panel {
    transition-duration: 1ms !important;
  }
}
</style>
