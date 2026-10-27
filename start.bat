@echo off
chcp 65001 >nul
title SECNOTES 启动器
cd /d "%~dp0"
set PORT=8787

echo.
echo   SECNOTES · 渗透学习台
echo   ----------------------------------------
echo.

where python >nul 2>nul
if errorlevel 1 goto try_node

echo   正在启动本地服务（Python）...
start "SECNOTES :%PORT%" cmd /c "python -m http.server %PORT% --bind 127.0.0.1"
timeout /t 2 >nul
start "" "http://127.0.0.1:%PORT%/"
echo   地址：http://127.0.0.1:%PORT%/
echo   关闭标题为 “SECNOTES :%PORT%” 的窗口即可停止服务。
echo.
timeout /t 4 >nul
exit

:try_node
where node >nul 2>nul
if errorlevel 1 goto noenv

echo   未找到 Python，改用 Node 静态服务...
start "SECNOTES :%PORT%" cmd /c "npx --yes http-server . -p %PORT% -a 127.0.0.1 -c-1"
timeout /t 8 >nul
start "" "http://127.0.0.1:%PORT%/"
echo   地址：http://127.0.0.1:%PORT%/
echo   关闭标题为 “SECNOTES :%PORT%” 的窗口即可停止服务。
echo.
timeout /t 4 >nul
exit

:noenv
echo   没检测到 Python 或 Node。
echo.
echo   你仍然可以直接双击 index.html 浏览 —— 正文会使用内置全文包，
echo   但新增或修改 .md 后需要重新生成索引才生效。
echo.
echo   推荐：安装 Python 3 后重新运行本脚本，可实时读取最新的 .md 文件。
echo.
pause
