import { join } from 'node:path'
import { app, BrowserWindow, nativeTheme, shell, type BrowserWindowConstructorOptions } from 'electron'
import { registerIpc, TITLE_BAR_HEIGHT } from './ipc'

function createWindow(): void {
  // Mismos colores de fondo que la interfaz (styles.css), para que no haya un destello al abrir.
  const dark = nativeTheme.shouldUseDarkColors
  const ground = dark ? '#16110e' : '#eee6dc'
  const ink = dark ? '#f3e9df' : '#2a1f18'

  // En Windows y macOS la barra de título es propia: ahí van las pestañas de los repos.
  // En Linux se deja la del sistema, porque cada escritorio la dibuja distinto.
  const titleBar: BrowserWindowConstructorOptions =
    process.platform === 'win32'
      ? { titleBarStyle: 'hidden', titleBarOverlay: { color: ground, symbolColor: ink, height: TITLE_BAR_HEIGHT } }
      : process.platform === 'darwin'
        ? { titleBarStyle: 'hiddenInset', trafficLightPosition: { x: 14, y: 13 } }
        : {}

  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    show: false,
    title: 'GitOno',
    autoHideMenuBar: true,
    backgroundColor: ground,
    ...titleBar,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  window.once('ready-to-show', () => window.show())

  // Los links se abren en el navegador del sistema, nunca dentro de la app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpc()
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
