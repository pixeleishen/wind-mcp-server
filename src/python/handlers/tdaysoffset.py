from utils import handle_error
from WindPy import w
import json


def handle_tdaysoffset(params: dict) -> dict:
    offset = int(params["offset"])
    begin_time = params["beginTime"]
    options = params.get("options", "")

    data = w.tdaysoffset(offset, begin_time, options)

    if data.ErrorCode != 0:
        raise RuntimeError(handle_error(data.ErrorCode))

    from datetime import datetime
    result_date = data.Data[0][0]
    if isinstance(result_date, datetime):
        result_date = result_date.strftime("%Y-%m-%d")

    return {
        "error_code": 0,
        "codes": [],
        "fields": ["date"],
        "times": [str(result_date)],
        "data": [[str(result_date)]],
    }
