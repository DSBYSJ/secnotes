---
title: 文件包含与路径穿越
category: web
tags: [LFI, 路径穿越, 伪协议]
summary: include 的参数一旦可控，读文件只是起点。封装器、日志包含、临时文件，三条常见链路与对应防御。
level: 2
minutes: 13
order: 4
updated: 2026-10-27
---

# 文件包含与路径穿越

## 区别

- **路径穿越（Path Traversal）**：读任意文件，`../../etc/passwd`
- **文件包含（LFI/RFI）**：把文件当**代码**加载执行

前者是信息泄露，后者是代码执行。同一个参数可能同时存在两种问题。

## 常见入口

```php
// 语言包、模板、页面路由
include($_GET['page'] . '.php');
require_once("lang/" . $_COOKIE['lang']);
```

Java 里的 `FileInputStream`、Python 的 `open()` 属于路径穿越；PHP 的 `include`、JSP 的 `<%@ include %>` 才可能升级为代码执行。

## 读文件：从 ../ 开始

```
?file=../../../../etc/passwd
?file=....//....//etc/passwd          # 绕过简单的 ../ 过滤
?file=%2e%2e%2f%2e%2e%2fetc%2fpasswd  # URL 编码
?file=..%252f..%252fetc%252fpasswd    # 双重编码
```

> [!TIP]
> 判断穿越了几层：先用 `../../etc/passwd`，不成功就加一层。Linux 有根目录上限，Windows 可以用 `C:\` 试。

## PHP 封装器

这是 LFI 最有价值的部分，因为能**读出源码**。

### php://filter

```
?file=php://filter/convert.base64-encode/resource=index.php
```

拿到 base64 后解码，得到源码。源码里的数据库密码、密钥、其他漏洞点全在里面。

### php://input / data://

需要 `allow_url_include=On`（默认关闭），现代环境基本不可用，但老系统仍有。

### phar://

`phar://` 可以触发反序列化，属于"文件包含 + 反序列化"的组合，详见反序列化专题。

### zip://

```
?file=zip://uploads/shell.jpg%23shell.php
```

配合上传一个 zip 改名的图片，即可包含内部文件。

## 日志包含

思路：把 PHP 代码写进日志，再包含日志文件。

```
1. 请求一个不存在的路径，UA 里带上代码 → 写入 access.log
2. ?file=../../../../var/log/nginx/access.log
```

前提：日志路径可读、日志内容未被转义、Web 进程有读权限。

同理还有：
- SSH 日志 `/var/log/auth.log`（用户名可控）
- Apache `error.log`
- 邮件日志

## 临时文件包含

PHP 上传文件时会创建临时文件（`/tmp/phpXXXXXX`），请求结束后删除。利用方式是**条件竞争**：在上传请求未结束时，用包含去读那个临时文件。

这类利用需要脚本配合，现实中出现频率低于日志包含。

## Session 文件包含

如果能把代码写进 session（例如用户名、个人简介字段），session 文件路径通常是 `/var/lib/php/sessions/sess_<PHPSESSID>`，直接包含即可。

判断点：**有没有"用户可控内容被存进 session"的功能**。

## 目录穿越的其他形态

| 场景 | 形态 |
|---|---|
| 下载接口 | `download?file=report.pdf` |
| 图片缩放 | `img?path=...&w=100` |
| 模板渲染 | `theme=default` |
| 日志查看 | `log?name=access` |
| ZIP 解压 | 压缩包内条目名带 `../`（Zip Slip） |

Zip Slip 值得单独记：解压时如果不校验条目路径，压缩包里的 `../../../../etc/cron.d/x` 会直接写到系统目录。

## 防御

1. **不要用用户输入拼路径**。用 ID 映射：

```php
$map = ['home' => 'pages/home.php', 'about' => 'pages/about.php'];
$page = $map[$_GET['page']] ?? 'pages/404.php';
include $page;
```

2. 必须用路径时：`basename()` 去目录 + 白名单后缀 + `realpath()` 后校验前缀

```php
$base = realpath(__DIR__ . '/pages');
$target = realpath($base . '/' . basename($input));
if (strpos($target, $base) !== 0) { exit('invalid'); }
```

3. `open_basedir` 限制目录
4. 关闭 `allow_url_include`、`allow_url_fopen`
5. 上传目录不可执行（见 [[upload]]）
6. 日志目录对 Web 进程**不可读**

## 测试清单

- [ ] 参数是否直接拼进 `include`/`require`
- [ ] `../` 过滤是否可绕过（递归替换、编码、`....//`）
- [ ] `php://filter` 是否可用（读源码）
- [ ] 日志路径是否可读、内容是否可控
- [ ] session 中是否有可控内容
- [ ] 下载接口是否校验路径前缀
- [ ] 解压功能是否防 Zip Slip

## 相关

- [[upload]] — 上传 + 包含
- [[ssrf]] — 另一种"让服务器替你访问"
