const { spawn } = require('child_process');
const child = spawn('cmd.exe', ['/c', 'npx prisma migrate dev --name saas_plan_and_whatsapp_multitenant']);

child.stdout.on('data', (data) => {
  const str = data.toString();
  process.stdout.write(str);
  if (str.includes('fail') || str.includes('Yes,') || str.includes('y/N')) {
    child.stdin.write('y\n');
  }
});

child.stderr.on('data', (data) => {
  process.stderr.write(data.toString());
});

child.on('close', (code) => {
  process.exit(code);
});
