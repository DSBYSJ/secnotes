// 知识分类（手工维护，不参与自动生成）
// id 必须与 content/notes/ 下的子目录名一致
window.CATEGORIES = [
  {
    id: 'basics',
    name: '基础与方法论',
    short: '基础',
    desc: '流程、授权边界、测试规范。决定一次测试能不能收尾。',
  },
  {
    id: 'recon',
    name: '信息收集',
    short: '侦察',
    desc: '资产、端口、目录、指纹。80% 的时间花在这里。',
  },
  {
    id: 'web',
    name: 'Web 漏洞',
    short: 'Web',
    desc: '注入、上传、包含、SSRF —— 渗透测试的主战场。',
  },
  {
    id: 'auth',
    name: '认证与会话',
    short: '认证',
    desc: '令牌、单点登录、权限模型。绕过登录往往比拿 shell 更值钱。',
  },
  {
    id: 'post',
    name: '后渗透与内网',
    short: '内网',
    desc: '提权、凭据、横向、隧道。从一台机器到一片网络。',
  },
  {
    id: 'report',
    name: '报告与合规',
    short: '报告',
    desc: '把发现变成客户能执行的动作，这才是交付。',
  },
  {
    id: 'labs',
    name: '实战复盘',
    short: '实战',
    desc: '靶场与项目的复盘记录。从「实战台」导出，也可以手写。',
  },
];
