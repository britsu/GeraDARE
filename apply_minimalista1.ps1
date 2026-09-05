$icoPath = "c:\Users\User\Documents\GeraDARE\assets\icons\minimalista1_letra_d.ico"
$appIconPath = "c:\Users\User\Documents\GeraDARE\assets\icons\app_icon.ico"
$publicFavicon = "c:\Users\User\Documents\GeraDARE\public\favicon.ico"

# 1. Update app_icon.ico and public/favicon.ico
Copy-Item $icoPath $appIconPath -Force
Copy-Item $icoPath $publicFavicon -Force
Write-Host "Ícone copiado para app_icon.ico e public/favicon.ico"

# 2. Update Desktop Shortcut
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "GeraDARE.lnk"

$wscript = New-Object -ComObject WScript.Shell
$shortcut = $wscript.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "c:\Users\User\Documents\GeraDARE\start_geradare.bat"
$shortcut.WorkingDirectory = "c:\Users\User\Documents\GeraDARE"
$shortcut.Description = "GeraDARE - Automação DARE ICMS ST SEFAZ/TO"
$shortcut.IconLocation = "$icoPath, 0"
$shortcut.Save()
Write-Host "Atalho da Área de Trabalho atualizado com: $icoPath"

# 3. Notify Windows Shell to refresh icon cache immediately
$signature = @'
[DllImport("shell32.dll", CharSet = CharSet.Auto, SetLastError = true)]
public static extern void SHChangeNotify(uint wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);
'@
$type = Add-Type -MemberDefinition $signature -Name Win32Shell -Namespace Win32Functions -PassThru
$SHCNE_ASSOCCHANGED = 0x08000000
$SHCNF_IDLIST = 0x0000
$type::SHChangeNotify($SHCNE_ASSOCCHANGED, $SHCNF_IDLIST, [IntPtr]::Zero, [IntPtr]::Zero)

Write-Host "Cache de ícones do Windows Explorer atualizado com sucesso!"
