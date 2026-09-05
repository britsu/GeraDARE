@echo off
chcp 65001 > nul
title GeraDARE - Selecionar Ícone do Atalho
cls
echo ============================================================
echo   GeraDARE - Selecionar Ícone da Área de Trabalho
echo ============================================================
echo.
echo Opções Minimalistas (Recomendadas):
echo   [1] Minimalista 1: Monograma D + Guia com Check Dourado [Ativo por Padrão]
echo   [2] Minimalista 2: Guia Fiscal com Selo de Aprovação Verde
echo   [3] Minimalista 3: Sol Geométrico do Tocantins + Guia
echo.
echo Outras Opções:
echo   [4] Escudo Fiscal 3D Metálico
echo   [5] Selo Dourado 3D Tocantins
echo   [6] Fintech Dark Neo 3D
echo.
set /p opcao="Digite o número da opção desejada (1 a 6): "

if "%opcao%"=="1" goto OP1
if "%opcao%"=="2" goto OP2
if "%opcao%"=="3" goto OP3
if "%opcao%"=="4" goto OP4
if "%opcao%"=="5" goto OP5
if "%opcao%"=="6" goto OP6
echo Opção inválida. Nenhuma alteração feita.
pause
exit /b

:OP1
set ICO=minimalista1_letra_d.ico
goto APPLY

:OP2
set ICO=minimalista2_guia_check.ico
goto APPLY

:OP3
set ICO=minimalista3_sol_tocantins.ico
goto APPLY

:OP4
set ICO=opcao1_escudo.ico
goto APPLY

:OP5
set ICO=opcao2_selo.ico
goto APPLY

:OP6
set ICO=opcao3_fintech.ico
goto APPLY

:APPLY
echo.
echo Aplicando ícone %ICO%...
copy /Y "c:\Users\User\Documents\GeraDARE\assets\icons\%ICO%" "c:\Users\User\Documents\GeraDARE\assets\icons\app_icon.ico" > nul

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([System.IO.Path]::Combine([Environment]::GetFolderPath('Desktop'), 'GeraDARE.lnk')); $s.IconLocation = 'c:\Users\User\Documents\GeraDARE\assets\icons\app_icon.ico, 0'; $s.Save()"

echo Ícone atualizado com sucesso no atalho da Área de Trabalho!
echo.
pause
