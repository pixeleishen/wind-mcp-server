export type FieldType = "text" | "date";

export interface FormField {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  hint?: string;
}

export interface WindFunctionConfig {
  id: string;
  label: string;
  description: string;
  fields: FormField[];
  /** Restrict certain fields to single value only (no commas). Key = field key, value = warning message. */
  singleOnly?: Record<string, string>;
}

export const WIND_FUNCTIONS: WindFunctionConfig[] = [
  {
    id: "wsd",
    label: "WSD — 日期序列数据",
    description: "获取证券历史时间序列数据（行情、财务等）。支持多品种单指标或单品种多指标，多品种+多指标时自动逐个查询。",
    fields: [
      { key: "codes",     label: "证券代码", type: "text", required: true,  placeholder: "000001.SZ,600000.SH", hint: "支持多品种，逗号分隔" },
      { key: "fields",    label: "指标",     type: "text", required: true,  placeholder: "open,high,low,close,volume", hint: "常用: open/high/low/close/volume/amt/pct_chg/turn/mkt_cap_ard/pe_ttm/pb_mrq" },
      { key: "beginTime", label: "开始日期", type: "date", required: true },
      { key: "endTime",   label: "结束日期", type: "date", required: true },
      { key: "options",   label: "可选参数", type: "text", required: false, placeholder: "Period=W;PriceAdj=F;Fill=Previous", hint: "Period: D/W/M/Q/S/Y | PriceAdj: F前复权/B后复权 | Fill: Previous/Blank | Days: Trading/Weekdays/Alldays" },
    ],
  },
  {
    id: "wss",
    label: "WSS — 日截面数据",
    description: "获取多品种多指标在某个时间点的截面数据，如PE、市值、财务指标等。",
    fields: [
      { key: "codes",   label: "证券代码", type: "text", required: true,  placeholder: "000001.SZ,600000.SH,601318.SH", hint: "支持多品种，逗号分隔" },
      { key: "fields",  label: "指标",     type: "text", required: true,  placeholder: "pe_ttm,pb_mrq,mkt_cap_ard,roe_ttm2", hint: "常用: pe_ttm/pb_mrq/ps_ttm/mkt_cap_ard/roe_ttm2/profit_ttm/or_ttm/eps_ttm/bps_lr" },
      { key: "options", label: "可选参数", type: "text", required: false, placeholder: "tradeDate=20250101;unit=1", hint: "tradeDate: 截面日期 | rptDate: 报告期 | currencyType: 币种 | unit: 单位" },
    ],
  },
  {
    id: "wsq",
    label: "WSQ — 实时行情快照",
    description: "获取证券当前实时行情数据，包括最新价、买卖盘、成交量等。支持多品种多指标。",
    fields: [
      { key: "codes",   label: "证券代码", type: "text", required: true,  placeholder: "000001.SZ,600000.SH", hint: "支持多品种，逗号分隔" },
      { key: "fields",  label: "实时指标", type: "text", required: true,  placeholder: "rt_last,rt_open,rt_high,rt_low,rt_vol", hint: "常用: rt_last/rt_open/rt_high/rt_low/rt_vol/rt_amt/rt_bid1/rt_ask1/rt_bsize1/rt_asize1/rt_pct_chg" },
      { key: "options", label: "可选参数", type: "text", required: false, placeholder: "", hint: "快照模式一般无需额外参数" },
    ],
  },
  {
    id: "wset",
    label: "WSET — 数据集报表",
    description: "获取板块成分、指数成分、ETF申赎、融资融券标的、停复牌、分红送转等报表数据。",
    fields: [
      { key: "tableName", label: "报表名称", type: "text", required: true,  placeholder: "sectorconstituent", hint: "常用: sectorconstituent(板块成分)/indexconstituent(指数成分)/etfconstituent(ETF成分)/futureoir(期货持仓)" },
      { key: "options",   label: "可选参数", type: "text", required: false, placeholder: "date=2025-01-01;windcode=000300.SH", hint: "不同报表参数不同，建议使用Wind代码生成器查看" },
    ],
  },
  {
    id: "edb",
    label: "EDB — 宏观经济数据库",
    description: "获取宏观经济指标时间序列，包括GDP、CPI、PMI、利率、汇率等。",
    fields: [
      { key: "codes",     label: "指标代码",  type: "text", required: true,  placeholder: "M0001395,M0001396,M0001397", hint: "Wind EDB指标代码，如 M0001395(GDP) / M0000612(CPI) / M0017126(PMI) / M0009808(M2)" },
      { key: "beginTime", label: "开始日期", type: "date", required: true },
      { key: "endTime",   label: "结束日期", type: "date", required: true },
      { key: "options",   label: "可选参数", type: "text", required: false, placeholder: "Fill=Previous", hint: "Fill: Previous沿用前值/Blank返回空值" },
    ],
  },
  {
    id: "tdays",
    label: "TDAYS — 交易日历",
    description: "获取指定日期区间内的交易日列表。",
    fields: [
      { key: "beginTime", label: "开始日期", type: "date", required: true },
      { key: "endTime",   label: "结束日期", type: "date", required: true },
      { key: "options",   label: "可选参数", type: "text", required: false, placeholder: "Days=Alldays;TradingCalendar=SSE", hint: "Days: Trading交易日/Weekdays工作日/Alldays日历日 | TradingCalendar: SSE/SZSE/CFFE/HKEX等" },
    ],
  },
  {
    id: "wst",
    label: "WST — 日内Tick序列",
    description: "获取单只证券的日内分笔Tick数据，包括成交价、买卖盘等。仅支持单品种，近7个交易日数据。",
    singleOnly: { codes: "WST 仅支持单品种查询，请输入一个证券代码" },
    fields: [
      { key: "codes",     label: "证券代码", type: "text", required: true,  placeholder: "000001.SZ", hint: "仅支持单品种" },
      { key: "fields",    label: "指标",     type: "text", required: true,  placeholder: "last,bid1,ask1,volume,amt", hint: "常用: last/bid1/ask1/bsize1/asize1/volume/amt/oi(持仓量)" },
      { key: "beginTime", label: "开始时间", type: "text", required: true,  placeholder: "2025-01-20 09:30:00", hint: "精确到秒，如 2025-01-20 09:30:00" },
      { key: "endTime",   label: "结束时间", type: "text", required: true,  placeholder: "2025-01-20 15:00:00", hint: "精确到秒，仅支持近7个交易日" },
      { key: "options",   label: "可选参数", type: "text", required: false, placeholder: "", hint: "一般无需额外参数" },
    ],
  },
  {
    id: "wses",
    label: "WSES — 板块日序列数据",
    description: "获取板块的历史日序列数据，如板块平均行情、基本面、盈利预测等。支持多板块单指标。",
    singleOnly: { fields: "WSES 仅支持单指标查询，请输入一个指标" },
    fields: [
      { key: "codes",     label: "板块代码", type: "text", required: true,  placeholder: "a001010100,a001010200", hint: "板块ID，可通过Wind板块查询工具获取" },
      { key: "fields",    label: "指标",     type: "text", required: true,  placeholder: "sec_close_avg", hint: "仅支持单指标，如 sec_close_avg/sec_turn_avg/sec_pct_chg_avg" },
      { key: "beginTime", label: "开始日期", type: "date", required: true },
      { key: "endTime",   label: "结束日期", type: "date", required: true },
      { key: "options",   label: "可选参数", type: "text", required: false, placeholder: "DynamicTime=1;Period=D", hint: "DynamicTime: 0历史成分/1最新成分 | Period: D/W/M/Q/S/Y | Fill: Previous/Blank" },
    ],
  },
  {
    id: "wsee",
    label: "WSEE — 板块日截面数据",
    description: "获取板块在某个交易日的截面数据，如平均行情、平均财务数据等。支持多板块多指标。",
    fields: [
      { key: "codes",   label: "板块代码", type: "text", required: true,  placeholder: "a001010100,a001010200", hint: "板块ID，可通过Wind板块查询工具获取" },
      { key: "fields",  label: "指标",     type: "text", required: true,  placeholder: "sec_close_avg,sec_turn_avg", hint: "支持多指标，如 sec_close_avg/sec_turn_avg/sec_pct_chg_avg" },
      { key: "options", label: "可选参数", type: "text", required: false, placeholder: "tradeDate=20250101;DynamicTime=1", hint: "tradeDate: 截面日期 | DynamicTime: 0历史成分/1最新成分" },
    ],
  },
  {
    id: "tdaysoffset",
    label: "TDAYSOFFSET — 日期偏移",
    description: "获取指定日期前推或后推N个交易日的日期。",
    fields: [
      { key: "beginTime", label: "基准日期", type: "date", required: true },
      { key: "offset",    label: "偏移天数", type: "text", required: true,  placeholder: "-5", hint: "正数后推，负数前推，如 -5 表示前推5个交易日" },
      { key: "options",   label: "可选参数", type: "text", required: false, placeholder: "Days=Trading;TradingCalendar=SSE", hint: "Days: Trading/Weekdays/Alldays | TradingCalendar: SSE/SZSE等" },
    ],
  },
  {
    id: "tdayscount",
    label: "TDAYSCOUNT — 交易日计数",
    description: "统计两个日期之间的交易日天数。",
    fields: [
      { key: "beginTime", label: "开始日期", type: "date", required: true },
      { key: "endTime",   label: "结束日期", type: "date", required: true },
      { key: "options",   label: "可选参数", type: "text", required: false, placeholder: "Days=Trading;TradingCalendar=SSE", hint: "Days: Trading/Weekdays/Alldays | TradingCalendar: SSE/SZSE等" },
    ],
  },
];
