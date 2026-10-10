# Skill: FlexiKit API Layer & Request Binder

## Description
当用户要求“让前端对接后端接口”、“编写 Axios 请求”、“处理前端加载状态（Loading）或错误提示（Toast）”时触发。此技能隔离网络请求细节，强迫 Codex 遵循 FlexiKit 的前端面向接口开发规范[cite: 1]。

## Strict Triggers
- "让前端调一下后端的...接口"
- "写一个前端的 axios 请求"
- "前端怎么获取数据并展示"
- "给这个页面加上数据对接"

## Core Implementation Rules
1. **禁止组件内裸写 Axios：**
   - 严禁在 Vue 组件（`*.vue`）中直接导入 `axios` 或拼写完整的 URL 路径。
   - 所有业务请求应通过实际目录 `apps/web/src/api/` 的统一 Client 与业务模块封装，例如 `apps/web/src/api/client.ts` 与 `apps/web/src/api/tools.ts`。
2. **统一使用实例（Instance）：**
   - 必须复用 `apps/web/src/api/client.ts` 的单一 Axios Client；其 API V1 路由、成功响应解包与 Refresh Token 恢复策略均已有真实实现，禁止新建独立 `request`/`apiClient`。
3. **响应式状态联动：**
   - 异步接口调用必须配合 Vue 的 `try-catch-finally` 结构，在 `finally` 块中务必关闭 `loading.value = false`，保证极端情况下页面不会无限卡死。

## Output Template Example

下面引用当前项目真实的 `apps/web/src/api/tools.ts` 用法，新功能应复用同样的 `api` 实例、类型与请求格式：

```typescript
import api from './client';
import type { BackendTool } from './toolMapper';

export interface CreateToolInput {
  name: string;
  url?: string;
  description?: string;
}

export const toolsApi = {
  getTool: (id: number) => api.get<BackendTool>(`/tools/${id}`),
  createTool: (data: CreateToolInput) => api.post<BackendTool>('/tools', data),
};
```

以上仅为局部类型示例；完整字段及业务规则以现有 `tools.ts` 为准。