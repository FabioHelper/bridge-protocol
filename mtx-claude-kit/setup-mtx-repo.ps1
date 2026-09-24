# One-shot setup: puts the local MTX project on GitHub with the handoff docs and the Claude kit.
# Run in PowerShell:
#   irm https://raw.githubusercontent.com/FabioHelper/bridge-protocol/refs/heads/claude/mtx-remake-model-optimization-6y5taa/mtx-claude-kit/setup-mtx-repo.ps1 | iex
# Safe to re-run: existing files are never overwritten (a differing kit file lands as *.kit instead).
& {
    $Project   = 'C:\Users\Fabio D\Desktop\mtx'
    $Handoff   = 'C:\Users\Fabio D\Documents\Codex\2026-09-24\ins\outputs'
    $RepoUrl   = 'https://github.com/FabioHelper/mtx-remake.git'
    $KitRepo   = 'https://github.com/FabioHelper/bridge-protocol.git'
    $KitBranch = 'claude/mtx-remake-model-optimization-6y5taa'

    function Step($m) { Write-Host "`n==> $m" -ForegroundColor Cyan }
    function Stop-Setup($m) { Write-Host "`nSTOPPED: $m" -ForegroundColor Red }
    function G { & git.exe @args; if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') failed (exit $LASTEXITCODE)" } }

    if (-not (Get-Command git.exe -ErrorAction SilentlyContinue)) {
        Stop-Setup 'Git is not installed. Run:  winget install --id Git.Git -e  then open a NEW PowerShell window and run this again.'; return
    }
    if (-not (Test-Path -LiteralPath $Project)) { Stop-Setup "Project folder not found: $Project"; return }
    if (-not (Test-Path -LiteralPath (Join-Path $Handoff 'MTX-CLAUDE-HANDOFF.md'))) {
        Stop-Setup "MTX-CLAUDE-HANDOFF.md not found in $Handoff"; return
    }

    try {
        Set-Location -LiteralPath $Project

        Step 'Copying handoff docs into docs\handoff'
        New-Item -ItemType Directory -Force 'docs\handoff' | Out-Null
        Copy-Item -Path (Join-Path $Handoff '*') -Destination 'docs\handoff' -Recurse -Force

        Step 'Installing the Claude kit'
        # Scratch clone lives inside the project (never committed) - avoids 8.3 short paths in %TEMP%.
        $tmp = Join-Path $Project '.mtx-kit-tmp'
        if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force }
        G clone --quiet --depth 1 --branch $KitBranch $KitRepo $tmp
        $kit = (Get-Item -LiteralPath (Join-Path $tmp 'mtx-claude-kit')).FullName
        Get-ChildItem -LiteralPath $kit -Recurse -File -Force | ForEach-Object {
            $rel = $_.FullName.Substring($kit.Length).TrimStart('\', '/')
            if ($rel -eq 'setup-mtx-repo.ps1') { return }
            if ($rel -eq 'README.md') { $rel = 'docs\CLAUDE-KIT.md' }
            $dest = Join-Path $Project $rel
            if (Test-Path -LiteralPath $dest) {
                if ((Get-FileHash -LiteralPath $dest).Hash -eq (Get-FileHash -LiteralPath $_.FullName).Hash) { return }
                $dest = "$dest.kit"
                Write-Host "  $rel already exists - kit version saved as $rel.kit" -ForegroundColor Yellow
            }
            New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
            Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
        }
        Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue

        Step 'Making sure dependencies and build output are not uploaded (.gitignore)'
        $want = @('.mtx-kit-tmp/', 'node_modules/', 'dist/', 'coverage/', '.vite/', '*.log', '.env', '.env.*')
        $gi = Join-Path $Project '.gitignore'
        $have = @()
        if (Test-Path -LiteralPath $gi) { $have = @(Get-Content -LiteralPath $gi) }
        $missing = @($want | Where-Object { $have -notcontains $_ })
        if ($missing.Count -gt 0) {
            [IO.File]::WriteAllLines($gi, [string[]](@($have) + $missing), (New-Object Text.UTF8Encoding($false)))
        }

        Step 'Preparing git'
        if (-not (Test-Path -LiteralPath '.git')) { G init --quiet }
        if (-not (git.exe config user.name))  { G config user.name 'FabioHelper' }
        if (-not (git.exe config user.email)) { G config user.email 'fabiodutra19@gmail.com' }

        $files = @(git.exe -c core.quotePath=false ls-files --cached --others --exclude-standard)
        $big = @($files | Where-Object { (Test-Path -LiteralPath $_) -and (Get-Item -LiteralPath $_ -Force).Length -gt 95MB })
        if ($big.Count -gt 0) {
            Stop-Setup ("These files exceed GitHub's 100 MB limit. Move them out of the folder or add them to .gitignore, then run this again:`n  " + ($big -join "`n  ")); return
        }
        Write-Host "  $($files.Count) files will be tracked"

        G add -A
        git.exe diff --cached --quiet
        if ($LASTEXITCODE -ne 0) { G commit --quiet -m 'Import MTX project, Codex handoff docs and Claude kit' }

        $remote = 'origin'
        $remotes = @(git.exe remote)
        if ($remotes -contains 'origin') {
            if ((git.exe remote get-url origin) -ne $RepoUrl) {
                $remote = 'github'
                if ($remotes -notcontains 'github') { G remote add github $RepoUrl }
            }
        } else {
            G remote add origin $RepoUrl
        }

        Step "Pushing to GitHub (a browser sign-in window may open the first time)"
        G push -u $remote HEAD:main

        Write-Host "`nDONE -> https://github.com/FabioHelper/mtx-remake" -ForegroundColor Green
    } catch {
        Stop-Setup $_.Exception.Message
    }
}
