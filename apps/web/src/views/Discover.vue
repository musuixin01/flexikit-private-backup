<template>
  <div class="app-layout discover-page">
    <Navbar force-show-logo :show-favorites="false" />
    <main class="main-content full-width">

      <div class="discover-container">
        <!-- Header -->
        <div class="discover-header">
          <div>
            <span class="discover-eyebrow">EXPLORE · 精选工具库</span>
            <h1 class="discover-title">发现真正值得使用的工具</h1>
            <p class="discover-subtitle">从智能推荐、社区热度和最新收录中，快速找到下一件趁手工具。</p>
          </div>
          <div class="discover-header-actions">
            <span class="updated-time" aria-live="polite">{{ lastUpdatedText }}</span>
            <button class="refresh-btn" type="button" :disabled="loading" @click="refreshDiscover">
              <span :class="{ spinning: loading }">↻</span>
              {{ loading ? '刷新中' : '刷新内容' }}
            </button>
          </div>
        </div>

        <!-- 平台筛选 -->
        <ConnectivityNotice
          message="发现页暂时使用本地工具数据；工作台、本地工具与桌面功能不受影响。"
          @reconnected="refreshDiscover"
        />

        <div class="source-filter" role="tablist" aria-label="工具来源筛选">
          <button
            v-for="s in sourceList"
            :key="s.key"
            class="source-tab"
            :class="{ active: currentSource === s.key }"
            role="tab"
            :aria-selected="currentSource === s.key"
            @click="changeSource(s.key)"
          >
            {{ s.label }}
            <span class="source-count" v-if="s.count > 0">{{ s.count }}</span>
          </button>
        </div>

        <!-- Section 1: 智能推荐 -->
        <section id="recommendations" class="discover-section">
          <div class="section-header">
            <h2 class="section-title">
              <span class="section-icon">✨</span> 智能推荐
            </h2>
            <div class="section-actions">
              <button class="nav-btn" type="button" aria-label="向左浏览推荐工具" @click="scrollLeft">‹</button>
              <button class="nav-btn" type="button" aria-label="向右浏览推荐工具" @click="scrollRight">›</button>
            </div>
          </div>
          <div class="cards-scroll" ref="recommendScrollRef">
            <ToolCard
              v-for="tool in recommendList"
              :key="tool.id"
              :tool="tool"
              mode="discovery"
              :recommendation-reason="tool.recommendationReason"
              @click="handleToolClick(tool)"
              @add="handleAddTool"
            />
            <!-- 空状态 -->
            <div v-if="recommendList.length === 0" class="empty-state empty-inline">
              <span class="empty-icon">✨</span>
              <p class="empty-text">暂无推荐数据</p>
            </div>
          </div>
        </section>

        <!-- Section 2: 排行榜 -->
        <section id="rankings" class="discover-section">
          <div class="section-header">
            <h2 class="section-title">
              <span class="section-icon">🔥</span> 排行榜
            </h2>
            <div class="rank-tabs">
              <button
                v-for="p in rankPeriods"
                :key="p.key"
                class="rank-tab"
                :class="{ active: rankPeriod === p.key }"
                @click="rankPeriod = p.key; fetchRankings()"
              >
                {{ p.label }}
              </button>
            </div>
          </div>
          <p v-if="rankFallbackMode" class="rank-fallback-note">
            本地工具占位顺序，不代表热度排行
          </p>
          <div class="rank-list">
            <div
              v-for="(tool, index) in rankList"
              :key="tool.id"
              class="rank-item"
              @click="handleToolClick(tool)"
            >
              <div class="rank-number" :class="getRankClass(index)">
                {{ index + 1 }}
              </div>
              <div class="card-icon"><ToolIcon :tool="tool" /></div>
              <div class="rank-info">
                <div class="rank-name">{{ tool.name }}</div>
                <div class="rank-desc">{{ tool.description || tool.desc || '' }}</div>
              </div>
              <div v-if="!rankFallbackMode" class="rank-score">
                <span class="score-fire">🔥</span>
                <span class="score-value">{{ formatHeatScore(tool.hot_score) }}</span>
              </div>
            </div>
            <!-- 空状态 -->
            <div v-if="rankList.length === 0 && !loading" class="empty-state">
              <span class="empty-icon">📭</span>
              <p class="empty-text">暂无排行榜数据</p>
            </div>
          </div>
        </section>

        <!-- Section 3: 最新发现 -->
        <section id="latest" class="discover-section">
          <div class="section-header">
            <h2 class="section-title">
              <span class="section-icon">🆕</span> 最新发现
            </h2>
            <button class="view-all" type="button" @click="viewAllLatest">查看当前收录 →</button>
          </div>
          <div class="cards-grid">
            <ToolCard
              v-for="tool in latestList"
              :key="tool.id"
              :tool="tool"
              mode="discovery"
              :show-new="true"
              @click="handleToolClick(tool)"
              @add="handleAddTool"
            />
            <!-- 空状态 -->
            <div v-if="latestList.length === 0 && !loading" class="empty-state empty-grid">
              <span class="empty-icon">🆕</span>
              <p class="empty-text">暂无最新发现</p>
            </div>
          </div>
          <div class="load-more-wrap">
            <button
              v-if="latestHasMore"
              class="load-more-btn"
              @click="loadMoreLatest"
              :disabled="loading"
            >
              {{ loading ? '加载中...' : '加载更多' }}
            </button>
            <p v-else class="no-more-text">— 已经到底了 —</p>
          </div>
        </section>
      </div>
    </main>
  </div>
  <ToastMessage />
  <ToolModal
    ref="toolModalRef"
    @saved="onToolSaved"
    @local-import-request="openLocalToolImport"
  />
  <LocalToolImportModal ref="localToolImportRef" />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import Navbar from '@/components/layout/Navbar.vue';
