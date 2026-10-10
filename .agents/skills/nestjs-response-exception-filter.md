# Skill: NestJS Global Response & Exception Standard

## Description
当用户要求在 backend 中“编写新 API 接口”、“处理错误报错”、“返回前端数据”时，强制触发。本技能确保所有 HTTP 响应严格遵守 FlexiKit 企业级 RESTful 响应规范，不向公网泄露任何底层数据库堆栈错误。

## Strict Triggers
- "写一个接口返回工具列表"
- "处理一下查不到数据的报错"
- "统一一下返回格式"
- "拦截这个 TypeORM 错误"

## Core Implementation Rules
1. **标准成功响应信封（Success Envelope）：**
   - Controller 返回业务数据，不得手动构造成功信封。现有全局 `ApiResponseInterceptor` 负责输出 `{ code: 0, message: 'success', data: T }`；HTTP 201 与信封 `code: 0` 相互独立。
   - 仅明确标注 `@RawResponse()` 的原始二进制/流式端点跳过成功信封。参见 `docs/API_RESPONSE_CONTRACT.md`。
2. **业务异常抛出规范（Business Exceptions）：**
   - 遇到业务逻辑错误（如“工具不存在”、“权限不足”），严禁使用原生的 `throw new Error()`。
   - 必须抛出 NestJS 官方的 `HttpException` 或其子类（如 `NotFoundException`, `BadRequestException`）。
3. **底层安全隔离（Database Error Masking）：**
   - 若捕获到 PostgreSQL 的唯一键冲突（如 `23505`）或其他 `QueryFailedError`，严禁将具体的 SQL 字段或表名放进 `message` 中返回给前端。
   - 必须将其转化为模糊的业务提示，例如：“该记录已存在，请勿重复提交”。

## Output Template Example

> 注意：下列旧示例只展示业务边界，存在过宽的 catch 和不合规范的异常传播。新代码应优先直接返回 Service 结果，仅在能明确识别数据库错误类型时进行有界异常映射，不能把全部 4xx 统一转成 500。
当编写 Controller 层的具体方法时，结构必须极致清晰、捕获精准：
```typescript
import { Controller, Post, Body, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { CreateToolDto } from './dto/create-tool.dto';

@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Post()
  async createTool(@Body() createDto: CreateToolDto) {
    try {
      const result = await this.toolsService.create(createDto);
      // 全局 ApiResponseInterceptor 自动封装成功响应；Controller 只返回业务数据
      return result;
    } catch (error) {
      // 精准拦截 PostgreSQL 唯一性冲突 (ErrorCode 23505)
      if (error.code === '23505') {
        throw new BadRequestException('该工具名称或 URL 已存在，请重新输入');
      }
      // 其他未知底层错误进行脱敏
      throw new InternalServerErrorException('服务器处理创建请求时发生异常，请稍后再试');
    }
  }
}
```
