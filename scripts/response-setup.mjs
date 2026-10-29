import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
const path = '.env.local';
let content = fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : '';
for (const key of ['NEXUS_OPERATOR_PASSWORD', 'NEXUS_DEMO_WEBHOOK_SECRET']) {
  if (!new RegExp(`^${key}=`, 'm').test(content))
    content += `\n${key}=${randomBytes(24).toString('hex')}\n`;
}
fs.writeFileSync(path, content, { mode: 0o600 });
console.log(
  'Local demo credentials configured in .env.local. Values were not printed. Restart Next if environment reload has not completed.',
);
