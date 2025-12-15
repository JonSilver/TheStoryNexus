#!/usr/bin/env pwsh

<#
.SYNOPSIS
    Updates version in package.json, updates package-lock.json, and creates git commit.

.PARAMETER Action
    'major', 'minor', 'patch', or 'set'

.PARAMETER Version
    Exact version for 'set' action (e.g., "1.2.3")

.PARAMETER CommitMessage
    Custom commit message. Defaults to "chore: bump version to X.Y.Z"

.PARAMETER DryRun
    Preview changes without applying
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
    [switch]$DryRun
)

$ScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptRoot
Set-Location $ProjectRoot

function Test-SemanticVersion {
    param([string]$VersionString)
    return $VersionString -match '^\d+\.\d+\.\d+$'
}

function Get-VersionComponents {
    param([string]$VersionString)
    $parts = $VersionString.Split('.')
    return @{
        Major = [int]$parts[0]
        Minor = [int]$parts[1]
        Patch = [int]$parts[2]
    }
}

function New-VersionString {
    param($Major, $Minor, $Patch)
    return "$Major.$Minor.$Patch"
}

function Compare-SemanticVersion {
    param([string]$Version1, [string]$Version2)

    $v1 = Get-VersionComponents $Version1
    $v2 = Get-VersionComponents $Version2

    if ($v1.Major -lt $v2.Major) { return -1 }
    if ($v1.Major -gt $v2.Major) { return 1 }
    if ($v1.Minor -lt $v2.Minor) { return -1 }
    if ($v1.Minor -gt $v2.Minor) { return 1 }
    if ($v1.Patch -lt $v2.Patch) { return -1 }
    if ($v1.Patch -gt $v2.Patch) { return 1 }
    return 0
}

try {
    $PackageJsonPath = Join-Path $ProjectRoot "package.json"
    if (-not (Test-Path $PackageJsonPath)) {
        throw "package.json not found in project root: $ProjectRoot"
    }

    Write-Host "Reading package.json..." -ForegroundColor Cyan
    $PackageContent = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
    $CurrentVersion = $PackageContent.version

    Write-Host "Current version: $CurrentVersion" -ForegroundColor Yellow

    if (-not (Test-SemanticVersion $CurrentVersion)) {
        throw "Current version '$CurrentVersion' is not valid semver (x.y.z)"
    }

    $VersionComponents = Get-VersionComponents $CurrentVersion
    $NewVersion = ""

    switch ($Action) {
        "major" {
            $NewVersion = New-VersionString ($VersionComponents.Major + 1) 0 0
        }
        "minor" {
            $NewVersion = New-VersionString $VersionComponents.Major ($VersionComponents.Minor + 1) 0
        }
        "patch" {
            $NewVersion = New-VersionString $VersionComponents.Major $VersionComponents.Minor ($VersionComponents.Patch + 1)
        }
        "set" {
            if (-not $Version) {
                throw "Version parameter is required when Action is 'set'"
            }
            if (-not (Test-SemanticVersion $Version)) {
                throw "Provided version '$Version' is not valid semver (x.y.z)"
            }

            $VersionComparison = Compare-SemanticVersion $Version $CurrentVersion
            if ($VersionComparison -lt 0) {
                throw "Cannot set version to '$Version' - lower than current '$CurrentVersion'"
            }
            if ($VersionComparison -eq 0) {
                throw "Version '$Version' is same as current. No change needed."
            }

            $NewVersion = $Version
        }
    }

    Write-Host "New version will be: $NewVersion" -ForegroundColor Green

    if ($DryRun) {
        Write-Host "`n--- DRY RUN ---" -ForegroundColor Magenta
        Write-Host "Would update package.json: $CurrentVersion -> $NewVersion"
        Write-Host "Would run: npm install --package-lock-only"
        Write-Host "Would commit: $(if ($CommitMessage) { $CommitMessage } else { "chore: bump version to $NewVersion" })"
        Write-Host "--- END DRY RUN ---`n" -ForegroundColor Magenta
        return
    }

    # Check for uncommitted changes
    Write-Host "Checking git status..." -ForegroundColor Cyan
    $GitStatus = git status --porcelain
    if ($GitStatus) {
        Write-Warning "Uncommitted changes:"
        Write-Host $GitStatus -ForegroundColor Yellow
        $Confirm = Read-Host "Continue anyway? (y/N)"
        if ($Confirm -ne 'y' -and $Confirm -ne 'Y') {
            Write-Host "Aborted." -ForegroundColor Red
            return
        }
    }

    # Update package.json
    Write-Host "Updating package.json..." -ForegroundColor Cyan
    $PackageContent.version = $NewVersion
    $UpdatedJson = $PackageContent | ConvertTo-Json -Depth 10
    Set-Content $PackageJsonPath -Value $UpdatedJson -Encoding UTF8

    # Update package-lock.json
    Write-Host "Running npm install --package-lock-only..." -ForegroundColor Cyan
    $NpmResult = npm install --package-lock-only 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm install failed:"
        Write-Host $NpmResult -ForegroundColor Red
        throw "npm install --package-lock-only failed"
    }

    # Create git commit
    $FinalCommitMessage = if ($CommitMessage) { $CommitMessage } else { "chore: bump version to $NewVersion" }
    Write-Host "Creating git commit..." -ForegroundColor Cyan

    git add package.json package-lock.json
    $CommitResult = git commit -m $FinalCommitMessage 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Git commit failed:"
        Write-Host $CommitResult -ForegroundColor Red
        throw "git commit failed"
    }

    Write-Host "`nSuccess!" -ForegroundColor Green
    Write-Host "Version: $CurrentVersion -> $NewVersion" -ForegroundColor Green
    Write-Host "Commit: '$FinalCommitMessage'" -ForegroundColor Green

}
catch {
    Write-Error "Error: $($_.Exception.Message)"
    exit 1
}
