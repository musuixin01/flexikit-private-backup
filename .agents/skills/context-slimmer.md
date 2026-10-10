# Skill: Dynamic Token & Context Slimmer

## Description
当用户要求修改既有代码、重构接口、或者进行 Bug 修复时强制触发。此技能作为全局“Token 守护者”，强制 Codex 在读取和输出代码时进行最大化压缩，严禁产生冗余 Token 消耗。

## Strict Triggers
- "修改一下这个方法"
- "重构这段逻辑"
- "帮我修复这个报错"
- "优化这段代码"

## Token Saving Rules
1. **输入阶段（No Over-Reading）：**
   - 如果用户只提到了某个 Service 的一个方法，严禁主动去拉取整个 Module 或其他无关的 Controller 文件。只关注当前报错或修改的核心函数。
2. **输出阶段（Strict Diff Output）：**
   - 严禁完整输出一个包含上百行的整个文件。必须使用 **「代码占位符 + 局部修改」** 的格式输出。
   - 未修改的函数和类结构，一律用 `// ... 保持原有代码不变 ...` 或 `// ... Existing code ...` 代替。
3. **压缩结构体（Compress Object）：**
   - 在向用户解释原因时，严禁重复大段的日志。只提取报错的关键行（Error Stack Trace 的前3行），其余直接裁剪。

## Output Template Example
> **错误的做法（浪费大量 Token）：** 重新打印整个 200 行的 `tools.service.ts` 文件。
> **正确的命中做法（极端省钱）：**
```typescript
// backend/src/tools/tools.service.ts

// ... 保持原有导入和构造函数不变 ...

async getToolDetail(id: string): Promise<Tool> {
  const cacheKey = `flexikit:tools:detail:${id}`;
  const cachedData = await this.cacheManager.get<Tool>(cacheKey);
  if (cachedData) return cachedData;

  // [修改点]：修复了未格式化 UUID 导致 pgvector 报错的问题
  const tool = await this.toolRepository.findOne({ where: { id: id.trim() } });
  
  // ... 保持后续缓存写入和返回逻辑不变 ...
}
```
