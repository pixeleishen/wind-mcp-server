from utils import wind_data_to_dict, handle_error
from WindPy import w


def handle_wss(params: dict) -> dict:
    codes = params["codes"]
    fields = params["fields"]
    options = params.get("options", "")

    data = w.wss(codes, fields, options)

    if data.ErrorCode != 0:
        raise RuntimeError(handle_error(data.ErrorCode))

    return wind_data_to_dict(data)
