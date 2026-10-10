# Skill: TypeORM + pgvector Vector Sync & Search

## Description
当用户需要在 FlexiKit 后端处理向量数据库、配置 `embedding` 模块、编写向量相似度检索（如工具智能推荐、标签发现）、或者修改有关 `pgvector` 的 PostgreSQL 16 实体类（Entity）时触发。该技能严防大模型误写传统 SQL 或不兼容的向量计算语法。

## Strict Triggers
- "修改 embedding 模块"
- "用 pgvector 做相似度检索/向量搜索"
- "帮我写一段向量查询代码"
- "在 tool entity 里加上向量/embedding 字段"

## Core Implementation Rules
1. **Entity 向量定义规范：**
   - TypeORM 没有 `columnToken` 这一列选项。实际 `backend/src/tools/tool.entity.ts` 使用 `@Column('vector', { nullable: true, length: 1536, transformer: VectorTransformer, select: false })`。
   - 当前 Tool embedding 字段为 `number[] | null`，仅支持 1536 维；入库或查询前必须验证维度、数值范围及有限性。
2. **高命中率 Raw SQL/QueryBuilder 检索公式：**
   - 在进行向量相似度匹配时，必须使用 `pgvector` 的专属余弦距离操作符 `<=>`。
   - 当前实现通过 `.orderBy('tool.embedding <=> CAST(:queryVector AS vector)', 'ASC')` 升序排序，以 Tool id 打破同分；向量必须先严格验证、通过命名参数传入，不能插入未验证的 SQL 文本。
   - 相似 Tool 检索本身使用 PostgreSQL `INNER JOIN`，不能笼统禁止 JOIN。禁止将向量距离计算转为应用内 JS 循环；必须保留公开 Tool 和 embedding 来源/版本/新鲜度过滤。

## Negative Constraints (绝对禁止)
- **严禁**使用 JavaScript/TypeScript 数组在内存中进行 `for` 循环比对相似度。
- **严禁**在未使用 `pgvector` 扩展的情况下，直接对 `text` 字段进行模糊匹配来替代向量搜索。

## Output Template Example
```typescript
// 正确的 pgvector 检索 QueryBuilder 命中模版
// validatedVectorLiteral 来自现有安全校验 helper，不直接拼接不受信任的输入。
const distance = 'tool.embedding <=> CAST(:queryVector AS vector)';
const query = this.toolsRepository.createQueryBuilder('tool')
  .addSelect(distance, 'vector_distance')
  .where('tool.user_id IS NULL')
  .andWhere('tool.embedding IS NOT NULL')
  // ... 继续校验 embedding Provider/Model/Dimensions/Hash/UpdatedAt ...
  .orderBy(distance, 'ASC')
  .addOrderBy('tool.id', 'ASC')
  .setParameter('queryVector', validatedVectorLiteral)
  .take(limit);
// 执行、结果距离与有限数字校验复用 ToolVectorSearchService.readMatches。
```
