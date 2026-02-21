# 量化研究平台 — 全流程路线图

## 背景

Wind API 数据接口已打通（Python bridge + Express API :3001 + React UI :5173 均已完成）。
本文档规划从原始数据入库，到因子构建、组合优化的完整工程路径。

---

## 总体架构

```
Wind API
   │  (已完成) Python bridge → Express :3001 → React UI :5173
   │
   ▼
[阶段一] 本地数据库
   │  PostgreSQL — 本地安装，标准 SQL
   │  资产代码 × 交易日 为主键，指标列按需挂载
   │
   ▼
[阶段二] 数据入库管道
   │  Wind API → Python ETL 脚本 → 数据库
   │  静态指标（无时间轴）自动 forward-fill 到全部交易日
   │
   ▼
[阶段三] LLM 辅助数据清洗
   │  LLM 读取 raw data schema，生成清洗/加工脚本
   │  清洗后数据存入独立 schema（processed）
   │
   ▼
[阶段四] 因子生产
   │  用户提供论文 → LLM 生成伪代码 → 正式 Python 代码
   │  因子值写入数据库 factor schema
   │  React 前端：因子值表格 + 图形化展示
   │
   ▼
[阶段五] 组合优化
   │  用户提供组合优化论文 → LLM 生成伪代码 → 正式 Python 代码
   │  因子 → 权重 → 策略回测结果
```

---

## 已确认选型

| 项目 | 选择 |
|------|------|
| 数据库部署 | 本地 PostgreSQL |
| 前端图表库 | Recharts |
| 初始资产范围 | 阶段二再定，阶段一只建结构 |
| 优化器 | cvxpy（主）/ scipy.optimize（备选） |

---

## 执行顺序

| 阶段 | 状态 | 前置条件 | 交付物 |
|------|------|---------|--------|
| 一：数据库搭建 | ✅ 已完成 | 无 | SQL schema，本地 DB 可连接 |
| 二：ETL 管道 | ✅ 已完成 | 阶段一完成 | Python ETL 脚本，数据可入库 |
| 三：数据清洗 | ⏳ 待推进 | 阶段二有数据 | 清洗脚本 + processed schema |
| 四：因子生产 | ⏳ 待推进 | 阶段三 + 用户提供论文 | 因子代码 + 前端展示页 |
| 五：组合优化 | ⏳ 待推进 | 阶段四 + 用户提供论文 | 优化器代码 + 策略回测页 |

---

## 阶段一：本地数据库搭建 ✅

### 技术选型

- **PostgreSQL**
  - 标准 SQL，Python `psycopg2` / `SQLAlchemy` 直接对接
  - 本地安装，轻量运行

### 文件结构

```
db/
├── init/
│   └── 01_schema.sql        建表 DDL
└── README.md                启动说明
```

### 核心表结构

| 表 | 类型 | 说明 |
|----|------|------|
| `raw.trading_calendar` | 普通表 | 交易日历（tdays 结果） |
| `raw.assets` | 普通表 | 资产主表（股票/指数/基金/期货） |
| `raw.daily_prices` | 普通表 | 日度行情（wsd 结果） |
| `raw.daily_fundamentals` | 普通表 | 快照基本面指标（wss 结果，forward-fill） |
| `raw.macro_indicators` | 普通表 | 宏观经济指标（edb 结果） |
| `factors.values` | 普通表 | 因子值 |

### Schema 分层

```
raw.*        Wind 原始数据（只写入，不修改）
processed.*  清洗/加工后数据（因子计算的输入）
factors.*    因子值（因子模型的输出）
```

### 静态指标填充规则

- wss/wsq 返回的快照值（如 PE、市值）无时间轴
- ETL 脚本将其 forward-fill 到 `trading_calendar` 中的全部交易日
- 填充方向：向后填充（最新快照值沿用至下次更新）

### 启动方式

```bash
# 创建用户和数据库
psql -U postgres -c "CREATE USER quant WITH PASSWORD 'quant123';"
psql -U postgres -c "CREATE DATABASE quantdb OWNER quant;"

# 执行建表脚本
psql -U quant -d quantdb -f db/init/01_schema.sql
```

连接字符串：`postgresql://quant:quant123@localhost:5432/quantdb`

---

## 阶段二：数据入库管道（ETL）✅

### 设计原则

- 每个 Wind 函数对应一个 ETL 脚本，复用已有 Python bridge
- 支持增量更新（只拉取缺失日期）
- 失败重试 + 日志记录

### 文件结构

```
etl/
├── config.py            数据库连接、Wind 参数配置
├── base.py              公共 upsert 工具函数 + Wind bridge 调用
├── load_tdays.py        交易日历入库
├── load_prices.py       日度行情入库（wsd）
├── load_fundamentals.py 快照指标入库（wss）+ forward-fill
├── load_macro.py        宏观指标入库（edb）
└── run_all.py           按顺序执行全部 ETL
```

### 增量逻辑

```python
last_date = db.query("SELECT MAX(trade_date) FROM daily_prices WHERE code = ?")
missing_dates = trading_calendar[last_date+1 : today]
if missing_dates:
    data = wind_bridge.wsd(code, fields, missing_dates[0], missing_dates[-1])
    db.upsert(data)
```

### 运行方式

```bash
# 安装依赖
pip install psycopg2-binary

# 全量入库（指定资产代码和起始日期）
cd etl
python run_all.py --codes 000001.SZ,600000.SH --start 2020-01-01

# 强制重新拉取（忽略已有数据）
python run_all.py --codes 000001.SZ --no-incremental
```

---

## 阶段三：LLM 辅助数据清洗 ⏳

### 前置条件

阶段二完成，`raw.*` 中有实际数据。

### 工作流

1. LLM 读取数据库 schema + 样本数据
2. 用户描述清洗需求（去极值、标准化、行业中性化等）
3. LLM 生成 Python 清洗脚本
4. 清洗结果写入 `processed` schema，与原始数据隔离

### 常见清洗操作

- 去极值（MAD 法 / 3σ 法）
- 标准化（截面 z-score）
- 行业中性化（回归残差）
- 缺失值处理（行业均值填充 / 线性插值）

---

## 阶段四：因子生产 + 前端展示 ⏳

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

### 前端展示（扩展现有 React UI）

- 新增路由 `/factors`
- 表格视图：因子名 × 资产 × 日期，支持筛选排序
- 图形视图：
  - 时序折线图（单因子 × 多资产）
  - 截面分布直方图（单日 × 全资产）
  - 因子相关性热力图
- 图表库：**Recharts**

---

## 阶段五：组合优化 ⏳

### 前置条件

阶段四完成 + 用户提供组合优化论文。

### 工作流

1. 用户提供组合优化论文 → LLM 生成优化器伪代码
2. 伪代码转为正式 Python
3. 优化器读取 `factors.*`，输出权重向量
4. 回测引擎计算策略净值、夏普比率等指标
5. 前端新增"策略"页面展示回测结果

### 技术选型

| 库 | 用途 |
|----|------|
| `cvxpy` | 凸优化，适合均值-方差、风险平价等标准模型 |
| `scipy.optimize` | 备选，适合自定义目标函数 |

### 回测指标

- 累计收益率 / 年化收益率
- 最大回撤
- 夏普比率 / 卡玛比率
- 换手率
