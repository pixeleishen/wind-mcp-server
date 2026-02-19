import sys
import json
import os

# Add the directory containing this script to sys.path so handlers can import utils
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from handlers.wsd import handle_wsd
from handlers.wss import handle_wss
from handlers.wsq import handle_wsq
from handlers.wset import handle_wset
from handlers.edb import handle_edb
from handlers.tdays import handle_tdays

HANDLERS = {
    "wsd": handle_wsd,
    "wss": handle_wss,
    "wsq": handle_wsq,
    "wset": handle_wset,
    "edb": handle_edb,
    "tdays": handle_tdays,
}


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
