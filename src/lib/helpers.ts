import { spawn } from "node:child_process";

export function runPythonScript(scriptPath: string, args: string[] = []): Promise<string> {
    return new Promise((resolve, reject) => {
      const pythonProcess = spawn('python3', [scriptPath, ...args]);
  
      let output = '';
      let errorOutput = '';
  
      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
  
      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
  
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Exit code ${code}: ${errorOutput}`));
        }
      });
  
      pythonProcess.on('error', (err) => {
        reject(err);
      });
    });
  }