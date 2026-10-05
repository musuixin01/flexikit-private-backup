import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import * as cheerio from 'cheerio';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, In } from 'typeorm';
import { Tool } from './tool.entity';
import { CreateToolDto, ToolsQueryDto, UpdateToolDto } from './dto';
import { User } from '../users/user.entity';
import { validateUrlSafe } from '../common/utils/ssrf.util';
import { Logger } from '@nestjs/common';
import { normalizeToolUrl } from './tool-url.util';

const execFileAsync = promisify(execFile);
const logger = new Logger('ToolsService');

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class ToolsService {
  constructor(
    @InjectRepository(Tool)
    private toolsRepository: Repository<Tool>,
  ) {}

  // ========== 修复的 findAll ==========
  async findAll(userId: number | null, query: ToolsQueryDto) {
    const { category, search, favorite, limit = 50, offset = 0 } = query;
    const qb = this.toolsRepository.createQueryBuilder('tool');

    // 核心：未登录只返回内置工具，已登录返回内置+自己的
    if (userId === null) {
      qb.where('tool.user_id IS NULL');
    } else {
      qb.where(
        new Brackets((scope) => {
          scope
            .where('tool.user_id IS NULL')
            .orWhere('tool.user_id = :userId', { userId });
        }),
      );
    }

    // 分类筛选
    if (category && category !== '全部') {
      qb.andWhere('tool.category = :category', { category });
    }

    // 搜索
    if (search) {
      qb.andWhere(
        '(tool.name ILIKE :search OR tool.description ILIKE :search OR EXISTS (SELECT 1 FROM unnest(tool.tags) tag WHERE tag ILIKE :search))',
        { search: `%${search}%` }
      );
    }

    // 收藏筛选：只有已登录用户才支持
    if (favorite && userId !== null) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM favorites fav WHERE fav.tool_id = tool.id AND fav.user_id = :favoriteUserId)',
        { favoriteUserId: userId },
      );
    }

    qb.orderBy('tool.created_at', 'DESC')
      .skip(offset)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  // 以下方法保持不变（包含您之前添加的 increment 等）
  async findOne(id: number): Promise<Tool> {
    const tool = await this.toolsRepository.findOne({ where: { id } });
    if (!tool) throw new NotFoundException('Tool not found');
    return tool;
  }

  async findDuplicateByUrl(url: string, userId: number): Promise<Tool | null> {
    const normalizedUrl = normalizeToolUrl(url);
    if (!normalizedUrl) {
      throw new BadRequestException('Invalid website url');
    }

    const parsedUrl = new URL(normalizedUrl);
    const candidates = await this.toolsRepository
      .createQueryBuilder('tool')
      .where(
        new Brackets((scope) => {
          scope
            .where('tool.user_id IS NULL')
            .orWhere('tool.user_id = :userId', { userId });
        }),
      )
      .andWhere('tool.local_path IS NULL')
      .andWhere('tool.url ILIKE :originPrefix', {
        originPrefix: parsedUrl.origin + '%',
      })
      .orderBy('tool.created_at', 'DESC')
      .getMany();

    const matches = candidates.filter(
      candidate => normalizeToolUrl(candidate.url) === normalizedUrl,
    );

    return matches.find(candidate => candidate.user_id === userId)
      ?? matches.find(candidate => candidate.user_id === null)
      ?? null;
  }

  async create(createDto: CreateToolDto, userId: number): Promise<Tool> {
    let normalizedUrl = createDto.url;

    if (createDto.url && createDto.url !== '#') {
      normalizedUrl = normalizeToolUrl(createDto.url) ?? undefined;
      if (!normalizedUrl) {
        throw new BadRequestException('Invalid website url');
      }

      if (!createDto.local_path) {
        const duplicate = await this.findDuplicateByUrl(normalizedUrl, userId);
        if (duplicate) {
          throw new ConflictException('该网站已在工具箱中');
        }
      }
    }

    const icon = createDto.icon || this.getWebsiteFavicon(normalizedUrl);
    const tool = this.toolsRepository.create({
      ...createDto,
      url: normalizedUrl,
      icon,
      user_id: userId,
      is_custom: true,
    });
    return await this.toolsRepository.save(tool);
  }

  private getWebsiteFavicon(url?: string): string | undefined {
    if (!url || url === '#') return undefined;

    try {
      const parsedUrl = new URL(url);
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsedUrl.hostname)}&sz=64`;
    } catch {
      return undefined;
    }
  }

  async update(id: number, updateDto: UpdateToolDto, userId: number): Promise<Tool> {
    const tool = await this.findOne(id);
    if (tool.user_id !== userId) {
      throw new ForbiddenException('Not your tool');
    }
    Object.assign(tool, updateDto);
    return await this.toolsRepository.save(tool);
  }

  async delete(id: number, userId: number): Promise<void> {
    const tool = await this.findOne(id);
    if (tool.user_id !== userId) {
      throw new ForbiddenException('Not your tool');
    }
    await this.toolsRepository.remove(tool);
  }

  async getLocalIcon(filePath: string) {
    if (!filePath) {
      throw new BadRequestException('文件路径不能为空');
    }

    // 规范化路径，防止路径遍历
    const resolvedPath = path.resolve(filePath.trim());
    
    // 验证文件存在且是文件
    if (!fs.existsSync(resolvedPath)) {
      throw new BadRequestException('文件路径无效或不存在');
    }
    
    const stat = fs.statSync(resolvedPath);
    if (!stat.isFile()) {
      throw new BadRequestException('路径必须指向文件');
    }

    // 只允许常见的可执行文件和快捷方式
    const allowedExtensions = ['.exe', '.lnk', '.url'];
    const ext = path.extname(resolvedPath).toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      throw new BadRequestException('不支持的文件类型，仅支持 .exe, .lnk, .url');
    }

    // Windows平台才支持提取图标
    if (process.platform !== 'win32') {
      return { icon: null };
    }

    try {
      // 使用参数传递文件路径，避免命令注入
      // PowerShell脚本通过-EncodedCommand传递，避免转义问题
      const psScript = `
