---
title: XSS：三类注入与防御视角
category: web
tags: [XSS, 前端安全, CSP]
summary: 反射、存储、DOM 三类的差别不在 payload，而在"数据从哪来、在哪落地"。上下文决定一切。
level: 2
minutes: 14
order: 2
updated: 2026-10-27
---

# XSS：三类注入与防御视角

## 一句话原理

服务端把用户输入原样放进了 HTML，浏览器把它当**代码**执行而不是**文本**显示。

## 三种类型

| 类型 | 数据流 | 触发条件 | 危害 |
|---|---|---|---|
| 反射型 | URL → 响应体 | 受害者点链接 | 钓鱼、绕过 CSRF token |
| 存储型 | 数据库 → 页面 | 任何人访问该页 | 蠕虫、批量盗号 |
| DOM 型 | URL → 前端 JS → DOM | 受害者点链接 | 服务端日志看不到 |

三者 payload 可能完全一样，区别只在**落地位置**和**是否持久化**。

## 上下文决定 payload 形态

同一段输入，落在不同位置，闭合方式完全不同：

```html
<!-- 1. HTML 标签之间 -->
<div>INPUT</div>          →  <script>...</script> 或 <img src=x onerror=...>

<!-- 2. 属性值内（双引号） -->
<input value="INPUT">     →  " onfocus=... autofocus="

<!-- 3. 属性值内（单引号，未闭合） -->
<input value='INPUT'>     →  ' onmouseover='...

<!-- 4. JS 字符串内 -->
<script>var a = "INPUT"</script>  →  ";alert(1);// 

<!-- 5. URL 内 -->
<a href="INPUT">          →  javascript:alert(1)
```

> [!TIP]
> 测试时先确定**落地上下文**，再决定闭合字符。盲目丢 `<script>alert(1)</script>` 是最低效的做法。

## DOM 型：重点在 source 与 sink

DOM XSS 不经过服务端，所以要看的是一对关系：

**Source（污点来源）**
`location.hash`、`location.search`、`document.referrer`、`postMessage`、`window.name`

**Sink（危险落地）**
`innerHTML`、`outerHTML`、`document.write`、`eval`、`setTimeout(string)`、`location.href`

```js
// 危险
el.innerHTML = location.hash.slice(1);

// 安全
el.textContent = location.hash.slice(1);
```

审计前端代码时，直接搜 sink 名，再回溯它有没有被 source 污染。

## 测试流程

1. **找反射点**：在参数里放一个唯一字符串（如 `xss12345`），全文搜索响应体
2. **判断上下文**：看它落在标签、属性还是脚本里，有没有被编码
3. **构造闭合**：按上下文选闭合方式
4. **验证执行**：用 `alert(1)` 或更温和的 `console.log`，避免弹窗打扰
5. **评估影响**：能否读 Cookie（HttpOnly？）、能否发起同源请求（CSRF token？）

### 自动化工具

- Burp Suite 的 **DOM Invader**：专治 DOM 型，能看到 source → sink 链路
- **XSStrike**：参数级 fuzz，会按上下文生成 payload
- 手工仍是主力，工具只负责扩大覆盖面

## 存储型的额外风险

存储型 XSS 一旦出现在**后台管理页面**，就等于：

```
低权限用户提交 → 管理员打开列表页 → 在管理员会话里执行
```

可以直接用管理员的身份调用后台接口。这类问题的评级通常远高于前台反射型。

## 防御：三层，缺一不可

### 1. 输出编码（最根本）

按上下文编码，而不是"过滤危险字符"：

| 上下文 | 编码 |
|---|---|
| HTML 文本 | `& < > " '` → 实体 |
| HTML 属性 | 同上，且属性值必须加引号 |
| JS 字符串 | `\xHH` / `\uHHHH`，或 JSON 序列化后嵌入 |
| URL 参数 | `encodeURIComponent` |
| CSS | 避免动态拼接，用类名白名单 |

现代框架（React、Vue）默认转义，**危险的是 `dangerouslySetInnerHTML`、`v-html`、`innerHTML`** 这些逃生舱。

### 2. CSP（兜底）

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'nonce-随机值';
  object-src 'none';
  base-uri 'self';
```

CSP 不能防注入，但能让注入的脚本**执行不了**。注意避免 `unsafe-inline` 和过宽的白名单域。

### 3. Cookie 安全属性

```
Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax
```

`HttpOnly` 让 JS 读不到会话 Cookie，直接砍掉"盗 Cookie"这条最常见的利用链。

## 常见误区

- **只做前端校验**：抓包直接绕过
- **只过滤 `<script>`**：`<img onerror>`、`<svg onload>` 一样有效
- **只做一次编码**：在错误的层编码等于没编码
- **依赖 WAF**：WAF 规则永远滞后于新 payload

## 相关

- [[jwt]] — 会话令牌相关的另一条攻击面
- [[upload]] — 上传 HTML/SVG 也能造成存储型
