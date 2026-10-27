// 本文件由 tools/build-index.js 自动生成，请勿手改。
// 重新生成：node tools/build-index.js
// 生成时间：2026-10-27 09:12:33
window.LIBRARY = {
  "generatedAt": "2026-10-27 09:12:33",
  "count": 13,
  "notes": [
    {
      "id": "jwt",
      "title": "JWT 与会话令牌的常见缺陷",
      "category": "auth",
      "tags": [
        "JWT",
        "认证",
        "会话"
      ],
      "summary": "结构、五类典型缺陷（alg:none、弱密钥、kid 注入、jku、算法混淆）、验证清单与正确实现。",
      "level": 2,
      "minutes": 12,
      "order": 1,
      "updated": "2026-10-27",
      "file": "notes/auth/jwt.md"
    },
    {
      "id": "methodology",
      "title": "渗透测试标准流程与方法论",
      "category": "basics",
      "tags": [
        "流程",
        "PTES",
        "方法论"
      ],
      "summary": "把一次测试拆成七个阶段：定范围、收集、建模、验证、利用、后渗透、报告。跳过任何一步，后面都要加倍偿还。",
      "level": 1,
      "minutes": 12,
      "order": 1,
      "updated": "2026-10-27",
      "file": "notes/basics/methodology.md"
    },
    {
      "id": "legal-boundary",
      "title": "授权边界：什么能做，什么不能做",
      "category": "basics",
      "tags": [
        "合规",
        "授权",
        "法律"
      ],
      "summary": "渗透测试与入侵的区别只有两个字——授权。这篇笔记整理授权书要素、常见越界场景与自保动作。",
      "level": 1,
      "minutes": 8,
      "order": 2,
      "updated": "2026-10-27",
      "file": "notes/basics/legal-boundary.md"
    },
    {
      "id": "linux-privesc",
      "title": "Linux 提权检查清单",
      "category": "post",
      "tags": [
        "提权",
        "Linux",
        "后渗透"
      ],
      "summary": "拿到普通 shell 之后按顺序过一遍：身份、内核、SUID、sudo、定时任务、可写文件、能力、容器。",
      "level": 3,
      "minutes": 18,
      "order": 1,
      "updated": "2026-10-27",
      "file": "notes/post/linux-privesc.md"
    },
    {
      "id": "lateral-movement",
      "title": "内网横向：立足点之后的路径",
      "category": "post",
      "tags": [
        "内网",
        "域渗透",
        "隧道",
        "检测"
      ],
      "summary": "从一台机器到整个域，靠的不是单个漏洞，而是凭据复用 + 网络可达 + 权限配置。附隧道选型与日志痕迹。",
      "level": 3,
      "minutes": 20,
      "order": 2,
      "updated": "2026-10-27",
      "file": "notes/post/lateral-movement.md"
    },
    {
      "id": "recon-passive",
      "title": "被动侦察：资产与指纹收集",
      "category": "recon",
      "tags": [
        "信息收集",
        "OSINT",
        "子域"
      ],
      "summary": "不发一个数据包，先把目标的资产面摸清：证书日志、DNS 历史、代码泄露、搜索引擎语法。",
      "level": 1,
      "minutes": 15,
      "order": 1,
      "updated": "2026-10-27",
      "file": "notes/recon/recon-passive.md"
    },
    {
      "id": "recon-active",
      "title": "主动侦察：端口、目录与参数发现",
      "category": "recon",
      "tags": [
        "信息收集",
        "nmap",
        "ffuf",
        "目录爆破"
      ],
      "summary": "开始发包之后的顺序：先端口，再服务，再目录，最后参数。附限速与结果归档的实践约定。",
      "level": 2,
      "minutes": 16,
      "order": 2,
      "updated": "2026-10-27",
      "file": "notes/recon/recon-active.md"
    },
    {
      "id": "report-writing",
      "title": "报告撰写与风险评级",
      "category": "report",
      "tags": [
        "报告",
        "CVSS",
        "沟通"
      ],
      "summary": "一份能推动修复的报告：执行摘要讲业务，技术细节讲复现，风险评级讲依据而不是感觉。",
      "level": 1,
      "minutes": 10,
      "order": 1,
      "updated": "2026-10-27",
      "file": "notes/report/report-writing.md"
    },
    {
      "id": "sqli-basics",
      "title": "SQL 注入：从探测到验证",
      "category": "web",
      "tags": [
        "SQL注入",
        "sqlmap",
        "数据库"
      ],
      "summary": "注入点怎么找、六种注入类型怎么区分、验证到什么程度算够，以及为什么预编译才是真修复。",
      "level": 2,
      "minutes": 20,
      "order": 1,
      "updated": "2026-10-27",
      "file": "notes/web/sqli-basics.md"
    },
    {
      "id": "xss",
      "title": "XSS：三类注入与防御视角",
      "category": "web",
      "tags": [
        "XSS",
        "前端安全",
        "CSP"
      ],
      "summary": "反射、存储、DOM 三类的差别不在 payload，而在\"数据从哪来、在哪落地\"。上下文决定一切。",
      "level": 2,
      "minutes": 14,
      "order": 2,
      "updated": "2026-10-27",
      "file": "notes/web/xss.md"
    },
    {
      "id": "upload",
      "title": "文件上传：校验绕过与安全设计",
      "category": "web",
      "tags": [
        "文件上传",
        "Webshell",
        "绕过"
      ],
      "summary": "上传点的问题从来不是\"能不能传上去\"，而是\"传上去之后能不能被执行\"。从校验层级到解析漏洞一次说清。",
      "level": 2,
      "minutes": 15,
      "order": 3,
      "updated": "2026-10-27",
      "file": "notes/web/upload.md"
    },
    {
      "id": "lfi",
      "title": "文件包含与路径穿越",
      "category": "web",
      "tags": [
        "LFI",
        "路径穿越",
        "伪协议"
      ],
      "summary": "include 的参数一旦可控，读文件只是起点。封装器、日志包含、临时文件，三条常见链路与对应防御。",
      "level": 2,
      "minutes": 13,
      "order": 4,
      "updated": "2026-10-27",
      "file": "notes/web/lfi.md"
    },
    {
      "id": "ssrf",
      "title": "SSRF：让服务器替你访问内网",
      "category": "web",
      "tags": [
        "SSRF",
        "内网",
        "云元数据"
      ],
      "summary": "服务端请求伪造的价值在于\"位置\"——它站在内网里。协议、云元数据、DNS 重绑定与防御要点。",
      "level": 2,
      "minutes": 14,
      "order": 5,
      "updated": "2026-10-27",
      "file": "notes/web/ssrf.md"
    }
  ]
};
