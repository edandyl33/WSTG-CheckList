@echo off
rem Starts the local web server and opens the app in your default browser.
cd /d "%~dp0"
start "" http://127.0.0.1:8080
node server.js 8080
