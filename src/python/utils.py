from datetime import datetime


def wind_data_to_dict(data) -> dict:
    """Convert a WindPy WindData object to a plain serializable dict."""
    if data is None:
        return {}

    result = {
        "error_code": data.ErrorCode,
        "codes": data.Codes,
        "fields": data.Fields,
        "times": [t.strftime("%Y-%m-%d") if isinstance(t, datetime) else str(t) for t in (data.Times or [])],
        "data": [],
    }

    if data.Data:
        result["data"] = [
            [_serialize_value(v) for v in row]
            for row in data.Data
        ]

    return result


def _serialize_value(v):
    if isinstance(v, datetime):
        return v.strftime("%Y-%m-%d")
    if isinstance(v, float) and (v != v):  # NaN check
        return None
    return v


ERROR_CODES = {
    0: "Success",
    -1: "Unknown error",
    -2: "Connection failed",
    -3: "Login failed",
    -4: "No data",
    -40520007: "No permission for this data",
    -40521009: "Invalid security code",
    -40522003: "Invalid field",
    -40522009: "Date out of range",
}


def handle_error(error_code: int) -> str:
    return ERROR_CODES.get(error_code, f"Wind error code: {error_code}")
