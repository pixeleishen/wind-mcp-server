from utils import wind_data_to_dict, handle_error
from WindPy import w


def handle_edb(params: dict) -> dict:
    codes = params["codes"]
    begin_time = params["beginTime"]
    end_time = params["endTime"]
    options = params.get("options", "")

    data = w.edb(codes, begin_time, end_time, options)

    if data.ErrorCode != 0:
        raise RuntimeError(handle_error(data.ErrorCode))

    return wind_data_to_dict(data)
