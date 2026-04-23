# 盒中捏物 (Neeeead) - 架构与技术栈设计

## 一、 技术栈概览

本项目采用现代化的全栈 Serverless 架构，以最小的运维成本实现高互动性、高性能的 Web 应用。

### 1. 前端 (Frontend)
负责渲染复杂的几何图形、处理高频的用户交互以及构建美观的 UI。

*   **核心框架：Next.js (App Router)**
    *   **解决问题**：提供更优的路由管理、SEO 友好的服务端渲染（SSR）以及直接与后端集成的 API Routes，是支撑未来“社区广场”、“我的盒子”等页面的基石。
*   **UI 库：React 19 + React DOM**
    *   **解决问题**：通过状态管理（useState, useEffect, useCallback）高效管理图形生成参数与画布的重新渲染。
*   **样式方案：Tailwind CSS v4**
    *   **解决问题**：采用最新的原子化 CSS 引擎，结合 CSS Variables（`@theme`），实现无缝的品牌主题切换和极速样式开发。
*   **图形渲染引擎 (2D)**
    *   **SVG (Scalable Vector Graphics)**：用于生成核心的“捏物”轮廓。SVG 具有完美的缩放性，且通过 `<g transform="...">` 实现了 Mode B 的防裁切居中缩放算法。
    *   **Canvas 2D API (`canvasUtils.ts`)**：用于高分辨率（1080x1440）离屏绘制“捏物卡片”，处理复杂的文本换行、多图层叠加以及最终导出为 PNG。
    *   **Web Workers**：在 `Expand Shape` 功能中，将耗时的像素级轮廓追踪（Moore-Neighbor）和路径简化（RDP）放到后台线程，防止主 UI 线程卡顿。
*   **图形渲染引擎 (3D/物理) -【计划中】**
    *   **Three.js / React Three Fiber (R3F)**：用于在“盒子空间”中渲染具有体积感的软体生物，并赋予材质光影。
    *   **Matter.js / Cannon.js**：用于处理公共盒子内捏物之间的碰撞、挤压与抢食物理逻辑。

### 2. 后端与数据库 (Backend / BaaS)
提供数据持久化、用户身份认证及实时同步能力。

*   **后端即服务 (BaaS)：Supabase**
    *   **PostgreSQL**：作为核心关系型数据库，存储用户、捏物参数和交互日志。
    *   **Supabase Auth**：处理用户注册、登录（支持第三方 Oauth）。
    *   **Supabase Realtime (WebSocket)**：实现“盒子空间”中投食、捏物移动等状态在多个客户端之间的毫秒级同步。
    *   **Migration Runner (`npm run db:migrate`)**：当前默认迁移方案。通过项目内脚本 `scripts/migrate.mjs` 连接 Postgres 执行 `supabase/migrations/*.sql`，并记录 `schema_migrations`，避免 Supabase CLI 在特定网络环境不可用的问题。
    *   **Supabase CLI（可选）**：网络可达时仍可使用 `supabase db push`。
*   **云端部署与 CI/CD：Vercel**
    *   **解决问题**：与 GitHub 深度集成，每次向 `main` 分支 push 代码时，自动触发 Next.js 构建、CDN 分发，并可联动 GitHub Actions 执行数据库结构的更新。

---

## 二、 运行环境与配置清单

### 1. 本地开发环境（必需）

- Node.js 20+
- npm 10+
- Next.js dev server：`npm run dev`

### 2. 环境变量分层

#### 前端运行时（公开）
存放在 `.env.local` 与 Vercel Project Environment Variables：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

#### 数据库迁移（私密，仅开发机/CI）
存放在 `.env.migrate`（禁止提交）：

- `DATABASE_URL`

示例模板文件：
- `.env.local.example`
- `.env.migrate.example`

### 3. 迁移执行标准

默认命令：

```bash
npm run db:migrate
```

执行行为：
- 按文件名顺序执行 `supabase/migrations/*.sql`
- 每个 migration 独立事务
- 记录 `public.schema_migrations`（filename + checksum）
- 使用 advisory lock 防并发重复执行

