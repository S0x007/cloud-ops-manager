import { useEC2Store } from './ec2Store'
import { useS3Store } from './s3Store'

/** 切换凭证/区域时清空各模块缓存，避免展示上一账号的数据 */
export function resetResourceStores(): void {
  useEC2Store.getState().reset()
  useS3Store.getState().reset()
}
