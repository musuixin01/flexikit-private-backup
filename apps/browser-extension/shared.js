export const DEFAULT_API_BASE_URL = 'http://127.0.0.1:3001/v1';

export const STORAGE_KEYS = Object.freeze({
  settings: 'flexikitSettings',
  auth: 'flexikitAuthSession',
  clientInstanceId: 'flexikitClientInstanceId'
});

const TRACKING_PARAMS = new Set([
  'fbclid', 'gclid', 'dclid', 'msclkid', 'mc_cid', 'mc_eid',
  'ref', 'ref_src', 'spm', 'yclid'
]);

const CATEGORY_HINTS = Object.freeze({
  '效率工具': ['效率', '办公', '生产力', '自动化', 'workflow', 'todo', '笔记', '时间管理'],
  '开发工具': ['开发', '编程', '代码', 'api', 'git', 'github', 'ide', '调试', 'docker', 'devops'],
  '设计工具': ['设计', 'ui', 'ux', 'figma', '原型', '图标', '素材', '3d', '动画'],
  '系统工具': ['系统', '优化', '清理', '监控', '硬件', '启动器', '卸载'],
  '网络工具': ['网络', '下载', '代理', 'vpn', 'dns', 'ftp', '抓包'],
  '安全工具': ['安全', '隐私', '密码', '加密', '防护', '广告拦截'],
  '影音娱乐': ['视频', '音频', '音乐', '播放器', '直播', '娱乐'],
  '图形图像': ['图片', '图像', '截图', '修图', '抠图', 'photoshop'],
  '文档办公': ['文档', 'pdf', 'markdown', '写作', '表格', 'excel', 'ppt'],
  '学习教育': ['学习', '教育', '课程', '阅读', '语言', '教程'],
  '生活实用': ['生活', '健康', '天气', '日历', '理财', '地图'],
  '通讯社交': ['通讯', '社交', '聊天', '邮件', '协作', '会议'],
  '数据科学': ['数据', '数据分析', '可视化', '机器学习', 'ai', '大模型'],
  '云服务': ['云服务', '云计算', '服务器', '云存储', 'cdn', 'vps'],
  '项目管理': ['项目管理', '团队协作', '任务管理', '敏捷', '看板'],
  '电商工具': ['电商', '开店', '运营', '营销', '淘宝', '拼多多', '京东'],
  '内容创作': ['内容创作', '自媒体', '短视频', '直播', '文案', '创作者'],
  '翻译工具': ['翻译', '词典', '语言', 'ocr', '文字识别'],
  '数据库工具': ['数据库', 'sql', 'redis', 'mongodb', 'postgresql', 'mysql'],
  '远程办公': ['远程办公', '远程桌面', '视频会议', '屏幕共享'],
  '文件管理': ['文件管理', '云存储', '同步', '备份', '压缩', '文件传输']
});

export function normalizeApiBaseUrl(value) {
  const candidate = String(value || DEFAULT_API_BASE_URL).trim();
  const url = new URL(candidate);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('API 地址仅支持 http 或 https');
  }
  url.hash = '';
  url.search = '';
  return url.toString().replace(/\/+$/, '');
}

export function apiOriginPattern(value) {
  const url = new URL(normalizeApiBaseUrl(value));
  return `${url.protocol}//${url.hostname}/*`;
}

export function isSupportedPageUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function canonicalizePageUrl(value) {
  const url = new URL(String(value || '').trim());
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('仅支持 http/https 网页');
  }

  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    const normalized = key.toLowerCase();
    if (normalized.startsWith('utm_') || TRACKING_PARAMS.has(normalized)) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();

  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  }

  return url.toString();
}

export function normalizeText(value, maxLength) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

export function normalizePageMetadata(value) {
  if (!value || typeof value !== 'object') throw new Error('网页信息无效');

  const url = canonicalizePageUrl(value.url);
  const parsed = new URL(url);
  const name = normalizeText(value.name || parsed.hostname, 100);
  const description = normalizeText(value.description, 500);
  const icon = isSupportedPageUrl(value.icon) ? String(value.icon) : `${parsed.origin}/favicon.ico`;

  return {
    name: name || parsed.hostname,
    url,
    icon,
    description,
    captureSource: 'browser-extension-v2'
  };
}

export function uniqueTags(values, limit = 8) {
  const result = [];
  const seen = new Set();

  for (const value of Array.isArray(values) ? values : []) {
    const tag = normalizeText(value, 32);
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length >= limit) break;
  }

  return result;
}

export function inferCategory(categories, tags, metadata = {}) {
  const available = Array.isArray(categories)
    ? categories.map(value => normalizeText(value, 50)).filter(Boolean)
    : [];
  if (!available.length) return '';

  const haystack = [
    normalizeText(metadata.name, 100),
    normalizeText(metadata.description, 500),
    normalizeText(metadata.url, 300),
    ...uniqueTags(tags, 12)
  ].join(' ').toLocaleLowerCase();

  let best = '';
  let bestScore = 0;

  for (const category of available) {
    const hints = CATEGORY_HINTS[category] || [category];
    let score = 0;

    for (const hint of hints) {
      const normalized = hint.toLocaleLowerCase();
      if (normalized && haystack.includes(normalized)) {
        score += normalized === category.toLocaleLowerCase() ? 3 : 1;
      }
    }

    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : '';
}

export function unwrapApiPayload(payload) {
  if (
    payload &&
    typeof payload === 'object' &&
    payload.code === 0 &&
    payload.message === 'success' &&
    Object.prototype.hasOwnProperty.call(payload, 'data')
  ) {
    return payload.data;
  }
  return payload;
}

export function isExpired(isoDate, leewayMs = 30_000) {
  if (!isoDate) return true;
  const expiresAt = Date.parse(isoDate);
  if (!Number.isFinite(expiresAt)) return true;
  return expiresAt <= Date.now() + leewayMs;
}
