---
title: 文件上传：校验绕过与安全设计
category: web
tags: [文件上传, Webshell, 绕过]
summary: 上传点的问题从来不是"能不能传上去"，而是"传上去之后能不能被执行"。从校验层级到解析漏洞一次说清。
level: 2
minutes: 15
order: 3
updated: 2026-10-27
---

# 文件上传：校验绕过与安全设计

> [!WARNING]
> 本笔记不提供任何 Webshell 代码。学习上传漏洞的正确方式是：在 DVWA / upload-labs 这类本地靶场里，理解**每一层校验为什么失效**。

## 问题的本质

上传漏洞的完整条件是两条同时成立：

1. 文件**传上去了**（绕过上传校验）
2. 文件**被执行了**（服务端把上传目录当代码目录）

只满足第一条，最多是存储型 XSS 或磁盘占满。真正致命的是第二条。

## 校验的五个层级

| 层级 | 校验内容 | 绕过思路 |
|---|---|---|
| 前端 | `accept`、JS 扩展名检查 | 抓包直接改，前端校验等于没有 |
| MIME | `Content-Type` 头 | 改成 `image/png` |
| 扩展名黑名单 | `php`、`jsp`、`asp` 被禁 | 找遗漏后缀、大小写、多后缀 |
| 扩展名白名单 | 只允许 `jpg/png` | 需要配合解析漏洞或二次渲染 |
| 内容检测 | 文件头、二次渲染、杀软 | 图片马、二次渲染后重新注入 |

> [!TIP]
> 只做**前端校验**的上传点是常见配置错误，也是最容易被误判为"安全"的地方——安全工程师用浏览器测，攻击者用 Burp 测。

## 扩展名绕过：常见思路

### 1. 黑名单遗漏

不同中间件的可执行后缀远超 `php`：

```
php3 php4 php5 php7 phps phtml pht phar
jsp jspx jspf
asp aspx asa cer cdx
```

黑名单永远列不全，这就是**必须用白名单**的原因。

### 2. 大小写与空格

Windows 下大小写不敏感：`PhP`、`pHp`。
部分环境会去掉尾部空格或点：`shell.php `、`shell.php.`。

### 3. 多后缀解析（Apache）

`AddHandler application/x-httpd-php .php` 的配置下，`shell.php.jpg` 会被当成 PHP 执行——Apache 从右往左找可识别的 handler，但 `mod_mime` 可能把多个扩展名都映射上。

`AddType` 与 `AddHandler` 的行为差异，是这个漏洞存在多种变体的原因。

### 4. `%00` 截断

老版本 PHP（< 5.3.4）中，`shell.php%00.jpg` 会在底层 C 函数处截断，最终落盘为 `shell.php`。现代版本已修复，但在老旧系统里仍会遇到。

### 5. `.htaccess` / `web.config`

如果允许上传任意文件且目录可访问，上传一个配置文件就能让普通图片被当代码执行：

```apache
# .htaccess 内容示意（仅靶场环境）
AddType application/x-httpd-php .jpg
```

防御要点：**上传目录禁止解析、禁止 `.htaccess` 生效**（`AllowOverride None`）。

### 6. 条件竞争

逻辑是：先落盘 → 再校验 → 不合格就删除。
如果在"落盘"和"删除"之间的毫秒级窗口里访问该文件，就能执行。

这类漏洞在 CTF 里常见，真实业务里也存在（尤其是大文件分片上传 + 异步审核）。

## 解析漏洞：不靠后缀

| 环境 | 特征 |
|---|---|
| Apache 多后缀 | `1.php.jpg` 可能被解析为 PHP |
| IIS 6 目录解析 | `/upload/shell.asp/1.jpg` |
| IIS 6 分号 | `shell.asp;.jpg` |
| Nginx `cgi.fix_pathinfo` | `/upload/1.jpg/x.php` 被交给 PHP 处理 |
| PHP-FPM 路径截断 | 老版本 `fastcgi_split_path_info` 配置不当 |

判断方式：**看 `Server` 头 + 试探路径变体**，而不是猜。

## 图片马与二次渲染

服务端如果对图片做了重新编码（GD/ImageMagick），直接插入的代码会被抹掉。绕过思路是找到**重新编码后仍然保留的元数据区域**（EXIF、注释段），或者利用渲染库本身的漏洞。

这也是为什么"上传点必须配合文件包含/解析漏洞才有杀伤力"——单独一个图片马，需要另一个入口去包含它。

## 安全设计（正确做法）

1. **白名单**扩展名 + **服务端重命名**（UUID，不保留原名）
2. 校验**文件头魔数**，不只是扩展名
3. 上传目录 **禁止脚本执行**（Nginx `location ^~ /uploads/ { ... }` 不转发给 PHP）
4. 图片做**二次渲染**，去掉元数据
5. 文件存**对象存储**，域名与主站分离（天然不解析）
6. 大小限制 + 频率限制 + 病毒扫描
7. 下载走**鉴权代理**，不直接暴露路径

```
# Nginx 关键配置示意
location ^~ /uploads/ {
    location ~ \.(php|php5|phtml)$ { deny all; }
    add_header Content-Disposition "attachment";
}
```

## 测试清单

- [ ] 前端校验是否可绕过（抓包改后缀）
- [ ] 服务端是否校验 MIME / 文件头
- [ ] 黑名单是否遗漏冷门后缀
- [ ] 上传目录是否可访问、是否解析脚本
- [ ] 是否允许 `.htaccess` / `web.config`
- [ ] 文件名是否可控（路径穿越：`../../shell.jpg`）
- [ ] 二次渲染是否保留元数据
- [ ] 大文件分片是否绕过校验

## 相关

- [[lfi]] — 上传 + 包含的组合拳
- [[xss]] — 上传 SVG/HTML 造成存储型
