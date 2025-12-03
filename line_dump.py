from pathlib import Path
path = Path( electron/renderer.js)
lines = path.read_text(encoding='utf-8').splitlines()
for i in range(1800, 1850):
    safe = lines[i].encode('utf-8', 'ignore').decode('utf-8')
    print(f'{i+1}: {safe}')
