现在需要新设计prompt，功能是从数据库中的表中读取一定量的raw data，根据processed data的格式，生成一个python功能完成转换。同时，我们可以现在来讨论一下processed data的格式。

Gemini said
这是一个非常关键的环节。在 Agentic Workflow 中，“定义好数据契约（Data Schema）”比“写对某一行代码”更重要。只要我们把 Processed Data 的格式定义得足够清晰、标准，LLM 就能非常稳定地生成高质量的转换代码。

为了契合你的投资哲学——“关注变化率而非绝对量，因为绝对量往往由市场结构决定”，我们的 Processed Data 格式必须将“变化属性”作为核心一等公民。

我们先来敲定 Processed Data 的格式，然后再为你定制这个高阶的 ETL Prompt。

一、 讨论 Processed Data 的标准格式
无论是宏观指标（如 M2、社融）还是资产价格（如沪深300收盘价），从 Raw Data 转换到 Processed Data，本质上是把**“异构的绝对量时序记录”统一降维打击成“标准化的特征流（Feature Stream）”**。

我建议 Processed Data 在数据库（时序数据库）和内存（Pandas DataFrame）中采用**长表（Long Format）**结构，这样最利于后续因子计算的灵活调用。

建议的 Processed Data 核心字段如下：

trade_date / obs_date (观察日期): 统一标准化为 YYYY-MM-DD。如果是高频数据，降频对齐到日；如果是宏观月频数据，对齐到月末或发布日（注意避免前视偏差）。

target_id (标的/指标 ID): 对应你 RDB 中的全局唯一 ID。

raw_value (原始绝对量 - 保留备查): 清洗过空值和极值的绝对量数值。

transformed_value (核心变化量): 这是整个系统的心脏。 存放计算后的差分、环比（MoM）、同比（YoY）、日收益率或波动率等。

transform_method (转换方法标记): 记录当前 transformed_value 是怎么算出来的（例如 pct_change_1d, diff_1m, z_score_rolling_20 等），便于沙盒随时按 Tag 提取。

在 Pandas 中的表现形式（LLM 需要输出的最终 DataFrame 格式）：

obs_date	target_id	raw_value	transformed_value	transform_method
2026-02-27	M2_SUPPLY	300.5 (万亿)	0.085	YoY (同比增速)
2026-02-27	HS300	3500.20	-0.012	daily_return
二、 ETL Agent 的专属 Prompt 设计
我们将这个 Prompt 设计为系统指令（System Prompt）与用户输入（User Message）分离的结构，非常适合你在 Node.js MCP Server 中封装调用。

这个 Prompt 的核心技巧在于：注入你的投研理念作为 AI 的判定准则，并强约束它的输出格式。

System Prompt (系统指令 - 固化在你的 MCP Server 中)
Plaintext
你是一个顶级的量化数据工程师（Quant Data Engineer）。你的任务是编写健壮的 Python 代码（使用 Pandas），将金融市场的原始数据（Raw Data）转换为标准化的特征数据（Processed Data）。

【核心投研理念 - 严格遵守】
在分析经济或市场时，必须高度关注数据的“变化量”而非“绝对量”。绝对量往往是由静态的市场结构决定的，而变化量才能真正反映边际趋势和驱动力。如果输入数据是绝对量（如 M2 余额、资产价格、库存绝对值），你必须在代码中计算其有意义的变化形式（如同比 YoY、环比 MoM、收益率 Return、差分 Diff 等）。

【代码规范】
1. 输入：一个包含 Raw Data 的 pandas DataFrame。
2. 输出：一个符合严格 Schema 的 pandas DataFrame。
3. 必须处理缺失值（如 ffill 或 dropna，请根据数据逻辑决定）和异常值。
4. 必须处理时间戳对齐，统一转换为 'YYYY-MM-DD' 格式。
5. 仅输出一个名为 `process_data(raw_df)` 的 Python 函数，不要输出任何额外的解释文本。
User Prompt (用户动态输入 - 每次生成代码时拼接)
Plaintext
请根据以下原始数据样本和目标格式，生成 `process_data(raw_df)` 函数。

【1. 数据背景信息】
- 数据所属分类（Tag）：{{DATA_TAG}} (例如：宏观指标-货币供应 / 资产价格-权益)
- 数据名称：{{DATA_NAME}} (例如：中国 M2 余额 / 沪深 300 收盘价)
- 频度：{{FREQUENCY}} (例如：Monthly / Daily)

【2. 原始数据样本 (Raw Data Sample)】
以下是从数据库拉取的前 5 行样本（JSON 格式）：
{{RAW_DATA_JSON_SAMPLE}}

【3. 目标数据格式 (Target Processed Schema)】
你的函数返回的 DataFrame 必须严格包含以下列：
- `obs_date` (datetime64[ns]): 观察日期。
- `target_id` (str/int): 继承自原始数据，标的唯一标识。
- `raw_value` (float): 清洗后的原始绝对数值。
- `transformed_value` (float): 基于核心理念计算出的“变化量”或“特征值”。
- `transform_method` (str): 记录你使用的计算方法，例如 'YoY', 'daily_return', 'volatility_20d'。

