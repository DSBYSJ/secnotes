---
title: 主动侦察：端口、目录与参数发现
category: recon
tags: [信息收集, nmap, ffuf, 目录爆破]
summary: 开始发包之后的顺序：先端口，再服务，再目录，最后参数。附限速与结果归档的实践约定。
level: 2
minutes: 16
order: 2
updated: 2026-10-27
---

# 主动侦察：端口、目录与参数发现

主动侦察会留下日志。**发包前先说清楚**：这批 IP 在不在授权里、出口 IP 有没有报备、允不允许高强度扫描。

## 正确的顺序

很多人上来就 `dirsearch`，这是错的。顺序应该是：

```
端口 → 服务与版本 → 虚拟主机 → 目录/文件 → 参数 → 应用逻辑
```

原因：端口决定你面对什么服务；服务决定用哪套字典；参数只有在找到动态页面后才有意义。

## 1. 端口扫描

### 分层策略

| 层 | 目的 | 命令要点 |
|---|---|---|
| 快速全端口 | 找出所有开放端口 | `-p- --min-rate 2000 -T4` |
| 精确识别 | 版本与脚本 | `-sV -sC -p <open>` |
| UDP 补充 | SNMP/TFTP/DNS | `-sU --top-ports 50` |
| 绕过 | 过滤环境 | `-Pn -sS --source-port 53` |

```bash
# 第一轮：快，只关心哪些端口开着
nmap -p- --min-rate 2000 -T4 -Pn -oG scan-all.txt 10.10.10.5

# 第二轮：对开放端口做版本与默认脚本
nmap -sV -sC -p 22,80,443,3306 -oA scan-detail 10.10.10.5

# 大网段先粗筛
masscan -p1-65535 --rate 1000 10.10.10.0/24 -oL masscan.txt
```

> [!WARNING]
> `--min-rate` 和 `-T4` 在生产环境可能触发防护甚至影响业务。**授权书里没写"允许高强度扫描"就不要用**。

### 读结果比扫更重要

- 同一端口在不同主机上的版本不一致 → 可能是遗留系统
- 端口开着但返回 RST → 可能有防火墙在做端口敲门
- 只开放 80/443 但证书是别的域名 → 虚拟主机线索

## 2. 虚拟主机发现

一台 IP 上可能跑几十个站点，直接访问 IP 只能看到默认站。

```bash
# 用 Host 头爆破
ffuf -w vhosts.txt -u http://10.10.10.5 \
  -H "Host: FUZZ.example.com" -fs 4242

# 证书里的 SAN 也能反推
openssl s_client -connect 10.10.10.5:443 </dev/null 2>/dev/null \
  | openssl x509 -noout -text | grep DNS
```

## 3. 目录与文件

### 字典选择

| 场景 | 字典 |
|---|---|
| 通用 | `raft-medium-directories.txt`、`directory-list-2.3-medium.txt` |
| 备份文件 | `BackupFile`、自定义后缀组合 |
| API | `api-endpoints.txt`、Swagger 路径 |
| 特定框架 | WordPress / Spring / ThinkPHP 专用字典 |

```bash
# 先小字典快跑，再针对命中路径递归
ffuf -w ~/wordlists/common.txt -u https://example.com/FUZZ \
  -mc 200,204,301,302,401,403 -fs 0 -t 40 -o dir.json

# 备份文件：源码泄露的重灾区
ffuf -w ~/wordlists/common.txt -u https://example.com/FUZZ \
  -e .bak,.zip,.tar.gz,.old,~,.swp -mc 200
```

### 状态码的语义

- `200` — 存在
- `301/302` — 存在但跳转（可能是登录重定向）
- `401/403` — **存在但受保护，往往最有价值**
- `404` — 不存在（注意自定义 404 页面会造成假阳性）
- `429` — 被限速了，降并发

`-fs`（按响应大小过滤）通常比 `-mc` 更可靠，因为很多站点对所有路径都返回 200。

## 4. 参数发现

找到了动态页面（`?id=1`），下一步是找**隐藏参数**。

```bash
# 从 JS 里提取参数名
cat app.js | grep -oE "[a-zA-Z_]{3,20}=" | sort -u

# 用字典 fuzz GET 参数
ffuf -w params.txt -u "https://example.com/api/user?FUZZ=1" -fs 1234

# POST 参数（注意 Content-Type）
ffuf -w params.txt -u https://example.com/api/login \
  -X POST -H "Content-Type: application/json" \
  -d '{"FUZZ":"test"}' -fs 88
```

Arjun 是专门做这事的工具，比手搓字典省事：

```bash
arjun -u https://example.com/api/user -m GET
```

## 5. 限速与隐蔽

| 手段 | 做法 | 代价 |
|---|---|---|
| 降并发 | `-t 10`、`--rate-limit` | 变慢 |
| 加延迟 | `-p 0.5` | 更慢 |
| 换 UA | 常见浏览器 UA | 绕过最粗糙的规则 |
| 分散源 IP | 代理池 | 合规风险，通常不允许 |
| 走正常路径 | 从爬虫结果出发，而不是盲爆 | 覆盖率低但质量高 |

> [!TIP]
> 与其把并发拉到 200，不如把字典换准。**一个贴合业务的 200 条字典，覆盖率高于 2 万条通用字典**。

## 6. 结果归档

每次扫描都要落盘，命名统一：

```
recon/
├── 01-nmap/
│   ├── scan-all.txt
│   └── scan-detail.nmap
├── 02-web/
│   ├── httpx.txt
│   └── dir.json
├── 03-params/
└── notes.md      ← 人写的结论，不是机器输出
```

`notes.md` 里只写结论和线索，例如："`/api/v1/export` 返回 403，但 `/api/v1/export/../export` 返回 200，疑似路径校验缺陷，待验证"。机器输出再全，也不能代替这一句。

## 相关

- [[recon-passive]] — 被动侦察
- [[ssrf]] — 用 SSRF 做内网端口探测
