# FlexiKit 文档完整盘点与一致性审查（2026-10-10）

> 审查基线：原有 49 份 docs/ 文档、16 份 .agents/skills/ 技能、根目录 CLAUDE.md/README.md 和 3 个子项目 README，共 **70 份 Markdown**。已逐文件载入全文进行章节、相对链接、代码块和内容标记扫描，对问题涉及的关键章节逐段审查，并与当前前后端源码、专项文档互证。此审查报告不取代 docs/MASTER_PLAN.md 的执行指针，也不宣称全部历史数据完成实时复核。

## 1. 执行主线

- 以 CLAUDE.md、适用的 .agents/skills/、docs/MASTER_PLAN.md 为规范基准。ROADMAP、IMPLEMENTATION_PLAN 及各历史 ADR 中的“下一任务”必须按其写作日期解读。
- 当前仍为 **Stage 6 / v0.5 公测打磨 / 性能指标**。主窗口 Windows 边缘连续缩放闪动按用户先前决定暂停，尚未解决。Release、真实首屏、GPU 长期负载、多屏 DPI、真实 Canvas 操作、7 日外部用户试测均未完成正式验收。
- 接手时 Git master HEAD a13fee6、ahead 42；原工作区存在大量未提交代码和 Canvas/Resize 文档。此次仅作独立文档与技能精确修订，不覆盖上述工作。

## 2. 本轮修正及证据

| 类别 | 修正内容 | 证据 |
| --- | --- | --- |
| API 路由与响应 | API.md 改为规范 /v1 路由、普通 JSON 成功信封 code=0/data、标准错误 code 与 Web Axios 自动解包；Error Contract 移除“成功信封尚未实现” | backend/src/main.ts；common/versioning；common/interceptors/api-response.interceptor.ts；apps/web/src/api/client.ts |
| API 推荐 | 移除“pgvector 相似推荐待实现”的过期结论 | backend/src/recommendations；docs/SIMILAR_RECOMMENDATIONS.md |
| 进度 | ROADMAP 与 IMPLEMENTATION_PLAN 将 S4/S5 已完成的响应、类型、桌面 AI、Token 成本基础项正确勾选；API_MIGRATION_PLAN 纠正历史标题 | MASTER_PLAN；各 S4/S5 专项文档 |
| 历史指针 | AI_ASSISTANT.md 的旧 S5.3 后续任务明确标为历史交接，不能覆盖 Stage 6 执行指针 | MASTER_PLAN |
| Canvas | CANVAS_REFRACTION_ADR 标为 2026-10-09 单屏原型；指向现有多屏/GPU 恢复/光学演进文档 | CANVAS_WALLPAPER_OPTICS；CANVAS_CONSOLE |
| 后端技能 | 修复要求 Controller 手动包装 code=201 的错误；更新 pgvector 实际 TypeORM vector(1536) 声明、参数化余弦查询及允许自连接的准确约束 | ApiResponseInterceptor；tool.entity.ts；tool-vector-search.service.ts |
| AI/前端技能 | 删除“强制清空系统 Prompt/对话”的虚假能力，修正 frontend/src/旧 Client 路径和冲突的默认阴影/缓动指导 | CLAUDE.md；apps/web/src/api/client.ts；apple-design-system.md |
| 本地安全 | 修正敏感数据分类中“无法清除当前用户 Canvas/活动”的旧说法，区分历史错误日志与新诊断事件白名单 | DATA_EXPORT_DELETE；PRIVACY_SETTINGS；STAGE6_DIAGNOSTICS |
| 安全 | 修正漏洞报告公开 Issue 的错误引导、未核实 SLA、Browser/Windows 凭据方案混用 | BROWSER_AUTH_STORAGE；DESKTOP_AUTH_STORAGE |
| 合规 | ICP 经营许可证不再按“存在付费会员”机械判断，区分已实现数据导出/删除 API 与完整 GDPR 合规 | [湖北通信管理局答复](https://hubca.miit.gov.cn/zwgk/dxhhlwgl/art/2025/art_46268c23ed4f4a5191d9fc2f79dcf231.html) |
| 项目介绍 | README 更新真实产品定位；移除不存在的 LICENSE 文件链接及未经授权的 MIT 许可证承诺 | 实际仓库目录 |
| Markdown | 补齐 8 份技能文档遗失的代码围栏闭合，避免后续正文被当作代码 | 文档全文静态扫描 |

## 3. 尚未关闭的风险与限制

1. **P1 安全治理：** backend/src/crawler/crawler.controller.ts 的手动 POST 爬虫任务尚未启用 JWT/管理员 Guard；若开放公网可能被匿名触发。必须先加鉴权、限流与执行预算，再进入公开生产部署。此次只记录，未未经授权改业务代码。
2. **P1 发布门槛：** Windows resize 闪动仍暂停，动态视觉、100/125/150% DPI、混合双屏和真实 GPU/DWM Present 未终验，不可将自动测试视作实机全通过。
3. **发布合规：** 没有 LICENSE；security@flexikit.app/dpo@flexikit.com 的投递与职责未证实；ICP/APP 备案、经营许可类别、GDPR 义务应基于实际业务模式复核。
4. **数据与历史文档：** 旧日志并未自动删除；历史测试的 PID、截图、性能数值不能视作当前运行程序实时状态。旧代码样例必须以真实接口实现为准。

**后续治理更新（2026-10-10）**：上文第 1 项匿名手动爬虫 P1 已在代码中增加 `JwtAuthGuard + AdminAccessGuard`，并加入单进程手动抓取限流/互斥，10 路由的隔离源码+Mock 回归 PASS。原报告保留发现时事实不追溯改写；正式 NestJS/HTTP 和多实例资源预算仍未验收，不能直接标为公网安全发布完成。详见 `docs/TECH_DEBT.md` 与 Stage6 checklist。

## 4. 验证与保护

本轮对审查范围文件执行过 PowerShell 全文只读扫描和相对路径链接/Markdown 围栏检查，并对关键实现执行文件定位与源码对照。结构化编辑均采用读修订版、精确唯一文本锚点与先 dry-run；混合 CRLF/LF 文件采用源 SHA 比对和原有行尾保留方式进行定点替换。未提交/推送 Git、未构建覆盖安装版、未动已有用户数据。

完成纯文档更正不等于 Stage 6 测试完成。后续按 MASTER_PLAN 原主线继续，通过运行验证后再同步 STABLE_CHECKLIST、CHANGELOG 与专项记录。
