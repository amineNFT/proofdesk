import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('public/contracts', { recursive: true });
await copyFile('contracts/proofdesk.py', 'public/contracts/proofdesk.py');
