// deliver-pr.ps1 を PowerShell で起動する。
// pwsh（7+）があればそれを使い、無ければ Windows 同梱の powershell.exe（5.1）で動かす。
// スクリプト側は 5.1 互換に保っているが、7 があるなら素直にそちらを使う。
import { spawnSync } from 'node:child_process';

const [script, ...args] = process.argv.slice(2);
if (!script) {
  console.error('usage: node scripts/run-powershell.mjs <script.ps1> [args...]');
  process.exit(1);
}

const probe = spawnSync('pwsh', ['-NoProfile', '-Command', 'exit 0'], { stdio: 'ignore', shell: false });
const shell = probe.status === 0 ? 'pwsh' : 'powershell';

const result = spawnSync(shell, ['-NoProfile', '-File', script, ...args], { stdio: 'inherit', shell: false });
if (result.error) {
  console.error(`${shell} の起動に失敗しました: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
