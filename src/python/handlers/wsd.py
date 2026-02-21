from utils import wind_data_to_dict, handle_error, merge_wind_results
from WindPy import w


def handle_wsd(params: dict) -> dict:
    codes = params["codes"]
    fields = params["fields"]
    begin_time = params["beginTime"]
    end_time = params["endTime"]
    options = params.get("options", "")

    code_list = [c.strip() for c in codes.split(",") if c.strip()]
    field_list = [f.strip() for f in fields.split(",") if f.strip()]

    # Wind wsd doesn't support multi-codes + multi-fields simultaneously
    if len(code_list) > 1 and len(field_list) > 1:
        results = []
        for code in code_list:
            data = w.wsd(code, fields, begin_time, end_time, options)
            if data.ErrorCode != 0:
                raise RuntimeError(handle_error(data.ErrorCode))
            results.append(wind_data_to_dict(data))
        return merge_wind_results(results)

    data = w.wsd(codes, fields, begin_time, end_time, options)

    if data.ErrorCode != 0:
        raise RuntimeError(handle_error(data.ErrorCode))

    return wind_data_to_dict(data)