---

## 三、 数据库设计 (Database Schema)

基于 Supabase / PostgreSQL，以下是支撑现有功能及未来“盒子”、“养成”模块的核心表结构规划。

### 1. `users` (用户表 - 由 Supabase Auth 托管)
存储用户的基本身份与社交信息。

| 字段名 | 类型 | 约束 | 描述 |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK | 唯一标识 (Auth 自动生成) |
| `resident_id` | `text` | UNIQUE, NULL | 盒子居民编号（如 #001），可选 |
| `display_name` | `text` | NOT NULL | 用户昵称（默认生成或自定义） |
| `avatar_url` | `text` | NULL | 用户头像链接 |
| `created_at` | `timestamptz` | DEFAULT now() | 账号注册时间 |

### 2. `creatures` (捏物生物表)
核心表，存储每一个被创造出来的捏物及其决定外观的数学参数。

| 字段名 | 类型 | 约束 | 描述 |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK, DEFAULT gen_v4() | 捏物的唯一 ID |
| `creator_id` | `uuid` | FK(users.id) | 创造该捏物的原作者 ID |
| `owner_id` | `uuid` | FK(users.id) | 当前领养该捏物的主人 ID |
| `name` | `text` | NOT NULL | 捏物的名字（如“我的捏物”或 AI 命名） |
| `sound_mimic` | `text` | DEFAULT '哇呜' | 声音拟态设定 |
| `parameters` | `jsonb` | NOT NULL | 决定形态的核心几何参数：<br>`{ vertices: int, irregularity: float, complexity: float, strokeOffset: int }` |
| `eyes` | `jsonb` | DEFAULT '[]' | 眼睛坐标数组：`[{ x: float, y: float }]` |
| `status` | `enum` | DEFAULT 'private' | 状态：`private`(私有), `public_pool`(在公共盒子), `adopted`(已被领养) |
| `stats` | `jsonb` | DEFAULT '{}' | 养成数值：`{ hunger: int, happiness: int, age: int }` |
| `created_at` | `timestamptz` | DEFAULT now() | 诞生时间 |

### 3. `box_events` (盒子互动事件表 - 计划中)
记录在“盒子空间”中发生的实时事件，用于历史追溯或成就统计。

| 字段名 | 类型 | 约束 | 描述 |
| :--- | :--- | :--- | :--- |
| `id` | `uuid` | PK, DEFAULT gen_v4() | 事件 ID |
| `actor_id` | `uuid` | FK(users.id) | 发起动作的用户 ID |
| `target_creature_id`| `uuid` | FK(creatures.id), NULL| 被互动的目标捏物 ID（如果是投食到空地则为空）|
| `event_type` | `text` | NOT NULL | 事件类型：`feed`(投食), `pet`(抚摸), `adopt`(领养) |
| `position_x` | `float` | NULL | 发生互动的物理空间 X 坐标 |
| `position_y` | `float` | NULL | 发生互动的物理空间 Y 坐标 |
| `created_at` | `timestamptz` | DEFAULT now() | 事件发生时间 |

---
*注：所有的表都将配置 Row Level Security (RLS) 策略，确保用户只能修改自己拥有的捏物状态，公共盒子的读写权限将被严格限制。*

---

## 四、 部署链路规范（GitHub -> Vercel）

### 1. 顺序约束

1. 先完成本地开发与迁移验证
2. 推送 GitHub 仓库
3. Vercel 绑定 GitHub 仓库并配置环境变量
4. 首次线上部署后做回归测试

### 2. 回归最小清单

- 未登录可访问 `捏只新的` 和 `盒子广场（只读）`
- 登录后可保存捏物到 `creatures`
- `public_pool` 查询可读
- RLS 不允许用户修改他人数据

---

## 五、 三驾马车协作边界（技术视角）

- `architect.md`：只记录技术事实与约束（技术栈、环境、部署、迁移、数据安全）。
- `product.md`：只记录业务结构与用户路径（不写连接串、命令细节）。
- `writing.md`：只记录文案资产（不写业务逻辑和技术实现）。
