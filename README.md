# OfferLens

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16.2-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![DeepSeek](https://img.shields.io/badge/AI-DeepSeek%20V4%20Flash-orange)](https://deepseek.com/)

> 🚀 **在线体验** → [dp.offerlens.cn:5173](https://dp.offerlens.cn:5173/) （无需注册，免费使用）

**OfferLens** 是一个面向全部职业的中文招聘流程模拟器。用户输入简历与岗位描述，系统通过 AI 模拟真实招聘筛选流程，提供卡点诊断、五维证据评估和证据化简历工作台。

覆盖技术、商业、职能专业、创意传媒、教育科研、医疗照护、工程制造、建筑物流、生活服务和公共服务等职业。

分析后可进入“证据化简历工作台”，按职业要求引导用户从工作、实习、课程、作品、服务、生产实践、见习和志愿活动中回忆真实证据，再生成可编辑、可导出 PDF/DOCX 的目标岗位简历。回忆提示不是候选人事实；只有用户明确确认的真实经历才允许写入简历。

> PASS 仅表示模拟进入下一招聘阶段，不表示获得 Offer。流程进度和投递建议均不是 Offer 概率。项目不保存简历、岗位描述或分析历史；公开评论不会关联任何分析材料。

## 本地运行

要求：Node.js 22、Redis 7。

```bash
npm install
cp .env.example .env.local
npm run dev
```

在 `.env.local` 中填写 `DEEPSEEK_API_KEY`、评论与匿名统计的管理令牌、哈希密钥，并设置可用的 `REDIS_URL`。访问 `http://localhost:3000`。

## 验证

```bash
npm run lint
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

单元测试和 E2E 不会调用真实 DeepSeek API。真实端到端验证应在受控环境中手动提交一份脱敏测试简历。

## 国内云 Docker 部署

```bash
cp .env.example .env.production
# 编辑 .env.production，填入真实 DeepSeek Key
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

应用只绑定到 `127.0.0.1:3000`，Nginx 默认通过高位端口 `5173` 对外提供服务，避免未备案域名直接使用 80 端口。复制 `deploy/nginx/offerlens.conf` 到 Nginx 配置目录，检查并重载：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

随后使用 Certbot 或云厂商证书为域名开启 HTTPS。Nginx 配置会覆盖 `X-Real-IP` 与 `X-Forwarded-For`，避免客户端伪造限流来源。

Redis 只存放短期哈希计数器；评论与匿名漏斗事件保存在独立 SQLite 数据卷中，部署重建不会丢失。新投稿默认待审核，公开接口和首页滚动区只返回已批准评价。

如果国内网络无法访问 Docker Hub，可使用仓库内的
`deploy/systemd/offerlens.service` 直接以 Node.js + systemd 运行，并使用系统
Redis。应用仍监听 `127.0.0.1:3000`，由同一份 Nginx 配置对外提供服务。

## 环境变量

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| `DEEPSEEK_API_KEY` | 无 | 必填，服务端模型密钥 |
| `DEEPSEEK_THINKING_ENABLED` | `false` | 是否启用 V4 Flash 思考模式 |
| `REDIS_URL` | `redis://127.0.0.1:6379` | Redis 连接地址 |
| `GLOBAL_DAILY_ANALYSIS_LIMIT` | `1000` | 全站滚动 24 小时调用上限 |
| `GLOBAL_DAILY_RESUME_LIMIT` | `1000` | 全站北京时间自然日简历规划上限 |
| `RESUME_PLAN_DEVICE_DAILY_LIMIT` | `20` | 单设备北京时间自然日简历规划上限 |
| `RESUME_PLAN_IP_WINDOW_LIMIT` | `10` | 单 IP 每 10 分钟简历规划上限 |
| `RESUME_PLAN_COOLDOWN_SECONDS` | `8` | 同设备两次生成简历规划的冷却秒数 |
| `ANALYSIS_IP_LIMIT` | `10` | 单 IP 每 10 分钟次数；设为 `0` 表示不限次 |
| `ANALYSIS_DEVICE_LIMIT` | `5` | 单设备每 24 小时次数；设为 `0` 表示不限次 |
| `COMMENT_DB_PATH` | 开发环境 `.data/comments.sqlite` | 公开评论 SQLite 路径 |
| `COMMENT_ADMIN_TOKEN` | 无 | 必填，审核和软删除评论的 Bearer Token |
| `COMMENT_HASH_SECRET` | 无 | 必填，用于设备和 IP 的加盐哈希 |
| `ANALYTICS_DB_PATH` | 开发环境 `.data/analytics.sqlite` | 匿名漏斗事件 SQLite 路径 |
| `ANALYTICS_ADMIN_TOKEN` | 无 | 必填，用于读取统计摘要的 Bearer Token |
| `ANALYTICS_HASH_SECRET` | 无 | 必填，仅用于匿名会话 HMAC，需与其他密钥分开 |
| `FEEDBACK_DB_PATH` | 开发环境 `.data/feedback.sqlite` | 私密面试反馈 SQLite 路径 |
| `FEEDBACK_ADMIN_TOKEN` | 无 | 必填，用于读取私密反馈的 Bearer Token |
| `FEEDBACK_HASH_SECRET` | 无 | 必填，用于反馈设备与 IP 的加盐哈希 |
| `USER_DB_PATH` | 开发环境 `.data/users.sqlite` | 可选账号与求职工作台 SQLite 路径 |
| `SESSION_SECRET` | 无 | 必填，用于签名 HttpOnly 登录会话 |
| `USER_DATA_ENCRYPTION_KEY` | 无 | 预留，用于后续用户敏感数据加密 |

## 数据与限流

- 获客阶段不限制单 IP 和单设备分析次数；全站仍保留每日 1000 次成本保险。
- 自动职业识别错误时可免费纠正一次；纠正令牌绑定设备、两小时有效，不占设备日额度，但仍计入 IP、冷却和全站额度。
- 同设备请求冷却：8 秒。
- 评论：同设备 60 秒冷却、每天 3 条；同 IP 每天 10 条。
- 独立反馈：同设备 30 秒冷却、每天 5 条；同 IP 每天 20 条。
- 简历改写：同设备北京时间每天 2 次完整会话；同 IP 10 次/10 分钟；8 秒冷却。
- 浏览器只使用 user agent、屏幕尺寸、时区、语言和随机盐生成轻量标识。
- 原始 IP、简历、岗位描述和模型结果均不会写入 Redis 或 SQLite。
- 简历工作台正文和草稿仅保存于当前标签页的 `sessionStorage`；Redis 只保存额度与一次性令牌哈希。
- 可选登录工作台会改变保存边界：只有用户注册/登录并明确点击保存或导入当前会话后，基础简历、岗位快照、简历版本、二次评审报告和面试包才会写入 `USER_DB_PATH`。

## 求职工作台

`/workspace` 是可选登录后的长期资料区。匿名用户仍可完成单次分析；如果分析后注册，系统会检测当前标签页的匿名分析资料，并展示“保存刚才这次分析到我的工作台”。用户确认后才会导入，不会静默上传。

工作台首版支持：

- 基础简历库：保存可复用的一版或多版简历。
- 岗位工作区：把某个岗位描述与一份简历绑定，保存分析结果和简历版本。
- 多岗位对比：在 `/compare` 粘贴 2–5 个岗位描述，按投递建议、通过阶段和证据完整度排序。
- 二次评审：对岗位定制简历检查证据缺口、夸大表达、关键词遗漏、事实引用断裂、面试风险和可读性。
- 面试追问准备包：基于岗位、简历版本、评审风险和五维证据生成追问、准备材料和不可编造边界。

系统不爬取招聘平台，不绕过登录、复制或风控限制；岗位输入来自用户 OCR、复制或手动粘贴。

## 匿名漏斗统计

系统记录首页访问、开始/完成分析、结果查看、简历规划/改写/导出和分享动作，用于判断用户在哪一步流失。统计使用当前标签页随机会话 ID，并在服务端通过 HMAC 匿名化；不收集简历、JD、姓名、联系方式、原始 IP、设备 ID或自由文本。

查看最近 7 天或 30 天汇总：

```bash
curl \
  -H "Authorization: Bearer $ANALYTICS_ADMIN_TOKEN" \
  "http://127.0.0.1:3000/api/analytics?days=7"
```

其中 `activationRate` 表示“成功完成分析的会话 / 访问首页的会话”，`completionRate` 表示“成功完成分析的会话 / 开始分析的会话”。接口只返回聚合数字、错误码和职业族分布。

## 面试后反馈

`/feedback` 是不依赖分析会话的永久入口。用户可选择提交真实面试进展与模拟判断吻合度，也可在尚未面试时只提交产品建议；后者不会被要求评价“准确或不准确”。反馈默认不公开，不关联简历、JD 或历史分析。

管理员查看最近反馈：

```bash
curl \
  -H "Authorization: Bearer $FEEDBACK_ADMIN_TOKEN" \
  "http://127.0.0.1:3000/api/feedback?limit=50"
```

## 评论管理

评论提交后进入待审队列，不会立即公开。查看待审评价：

```bash
curl \
  -H "Authorization: Bearer $COMMENT_ADMIN_TOKEN" \
  "http://127.0.0.1:3000/api/comments/moderation?limit=50"
```

批准或拒绝评价：

```bash
curl -X PATCH \
  -H "Authorization: Bearer $COMMENT_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"APPROVED"}' \
  http://127.0.0.1:3000/api/comments/<comment-id>
```

`status` 可为 `APPROVED` 或 `REJECTED`。管理员也可通过评论 ID 软删除：

```bash
curl -X DELETE \
  -H "Authorization: Bearer $COMMENT_ADMIN_TOKEN" \
  http://127.0.0.1:3000/api/comments/<comment-id>
```

systemd 部署需提前创建持久目录：

```bash
sudo install -d -o offerlens -g offerlens -m 750 /var/lib/offerlens
```
