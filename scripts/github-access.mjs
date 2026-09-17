import { spawnSync } from 'node:child_process';
const credential = spawnSync('git', ['credential', 'fill'], {
  input: 'protocol=https\nhost=github.com\n\n',
  encoding: 'utf8',
  env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
  windowsHide: true,
});
if (credential.status !== 0) {
  console.log('No non-interactive GitHub authentication is available.');
  process.exit(2);
}
const data = Object.fromEntries(
  credential.stdout
    .trim()
    .split('\n')
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
if (!data.password) {
  console.log('No GitHub credential returned.');
  process.exit(2);
}
const response = await fetch('https://api.github.com/user', {
  headers: {
    Authorization: `Bearer ${data.password}`,
    Accept: 'application/vnd.github+json',
    'User-Agent': 'ProofDesk-setup',
  },
});
if (!response.ok) {
  console.log(`GitHub authentication returned HTTP ${response.status}.`);
  process.exit(2);
}
const user = await response.json();
console.log(`Authenticated GitHub account: ${user.login}`);
