# Feature Toggle 与本地完整验收（不依赖 Supabase CLI）

这份文档用于固定你的发布前流程，目标是：

1. 功能改完后，本地先走一遍完整链路（登录、保存、管理、广场）。
2. 在真正上线前，用开关控制新功能是否对外可见。
3. 全程不依赖 Supabase CLI，只用项目内置迁移器。

## 一、先准备 4 个本地文件（只做一次）

在项目根目录创建以下文件（不要提交到 GitHub）：

1. `.env.local.staging`
2. `.env.migrate.staging`
3. `.env.local.prod`
4. `.env.migrate.prod`

可直接从模板复制：

```powershell
Copy-Item .env.local.staging.example .env.local.staging
Copy-Item .env.migrate.staging.example .env.migrate.staging
Copy-Item .env.local.prod.example .env.local.prod
Copy-Item .env.migrate.prod.example .env.migrate.prod
```

然后把每个文件中的占位符改成真实值。

## 二、每次开发完成后的固定验收流程

### 1) 切到 staging（预发布库）

```powershell
Copy-Item .env.local.staging .env.local -Force
Copy-Item .env.migrate.staging .env.migrate -Force
```

### 2) 同步数据库结构（SQL migration）

```powershell
npm run db:migrate
```

### 3) 启动项目并做完整验收

```powershell
npm run dev
```

建议最少验证以下链路：

1. 登录/注册
2. 新建捏物并保存
3. 我的盒子里搜索、发布/撤回
4. 广场页读取公开数据
5. 若开启编辑开关，再测修改、放生、回炉

## 三、上线前最后一步（切到 prod）

```powershell
Copy-Item .env.local.prod .env.local -Force
Copy-Item .env.migrate.prod .env.migrate -Force
npm run db:migrate
npm run dev
```

通过后再执行你的手动打包上传流程。

## 四、Feature Toggle 规则（已落地）

当前项目已接入两个开关：

1. `NEXT_PUBLIC_ENABLE_SQUARE`
2. `NEXT_PUBLIC_ENABLE_EDIT`

取值支持：`true / false`（也支持 `1 / 0`）。

行为说明：

1. `NEXT_PUBLIC_ENABLE_SQUARE=false`：导航不显示“盒子广场”，直接访问广场会提示“功能未开启”。
2. `NEXT_PUBLIC_ENABLE_EDIT=false`：我的盒子里不显示“修改信息/放生/回炉”。

推荐策略：

1. staging 默认 `true`（全量验收）。
2. prod 默认 `false`（先保守发布代码）。
3. 观察稳定后，把 prod 对应开关改为 `true` 再放量。

## 五、你当前的手动打包注意事项

你是“打包 -> 解压 -> 上传 GitHub”的流程，务必确保以下文件不要被上传：

1. `.env.local`
2. `.env.migrate`
3. `.env.local.staging`
4. `.env.local.prod`
5. `.env.migrate.staging`
6. `.env.migrate.prod`

建议每次上传前检查 `.gitignore` 是否仍在忽略 `.env` 相关文件。

