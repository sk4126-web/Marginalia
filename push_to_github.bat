@echo off
title Push Marginalia to GitHub (sk4126-web)
cd /d "%~dp0"
echo ========================================================
echo   Pushing Marginalia to github.com/sk4126-web/marginalia
echo ========================================================
echo.
echo Make sure you have created the empty repo at:
echo https://github.com/new (Name: marginalia)
echo.
git push -u origin main
echo.
pause
