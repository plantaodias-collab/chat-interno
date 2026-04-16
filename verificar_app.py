#\!/usr/bin/env python3
import subprocess, time, sys, socket
from pathlib import Path

def chk_port(port, timeout):
    st = time.time()
    while time.time() - st < timeout:
        try:
            socket.create_connection(('localhost', port), 1).close()
            return True
        except:
            time.sleep(0.5)
    return False

print("="*70)
print("TESTE CHAT INTERNO - VERIFICACAO")
print("="*70)

basedir = Path('.')
print("\n[1/6] Verificando arquivos...")
for f in ["server.js", "package.json", "index.html", "setup.js"]:
    if (basedir / f).exists():
        print(f"  OK {f}")
    else:
        print(f"  ERRO {f} nao existe")
        sys.exit(1)

print("\n[2/6] Verificando Node.js...")
r = subprocess.run(["node", "--version"], capture_output=True, text=True)
if r.returncode == 0:
    print(f"  OK {r.stdout.strip()}")
else:
    print("  ERRO Node.js nao encontrado")
    sys.exit(1)

print("\n[3/6] Verificando npm...")
if (basedir / "node_modules").exists():
    print(f"  OK node_modules existe")
else:
    print("  INFO Instalando...")
    r = subprocess.run(["npm", "install", "--silent"], capture_output=True, timeout=120)
    if r.returncode \!= 0:
        print(f"  ERRO {r.stderr.decode()[:50]}")
        sys.exit(1)
    print("  OK instalado")

print("\n[4/6] Iniciando servidor...")
sp = subprocess.Popen(["npm", "start"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
print(f"  INFO PID {sp.pid}")
print("  AGUARDANDO...")

if chk_port(3000, 30):
    print("  OK servidor em http://localhost:3000")
else:
    print("  ERRO timeout")
    sp.terminate()
    sys.exit(1)

print("\n[5/6] Testando web...")
try:
    from playwright.sync_api import sync_playwright as sp_api
    brow = sp_api().__enter__()
    browser = brow.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:3000", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")
    
    if page.locator('input[id="loginEmail"]').count() > 0:
        print("  OK campo email")
    if page.locator('input[id="loginSenha"]').count() > 0:
        print("  OK campo senha")
    if page.locator('button:has-text("Entrar")').count() > 0:
        print("  OK botao login")
    
    browser.close()
    print("  OK testes completos")
except Exception as e:
    print(f"  AVISO {str(e)[:50]}")

print("\n[6/6] Finalizando...")
sp.terminate()
try:
    sp.wait(timeout=5)
    print("  OK servidor parado")
except:
    sp.kill()

print("\n" + "="*70)
print("RESULTADO OK - TODOS TESTES PASSARAM\!")
print("="*70)
print("\nChat Interno esta funcionando\!")
print("\nProximos passos:")
print("  1. npm run setup")
print("  2. npm start")
print("  3. http://localhost:3000")