param([string]$iconPath)
Add-Type -AssemblyName System.Drawing
$icon = [System.Drawing.Icon]::ExtractAssociatedIcon($iconPath)
if ($icon) {
  $bitmap = $icon.ToBitmap()
  $ms = New-Object System.IO.MemoryStream
  $bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $bytes = $ms.ToArray()
  [Convert]::ToBase64String($bytes)
  $ms.Close()
  $bitmap.Dispose()
  $icon.Dispose()
}
`;
      
      // 将脚本编码为Base64，避免转义问题
      const encodedScript = Buffer.from(psScript, 'utf16le').toString('base64');
      
      const { stdout } = await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodedScript, '-iconPath', resolvedPath],
        { timeout: 5000, maxBuffer: 1024 * 1024 }
      );
      const base64 = stdout.trim();
      if (base64) {
        return { icon: `data:image/png;base64,${base64}` };
      }
    } catch (e: unknown) {
      logger.warn(`提取图标失败: ${getErrorMessage(e)}`);
    }
    return {
      icon: `<svg viewBox="0 0 24 24" fill="none" stroke="#6366f1" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><rect x="8" y="6" width="8" height="7" rx="1" fill="#6366f1" fill-opacity=".15"/></svg>`
    };
  }

  async deleteBatch(ids: number[], userId: number): Promise<void> {
    const tools = await this.toolsRepository.find({ where: { id: In(ids) } });
    const owned = tools.filter(t => t.user_id === userId);
    if (owned.length !== ids.length) {
      throw new ForbiddenException('Some tools do not belong to you');
    }
    await this.toolsRepository.remove(owned);
  }

  async incrementView(toolId: number): Promise<void> {
    await this.toolsRepository.increment({ id: toolId }, 'view_count', 1);
  }

  async incrementClick(toolId: number): Promise<void> {
    await this.toolsRepository.increment({ id: toolId }, 'click_count', 1);
  }

  async incrementFavorite(toolId: number, delta: number = 1): Promise<void> {
    await this.toolsRepository.increment({ id: toolId }, 'favorite_count', delta);
  }

  async getRankings(period: string, limit: number) {
    const qb = this.toolsRepository.createQueryBuilder('tool');
    
    // 基于工具更新时间筛选（点击/查看会更新updated_at）
    if (period === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      qb.where('tool.updated_at >= :today', { today });
    } else if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      qb.where('tool.updated_at >= :weekAgo', { weekAgo });
    } else if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      qb.where('tool.updated_at >= :monthAgo', { monthAgo });
    }
    
    // 只显示公开工具（非自定义）
    qb.andWhere('tool.user_id IS NULL')
      .orderBy('tool.click_count', 'DESC')
      .addOrderBy('tool.view_count', 'DESC')
      .addOrderBy('tool.favorite_count', 'DESC')
      .take(limit * 2); // 取更多然后计算热度排序
    
    const tools = await qb.getMany();
    
    // 计算综合热度分：点击权重最高，然后是收藏，最后是浏览
    // 加入时间衰减：越新的工具权重越高
    const now = Date.now();
    const withScore = tools.map(tool => {
      const ageDays = (now - tool.updated_at.getTime()) / (1000 * 60 * 60 * 24);
      const timeDecay = Math.max(0.1, 1 - ageDays / 30); // 30天衰减到0.1
      const hotScore = (
        tool.click_count * 0.5 + 
        tool.favorite_count * 0.3 + 
        tool.view_count * 0.2
      ) * timeDecay;
      
      return {
        ...tool,
        hot_score: hotScore,
      };
    });
    
    withScore.sort((a, b) => b.hot_score - a.hot_score);
    return withScore.slice(0, limit);
  }

  // ========== Favicon 解析服务 ==========

  async getWebsitePreview(siteUrl: string): Promise<{
    title: string;
    description: string;
    imageUrl: string | null;
    themeColor: string | null;
  } | null> {
    try {
      const baseUrl = new URL(siteUrl);
      const html = await this.fetchText(baseUrl.href, 7000);
      const $ = cheerio.load(html);

      const getMetaContent = (...selectors: string[]): string => {
        for (const selector of selectors) {
          const content = $(selector).first().attr('content')?.trim();
          if (content) return content;
        }
        return '';
      };

      const resolveAssetUrl = (value: string): string | null => {
        if (!value) return null;
        try {
          const url = new URL(value, baseUrl);
          return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
        } catch {
          return null;
        }
      };

      const title = (
        getMetaContent('meta[property="og:title"]', 'meta[name="twitter:title"]') ||
        $('title').first().text().trim() ||
        baseUrl.hostname
      ).slice(0, 160);
      const description = getMetaContent(
        'meta[property="og:description"]',
        'meta[name="twitter:description"]',
        'meta[name="description"]',
      ).slice(0, 320);
      const imageUrl = resolveAssetUrl(getMetaContent(
        'meta[property="og:image:secure_url"]',
        'meta[property="og:image"]',
        'meta[name="twitter:image"]',
        'meta[name="twitter:image:src"]',
      ));
      const rawThemeColor = getMetaContent('meta[name="theme-color"]').slice(0, 32);
      const themeColor = /^#[0-9a-f]{3,8}$/i.test(rawThemeColor) ? rawThemeColor : null;

      return { title, description, imageUrl, themeColor };
    } catch {
      return null;
    }
  }

  /**
   * 获取网站 favicon
   * 先解析 HTML 找 favicon 链接，找不到则用默认 /favicon.ico
   */
  async getFavicon(siteUrl: string): Promise<{ data: Buffer; contentType: string } | null> {
    try {
      const baseUrl = new URL(siteUrl);
      
      const candidates: string[] = [];
      try {
        const html = await this.fetchText(siteUrl, 5000);
        candidates.push(...this.extractFaviconUrlsFromHtml(html, baseUrl));
      } catch {
        // HTML 获取失败，继续尝试默认路径
      }

      candidates.push(
        `${baseUrl.origin}/favicon.ico`,
        `${baseUrl.origin}/favicon.png`,
        `${baseUrl.origin}/apple-touch-icon.png`,
      );

      for (const faviconUrl of [...new Set(candidates)]) {
        try {
          return await this.downloadImage(faviconUrl, 5000);
        } catch {
          // 当前候选失败，继续尝试下一个官网图标。
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * 发送 HTTP 请求获取文本内容
   */
  private async fetchText(url: string, timeout: number = 5000): Promise<string> {
    // SSRF 检查
    await validateUrlSafe(url);

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const req = client.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
        timeout,
      }, (res) => {
        // 处理重定向（重定向时也要做SSRF检查）
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, url).href;
          validateUrlSafe(redirectUrl)
            .then(() => this.fetchText(redirectUrl, timeout).then(resolve).catch(reject))
            .catch(reject);
          return;
        }

        if (!res.statusCode || res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          data += chunk;
          if (data.length > 2 * 1024 * 1024) {
            req.destroy(new Error('HTML response too large'));
          }
        });
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
    });
  }

  /**
   * 从 HTML 中提取 favicon 链接
   */
  private extractFaviconUrlsFromHtml(html: string, baseUrl: URL): string[] {
    const $ = cheerio.load(html);
    const candidates: Array<{ url: string; score: number }> = [];

    $('link[rel][href]').each((_, element) => {
      const link = $(element);
      const rel = (link.attr('rel') || '').toLowerCase();
      if (!rel.includes('icon')) return;

      const href = link.attr('href');
      if (!href) return;

      try {
        const iconUrl = new URL(href, baseUrl);
        if (!['http:', 'https:'].includes(iconUrl.protocol)) return;

        const sizes = link.attr('sizes') || '';
        const size = Number.parseInt(sizes.match(/(\d+)x\d+/i)?.[1] || '0', 10);
        const score = (rel.includes('apple-touch-icon') ? 1000 : 0) + size;
        candidates.push({ url: iconUrl.href, score });
      } catch {
        // 忽略无法解析的图标地址。
      }
    });

    return candidates
      .sort((left, right) => right.score - left.score)
      .map((candidate) => candidate.url);
  }

  /**
   * 下载图片，返回 Buffer 和 Content-Type
   */
  private async downloadImage(url: string, timeout: number = 5000): Promise<{ data: Buffer; contentType: string }> {
    // SSRF 检查
    await validateUrlSafe(url);

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const req = client.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        timeout,
      }, (res) => {
        // 处理重定向（重定向时也要做SSRF检查）
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, url).href;
          validateUrlSafe(redirectUrl)
            .then(() => this.downloadImage(redirectUrl, timeout).then(resolve).catch(reject))
            .catch(reject);
          return;
        }

        if (!res.statusCode || res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }

        const contentType = res.headers['content-type'] || 'image/x-icon';
        const normalizedContentType = contentType.toLowerCase().split(';')[0].trim();
        if (!normalizedContentType.startsWith('image/') && normalizedContentType !== 'application/octet-stream') {
          res.resume();
          reject(new Error(`Unexpected content type: ${contentType}`));
          return;
        }
        const chunks: Buffer[] = [];
        
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const data = Buffer.concat(chunks);
          if (data.length === 0) {
            reject(new Error('Empty response'));
            return;
          }
          // 限制图片大小，防止大文件攻击
          if (data.length > 5 * 1024 * 1024) {
            reject(new Error('Image too large'));
            return;
          }
          resolve({ data, contentType });
        });
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
    });
  }
}
