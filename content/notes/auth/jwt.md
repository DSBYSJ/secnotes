---
title: JWT 与会话令牌的常见缺陷
category: auth
tags: [JWT, 认证, 会话]
summary: 结构、五类典型缺陷（alg:none、弱密钥、kid 注入、jku、算法混淆）、验证清单与正确实现。
level: 2
minutes: 12
order: 1
updated: 2026-10-27
---

# JWT 与会话令牌的常见缺陷

## 结构

```
header.payload.signature
```

三段 Base64URL，用 `.` 连接。

```json
// header
{"alg":"HS256","typ":"JWT"}

// payload
{"sub":"1234","role":"user","exp":1767225600}
```

关键认知：**payload 是明文可读的**，只是被 Base64 编码，不是加密。任何放进 JWT 的东西都必须假设攻击者能看到。

## 五类缺陷

### 1. alg: none

老库默认信任 header 里的 `alg`：

```
{"alg":"none","typ":"JWT"}  +  空签名
```

服务端如果按 header 选算法，就会跳过验签。现代库已默认拒绝，但自研实现常见。

### 2. 弱密钥（HS256）

HS256 是对称签名，密钥一旦可猜就能伪造任意 payload。

```bash
# 用字典爆破（靶场/授权环境）
hashcat -m 16500 jwt.txt ~/wordlists/rockyou.txt

# 或用 jwt_tool
python3 jwt_tool.py <JWT> -C -d ~/wordlists/rockyou.txt
```

常见弱密钥：`secret`、`password`、`changeme`、项目名、`your-256-bit-secret`（官方示例默认值）。

### 3. kid 注入

`kid` 是 header 里用来指定密钥的字段，实现不当会变成注入点：

```json
{"alg":"HS256","kid":"../../../../dev/null"}
```

配合"从文件读密钥"的实现，签名密钥变成空字符串，可直接伪造。

如果 `kid` 被拼进 SQL 查询（`SELECT key FROM keys WHERE id='<kid>'`），就是 SQL 注入；如果被拼进命令，就是命令执行。

### 4. jku / x5u 指向攻击者

```json
{"alg":"RS256","jku":"https://attacker.com/jwks.json"}
```

服务端如果直接请求 `jku` 拿公钥，攻击者用自己的私钥签名、把自己的公钥挂上去即可通过验证。

正确实现必须**白名单校验 jku 域名**。

### 5. RS256 → HS256 算法混淆

服务端本应用 RS256 验签（公钥），攻击者把 header 改成 HS256，再用**公钥内容作为 HMAC 密钥**签名。若服务端按 header 选算法，就会用公钥当对称密钥验签 —— 通过。

根因：**算法由用户输入决定**。

## 其他问题

| 问题 | 表现 |
|---|---|
| 未校验 `exp` | 令牌永不过期 |
| 未校验 `aud` / `iss` | 一个系统的令牌可用于另一个系统 |
| 未校验签名 | 只做了 Base64 解码 |
| 敏感信息泄露 | 手机号、身份证号、内部角色名放在 payload |
| 无吊销机制 | 登出后旧 token 仍然有效 |
| 存储位置不当 | 放 localStorage → XSS 可直接读 |

## 测试清单

- [ ] 把 `alg` 改成 `none`，删掉签名，是否仍通过
- [ ] 是否泄露密钥（前端代码、GitHub、默认值）
- [ ] `kid` 是否可注入（路径穿越 / SQL / 命令）
- [ ] `jku` / `x5u` 是否可指向外部
- [ ] 算法混淆（RS256 ↔ HS256）是否可行
- [ ] 修改 payload 中 `role`/`sub` 后是否被拒
- [ ] `exp` 是否真的校验（改到过去/未来）
- [ ] 登出后旧 token 是否失效

工具：`jwt_tool`、Burp 的 JWT Editor 插件。

## 正确实现

```js
// 1. 固定算法，不从 header 读
jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] });

// 2. 校验全部声明
jwt.verify(token, key, {
  algorithms: ['RS256'],
  audience: 'api.example.com',
  issuer: 'https://auth.example.com',
  clockTolerance: 30,
});

// 3. 强密钥（HS256 至少 32 字节随机）
// 4. 短有效期 + refresh token
// 5. 关键操作二次校验（改密码、转账）
```

设计层面：

- 令牌里只放**标识**（`sub`），角色/权限每次从服务端查
- 需要即时吊销 → 用服务端 session 或维护黑名单
- 前端存储：`HttpOnly` Cookie + `SameSite` 优于 localStorage

## 相关

- [[xss]] — localStorage 存 token 的连带风险
- [[lateral-movement]] — 拿到令牌后的横向
