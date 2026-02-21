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

# 查看所有表
psql -U quant -d quantdb -c "\dt raw.*"
```

## Schema 说明

| Schema | 用途 |
|--------|------|
| `raw` | Wind 原始数据，只写入不修改 |
| `processed` | 清洗/加工后数据，因子计算的输入 |
| `factors` | 因子值，因子模型的输出 |

## 主要表

| 表 | 说明 |
|----|------|
| `raw.trading_calendar` | 交易日历 |
| `raw.assets` | 资产主表（股票/指数/基金/期货） |
| `raw.daily_prices` | 日度行情 |
| `raw.daily_fundamentals` | 快照基本面指标（PE/PB/市值等） |
| `raw.macro_indicators` | 宏观经济指标 |
| `factors.values` | 因子值 |
