// 学习路径（手工维护）
// item.note 填笔记 id 即可在任务后面挂"阅读笔记"入口
window.ROADMAP = {
  stages: [
    {
      id: 's1',
      name: '第一阶段 · 打地基',
      weeks: '2–3 周',
      goal: '能独立描述一次 HTTP 请求从浏览器到服务器的全过程，能在 Linux 里完成日常操作。',
      items: [
        { id: 's1-1', text: 'TCP/IP 与 HTTP 基础：三次握手、状态码、请求头、Cookie 机制' },
        { id: 's1-2', text: 'DNS 解析链路：递归、权威、CNAME、TTL' },
        { id: 's1-3', text: 'Linux 常用命令与权限模型（rwx、属主、SUID）' },
        { id: 's1-4', text: 'Python 基础：能读写文件、发 HTTP 请求、处理 JSON' },
        { id: 's1-5', text: '读完授权边界笔记，能说出"什么不能做"', note: 'legal-boundary' },
        { id: 's1-6', text: '本地搭起 DVWA + sqli-labs（Docker 或 phpstudy）' },
        { id: 's1-7', text: '装好 Burp Suite 并成功抓到一个 HTTPS 请求' },
      ],
    },
    {
      id: 's2',
      name: '第二阶段 · Web 核心漏洞',
      weeks: '4–6 周',
      goal: '对每个核心漏洞能说清：原理、怎么找、怎么验证、怎么修。',
      items: [
        { id: 's2-1', text: '渗透测试流程与方法论', note: 'methodology' },
        { id: 's2-2', text: 'SQL 注入：在 sqli-labs 刷完前 30 关', note: 'sqli-basics' },
        { id: 's2-3', text: 'XSS：三类都能手工构造并解释上下文差异', note: 'xss' },
        { id: 's2-4', text: '文件上传：upload-labs 通过 15 关以上', note: 'upload' },
        { id: 's2-5', text: '文件包含：能读出源码并解释封装器原理', note: 'lfi' },
        { id: 's2-6', text: 'SSRF：能判断盲/非盲，说清云元数据的风险', note: 'ssrf' },
        { id: 's2-7', text: 'JWT：完成 PortSwigger 的 JWT 全部实验', note: 'jwt' },
        { id: 's2-8', text: 'PortSwigger Academy 完成全部 Apprentice 级实验' },
      ],
    },
    {
      id: 's3',
      name: '第三阶段 · 工具链与实战',
      weeks: '4–6 周',
      goal: '拿到一个陌生目标，能自己规划信息收集顺序并跑通完整链路。',
      items: [
        { id: 's3-1', text: '被动侦察全流程跑通一次', note: 'recon-passive' },
        { id: 's3-2', text: '主动侦察：端口 → vhost → 目录 → 参数', note: 'recon-active' },
        { id: 's3-3', text: '独立完成 10 台 TryHackMe / HTB 机器' },
        { id: 's3-4', text: '为每台机器写一篇自己的 WP（含失败路径）' },
        { id: 's3-5', text: '掌握 ffuf 的过滤参数，能排除自定义 404 干扰' },
        { id: 's3-6', text: '用 sqlmap 的 -r 模式复现一次注入（授权环境）' },
      ],
    },
    {
      id: 's4',
      name: '第四阶段 · 内网与交付',
      weeks: '4 周+',
      goal: '能从一台 Web 服务器走到内网，并把过程写成客户能看懂的报告。',
      items: [
        { id: 's4-1', text: 'Linux 提权清单过一遍，在靶场实践 5 种路径', note: 'linux-privesc' },
        { id: 's4-2', text: '域基础：Kerberos、SPN、ACL、组策略' },
        { id: 's4-3', text: '用 BloodHound 找出到域管的最短路径', note: 'lateral-movement' },
        { id: 's4-4', text: '搭一条 chisel / ligolo-ng 隧道并扫通内网段' },
        { id: 's4-5', text: '写一份完整报告：执行摘要 + 漏洞详情 + 修复建议', note: 'report-writing' },
        { id: 's4-6', text: '复现 3 个近两年的 CVE，记录环境与验证过程' },
        { id: 's4-7', text: '把本站当作长期知识库，每周至少补一篇' },
      ],
    },
  ],
};
