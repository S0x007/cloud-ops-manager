import { useEffect, useRef, useCallback, useState } from 'react'
import { createPortal } from 'react-dom'

export interface ContextMenuItem {
  key: string
  label: string
  icon?: React.ReactNode
  danger?: boolean
  divider?: boolean // 在此项后显示分割线
  disabled?: boolean
  onClick: () => void
}

interface ContextMenuProps {
  visible: boolean
  x: number
  y: number
  items: ContextMenuItem[]
  onClose: () => void
}

export function ContextMenu({ visible, x, y, items, onClose }: ContextMenuProps): JSX.Element | null {
  const ref = useRef<HTMLDivElement>(null)

  // 点击外部关闭
  useEffect(() => {
    if (!visible) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    // 延迟绑定避免自身 click 触发
    setTimeout(() => {
      document.addEventListener('click', handler)
      document.addEventListener('keydown', keyHandler)
    }, 0)
    return () => {
      document.removeEventListener('click', handler)
      document.removeEventListener('keydown', keyHandler)
    }
  }, [visible, onClose])

  if (!visible) return null

  // 确保菜单不超出屏幕
  const menuWidth = 200
  const menuHeight = items.length * 36 + 8
  const adjX = Math.min(x, window.innerWidth - menuWidth - 10)
  const adjY = Math.min(y, window.innerHeight - menuHeight - 10)

  return createPortal(
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: adjX,
        top: adjY,
        zIndex: 9999,
        background: '#fff',
        border: '1px solid #e8e8e8',
        borderRadius: 8,
        boxShadow: '0 6px 16px rgba(0,0,0,0.12), 0 3px 6px rgba(0,0,0,0.08)',
        minWidth: 180,
        padding: '4px 0',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        fontSize: 13,
      }}
    >
      {items.map((item, idx) => (
        <div key={item.key}>
          <div
            onClick={() => {
              if (!item.disabled) {
                item.onClick()
                onClose()
              }
            }}
            style={{
              padding: '8px 16px',
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              opacity: item.disabled ? 0.4 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: item.danger ? '#ff4d4f' : '#333',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) e.currentTarget.style.background = '#f5f5f5'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = ''
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </div>
          {item.divider && (
            <div style={{ height: 1, background: '#f0f0f0', margin: '4px 0' }} />
          )}
        </div>
      ))}
    </div>,
    document.body,
  )
}

// Hook: 在任意组件中使用右键菜单
export function useContextMenu() {
  const [state, setState] = useState<{
    visible: boolean; x: number; y: number; items: ContextMenuItem[]
  }>({ visible: false, x: 0, y: 0, items: [] })

  const show = useCallback((e: React.MouseEvent, items: ContextMenuItem[]) => {
    e.preventDefault()
    e.stopPropagation()
    setState({ visible: true, x: e.clientX, y: e.clientY, items })
  }, [])

  const onClose = useCallback(() => {
    setState((s) => ({ ...s, visible: false }))
  }, [])

  return { ...state, show, onClose }
}
