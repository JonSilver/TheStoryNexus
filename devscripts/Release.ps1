#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Creates a release by updating version, creating a tag, and opening the GitHub release page.

.PARAMETER Action
    The action to perform: 'major', 'minor', 'patch', or 'set'

.PARAMETER Version
    When Action is 'set', specifies the exact version (e.g., "1.2.3")

.PARAMETER CommitMessage
    Custom commit message. Defaults to "chore: bump version to X.Y.Z"

.PARAMETER DryRun
    Shows what would be done without making changes

.PARAMETER Auto
    Creates release automatically using gh CLI with generated notes.
    Otherwise, opens the GitHub release page in browser.

.EXAMPLE
    .\Release.ps1 -Action patch
    .\Release.ps1 -Action patch -Auto
    .\Release.ps1 -Action set -Version "2.1.0" -DryRun
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("major", "minor", "patch", "set")]
    [string]$Action,

    [Parameter(Mandatory = $false)]
    [string]$Version,

    [Parameter(Mandatory = $false)]
    [string]$CommitMessage,

    [Parameter(Mandatory = $false)]
    [switch]$DryRun,

    [Parameter(Mandatory = $false)]
    [switch]$Auto
)

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptRoot
Set-Location $ProjectRoot

function Invoke-WithRetry {
    param(
        [scriptblock]$Command,
        [string]$Description,
        [int]$MaxRetries = 3,
        [int]$DelaySeconds = 5
    )
    for ($i = 1; $i -le $MaxRetries; $i++) {
        $result = & $Command 2>&1
        if ($LASTEXITCODE -eq 0) {
            return $result
        }
        if ($i -lt $MaxRetries) {
            Write-Host "  $Description failed (attempt $i/$MaxRetries), retrying in ${DelaySeconds}s..." -ForegroundColor Yellow
            Start-Sleep -Seconds $DelaySeconds
        }
    }
    throw "$Description failed after $MaxRetries attempts: $result"
}