import ToolCard from '@/components/tools/ToolCard.vue';
import ToolIcon from '@/components/tools/ToolIcon.vue';
import ToolModal from '@/components/tools/ToolModal.vue';
import LocalToolImportModal from '@/components/tools/LocalToolImportModal.vue';
import ToastMessage from '@/components/common/ToastMessage.vue';
import ConnectivityNotice from '@/components/common/ConnectivityNotice.vue';
import { discoveryApi, recommendationsApi, statsApi } from '@/api';
import type { DiscoveryTool } from '@/api/discovery';
import type { RecommendationExplanation } from '@/api/recommendations';
import { backendToFrontend } from '@/api/toolMapper';
import type { Tool } from '@/types/tool';
import { useUiStore } from '@/stores/ui';
import { useToolsStore } from '@/stores/tools';
import { useUserStore } from '@/stores/user';
import { readRecommendationBehaviorEvents } from '@/recommendations/behaviorEvents';
import { rankToolsByTagMatch } from '@/recommendations/tagMatcher';
import { connectivityMode } from '@/network/connectivity';

const ui = useUiStore();
const toolsStore = useToolsStore();
const user = useUserStore();

const toolModalRef = ref<InstanceType<typeof ToolModal> | null>(null);
const localToolImportRef = ref<InstanceType<typeof LocalToolImportModal> | null>(null);

interface DiscoveryCardTool extends Tool {
  source?: string;
  sourceUrl?: string;
  hotScore?: number;
  hot_score?: string | number;
  upvotes?: number;
  comments?: number;
  recommendationReason?: string;
}

// 将发现工具转换为前端 Tool 格式
function discoveryToTool(dt: DiscoveryTool): DiscoveryCardTool {
  return {
    id: dt.id,
    name: dt.name,
    url: dt.url,
    desc: dt.description,
    description: dt.description,
    cat: dt.category,
    category: dt.category,
    tags: dt.tags || [],
    icon: dt.icon || '',
    isCustom: false,
    is_custom: false,
    localPath: '',
    local_path: '',
    // 额外字段
    source: dt.source,
    sourceUrl: dt.source_url,
    hotScore: dt.hot_score,
    upvotes: dt.upvotes,
    comments: dt.comments,
  };
}

const recommendScrollRef = ref<HTMLElement | null>(null);

