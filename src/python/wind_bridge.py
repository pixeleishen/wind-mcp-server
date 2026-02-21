import sys
import json
import os

# Add the directory containing this script to sys.path so handlers can import utils
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Add WindPy location to sys.path
sys.path.insert(0, r"C:\Wind\Wind.NET.Client\WindNET\bin")

from handlers.wsd import handle_wsd
from handlers.wss import handle_wss
from handlers.wsq import handle_wsq
from handlers.wset import handle_wset
from handlers.edb import handle_edb
from handlers.tdays import handle_tdays
from handlers.wst import handle_wst
from handlers.wses import handle_wses
from handlers.wsee import handle_wsee
from handlers.tdaysoffset import handle_tdaysoffset
from handlers.tdayscount import handle_tdayscount
from excel_reader import read_excel

HANDLERS = {
    "wsd": handle_wsd,
    "wss": handle_wss,
    "wsq": handle_wsq,
    "wset": handle_wset,
    "edb": handle_edb,
    "tdays": handle_tdays,
    "wst": handle_wst,
    "wses": handle_wses,
    "wsee": handle_wsee,
    "tdaysoffset": handle_tdaysoffset,
    "tdayscount": handle_tdayscount,
}


def handle_ping():
    try:
        from WindPy import w
        result = w.start(waitTime=5)
        connected = result.ErrorCode == 0
        print(json.dumps({"ok": True, "connected": connected, "error_code": result.ErrorCode}))
    except Exception as e:
        print(json.dumps({"ok": True, "connected": False, "error": str(e)}))


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "No JSON argument provided"}))
        sys.exit(1)

    try:
        request = json.loads(sys.argv[1])
    except json.JSONDecodeError as e:
        print(json.dumps({"ok": False, "error": f"Invalid JSON: {e}"}))
        sys.exit(1)

    func = request.get("function")
    params = request.get("params", {})

    # If excelPath is provided, read codes/time range from Excel and merge into params
    excel_path = params.pop("excelPath", None)
    if excel_path:
        excel_data = read_excel(excel_path)
        # Excel values are defaults; explicit params take priority
        for key, val in excel_data.items():
            if key not in params or not params[key]:
                params[key] = val

    if func == "ping":
        handle_ping()
        return

    if func not in HANDLERS:
        print(json.dumps({"ok": False, "error": f"Unknown function: {func}"}))
        sys.exit(1)

    try:
        from WindPy import w
        start_result = w.start(waitTime=10)
        if start_result.ErrorCode != 0:
            print(json.dumps({"ok": False, "error": f"Wind start failed: {start_result.ErrorCode}"}))
            sys.exit(1)

        data = HANDLERS[func](params)
        print(json.dumps({"ok": True, "data": data}))

    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
