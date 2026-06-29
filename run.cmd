@echo off
cd /d %~dp0
start "docs" cmd /k npm run docs:dev