const rankPeriod = ref<string>('week');
const rankPeriods = [
  { key: 'today', label: '今日' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
];

const loading = ref(false);
const recommendList = ref<DiscoveryCardTool[]>([]);
const rankList = ref<DiscoveryCardTool[]>([]);
const rankFallbackMode = ref(false);
const latestList = ref<DiscoveryCardTool[]>([]);
const lastUpdatedText = ref('等待刷新');
const latestOffset = ref(0);
const latestHasMore = ref(true);
const PAGE_SIZE = 6;
const RECOMMENDATION_CANDIDATE_POOL_SIZE = 18;

function formatServerRecommendationReason(
  explanation: Readonly<RecommendationExplanation>,
): string {
  if (explanation.kind === 'similar_favorite') {
    const seedToolName = explanation.seedToolName?.trim();
    return seedToolName
      ? '与你收藏的「' + seedToolName + '」相似'
      : '与你的收藏偏好相似';
  }
  return '基于公开热度补充推荐';
}

function formatLocalRecommendationReason(
  matchedTag?: string,
  matchedCategory?: string,
): string | undefined {
  if (matchedTag) return '本机偏好匹配：#' + matchedTag;
  if (matchedCategory) return '本机偏好匹配：' + matchedCategory;
  return undefined;
}

function personalizeRecommendationCandidates<T extends DiscoveryCardTool>(
  candidates: readonly T[],
): T[] {
  const events = readRecommendationBehaviorEvents();
  return rankToolsByTagMatch(candidates, toolsStore.allTools, events)
    .map(item => {
      const localReason = formatLocalRecommendationReason(
        item.matchedTag,
        item.matchedCategory,
      );
      if (!localReason) return item.tool;
      return {
        ...item.tool,
        recommendationReason: item.tool.recommendationReason
          ? localReason + ' · ' + item.tool.recommendationReason
          : localReason,
      };
    });
}

// 平台筛选
const currentSource = ref<string>('all');
const sourceList = ref<{ key: string; label: string; count: number }[]>([
  { key: 'all', label: '全部', count: 0 },
]);

// 平台名称映射
const sourceLabelMap: Record<string, string> = {
  all: '全部',
  producthunt: 'Product Hunt',
  appinn: '小众软件',
  v2ex: 'V2EX',
  juejin: '掘金',
  iplaysoft: '异次元软件',
};

// 获取平台列表
async function fetchSources() {
  try {
    const res = await discoveryApi.getSources();
    const data = res.data;
    const sources = Array.isArray(data) ? data : [];
    
    const list = [{ key: 'all', label: '全部', count: 0 }];
    let total = 0;
    
    for (const s of sources) {
      const key = s.source;
      const label = sourceLabelMap[key] || key;
      list.push({ key, label, count: s.count || 0 });
      total += s.count || 0;
    }
    
    list[0].count = total;
    sourceList.value = list;
  } catch (e) {
    console.warn('获取平台列表失败', e);
  }
}

// 切换平台
function changeSource(source: string) {
  if (currentSource.value === source) return;
  currentSource.value = source;
  void refreshDiscover();
}

// 获取推荐
async function fetchRecommend() {
  try {
    if (currentSource.value === 'all' && user.isLoggedIn) {
      const res = await recommendationsApi.getExplainedRecommendations(
        RECOMMENDATION_CANDIDATE_POOL_SIZE,
      );
      const candidates = res.data.map(item => ({
        ...(backendToFrontend(item.tool) as DiscoveryCardTool),
        recommendationReason: formatServerRecommendationReason(item.explanation),
      }));
      recommendList.value = personalizeRecommendationCandidates(candidates).slice(0, PAGE_SIZE);
      return;
    }

    const source = currentSource.value === 'all' ? undefined : currentSource.value;
    const res = await discoveryApi.getRecommendations(RECOMMENDATION_CANDIDATE_POOL_SIZE, source);
    const data = res.data;
    const items = Array.isArray(data) ? data : (data.items || []);
    const candidates = items.map((item: DiscoveryTool) => discoveryToTool(item));
    recommendList.value = personalizeRecommendationCandidates(candidates).slice(0, PAGE_SIZE);
  } catch (e) {
    // 后端不可用时，用相同的本地标签匹配规则处理已加载工具。
    console.warn('推荐接口不可用，使用本地数据');
    const allTools = toolsStore.allTools;
    if (allTools.length > 0) {
      recommendList.value = personalizeRecommendationCandidates(allTools).slice(0, PAGE_SIZE);
    }
  }
}

// 获取排行榜
async function fetchRankings() {
  loading.value = true;
  try {
    const source = currentSource.value === 'all' ? undefined : currentSource.value;
    const res = await discoveryApi.getRankings(rankPeriod.value, 10, source);
    const data = res.data;
    const items = Array.isArray(data) ? data : (data.items || []);
    rankList.value = items.map((item: DiscoveryTool) => {
      const tool = discoveryToTool(item);
      return { ...tool, hot_score: item.hot_score };
    });
    rankFallbackMode.value = false;
  } catch (e) {
    console.warn('排行接口不可用，使用本地占位顺序');
    rankFallbackMode.value = true;
    rankList.value = [...toolsStore.allTools]
      .sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'))
      .slice(0, 10)
      .map(tool => ({ ...tool, hot_score: undefined }));
  } finally {
    loading.value = false;
  }
}
// 获取最新
async function fetchLatest(reset = true) {
  if (reset) {
    latestOffset.value = 0;
    latestHasMore.value = true;
  }
  if (!latestHasMore.value) return;
  loading.value = true;
  try {
    const source = currentSource.value === 'all' ? undefined : currentSource.value;
    const res = await discoveryApi.getLatest(PAGE_SIZE, latestOffset.value, source);
    const data = res.data;
    // 兼容两种格式：数组 或 { items, total }
    const items = Array.isArray(data) ? data : (data.items || []);
    const total = Array.isArray(data) ? null : (data.total ?? null);
    
    const tools = items.map((item: DiscoveryTool) => discoveryToTool(item));
    
    if (reset) {
      latestList.value = tools;
    } else {
      latestList.value = [...latestList.value, ...tools];
    }
    latestOffset.value += items.length;
    if (items.length < PAGE_SIZE || (total !== null && latestOffset.value >= total)) {
      latestHasMore.value = false;
    }
  } catch (e) {
    // 后端不可用时，从本地工具中获取
    console.warn('最新工具接口不可用，使用本地数据');
    const allTools = toolsStore.allTools;
    if (reset) {
      latestList.value = allTools.slice(0, PAGE_SIZE);
      latestOffset.value = PAGE_SIZE;
      latestHasMore.value = allTools.length > PAGE_SIZE;
    } else {
      const next = allTools.slice(latestOffset.value, latestOffset.value + PAGE_SIZE);
      latestList.value = [...latestList.value, ...next];
      latestOffset.value += next.length;
      latestHasMore.value = latestOffset.value < allTools.length;
    }
  } finally {
    loading.value = false;
  }
}

function loadMoreLatest() {
  fetchLatest(false);
}

function viewAllLatest() {
  document.getElementById('latest')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  ui.showToast(`当前已展示 ${latestList.value.length} 个最新工具`);
}

function formatHeatScore(value: string | number | undefined): string {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed.toFixed(1) : '—';
}
// 排行名次样式
function getRankClass(index: number) {
  if (index === 0) return 'rank-gold';
  if (index === 1) return 'rank-silver';
  if (index === 2) return 'rank-bronze';
  return '';
}

// 滚动控制
function scrollLeft() {
  const el = recommendScrollRef.value;
  if (el) el.scrollBy({ left: -300, behavior: 'smooth' });
}
function scrollRight() {
  const el = recommendScrollRef.value;
  if (el) el.scrollBy({ left: 300, behavior: 'smooth' });
}

// 工具点击记录
function handleToolClick(tool: DiscoveryCardTool) {
  if (tool.id !== undefined) statsApi.recordClick(tool.id).catch(() => {});
  if (tool.url && tool.url !== '#') {
    window.open(tool.url, '_blank');
  } else {
    ui.showToast('该工具暂无有效链接');
  }
}

// 快捷添加工具到我的工具箱
async function handleAddTool(tool: DiscoveryCardTool) {
  if (!user.isLoggedIn) {
    ui.showToast('请先登录后再添加工具');
    return;
  }

  const exists = toolsStore.allTools.some(item => item.url === tool.url || item.name === tool.name)
  if (exists) {
    ui.showToast('该工具已经在我的工具箱中')
    return
  }

  await toolsStore.addCustomTool(tool)
  ui.showToast(`已添加 ${tool.name}`)
}

function openLocalToolImport(): void {
  localToolImportRef.value?.open();
}

// 工具保存成功回调
function onToolSaved() {
  // 工具保存成功后的处理，比如刷新数据等
  // 这里暂时不需要额外处理，因为 tools store 会自动更新
}

// 初始化加载
async function refreshDiscover(): Promise<void> {
  await Promise.all([fetchRecommend(), fetchRankings(), fetchLatest(true)]);
  lastUpdatedText.value = connectivityMode.value === 'online'
    ? `更新于 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`
    : '本地模式';
}

onMounted(async () => {
  // 确保工具数据已加载（fallback 时需要）
  if (!toolsStore.isLoaded) {
    try {
      await toolsStore.initData();
    } catch {}
  }
  await fetchSources();
  await refreshDiscover();
});
</script>

<style scoped>
/* ===== 页面容器 ===== */
.discover-page {
  display: block;
  padding: 20px;
}
.main-content.full-width {
  max-width: 1200px;
  margin: 0 auto;
}
.discover-container {
  display: flex;
  flex-direction: column;
  gap: 40px;
  margin-top: 20px;
}

/* ===== Header ===== */
.discover-header {
  margin-bottom: 8px;
}
.discover-title {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 4px;
}
.discover-subtitle {
  font-size: 1rem;
  color: var(--text-secondary);
  margin: 0;
}

/* ===== 平台筛选 ===== */
.source-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}
.source-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border-radius: 24px;
  border: 1px solid var(--glass-border);
  background: var(--btn-bg);
  font-size: 0.9rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}
