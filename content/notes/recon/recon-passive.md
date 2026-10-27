---
title: 被动侦察：资产与指纹收集
category: recon
tags: [信息收集, OSINT, 子域]
summary: 不发一个数据包，先把目标的资产面摸清：证书日志、DNS 历史、代码泄露、搜索引擎语法。
level: 1
minutes: 15
order: 1
updated: 2026-10-27
---

# 被动侦察：资产与指纹收集

被动侦察的定义很简单：**你的流量不直接打到目标身上**，全部通过第三方数据源完成。

它的价值在于隐蔽——目标IDS看不到你。缺点是数据可能过期。

## 1. 域名与子域

### 证书透明日志（CT Log）

任何签发过证书的域名都会留下记录，这是最可靠的子域来源之一。

```bash
# 查询某个域名的所有证书记录
curl -s "https://crt.sh/?q=%25.example.com&output=json" \
  | jq -r '.[].name_value' | sort -u

# 用工具批量整理
subfinder -d example.com -all -silent | sort -u > subs.txt
```

### 其他子域来源

| 来源 | 方法 | 特点 |
|------|------|------|
| DNS 历史 | SecurityTrails、VirusTotal | 能挖到已下线的记录 |
| 搜索引擎 | `site:example.com -www` | 慢但免费 |
| 证书 SAN | `openssl s_client -connect x:443 \| openssl x509 -text` | 一张证书暴露多个域 |
| 爆破 | 字典 + DNS 解析（属主动） | 见 [[recon-active]] |
| JS 文件 | 前端代码里的 API 地址 | 常暴露内部域名 |

### 验证与去重

```bash
# 解析存活
cat subs.txt | dnsx -silent -a -resp

# HTTP 探活 + 标题 + 技术栈
cat subs.txt | httpx -silent -title -tech-detect -status-code -o live.txt
```

## 2. 组织与人员

- **Whois**：注册邮箱、注册商、创建时间（老域名通常意味着历史包袱）
- **ASN**：`whois -h whois.radb.net -- '-i origin ASxxxx'` 拿到整个网段，比逐个域名扫更全面
- **企业信息**：子公司、并购历史——每一家都可能是新的攻击面
- **招聘信息**：JD 里写的技术栈就是你的指纹表

## 3. 技术栈指纹

| 线索 | 判断 |
|------|------|
| `Server` 头 | Nginx / IIS / Apache 版本 |
| `X-Powered-By` | PHP / ASP.NET / Express |
| Cookie 名 | `PHPSESSID`、`JSESSIONID`、`ASP.NET_SessionId` |
| 报错页样式 | 框架特征（ThinkPHP、Spring Boot Whitelabel） |
| 静态资源路径 | `/static/`、`/_next/`、`/wp-content/` |
| favicon 哈希 | 用 mmh3 计算后可反查同源资产 |

```bash
# favicon 哈希，常用于找出同一套系统的其他资产
curl -s https://example.com/favicon.ico | python3 -c \
"import sys,mmh3,codecs;print(mmh3.hash(codecs.encode(sys.stdin.buffer.read(),'base64')))"
```

## 4. 代码与文档泄露

这是被动侦察里**性价比最高**的一块。

- **GitHub / Gitee**：搜索 `company.com password`、`filename:.env`、`org:xxx`
- **公开网盘**：会议纪要、拓扑图、运维手册
- **Swagger / Actuator**：`/v2/api-docs`、`/actuator/env` 常常未鉴权
- **历史快照**：Wayback Machine 能看到已删除的接口文档

> [!TIP]
> 搜代码时用**特征串**而不是公司名：内部域名后缀、内网 IP 段、邮箱域名、项目代号。这些串一旦泄露，往往连测试账号一起泄露。

## 5. 搜索引擎语法

```
site:example.com inurl:admin
site:example.com ext:pdf  "内部"
site:example.com intitle:index.of
"example.com" password filetype:xlsx
```

## 6. 归档与建模

被动侦察的产出不是一堆 URL，而是**有归属的资产表**：

| 字段 | 示例 |
|------|------|
| 资产 | admin.example.com |
| 类型 | 后台 / API / 静态站 |
| 归属 | 自建 / 外包 / 云托管 |
| 指纹 | Nginx 1.18 + PHP 7.4 + ThinkPHP |
| 状态 | 存活 / 403 / 已下线 |
| 备注 | 疑似测试环境，未在授权范围 |

最后一步很关键：**把"不在范围内"的资产单独列出来**，报告里要写清楚，避免越界。

## 工具速查

- `subfinder` — 子域枚举
- `amass` — 资产图谱（较重）
- `dnsx` — 批量 DNS 解析
- `httpx` — HTTP 探活与指纹
- `theHarvester` — 邮箱与主机收集

## 相关

- [[recon-active]] — 主动扫描
- [[methodology]] — 阶段划分
