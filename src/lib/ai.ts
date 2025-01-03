import { spawn } from "node:child_process";

export function startAiServer() {
  console.log('Starting AI server');
  const pythonProcess = spawn('fastapi', ['run', 'vision.py']);

  pythonProcess.stdout.pipe(process.stdout);

  pythonProcess.stderr.pipe(process.stderr);

  pythonProcess.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
  });

  pythonProcess.on('error', (err) => {
    console.error(err);
  });

  return pythonProcess;
}