.source-tab:hover {
  color: var(--text-primary);
  border-color: var(--accent);
}
.source-tab.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.source-count {
  font-size: 0.75rem;
  opacity: 0.8;
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 8px;
  border-radius: 12px;
}
.source-tab:not(.active) .source-count {
  background: var(--glass-bg);
  color: var(--text-secondary);
}

/* ===== Section ===== */
.discover-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.section-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}
.section-icon {
  font-size: 1.4rem;
}
.section-actions {
  display: flex;
  gap: 8px;
}
.nav-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  color: var(--text-secondary);
  font-size: 1.2rem;
  cursor: pointer;
  transition: all 0.2s;
}
.nav-btn:hover {
  background: var(--accent-soft);
  color: var(--accent);
}

/* ===== 推荐横向滚动 ===== */
.cards-scroll {
  display: flex;
  gap: 16px;
  overflow-x: auto;
  padding: 4px 0 12px;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
  min-width: 0;
}
.cards-scroll::-webkit-scrollbar {
  height: 8px;
}
.cards-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.cards-scroll::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--text-primary) 14%, transparent);
  border: 2px solid transparent;
  background-clip: padding-box;
  border-radius: 999px;
}
.cards-scroll::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--text-primary) 28%, transparent);
  border: 2px solid transparent;
  background-clip: padding-box;
}
.cards-scroll .tool-card {
  flex: 0 0 280px;
  min-width: 0;
  max-width: 280px;
}

