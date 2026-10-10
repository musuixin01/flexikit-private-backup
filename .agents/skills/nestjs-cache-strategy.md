# Skill: NestJS + Redis Cache Interception & Control

## Description
当用户需要在 FlexiKit 后端（`backend/`）引入 Redis 缓存、编写自定义缓存拦截器（Cache Interceptor）、实现 Service 层的缓存读取与双写策略（Cache-Aside Pattern）、或者优化高频 API 的响应速度时强制触发。此技能确保代码完全符合 NestJS 10 与 Redis 7 的高性能配合规范。

## Strict Triggers
- "给接口加上 Redis 缓存"
- "写一个缓存拦截器"
- "使用 cache-manager 控制 Redis"
- "优化这个查询，引入 Redis 缓存减少数据库压力"

## Core Implementation Rules
1. **严格的统一键名规范（Key Namespacing）：**
   - 严禁直接使用动态变量作为裸 Key（如 `await this.cache.get(id)`）。
   - 必须遵循 `flexikit:模块名:业务标识:唯一标识` 的三段式/四段式冒号命名空间规范。例如：`flexikit:tools:detail:${toolId}`。

2. **符合 NestJS 10 的 CacheManager 注入语法：**
   - 必须从 `@nestjs/cache-manager` 包中导入 `CACHE_MANAGER` 令牌和 `Cache` 类型。
   - 注入格式必须严格为：`@Inject(CACHE_MANAGER) private cacheManager: Cache`。
   - **NestJS 10 关键语法防错：** 在 NestJS 10 中，`cacheManager.set()` 的第三个参数 TTL 必须是**以毫秒为单位的纯数字**（或是特定 store 支持的格式），严禁写成旧版本的 `{ ttl: 3000 }` 对象形式（除非显式使用了特定非标 store）。默认统一使用毫秒数字，例如：`await this.cacheManager.set(key, value, 60000); // 1分钟`。

3. **双写一致性与主动失效（Cache Eviction）：**
   - 凡是编写了 `CUD`（创建、更新、删除）操作的代码（如 `updateTool`, `deleteTool`），**必须**在事务成功后，同步触发 `await this.cacheManager.del(key)` 清除对应缓存，严禁只依赖 TTL 自然过期。

4. **高并发防御防线（Cache Breakdown Protection）：**
   - 针对高频核心接口（如工具列表、发现首页），禁止写出“查不到缓存就直接穿透到 DB”的裸代码。
   - 必须提示使用简易的异步锁或防击穿逻辑，或者对不存在的 Key 缓存一个短期空值（如 `null` 或 `"EMPTY"`）以防止缓存穿透。

## Negative Constraints (绝对禁止)
- **严禁**将敏感信息（如用户密码、未加密的 JWT Token）直接序列化存入 Redis。
- **严禁**直接在 Controller 层裸写大量的 `try-catch` Redis 读写逻辑，建议封装在 Service 或专用的 Interceptor 中。

## Output Template Example
当触发此技能编写带有缓存的 Service 方法时，标准结构必须如下：
```typescript
import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class ToolsService {
  constructor(
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly toolRepository: ToolRepository,
  ) {}

  async getToolDetail(id: string): Promise<Tool> {
    const cacheKey = `flexikit:tools:detail:${id}`;
    
    // 1. 命中缓存
    const cachedData = await this.cacheManager.get<Tool>(cacheKey);
    if (cachedData) return cachedData;

    // 2. 缓存回源与防穿透
    const tool = await this.toolRepository.findOne({ where: { id } });
    if (!tool) {
      // 缓存 5 分钟空值，防止穿透攻击
      await this.cacheManager.set(cacheKey, null, 300000);
      return null;
    }

    // 3. 写入缓存（过期时间 1 小时，单位毫秒：3600000）
    await this.cacheManager.set(cacheKey, tool, 3600000);
    return tool;
  }
}
```