try {
    # Check for uncommitted changes
    Write-Host "Checking git status..." -ForegroundColor Cyan
    $GitStatus = git status --porcelain
    if ($GitStatus) {
        Write-Error "Working directory is not clean. Commit or stash changes first:"
        Write-Host $GitStatus -ForegroundColor Yellow
        exit 1
    }

    # Get current branch
    $CurrentBranch = git branch --show-current
    Write-Host "Current branch: $CurrentBranch" -ForegroundColor Cyan

    # Ensure we're on main branch
    if ($CurrentBranch -ne "main") {
        Write-Error "Releases must be created from the 'main' branch. Current branch: $CurrentBranch"
        exit 1
    }

    # Get repository URL from git remote
    Write-Host "Getting repository URL..." -ForegroundColor Cyan
    $RemoteUrl = git remote get-url origin 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to get git remote URL"
    }

    # Convert git URL to HTTPS GitHub URL
    if ($RemoteUrl -match 'github\.com[:/](.+?)(?:\.git)?$') {
        $RepoPath = $matches[1]
        $RepoUrl = "https://github.com/$RepoPath"
    } else {
        throw "Could not parse GitHub repository URL from: $RemoteUrl"
    }

    # Build Update-Version.ps1 parameters
    $UpdateVersionParams = @{
        Action = $Action
    }
    if ($Version) {
        $UpdateVersionParams.Version = $Version
    }
    if ($CommitMessage) {
        $UpdateVersionParams.CommitMessage = $CommitMessage
    }
    if ($DryRun) {
        $UpdateVersionParams.DryRun = $true
    }

    # Call Update-Version.ps1
    Write-Host "`nUpdating version..." -ForegroundColor Cyan
    $UpdateVersionScript = Join-Path $ScriptRoot "Update-Version.ps1"
    & $UpdateVersionScript @UpdateVersionParams

    if ($LASTEXITCODE -ne 0) {
        throw "Update-Version.ps1 failed with exit code $LASTEXITCODE"
    }

    if ($DryRun) {
        $PackageJsonPath = Join-Path $ProjectRoot "package.json"
        $PackageContent = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
        $CurrentVersion = $PackageContent.version

        $VersionComponents = $CurrentVersion.Split('.')
        $NewVersion = switch ($Action) {
            "major" { "$([int]$VersionComponents[0] + 1).0.0" }
            "minor" { "$($VersionComponents[0]).$([int]$VersionComponents[1] + 1).0" }
            "patch" { "$($VersionComponents[0]).$($VersionComponents[1]).$([int]$VersionComponents[2] + 1)" }
            "set" { $Version }
        }

        $RemoteUrl = git remote get-url origin 2>&1
        if ($RemoteUrl -match 'github\.com[:/](.+?)(?:\.git)?$') {
            $RepoPath = $matches[1]
            $DryRunRepoUrl = "https://github.com/$RepoPath"
        } else {
            $DryRunRepoUrl = "[repository URL]"
        }

        Write-Host "`nWould push all commits to origin" -ForegroundColor Magenta
        Write-Host "Would create and push tag: $NewVersion" -ForegroundColor Magenta
        if ($Auto) {
            Write-Host "Would run: gh release create $NewVersion --title `"v$NewVersion`" --generate-notes" -ForegroundColor Magenta
        } else {
            Write-Host "Would open: $DryRunRepoUrl/releases/new?tag=$NewVersion" -ForegroundColor Magenta
        }
        return
    }

    # Read new version from package.json
    Write-Host "`nReading new version..." -ForegroundColor Cyan
    $PackageJsonPath = Join-Path $ProjectRoot "package.json"
    $PackageContent = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
    $NewVersion = $PackageContent.version
    $TagName = $NewVersion

    Write-Host "Creating tag: $TagName" -ForegroundColor Cyan
    $TagResult = git tag $TagName 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Git tag failed:"
        Write-Host $TagResult -ForegroundColor Red
        throw "git tag failed with exit code $LASTEXITCODE"
    }

    # Push all commits and tag (with retry for transient network issues)
    Write-Host "Pushing all commits to origin..." -ForegroundColor Cyan
    Invoke-WithRetry -Command { git push } -Description "git push"

    Write-Host "Pushing tag to origin..." -ForegroundColor Cyan
    Invoke-WithRetry -Command { git push origin $TagName } -Description "git push tag"

    # Create release
    if ($Auto) {
        Write-Host "`nCreating GitHub release automatically..." -ForegroundColor Cyan
        Invoke-WithRetry -Command { gh release create $TagName --title "v$NewVersion" --generate-notes } -Description "gh release create"

        Write-Host "`nRelease created successfully!" -ForegroundColor Green
        Write-Host "Version: $NewVersion" -ForegroundColor Green
        Write-Host "Tag: $TagName" -ForegroundColor Green
        Write-Host "Pushed to: origin/$CurrentBranch" -ForegroundColor Green
        Write-Host "Release: $RepoUrl/releases/tag/$TagName" -ForegroundColor Green
    } else {
        $ReleaseUrl = "$RepoUrl/releases/new?tag=$TagName"

        Write-Host "`nOpening GitHub release page..." -ForegroundColor Cyan
        Write-Host $ReleaseUrl -ForegroundColor Yellow
        Start-Process $ReleaseUrl

        Write-Host "`nRelease process complete!" -ForegroundColor Green
        Write-Host "Version: $NewVersion" -ForegroundColor Green
        Write-Host "Tag: $TagName" -ForegroundColor Green
        Write-Host "Pushed to: origin/$CurrentBranch" -ForegroundColor Green
        Write-Host "GitHub release page opened in browser" -ForegroundColor Green
    }

}
catch {
    Write-Error "Error: $($_.Exception.Message)"
    exit 1
}
