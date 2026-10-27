---
title: Linux 提权检查清单
category: post
tags: [提权, Linux, 后渗透]
summary: 拿到普通 shell 之后按顺序过一遍：身份、内核、SUID、sudo、定时任务、可写文件、能力、容器。
level: 3
minutes: 18
order: 1
updated: 2026-10-27
---

# Linux 提权检查清单

> [!WARNING]
> 提权操作可能影响系统稳定性（尤其是内核漏洞利用）。在真实项目中，**必须先获得书面许可**，并在快照/可回滚的环境里进行。

## 顺序原则

从"最不容易出事"到"最容易出事"：

```
信息枚举 → 配置缺陷 → 权限配置错误 → 服务缺陷 → 内核漏洞
```

内核 EXP 放最后。它可能直接 panic，而前四类通常只是读写文件。

## 1. 先看清楚自己是谁

```bash
id; whoami; groups
uname -a; cat /etc/os-release
sudo -l
cat /etc/passwd | grep -v nologin
env; echo $PATH
```

要回答三个问题：**我是谁、我在哪台机器、这台机器上还有谁**。

## 2. 内核与补丁

```bash
uname -r
cat /etc/issue
# 对照发行版补丁级别，判断是否有已知本地提权漏洞
```

老内核（2.6/3.x）常见 DirtyCow 一类问题；4.x/5.x 也有各自的历史漏洞。**先看内核版本，再决定要不要查 EXP**。

## 3. SUID / SGID

```bash
find / -perm -4000 -type f 2>/dev/null
find / -perm -2000 -type f 2>/dev/null
```

关注点不是"有没有 SUID"，而是**这个 SUID 程序会不会调用外部命令**：

- `nmap --interactive`（老版本可执行命令）
- `find . -exec /bin/sh -p \; -quit`
- `vim`、`less`、`more`、`man`、`awk`、`tar`、`cp` 的 `-p` 参数
- 自定义脚本被设了 SUID（脚本本身通常不生效，但调用它的二进制可能）

查表：GTFOBins 收录了常见二进制的"逃逸用法"，按程序名查即可。

## 4. sudo 配置

```bash
sudo -l
```

高危模式：

```
(ALL) NOPASSWD: /usr/bin/vim          → vim 内执行 shell
(ALL) NOPASSWD: /usr/bin/find         → -exec
(ALL) NOPASSWD: /usr/bin/systemctl    → 改服务文件
(ALL) NOPASSWD: /bin/tar              → --checkpoint-action
```

还要注意 `sudo` 版本漏洞（如 CVE-2021-3156 Baron Samedit），以及 `sudo` 的环境变量继承（`LD_PRELOAD` 在部分配置下可用）。

## 5. 定时任务

```bash
cat /etc/crontab
ls -la /etc/cron.*
crontab -l
systemctl list-timers --all
```

三个条件同时成立才可利用：

1. 任务以 root 运行
2. 脚本/目录**可写**
3. 执行周期可预期

常见坑：脚本本身不可写，但 `PATH` 里的某个命令可被替换。

## 6. 可写文件与服务配置

```bash
find / -writable -type d 2>/dev/null | grep -v proc
ls -la /etc/passwd /etc/shadow
```

重点：

- `/etc/passwd` 可写 → 直接加 root 用户（少见但存在）
- 服务配置文件可写（`/etc/systemd/system/*.service`）
- Web 目录可写 → 结合 Web 服务提权
- `.bashrc`、`.profile` 可写 → 等管理员登录

## 7. 环境变量与 PATH

```bash
echo $PATH
find / -perm -o+w -type d 2>/dev/null
```

如果一个 root 执行的脚本调用了 `backup.sh` 而没有写绝对路径，而当前目录或 `PATH` 里有可写目录 → 劫持。

`LD_PRELOAD`、`LD_LIBRARY_PATH` 在 sudo 保留环境时同样有效。

## 8. Capabilities

```bash
getcap -r / 2>/dev/null
```

危险能力：

| capability | 含义 |
|---|---|
| `cap_setuid` | 可直接切用户 |
| `cap_setgid` | 同上 |
| `cap_dac_read_search` | 绕过文件读权限 |
| `cap_sys_admin` | 挂载等，几乎等于 root |
| `cap_sys_ptrace` | 注入进程 |

## 9. 容器与云环境

```bash
cat /proc/1/cgroup
ls -la /.dockerenv
mount | grep -E "overlay|proc"
```

- 容器内是 root，但宿主机不是 → 需要逃逸
- `--privileged`、挂载了 `docker.sock`、挂载了宿主机根目录 → 逃逸路径明确
- 云主机 → 检查元数据服务（见 [[ssrf]]）

## 10. 自动化枚举

| 工具 | 特点 |
|---|---|
| `linpeas.sh` | 覆盖最全，输出长，适合扫一遍 |
| `LinEnum.sh` | 轻量 |
| `linux-exploit-suggester` | 只针对内核漏洞 |
| `pspy` | 监控进程与定时任务（无需 root） |

> [!TIP]
> 自动工具会给一堆"红色警告"，其中 90% 不可利用。**判断标准永远是：这个配置能不能让我执行代码或读到敏感文件。**

## 提权之后（克制）

真实项目里，提权成功后的正确动作是：

1. 截图 `id` 输出
2. 记录 `/etc/shadow` 可读性（不导出）
3. 停止，写报告

不要：加账号、改配置、留后门、清日志。

## 相关

- [[lateral-movement]] — 拿到 root 之后往哪走
- [[methodology]] — 受控利用的原则
