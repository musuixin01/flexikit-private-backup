# Skill: TypeORM Strict Entity & Migration Guard

## Description
当用户在 FlexiKit 申请修改数据库表结构、增加字段、修改 TypeORM Entity 实体类或处理 PostgreSQL 16 数据落盘逻辑时，必须强制触发本技能。本技能确保数据库操作的绝对安全，严禁产生破坏性变更。

## Strict Triggers
- "给 user 表加一个字段"
- "修改 tool 的 entity"
- "生成数据库迁移文件"
- "调整一下这个字段的类型"

## Core Implementation Rules
1. **Entity 字段精准定义（Precision Mapping）：**
   - 新增字段必须显式声明列类型，严禁让 TypeORM 自动推断。例如：`@Column({ type: 'varchar', length: 255, nullable: true })`。
   - 所有时间戳字段必须使用精准的 `@CreateDateColumn({ type: 'timestamptz' })` 和 `@UpdateDateColumn({ type: 'timestamptz' })`，带上时区属性。
2. **关系定义的严谨性（Strict Relations）：**
   - 在定义 `@OneToMany` 或 `@ManyToOne` 时，必须显式指明 `onDelete` 和 `onUpdate` 行为（如 `'CASCADE'` 或 `'RESTRICT'`），防止孤儿数据。
3. **安全查询（Safe Querying）：**
   - 使用 `QueryBuilder` 或 `find` 逻辑时，凡是涉及外部传入参数，必须使用参数化查询（Parameterized Queries），严禁使用字符串拼接防止 SQL 注入。

## Negative Constraints (绝对禁止)
- **严禁**提示或修改 `ormconfig` 开启 `synchronize: true` 来同步生产环境数据库。
- **严禁**在未使用事务（Transaction）的情况下，执行涉及两张及以上核心数据表的级联 `INSERT/UPDATE` 操作。

## Output Template Example
当需要新增一个字段并提供查询保障时，精准输出应当如下：
```typescript
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('tools')
// 对高频查询字段强制添加复合索引
@Index(['category', 'isActive'])
export class Tool {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  name: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
```
