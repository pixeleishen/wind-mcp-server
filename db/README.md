# 数据库启动说明

## 前置条件

- [PostgreSQL](https://www.postgresql.org/download/windows/) 已安装并运行

## 初始化

```bash
# 创建用户和数据库
psql -U postgres -c "CREATE USER quant WITH PASSWORD 'quant123';"
psql -U postgres -c "CREATE DATABASE quantdb OWNER quant;"

# 执行建表脚本
psql -U quant -d quantdb -f db/init/01_schema.sql
```

## 连接信息

| 参数 | 值 |
|------|----|
| Host | `localhost` |
| Port | `5432` |
| Database | `quantdb` |
| User | `quant` |
| Password | `quant123` |

连接字符串：
```
postgresql://quant:quant123@localhost:5432/quantdb
```

## 常用命令

```bash
# 检查 PostgreSQL 是否运行
pg_isready

# 进入 psql
psql -U quant -d quantdb

# 查看各 schema 的表
psql -U quant -d quantdb -c "\dt meta.*"
psql -U quant -d quantdb -c "\dt raw.*"
psql -U quant -d quantdb -c "\dt processed.*"
psql -U quant -d quantdb -c "\dt factors.*"
```

## Schema 分层

| Schema | 用途 |
|--------|------|
| `meta` | 元数据、标签体系、Query 模板、关联映射 |
| `raw` | Wind API 原始数据（不可变） |
| `processed` | 清洗/加工后的标准化时序数据 |
| `factors` | 因子值 |

## 主要表

### meta（元数据层）

| 表 | 说明 |
|----|------|
| `meta.macro_scenarios` | 宏观场景定义（如：宽货币紧信用） |
| `meta.indicators` | 指标元数据，含分类标签与变化量属性 |
| `meta.assets` | 资产标的元数据（股票/债券/商品/指数等） |
| `meta.correlation_mappings` | 场景-指标-资产关联映射 |
| `meta.wind_query_templates` | MCP 保存的 Wind Query 模板 |

### raw（原始数据层）

| 表 | 说明 |
|----|------|
| `raw.trading_calendar` | 交易日历 |
| `raw.daily_prices` | 日度行情（wsd），通过 asset_id 关联 meta.assets |
| `raw.indicator_series` | 指标时序数据（edb/wss），通过 indicator_id 关联 meta.indicators |

### processed（清洗后数据层）

| 表 | 说明 |
|----|------|
| `processed.cleaned_series` | 标准化时序（ma_20 / daily_return / volatility_20d / yoy 等） |

### factors（因子层）

| 表 | 说明 |
|----|------|
| `factors.values` | 因子值，含因子类型分类（动量/价值/质量/宏观等） |
