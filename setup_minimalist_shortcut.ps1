Add-Type -AssemblyName System.Drawing

$assetsDir = "c:\Users\User\Documents\GeraDARE\assets\icons"
if (!(Test-Path $assetsDir)) {
    New-Item -ItemType Directory -Path $assetsDir -Force | Out-Null
}

$m1 = "C:\Users\User\.gemini\antigravity\brain\169b075a-4fbc-4add-bce0-d2d63b9ed75a\icon_mini_letter_d_1788459873126.jpg"
$m2 = "C:\Users\User\.gemini\antigravity\brain\169b075a-4fbc-4add-bce0-d2d63b9ed75a\icon_mini_doc_stamp_1788459898908.jpg"
$m3 = "C:\Users\User\.gemini\antigravity\brain\169b075a-4fbc-4add-bce0-d2d63b9ed75a\icon_mini_gold_sun_1788459927198.jpg"

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
    Write-Host "Criado ícone minimalista: $destIco"
}

Copy-Item $m1 "$assetsDir\minimalista1_letra_d.jpg" -Force
Copy-Item $m2 "$assetsDir\minimalista2_guia_check.jpg" -Force
Copy-Item $m3 "$assetsDir\minimalista3_sol_tocantins.jpg" -Force

Convert-ToIco "$assetsDir\minimalista1_letra_d.jpg" "$assetsDir\minimalista1_letra_d.ico"
Convert-ToIco "$assetsDir\minimalista2_guia_check.jpg" "$assetsDir\minimalista2_guia_check.ico"
Convert-ToIco "$assetsDir\minimalista3_sol_tocantins.jpg" "$assetsDir\minimalista3_sol_tocantins.ico"

# Set minimalista1 as default app_icon.ico
Copy-Item "$assetsDir\minimalista1_letra_d.ico" "$assetsDir\app_icon.ico" -Force

# Update Desktop Shortcut
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "GeraDARE.lnk"

$wscript = New-Object -ComObject WScript.Shell
$shortcut = $wscript.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "c:\Users\User\Documents\GeraDARE\start_geradare.bat"
$shortcut.WorkingDirectory = "c:\Users\User\Documents\GeraDARE"
$shortcut.Description = "GeraDARE - Automação DARE ICMS ST SEFAZ/TO"
$shortcut.IconLocation = "$assetsDir\app_icon.ico, 0"
$shortcut.Save()

Write-Host "Atalho da Área de Trabalho atualizado com sucesso com o ícone Minimalista 1!"
