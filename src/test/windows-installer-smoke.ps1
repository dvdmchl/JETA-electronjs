param(
    [Parameter(Mandatory = $true)]
    [string]$InstallerPath
)

$ErrorActionPreference = 'Stop'
$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
$installedJeta = Get-ChildItem 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall' -ErrorAction SilentlyContinue |
    Get-ItemProperty | Where-Object { $_.DisplayName -eq 'JETA' }
if ($installedJeta) { throw 'Use a clean test account: JETA is already installed for this user.' }
$testDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ('jeta-install-' + [guid]::NewGuid())
$application = $null

try {
    $setup = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$testDirectory") -WindowStyle Hidden -Wait -PassThru
    if ($setup.ExitCode -ne 0) { throw "Installer exited with $($setup.ExitCode)." }
    $executable = Join-Path $testDirectory 'JETA.exe'
    if (-not (Test-Path -LiteralPath $executable)) { throw 'Installed executable is missing.' }
    if (-not (Test-Path -LiteralPath (Join-Path $testDirectory 'Uninstall JETA.exe'))) {
        throw 'Installed uninstaller is missing.'
    }
    if (-not (Test-Path -LiteralPath (Join-Path $testDirectory 'samples/test/Test.yaml'))) {
        throw 'Bundled sample game is missing.'
    }

    $application = Start-Process -FilePath $executable -WindowStyle Hidden -PassThru
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    do {
        Start-Sleep -Milliseconds 500
        $application.Refresh()
        if ($application.HasExited) { throw "Installed application exited with $($application.ExitCode)." }
        # The title is updated only after the bundled index game loads successfully.
        if ($application.MainWindowTitle -match '^Jeta - index_(en|cs)\.yaml$') {
            Write-Output 'Installed JETA started and loaded its bundled index game.'
            break
        }
    } while ([DateTime]::UtcNow -lt $deadline)
    if ($application.MainWindowTitle -notmatch '^Jeta - index_(en|cs)\.yaml$') {
        throw 'Installed JETA did not load its index game within 30 seconds.'
    }
} finally {
    if ($application -and -not $application.HasExited) {
        $null = $application.CloseMainWindow()
        if (-not $application.WaitForExit(5000)) { Stop-Process -Id $application.Id -Force }
    }
    $uninstaller = Join-Path $testDirectory 'Uninstall JETA.exe'
    if (Test-Path -LiteralPath $uninstaller) {
        $uninstall = Start-Process -FilePath $uninstaller -ArgumentList '/S' -WindowStyle Hidden -Wait -PassThru
        if ($uninstall.ExitCode -ne 0) { throw "Uninstaller exited with $($uninstall.ExitCode)." }
        $deadline = [DateTime]::UtcNow.AddSeconds(20)
        while ((Test-Path -LiteralPath (Join-Path $testDirectory 'JETA.exe')) -and [DateTime]::UtcNow -lt $deadline) {
            Start-Sleep -Milliseconds 500
        }
        if (Test-Path -LiteralPath (Join-Path $testDirectory 'JETA.exe')) {
            throw 'Uninstaller did not remove the application.'
        }
        Write-Output 'Test installation was uninstalled successfully.'
    }
}
