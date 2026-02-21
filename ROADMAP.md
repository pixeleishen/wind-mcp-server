# 量化研究平台 — 全流程路线图

## 总体架构

```
Wind API
   │  Python bridge → Express :3001 → React UI :5173
   │
   ▼
[阶段一] 本地数据库          ✅ 已完成
   │  PostgreSQL — raw / processed / factors 三层 schema
   │
   ▼
[阶段二] 数据入库管道（ETL）  ✅ 已完成
   │  Wind API → Python ETL → PostgreSQL
   │  增量更新 + SSE 实时日志
   │
   ▼
[阶段三] LLM 辅助数据清洗    ✅ 已完成
   │  LLM 读取 schema + 样本数据 → 生成清洗脚本
   │  支持 OpenAI / Anthropic / DeepSeek / Gemini / Ollama
   │
   ▼
[阶段四] 因子生产            ⏳ 待推进
   │  用户提供论文 → LLM 生成因子代码
   │  因子值写入 factors schema + 前端展示
   │
   ▼
[阶段五] 组合优化            ⏳ 待推进
   │  因子 → 权重 → 策略回测
```

---

## 执行状态

| 阶段 | 状态 | 交付物 |
|------|------|--------|
| 一：数据库搭建 | ✅ 已完成 | SQL schema，raw/processed/factors 三层 |
| 二：ETL 管道 | ✅ 已完成 | 交易日历/行情/基本面/宏观 入库脚本 |
| 三：数据清洗 | ✅ 已完成 | LLM 聊天式清洗界面 + 多 Provider 支持 |
| Wind API 全覆盖 | ✅ 已完成 | 11 个函数 + Excel 导入 + 前端校验 |
| 四：因子生产 | ⏳ 待推进 | 需用户提供因子论文 |
| 五：组合优化 | ⏳ 待推进 | 需用户提供组合优化论文 |

---

## 已完成功能明细

### Wind API 数据查询
- 11 个 Wind 函数全覆盖：WSD / WSS / WSQ / WST / WSET / WSES / WSEE / EDB / TDAYS / TDAYSOFFSET / TDAYSCOUNT
- WSD 多codes+多fields 自动逐个查询合并（绕过 Wind API 三维限制）
- 前端校验：WST 仅单品种、WSES 仅单指标
- Excel 批量导入证券代码和时间范围
- Tab 键快速填充推荐参数
- 中文函数说明和指标提示

### 数据入库（ETL）
- 交易日历、日度行情、基本面指标、宏观数据
- 增量更新（只拉取缺失日期）
- SSE 实时日志流推送到前端

### LLM 数据清洗
- 聊天式交互界面
- 自动读取数据库 schema 作为上下文
- 多 Provider：OpenAI / Anthropic / DeepSeek / Gemini / Ollama
- 服务端密钥 + 客户端密钥双模式

### 基础设施
- MCP Server（stdio transport，供 Claude 等 LLM 客户端调用）
- Express API（HTTP :3001，供 Web UI 调用）
- React + Vite 前端（查询 / ETL / 清洗 / 设置 四个 Tab）
- PostgreSQL 三层 schema（raw / processed / factors）

---

## 已确认选型

| 项目 | 选择 |
|------|------|
| 数据库 | 本地 PostgreSQL |
| 前端图表库 | Recharts |
| 优化器 | cvxpy（主）/ scipy.optimize（备选） |
| LLM | 多 Provider 可切换 |

---

## 阶段四：因子生产 ⏳

### 前置条件
阶段三完成 + 用户提供因子论文。

### 工作流
1. 用户提供论文 PDF → LLM 阅读并生成因子伪代码
2. 伪代码转为正式 Python，读取 `processed.*`，写入 `factors.*`
3. 前端新增"因子展示"页面

### 因子表结构
```sql
CREATE TABLE factors.values (
    factor_name TEXT    NOT NULL,
    code        TEXT    NOT NULL,
    trade_date  DATE    NOT NULL,
    value       FLOAT,
    PRIMARY KEY (factor_name, code, trade_date)
);
```

### 前端展示
- 表格视图：因子名 × 资产 × 日期，支持筛选排序
- 时序折线图（单因子 × 多资产）
- 截面分布直方图（单日 × 全资产）
- 因子相关性热力图

---

## 阶段五：组合优化 ⏳

### 前置条件
阶段四完成 + 用户提供组合优化论文。

### 工作流
1. 用户提供组合优化论文 → LLM 生成优化器伪代码
2. 伪代码转为正式 Python
3. 优化器读取 `factors.*`，输出权重向量
4. 回测引擎计算策略净值

### 回测指标
- 累计收益率 / 年化收益率
- 最大回撤
- 夏普比率 / 卡玛比率
- 换手率
