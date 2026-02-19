from utils import wind_data_to_dict, handle_error
from WindPy import w


def handle_wset(params: dict) -> dict:
    table_name = params["tableName"]
    options = params.get("options", "")

    data = w.wset(table_name, options)

    if data.ErrorCode != 0:
        raise RuntimeError(handle_error(data.ErrorCode))

    return wind_data_to_dict(data)
