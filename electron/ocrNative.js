// ocrNative.js
// Lightweight, per-OS OCR using built-in frameworks (no Tesseract bundle).

const { spawn } = require("child_process");
const fs = require("fs");

function macOcr(imagePath) {
  return new Promise((resolve, reject) => {
    const swiftScript = `
import Vision
import Foundation

let path = CommandLine.arguments[1]
let url = URL(fileURLWithPath: path)

do {
    let handler = try VNImageRequestHandler(url: url, options: [:])
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["en-US"]
    try handler.perform([request])
    let results = request.results as? [VNRecognizedTextObservation] ?? []
    let lines = results.compactMap { $0.topCandidates(1).first?.string }
    print(lines.joined(separator: "\\n"))
} catch {
    fputs("ERROR: \\(error)", stderr)
    exit(1)
}
`;

    const child = spawn("swift", ["-e", swiftScript, imagePath]);
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve(out.trim());
      reject(new Error(err.trim() || `macOS OCR exited with code ${code}`));
    });
  });
}

function winOcr(imagePath) {
  return new Promise((resolve, reject) => {
    const psScript = `
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName Windows.Foundation
Add-Type -AssemblyName Windows.Storage
Add-Type -AssemblyName Windows.Storage.Streams
Add-Type -AssemblyName Windows.Graphics.Imaging
Add-Type -AssemblyName Windows.Media.Ocr

$path = '${imagePath.replace(/'/g, "''")}'
try {
  $file = [Windows.Storage.StorageFile]::GetFileFromPathAsync($path).GetAwaiter().GetResult()
  $stream = $file.OpenAsync([Windows.Storage.FileAccessMode]::Read).GetAwaiter().GetResult()
  $decoder = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream).GetAwaiter().GetResult()
  $bmp = $decoder.GetSoftwareBitmapAsync().GetAwaiter().GetResult()
  $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
  if (-not $engine) { throw 'No OCR engine available' }
  $result = $engine.RecognizeAsync($bmp).GetAwaiter().GetResult()
  $result.Text
} catch {
  Write-Error $_
  exit 1
}
`;

    const child = spawn("powershell", ["-NoLogo", "-NoProfile", "-Command", psScript]);
    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.stderr.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) return resolve(out.trim());
      reject(new Error(err.trim() || `Windows OCR exited with code ${code}`));
    });
  });
}

async function nativeOcr(imagePath) {
  if (!fs.existsSync(imagePath)) throw new Error("Image not found for OCR");
  if (process.platform === "darwin") return macOcr(imagePath);
  if (process.platform === "win32") return winOcr(imagePath);
  throw new Error("Native OCR not supported on this platform");
}

module.exports = { nativeOcr };
