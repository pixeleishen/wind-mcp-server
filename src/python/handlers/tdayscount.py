from utils import handle_error
from WindPy import w


def handle_tdayscount(params: dict) -> dict:
    begin_time = params["beginTime"]
    end_time = params["endTime"]
    options = params.get("options", "")

    data = w.tdayscount(begin_time, end_time, options)

    if data.ErrorCode != 0:
        raise RuntimeError(handle_error(data.ErrorCode))

    count = data.Data[0][0]

    return {
        "error_code": 0,
        "codes": [],
        "fields": ["count"],
        "times": [],
        "data": [[count]],
    }
