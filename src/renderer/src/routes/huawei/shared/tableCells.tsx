import { Typography } from 'antd'
import type { ReactNode } from 'react'

const { Text } = Typography

const rowFlex: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  maxWidth: '100%',
  minWidth: 0,
  verticalAlign: 'middle',
}

const textEllipsis: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  minWidth: 0,
}

/** 名称列：图标 + 单行省略 */
export function renderResourceName(
  label: string,
  icon: ReactNode,
  options?: { onClick?: () => void; title?: string },
): JSX.Element {
  const display = label || '-'
  const content = (
    <>
      <span style={{ flexShrink: 0, lineHeight: 1 }}>{icon}</span>
      <span style={{ ...textEllipsis, marginLeft: 6 }} title={options?.title ?? display}>
        {display}
      </span>
    </>
  )
  if (options?.onClick) {
    return (
      <a onClick={options.onClick} style={{ ...rowFlex, color: '#1677ff' }}>
        {content}
      </a>
    )
  }
  return <span style={rowFlex}>{content}</span>
}

/** ID 列：等宽字体 + 单行省略 + 可复制 */
export function renderResourceId(id: string): JSX.Element {
  return (
    <Text
      code
      copyable={{ text: id }}
      ellipsis={{ tooltip: id }}
      style={{ fontSize: 11, maxWidth: '100%', display: 'block' }}
    >
      {id}
    </Text>
  )
}

export const HUAWEI_NAME_COL = { width: 200, ellipsis: true as const }
export const HUAWEI_ID_COL = { width: 280, ellipsis: true as const }