/* ===== 排行榜 ===== */
.rank-tabs {
  display: flex;
  gap: 4px;
  background: var(--btn-bg);
  padding: 4px;
  border-radius: 24px;
}
.rank-tab {
  padding: 4px 16px;
  border-radius: 20px;
  border: none;
  background: transparent;
  font-size: 0.85rem;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s;
}
.rank-tab.active {
  background: var(--accent);
  color: #fff;
}
.rank-tab:hover:not(.active) {
  background: var(--btn-bg-hover);
}

.rank-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.rank-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  transition: transform 0.2s, box-shadow 0.2s;
}
.rank-item:hover {
  transform: translateY(-2px);
  box-shadow: var(--card-hover-shadow);
}
.rank-number {
  width: 28px;
  text-align: center;
  font-weight: 700;
  font-size: 1rem;
  color: var(--text-secondary);
  flex-shrink: 0;
}
.rank-gold {
  color: #ffd700;
}
.rank-silver {
  color: #c0c0c0;
}
.rank-bronze {
  color: #cd7f32;
}
/* 复用 ToolCard 的 .card-icon 样式，无需额外定义 */
.rank-info {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}
.rank-name {
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rank-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rank-fallback-note {
  margin: -4px 0 10px;
  color: var(--text-tertiary);
  font-size: .7rem;
  line-height: 1.5;
}
.rank-score {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--danger-soft);
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid var(--danger-soft);
  flex-shrink: 0;
}
.score-fire {
  font-size: 0.9rem;
}
.score-value {
  font-weight: 600;
  color: var(--danger);
}

