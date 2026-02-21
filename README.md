# wind-mcp-server

Wind 金融终端 MCP Server + Web 数据查询平台。通过 Python Bridge 将 Wind 终端数据暴露给 LLM（MCP 协议）和 Web UI。

## 架构

```
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌───────────────┐
│  React UI   │────▶│ Express API  │────▶│ Python Bridge │────▶│ Wind Terminal │
│  :5173      │     │ :3001        │     │ wind_bridge.py│     │ (WindPy)      │
└─────────────┘     └──────────────┘     └───────────────┘     └───────────────┘
                           │
┌─────────────┐            │
│  LLM Client │────────────┘  (MCP stdio transport via index.js)
│  (Claude等) │
└─────────────┘
```

## 支持的 Wind API 函数

| 函数 | 说明 | 多codes | 多fields | 备注 |
|------|------|---------|----------|------|
| WSD | 日期序列数据 | ✓ | ✓ | 多codes+多fields时自动逐个查询 |
| WSS | 日截面数据 | ✓ | ✓ | 单时间点，支持多品种多指标 |
| WSQ | 实时行情快照 | ✓ | ✓ | |
| WST | 日内Tick数据 | ✗ 单品种 | ✓ | 近7个交易日 |
| WSET | 数据集报表 | — | — | 板块成分/指数成分等 |
| WSES | 板块日序列 | ✓ | ✗ 单指标 | |
| WSEE | 板块日截面 | ✓ | ✓ | |
| EDB | 宏观经济数据库 | ✓ | — | codes即指标代码 |
| TDAYS | 交易日历 | — | — | |
| TDAYSOFFSET | 日期偏移 | — | — | |
| TDAYSCOUNT | 交易日计数 | — | — | |

## 前置条件

- Wind 终端已安装并登录
- Python 3.7+（WindPy 可访问）
- Node.js 18+

## 安装

```bash
npm install
pip install openpyxl
npm run build
```

## 运行

```bash
# 启动后端 API 服务
npm run server

# 启动前端开发服务
npm run dev:ui

# 启动 MCP Server（stdio，供 LLM 客户端使用）
npm start
```

## 功能特性

### Web UI 数据查询
- 11 个 Wind API 函数的可视化查询表单
- 每个函数带中文说明和推荐参数提示
- Tab 键快速填充 placeholder 内容
- 前端校验多维查询限制（WST 单品种、WSES 单指标）

### Excel 批量导入
- 支持从 Excel 文件导入证券代码和时间范围
- 自动识别中英文表头（code/股票代码/Wind代码、开始日期/结束日期）
- 上传 Excel 后 codes/beginTime/endTime 字段自动变为可选

### 数据入库（ETL）
- 交易日历、日度行情、基本面指标、宏观数据入库
- 支持增量更新
- SSE 实时日志流

### LLM 数据清洗
- 聊天式交互界面
- 支持 OpenAI / Anthropic / DeepSeek / Gemini / Ollama
- 自动读取数据库 schema 作为上下文

### LLM 设置
- 多 Provider 支持，服务端密钥 + 客户端密钥双模式
- 连接测试

## MCP 客户端配置

```json
{
  "mcpServers": {
    "wind": {
      "command": "node",
      "args": ["C:/Users/Pixel/Projects/wind-mcp-server/dist/index.js"]
    }
  }
}
```

## 项目结构

```
src/
├── index.ts                 MCP Server 入口（stdio transport）
├── server.ts                Express API 服务（HTTP :3001）
├── bridge/
│   ├── runner.ts            Python 子进程调用
│   └── types.ts             请求/响应类型定义
├── python/
│   ├── wind_bridge.py       CLI 分发器：解析 JSON → 路由到 handler
│   ├── excel_reader.py      Excel 文件读取（openpyxl）
│   ├── utils.py             WindData 序列化、错误码映射、结果合并
│   └── handlers/
│       ├── wsd.py           日期序列（多codes+多fields自动拆分）
│       ├── wss.py           日截面
│       ├── wsq.py           实时行情
│       ├── wst.py           日内Tick
│       ├── wset.py          数据集报表
│       ├── wses.py          板块日序列
│       ├── wsee.py          板块日截面
│       ├── edb.py           宏观经济
│       ├── tdays.py         交易日历
│       ├── tdaysoffset.py   日期偏移
│       └── tdayscount.py    交易日计数
└── ui/                      React 前端
    ├── App.tsx              主页面（查询/ETL/清洗/设置 四个 Tab）
    ├── api/client.ts        API 客户端（支持 JSON 和 FormData 上传）
    ├── config/
    │   ├── windFunctions.ts Wind 函数配置（字段、提示、校验规则）
    │   └── llmConfig.ts     LLM Provider 配置
    ├── components/          表单、结果表格、状态指示器等
    └── pages/               ETL、数据清洗、LLM 设置页面

db/                          PostgreSQL DDL
etl/                         数据入库脚本
docus/                       Wind API 文档
testdata/                    测试用 Excel 文件
config/                      LLM 密钥配置（已 gitignore）
```

## 测试

```bash
# 测试 Python Bridge（需要 Wind 终端运行）
python src/python/wind_bridge.py '{"function":"tdays","params":{"beginTime":"2025-01-01","endTime":"2025-01-31"}}'

# 测试 Excel 导入
python src/python/wind_bridge.py '{"function":"wsd","params":{"fields":"close","excelPath":"testdata/sample_codes.xlsx"}}'
```

## 常见问题

| 错误 | 原因 | 解决 |
|------|------|------|
| Wind start failed / ErrorCode: -2 | Wind 终端未运行或未登录 | 启动并登录 Wind 终端 |
| No module named 'WindPy' | WindPy 不在 Python 路径 | 在 Wind 终端执行"插件修复" |
| ErrorCode: -40522018 | WSD 不支持多codes+多fields | 已自动处理，逐个查询 |
| ErrorCode: -40520007 | 数据权限不足 | 检查 Wind 账号数据权限 |
| Python bridge exited with code 1 | Python 执行出错 | 查看后端终端日志 |
