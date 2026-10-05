import { BadRequestException, Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request, Response, NotFoundException, ParseIntPipe } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { CreateToolDto, ToolsQueryDto, UpdateToolDto } from './dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { TagRecommendationService } from './tag-recommendation.service';
import { Response as ExpressResponse } from 'express';
import { RawResponse } from '../common/decorators/raw-response.decorator';
import type { AuthenticatedRequest, OptionalUserRequest } from '../common/types/authenticated-request';

@Controller('tools')
export class ToolsController {
  constructor(
    private toolsService: ToolsService,
    private tagRecommendationService: TagRecommendationService,
  ) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  findAll(@Request() req: OptionalUserRequest, @Query() query: ToolsQueryDto) {
    // 未登录只返回内置工具；已登录返回内置工具 + 当前用户自定义工具。
    const userId = req.user?.userId || null;
    return this.toolsService.findAll(userId, query);
  }

  @Get('rankings')
  getRankings(@Query('period') period: string, @Query('limit') limit: number) {
    return this.toolsService.getRankings(period || 'today', limit || 10);
  }

  /**
   * 智能标签推荐
   * 根据工具名称、描述和网址自动推荐标签
   * 登录用户会基于历史使用习惯做个性化推荐
   */
  @Get('recommend-tags')
  @UseGuards(OptionalJwtAuthGuard)
  async recommendTags(
    @Request() req: OptionalUserRequest,
    @Query('name') name: string,
    @Query('description') description: string,
    @Query('url') url?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: number,
  ) {
    const userId = req.user?.userId || null;
    return this.tagRecommendationService.recommendTags(
      name || '',
      description || '',
      category,
      limit ? Number(limit) : 8,
      userId ?? undefined,
      url || '',
    );
  }

  /**
   * 获取所有可用标签（用于自动补全）
   */
  @Get('all-tags')
  getAllTags() {
    return this.tagRecommendationService.getAllTags();
  }

  // 公开端点：获取网站 favicon（后端解析，更稳定）
  @Get('favicon')
  @RawResponse()
  async getFavicon(@Query('url') siteUrl: string, @Response() res: ExpressResponse) {
    if (!siteUrl) {
      throw new BadRequestException('Missing url parameter');
    }

    try {
      const result = await this.toolsService.getFavicon(siteUrl);
      if (result) {
        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 缓存 1 天
        return res.send(result.data);
      }
    } catch {
      // 由下方统一返回 404，让前端继续尝试其他图标源。
    }

    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(404).end();
  }

  @Get('preview')
  async getWebsitePreview(@Query('url') siteUrl: string) {
    if (!siteUrl) throw new BadRequestException('Missing url parameter');

    const preview = await this.toolsService.getWebsitePreview(siteUrl);
    if (!preview) throw new NotFoundException('Website preview unavailable');
    return preview;
  }

  // 获取本地文件图标（需登录，仅用于自定义本地工具）
  @Get('local-icon')
  @UseGuards(JwtAuthGuard)
  async getLocalIcon(@Query('path') filePath: string) {
    return this.toolsService.getLocalIcon(filePath);
  }

  @Get('duplicate')
  @UseGuards(JwtAuthGuard)
  findDuplicateByUrl(
    @Query('url') url: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!url) throw new BadRequestException('Missing url parameter');
    return this.toolsService.findDuplicateByUrl(url, req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.toolsService.findOne(id);
  }

  // 以下操作需要登录，保留守卫
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createDto: CreateToolDto, @Request() req: AuthenticatedRequest) {
    return this.toolsService.create(createDto, req.user.userId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id', ParseIntPipe) id: number, @Body() updateDto: UpdateToolDto, @Request() req: AuthenticatedRequest) {
    return this.toolsService.update(id, updateDto, req.user.userId);
  }

  @Delete('batch')
  @UseGuards(JwtAuthGuard)
  deleteBatch(@Body('ids') ids: number[], @Request() req: AuthenticatedRequest) {
    return this.toolsService.deleteBatch(ids, req.user.userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  delete(@Param('id', ParseIntPipe) id: number, @Request() req: AuthenticatedRequest) {
    return this.toolsService.delete(id, req.user.userId);
  }
}
