from utils import wind_data_to_dict, handle_error
from WindPy import w


def handle_wsd(params: dict) -> dict:
    codes = params["codes"]
    fields = params["fields"]
    begin_time = params["beginTime"]
    end_time = params["endTime"]
    options = params.get("options", "")

    data = w.wsd(codes, fields, begin_time, end_time, options)

    if data.ErrorCode != 0:
        raise RuntimeError(handle_error(data.ErrorCode))

    return wind_data_to_dict(data)