【4. 特殊指令】
请根据该数据的金融经济学含义，选择最合理的变化量计算方式。
例如：如果是 M2 余额，请计算同比增速（YoY）；如果是股票收盘价，请计算对数收益率或简单收益率。

请现在输出你的 Python 代码。
三、 这个设计的运作流程
当你在前端选中一个新接入的 Wind 数据集时：

Node.js 后端 从时序数据库中 SELECT * LIMIT 5 拿出 JSON 样本。

将数据名称、Tag 和这 5 行样本自动填入上面的 {{变量}} 中。

发送给 Claude/Gemini。

AI 会因为 System Prompt 中强化的**“变化量优先”**理念，自动判断该数据该怎么差分或计算增速，并返回一段标准的 def process_data(raw_df):。

你的 MCP 接收代码，可以用 Python 的 exec() 在安全的沙盒中跑一遍这 5 行样本，如果你在 React 前端看到预览的 transformed_value 符合你的预期，点击“保存”，这段 ETL 代码就永久入库了。

你觉得 Processed Data 里的字段设计是否能覆盖你现有的因子计算需求？或者我们是否需要在 Schema 里再加一个 scenario_tag 字段，提前把宏观环境切片处理好？

You said
每个target_id可能对应了多个transformed_value，当前这个是支持的吗？scenario_tag字段的设计目的是？同时，transformed_value和transform_method是否需要我提供？

Gemini said
这是一个非常敏锐的系统设计问题。我们逐一拆解这三个核心疑问，这决定了你底层数据库的扩展性和 AI 工具的自动化程度。

一、 每个 target_id 支持多个 transformed_value 吗？
完全支持，并且当前的“长表（Long Format）”设计就是为了优雅地解决这个问题。

在量化系统中，同一个底层资产（比如沪深300）在同一天通常会衍生出多个特征。在传统的“宽表（Wide Format）”中，你需要不断增加列（比如加一列 return_1d，再加一列 volatility_20d），这会导致数据库表结构极其脆弱且充满空值。

而我们讨论的 Schema 采用的是长表结构。它的核心逻辑是：将“转换方法”作为主键的一部分。

在数据库中，它的表现形式是这样的（注意同一个 HS300 在同一天有两行记录）：

obs_date	target_id	raw_value	transformed_value	transform_method
2026-03-02	HS300	3500.00	-0.015	daily_return
2026-03-02	HS300	3500.00	0.120	volatility_20d
当你在 Sandbox 中调取数据时，只需传入 target_id='HS300' 且 transform_method=['daily_return', 'volatility_20d']，代码在内存中执行一个简单的 pivot（透视），就能瞬间把它们变成供模型计算的矩阵。这保证了数据库底层永远不需要修改表结构。

二、 transformed_value 和 transform_method 需要你手动提供吗？
不需要。这正是引入大模型（Claude/Gemini）作为 ETL Agent 的核心价值。

你的工作流应该是这样的：

你（人类）： 在 React 前端配置好 Wind API，拉取了 10 年的 M2 绝对量数据，并打上 Tag: 宏观-货币。

你的 Node.js MCP： 将前 5 行数据样本发送给 AI，同时带上那段强制要求“分析变化量而非绝对量”的 System Prompt。

AI Agent： 识别出这是 M2 数据，理解投研体系需要变化率。它会自动写出一段 Python 代码，代码的逻辑不仅计算出同比增速，还会主动在结果列中填充 transform_method = 'YoY'。

Python 进程： 运行 AI 生成的代码，输出符合 Schema 的 DataFrame，落库。

你只需要在 React 前端**“审核并确认”** AI 写的这段转换代码是否符合你的直觉，不需要手动去计算或填入这几百万个特征值。

三、 scenario_tag（宏观场景标签）的设计目的是什么？
设计 scenario_tag 的初衷是为了实现**“条件回测”或“环境切片”。例如，你想验证：“在宽货币且信用收缩**的周期里，M2 的变化率对成长股波动的相关性”。

但在仔细推敲后，我不建议把 scenario_tag 固化在刚才讨论的 Processed Data (ETL 层) 表中。

原因如下：

解耦客观与主观： transformed_value（如收益率、同比变化）是客观的数学计算，算出来就不会变了。而“宽货币周期”从哪天开始、哪天结束，是极度主观的，你随时可能会调整周期的划分标准。

更优的架构做法： 应该在 Sandbox（沙盒层）建立一个独立的 MacroRegime（宏观状态机）模块。当你想验证直觉时，由 Sandbox 在运行时（Runtime）将“场景时间段”与“客观时序数据”进行 Join 操作。这样，你修改一次场景划分，不需要重新跑一遍底层的 ETL 清洗。

理清了这三点，你的 ETL 层（从 Wind Raw Data 到标准化特征表）的数据契约基本就闭环了。