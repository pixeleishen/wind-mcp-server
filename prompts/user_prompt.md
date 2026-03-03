# ETL Agent — User Prompt 模板

> 此文件在运行时由后端动态填充 `{{变量}}` 后发送给 LLM。
> 对应代码：`etl/run_clean_agent.py`（待实现）

---

请根据以下原始数据样本和目标格式，生成 `process_data(raw_df, target_type, target_id)` 函数。

## 【1. 数据背景信息】

- **数据分类（Tag）**：{{DATA_TAG}}
  （例如：`宏观指标-货币供应` / `资产价格-A股权益` / `宏观指标-信用`）
- **数据名称**：{{DATA_NAME}}
  （例如：`中国 M2 余额` / `沪深300收盘价` / `社会融资规模增量`）
- **Wind 代码**：{{WIND_CODE}}
  （例如：`M0001385` / `000300.SH`）
- **频率**：{{FREQUENCY}}
  （`Daily` / `Monthly` / `Quarterly`）
- **target_type**：{{TARGET_TYPE}}
  （`'asset'` 或 `'indicator'`）
- **target_id**：{{TARGET_ID}}
  （数据库中对应的整数 ID）

## 【2. 原始数据样本（Raw Data Sample）】

以下是从数据库读取的前 10 行样本（JSON 格式）：

```json
{{RAW_DATA_JSON_SAMPLE}}
```

原始表的列名说明：
- `trade_date` / `obs_date`：日期
- `value`（宏观指标）或 `open/high/low/close/volume/pct_chg/adj_factor`（行情）
- `indicator_id` / `asset_id`：来源表主键

## 【3. 目标输出格式（Target Schema）】

你的函数返回的 DataFrame 必须严格包含以下列：

| 列名 | 类型 | 说明 |
|---|---|---|
| `obs_date` | `datetime64[ns]` | 观察日期 |
| `target_type` | `str` | 固定传入值，原样输出 |
| `target_id` | `int` | 固定传入值，原样输出 |
| `raw_value` | `float` | 清洗后的原始绝对数值 |
| `transformed_value` | `float` | 变化量或特征值 |
| `transform_method` | `str` | 你选用的方法标识符 |

**如需输出多种特征（如同时输出 YoY 和 MoM），请返回多行，每种方法一行。**

## 【4. 特殊指令】

请根据该数据的金融经济学含义，选择最合理的变化量计算方式：

- `M2余额`、`社融存量` 等存量型宏观 → `YoY`（同比增速，12期差分/滞后值）
- `新增贷款`、`出口额` 等流量型宏观 → `YoY` 或 `MoM`
- `股票/指数收盘价` → `daily_return`（对数收益率：`ln(Pt/Pt-1)`）
- `股票收盘价` 额外输出 → `volatility_20d`（20日滚动年化波动率）
- 如存在 `adj_factor`，用其计算复权价后再求收益率

函数最后须调用 `upsert()` 将结果写入 `processed.feature_series`，冲突列为
`['obs_date', 'target_type', 'target_id', 'transform_method']`，更新列为 `['raw_value', 'transformed_value']`。

请现在输出你的 Python 代码。
