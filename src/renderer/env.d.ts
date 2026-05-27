import { electronAPI } from '../preload/api'

declare global {
  interface Window {
    electronAPI: typeof electronAPI
  }
}
