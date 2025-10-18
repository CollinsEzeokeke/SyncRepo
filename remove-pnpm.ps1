# Detect and uninstall pnpm from any known method
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
  Write-Host "🔍 pnpm found at: $(Get-Command pnpm).Source"
  # Try uninstalling via known managers
  if (Get-Command choco -ErrorAction SilentlyContinue) { choco uninstall pnpm -y }
  if (Get-Command scoop -ErrorAction SilentlyContinue) { scoop uninstall pnpm }
  if (Get-Command winget -ErrorAction SilentlyContinue) { winget uninstall --id pnpm.pnpm -e --silent }
  if (Test-Path "$env:USERPROFILE\.local\share\pnpm") { Remove-Item -Recurse -Force "$env:USERPROFILE\.local\share\pnpm" }
  if (Test-Path "$env:USERPROFILE\.local\bin\pnpm") { Remove-Item -Force "$env:USERPROFILE\.local\bin\pnpm" }
  if (Test-Path "$env:ProgramData\chocolatey\lib\pnpm") { Remove-Item -Recurse -Force "$env:ProgramData\chocolatey\lib\pnpm" }
  if (Test-Path "$env:USERPROFILE\scoop\apps\pnpm") { Remove-Item -Recurse -Force "$env:USERPROFILE\scoop\apps\pnpm" }
  if (Test-Path "$env:ProgramFiles\nodejs\pnpm.cmd") { Remove-Item -Force "$env:ProgramFiles\nodejs\pnpm.cmd" }
  if (Test-Path "$env:AppData\Local\pnpm") { Remove-Item -Recurse -Force "$env:AppData\Local\pnpm" }
  Write-Host "🧹 Cleaning pnpm caches and config..."
  Remove-Item -Recurse -Force "$env:USERPROFILE\.pnpm-store","$env:USERPROFILE\.config\pnpm","$env:AppData\Local\pnpm" -ErrorAction SilentlyContinue
  Write-Host "✅ pnpm fully removed."
} else {
  Write-Host "🚫 pnpm is not installed or not found in PATH."
}
