@echo off

setlocal enabledelayedexpansion

chcp 65001 >nul 2>&1



REM Load language strings

call "%~dp0load_language.bat" 2>nul



REM Set default values if not loaded

if not defined BATCH_START_TITLE set BATCH_START_TITLE=?∠巨閮董蝟餌絞 - ??