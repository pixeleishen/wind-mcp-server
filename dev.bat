@echo off
echo Starting Wind API server (port 3001) and UI dev server (port 5173)...
start "Wind API" cmd /c "node dist/server.js"
start "Wind UI"  cmd /c "npx vite"
echo Both services launched in separate windows.
echo Close the windows to stop them.
