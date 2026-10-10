# Skill: NestJS Module & Architecture Forge

## Description
当用户要求在 FlexiKit 后端（`backend/`）创建新功能模块、新增 API 路由、设计 DTO 模块、或者重构既有的 Controller/Service 时，必须隐式触发并严格遵守此技能规则。该技能确保所有后端输出完全契合 NestJS 10 + TypeScript 的企业级分层规范。

## Strict Triggers
- "帮我给后端加一个...模块/接口"
- "在 backend 里面新增功能"
- "写一个 NestJS 的 Controller/Service/DTO"
- "为 FlexiKit 扩展一个 API"

## Core Implementation Rules
1. **严格分层（Directory Enforcement）：**
   所有新模块必须包含独立的 `*.module.ts`, `*.controller.ts`, `*.service.ts`。禁止将业务逻辑和控制层混合在单个文件中。
2. **现代 NestJS 10 语法：**
   - 必须使用标准装饰器：`@Controller()`, `@Injectable()`, `@Get()`, `@Post()`, `@Body()`, `@Param()`, `@Query()`。
   - 所有依赖注入必须通过 `constructor(private readonly ...)` 在构造函数中隐式注入。
3. **参数验证与管道（Validation Layer）：**
   - 所有的 `@Body()` 输入必须绑定一个显式的 DTO 类（例如 `CreateToolDto`）。
   - DTO 必须严格使用 `class-validator` 装饰器（如 `@IsString()`, `@IsOptional()`, `@IsUrl()`）进行运行时校验。
   - 必须配合 `class-transformer` 的 `@Type()` 进行类型转换。

## Output Template Example
当触发此技能创建模块时，骨架必须如下：
```typescript
// backend/src/example/dto/create-example.dto.ts
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateExampleDto {
  @IsString()
  @IsNotEmpty()
  readonly name: string;

  @IsString()
  @IsOptional()
  readonly description?: string;
}
```
