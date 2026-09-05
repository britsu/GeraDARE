Add-Type -AssemblyName System.Drawing

$assetsDir = "c:\Users\User\Documents\GeraDARE\assets\icons"
if (!(Test-Path $assetsDir)) {
    New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null
}

$img1 = "C:\Users\User\.gemini\antigravity\brain\169b075a-4fbc-4add-bce0-d2d63b9ed75a\icon_fiscal_shield_1788459651616.jpg"
$img2 = "C:\Users\User\.gemini\antigravity\brain\169b075a-4fbc-4add-bce0-d2d63b9ed75a\icon_gold_seal_1788459672010.jpg"
$img3 = "C:\Users\User\.gemini\antigravity\brain\169b075a-4fbc-4add-bce0-d2d63b9ed75a\icon_fintech_dare_1788459694535.jpg"

function Convert-ToIco([string]$srcJpg, [string]$destIco) {
    $bmp = [System.Drawing.Bitmap]::FromFile($srcJpg)
    $resized = New-Object System.Drawing.Bitmap(256, 256)
    $graphics = [System.Drawing.Graphics]::FromImage($resized)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($bmp, 0, 0, 256, 256)
    $graphics.Dispose()
    
    $hIcon = $resized.GetHicon()
    $icon = [System.Drawing.Icon]::FromHandle($hIcon)
    $fileStream = New-Object System.IO.FileStream($destIco, [System.IO.FileMode]::Create)
    $icon.Save($fileStream)
    $fileStream.Close()
    $resized.Dispose()
    $bmp.Dispose()
    Write-Host "Criado ícone: $destIco"
}

Copy-Item $img1 "$assetsDir\opcao1_escudo.jpg" -Force
Copy-Item $img2 "$assetsDir\opcao2_selo.jpg" -Force
Copy-Item $img3 "$assetsDir\opcao3_fintech.jpg" -Force

Convert-ToIco "$assetsDir\opcao1_escudo.jpg" "$assetsDir\opcao1_escudo.ico"
Convert-ToIco "$assetsDir\opcao2_selo.jpg" "$assetsDir\opcao2_selo.ico"
Convert-ToIco "$assetsDir\opcao3_fintech.jpg" "$assetsDir\opcao3_fintech.ico"

# Set opcao1 as default app_icon.ico
Copy-Item "$assetsDir\opcao1_escudo.ico" "$assetsDir\app_icon.ico" -Force

# Create Desktop Shortcut
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "GeraDARE.lnk"

$wscript = New-Object -ComObject WScript.Shell
$shortcut = $wscript.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "c:\Users\User\Documents\GeraDARE\start_geradare.bat"
$shortcut.WorkingDirectory = "c:\Users\User\Documents\GeraDARE"
$shortcut.Description = "GeraDARE - Automação DARE ICMS ST SEFAZ/TO"
$shortcut.IconLocation = "$assetsDir\app_icon.ico, 0"
$shortcut.Save()

Write-Host "Atalho criado na Área de Trabalho: $shortcutPath"
