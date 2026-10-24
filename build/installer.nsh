; Agregados al instalador de electron-builder (ver `nsis.include` en electron-builder.yml).

; El desinstalador borra la carpeta de instalación completa, y el instalador lo ejecuta antes de
; actualizar. Si la app quedó instalada dentro de un proyecto (pasó dos veces con la carpeta de
; GitOno), eso borraría el proyecto entero. Se frena si la carpeta tiene .git o package.json,
; que nunca están en una instalación de la app.
!macro customUnInit
  ${if} ${FileExists} "$INSTDIR\.git\*.*"
  ${orIf} ${FileExists} "$INSTDIR\package.json"
    MessageBox MB_OK|MB_ICONSTOP "No se desinstala GitOno de $INSTDIR porque esa carpeta parece un proyecto (tiene .git o package.json) y el desinstalador la borraría entera.$\r$\n$\r$\nBorrá a mano solo los archivos de la app." /SD IDOK
    SetErrorLevel 2
    Quit
  ${endIf}
!macroend
