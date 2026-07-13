@echo off
SET PATH=%PATH%;C:\Program Files\Git\cmd
cd /d C:\ChatInterno
call npm run build
git add -A
git commit -m "feat: novos recursos v2"
git push origin main