/* ===== 最新工具网格 ===== */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 20px;
}
.view-all {
  font-size: 0.9rem;
  color: var(--accent);
  cursor: pointer;
  text-decoration: none;
}
.view-all:hover {
  text-decoration: underline;
}
.load-more-btn {
  display: block;
  margin: 12px auto 0;
  padding: 8px 32px;
  border: 1px solid var(--divider);
  border-radius: 20px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
}
.load-more-btn:hover {
  background: var(--btn-bg-hover);
}
.load-more-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ===== 空状态 ===== */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-secondary);
}
.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 12px;
  opacity: 0.6;
}
.empty-text {
  margin: 0;
  font-size: 0.9rem;
}
.empty-inline {
  min-width: 200px;
  padding: 30px 20px;
}
.empty-grid {
  grid-column: 1 / -1;
  padding: 60px 20px;
}

/* ===== 加载更多 ===== */
.load-more-wrap {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
.no-more-text {
  color: var(--text-tertiary);
  font-size: 0.85rem;
  margin: 8px 0;
}

/* ===== 排行榜交互 ===== */
.rank-item {
  cursor: pointer;
  transition: all 0.2s ease;
}
.rank-item:hover {
  background: var(--btn-bg);
  transform: translateX(4px);
}

/* ===== 过渡动画 ===== */
.cards-scroll,
.rank-list,
.cards-grid {
  transition: opacity 0.3s ease;
}

/* ===== 响应式 ===== */
@media (max-width: 700px) {
  .cards-scroll .tool-card {
    flex: 0 0 220px;
    max-width: 220px;
  }
  .rank-item {
    flex-wrap: wrap;
    gap: 8px;
  }
  .rank-info {
    width: 100%;
    order: 3;
  }
  .rank-score {
    margin-left: auto;
  }
  .cards-grid {
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 480px) {
  .cards-grid {
    grid-template-columns: 1fr;
  }
}
/* ===== 发现页信息密度与交互优化 ===== */
.discover-page { padding: clamp(16px, 2vw, 28px) clamp(16px, 2.8vw, 44px) 64px; }
.main-content.full-width { max-width: 1580px !important; padding: 0 !important; }
.discover-container { gap: clamp(22px, 2.2vw, 34px); margin-top: 18px; }
.discover-header { display: flex; align-items: end; justify-content: space-between; gap: 32px; margin: 4px 0 0; padding: clamp(26px, 2.6vw, 38px); border: 1px solid var(--glass-border); border-radius: 26px; background: color-mix(in srgb, var(--glass-bg) 84%, transparent); backdrop-filter: blur(28px) saturate(150%); box-shadow: 0 18px 56px rgba(15,23,42,.055), inset 0 1px 0 rgba(255,255,255,.32); }
.discover-eyebrow { display: block; margin-bottom: 8px; color: var(--primary); font-size: .72rem; font-weight: 750; letter-spacing: .12em; }
.discover-title { font-size: clamp(1.75rem, 3vw, 2.45rem); letter-spacing: -.035em; }
.discover-subtitle { max-width: 700px; margin-top: 8px; line-height: 1.7; }
.discover-header-actions { display: flex; align-items: center; gap: 12px; flex: 0 0 auto; }
.updated-time { color: var(--text-tertiary); font-size: .76rem; }
.refresh-btn { min-height: 40px; padding: 9px 14px; display: inline-flex; align-items: center; gap: 7px; border: 1px solid var(--divider); border-radius: 12px; background: var(--btn-bg); color: var(--text-primary); font: inherit; font-size: .82rem; font-weight: 650; cursor: pointer; transition: all .3s cubic-bezier(.25,.1,.25,1); }
.refresh-btn:hover:not(:disabled) { color: var(--primary); border-color: color-mix(in srgb, var(--primary) 30%, transparent); background: var(--primary-light); transform: translateY(-1px); }
.refresh-btn:active:not(:disabled) { transform: scale(.98); }
.refresh-btn:disabled { opacity: .62; cursor: wait; }
.spinning { display: inline-block; animation: refreshSpin .8s cubic-bezier(.25,.1,.25,1) infinite; }
@keyframes refreshSpin { to { transform: rotate(360deg); } }
.source-filter { position: sticky; top: 76px; z-index: 45; width: fit-content; max-width: 100%; flex-wrap: nowrap; overflow-x: auto; margin: -10px 0 -6px; padding: 6px; border: 1px solid var(--glass-border); border-radius: 16px; background: color-mix(in srgb, var(--glass-bg) 90%, transparent); backdrop-filter: blur(24px) saturate(160%); box-shadow: 0 12px 34px rgba(15,23,42,.05); }
.source-filter { scrollbar-width: none; }
.source-filter::-webkit-scrollbar { display: none; }
.source-tab { flex: 0 0 auto; border-color: transparent; transition: all .3s cubic-bezier(.25,.1,.25,1); }
.source-tab:active { transform: scale(.98); }
.discover-section { scroll-margin-top: 152px; gap: clamp(18px, 1.7vw, 24px); padding: clamp(22px, 2.2vw, 32px); border: 1px solid color-mix(in srgb, var(--glass-border) 78%, transparent); border-radius: 26px; background: color-mix(in srgb, var(--glass-bg) 68%, transparent); box-shadow: 0 14px 44px rgba(15,23,42,.04), inset 0 1px 0 rgba(255,255,255,.22); transition: border-color .3s cubic-bezier(.25,.1,.25,1), box-shadow .3s cubic-bezier(.25,.1,.25,1); }
.discover-section:hover { border-color: color-mix(in srgb, var(--primary) 16%, var(--glass-border)); box-shadow: 0 20px 54px rgba(15,23,42,.055), inset 0 1px 0 rgba(255,255,255,.26); }
.section-title { margin: 0; }
.cards-scroll { scroll-snap-type: x proximity; padding: 4px 2px 14px; }
.cards-scroll .tool-card { scroll-snap-align: start; flex-basis: 300px; }
.nav-btn,
.rank-tab,
.view-all,
.load-more-btn { transition: all .3s cubic-bezier(.25,.1,.25,1); }
.nav-btn:active,
.rank-tab:active,
.view-all:active,
.load-more-btn:active { transform: scale(.98); }
.view-all { border: 0; background: transparent; font: inherit; }
.rank-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.rank-item { min-width: 0; border-radius: 16px; transition: background .3s cubic-bezier(.25,.1,.25,1), transform .3s cubic-bezier(.25,.1,.25,1), border-color .3s cubic-bezier(.25,.1,.25,1); }
.rank-item:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--primary) 18%, var(--glass-border)); }
@media (max-width: 760px) {
  .discover-page { padding: 12px 12px 40px; }
  .discover-header { align-items: flex-start; flex-direction: column; padding: 20px; }
  .discover-header-actions { width: 100%; justify-content: space-between; }
  .source-filter { top: 86px; width: 100%; }
  .discover-section { padding: 18px 14px; border-radius: 20px; }
  .rank-list { grid-template-columns: 1fr; }
}
</style>
