# PowerShell script to create a new release
# Usage: .\release.ps1 <patch|minor|major|none>

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('patch', 'minor', 'major', 'none')]
    [string]$BumpType
)

# Check if we're in a git repository
if (-not (Test-Path .git)) {
    Write-Error "Not a git repository"
    exit 1
}

# Check for uncommitted changes
$status = git status --porcelain
if ($status) {
    Write-Error "You have uncommitted changes. Please commit or stash them first."
    exit 1
}

# Ensure we're on main branch
$currentBranch = git branch --show-current
if ($currentBranch -ne "main") {
    Write-Warning "You are on branch '$currentBranch', not 'main'"
    $continue = Read-Host "Continue anyway? (y/N)"
    if ($continue -ne 'y' -and $continue -ne 'Y') {
        Write-Host "Release cancelled"
        exit 0
    }
}

# Pull latest changes
Write-Host "Pulling latest changes..." -ForegroundColor Cyan
git pull

# Get current version
$currentVersion = (Get-Content package.json | ConvertFrom-Json).version

if ($BumpType -eq 'none') {
    Write-Host "Skipping version bump, using current version: $currentVersion" -ForegroundColor Cyan
    $newVersion = $currentVersion
} else {
    Write-Host "Bumping $BumpType version..." -ForegroundColor Cyan
    npm version $BumpType
    $newVersion = (Get-Content package.json | ConvertFrom-Json).version
    Write-Host "New version: $newVersion" -ForegroundColor Green
}

# Push commit and tag
Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
git push
git push --tags

# Get repository URL
$remoteUrl = git config --get remote.origin.url
if ($remoteUrl -match '(?:https://github.com/|git@github.com:)(.+/.+?)(?:\.git)?$') {
    $repoPath = $matches[1]
    $releaseUrl = "https://github.com/$repoPath/releases/new?tag=v$newVersion"

    Write-Host "`nOpening release page in browser..." -ForegroundColor Cyan
    Write-Host "Release URL: $releaseUrl" -ForegroundColor Gray

    Start-Process $releaseUrl

    Write-Host "`nRelease v$newVersion ready to publish!" -ForegroundColor Green
    Write-Host "Fill in the release notes and click 'Publish release'" -ForegroundColor Yellow
} else {
    Write-Warning "Could not parse GitHub repository URL"
    Write-Host "Please create the release manually at: https://github.com/your-repo/releases/new?tag=v$newVersion"
}
