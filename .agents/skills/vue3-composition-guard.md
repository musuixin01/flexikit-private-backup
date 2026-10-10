# Skill: Vue 3 Composition & TypeScript Guard

## Description
当用户要求在 FlexiKit 前端（`frontend/`）创建新组件、编写页面视图、设计 Pinia Store 状态管理、或者重构既有的前端业务逻辑时强制触发[cite: 1]。此技能锁死 Vue 3 组合式 API 最新语法规范，确保全栈类型安全[cite: 1]。

## Strict Triggers
- "帮我写一个前端组件/页面"
- "在 frontend 目录下新增功能"
- "写一个 Pinia store"
- "为这个 Vue 组件加上业务逻辑/TS类型"

## Core Implementation Rules
1. **纯粹的 `<script setup lang="ts">` 架构：**
   - 严禁输出 Vue 2 选项式（Options API）的 `data`, `methods`, `computed` 结构。
   - 必须使用声明式的 `ref`, `computed`, `reactive`, `watchEffect`[cite: 1]。
2. **严格的宏函数类型定义（Vue 3.4+）：**
   - 组件的 Props 必须使用运行时类型或泛型参数的 `defineProps<{...}>()`。
   - 自定义事件必须显式声明 `defineEmits<{...}>()`。
   - 所有 API 请求的返回数据必须定义明确的 TypeScript 接口（Interface），严禁使用 `any`[cite: 1]。
3. **Pinia 组合式 Store 规范（Setup Stores）：**
   - 编写 Store 时，禁止使用 `defineStore('id', { state, actions })` 的旧对象语法。
   - 必须统一使用 Setup 语法：`defineStore('id', () => { ... return { ... } })`[cite: 1]。

## Output Template Example
当触发此技能生成前端工具列表逻辑时，标准骨架必须如下：
```typescript
// frontend/src/stores/tool.ts
import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import type { ToolItem } from '@/types'; // 假设的统一类型文件

export const useToolStore = defineStore('tool', () => {
  const tools = ref<ToolItem[]>([]);
  const loading = ref(false);

  const favoriteTools = computed(() => tools.value.filter(t => t.isFavorite));

  async function fetchTools() {
    loading.value = true;
    try {
      // API 请求逻辑...
    } finally {
      loading.value = false;
    }
  }

  return { tools, loading, favoriteTools, fetchTools };
});
```
