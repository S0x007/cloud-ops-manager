/**
 * 华为云 IMS 服务 — 镜像管理
 */

import { ImsClient } from '@huaweicloud/huaweicloud-sdk-ims/v2/ImsClient'
import { ListImagesRequest } from '@huaweicloud/huaweicloud-sdk-ims/v2/model/ListImagesRequest'
import { huaweiFactory } from '../huawei-client'

function readField(img: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    const value = img[key]
    if (value !== undefined && value !== null && value !== '') return value
  }
  return undefined
}

function readString(img: Record<string, unknown>, ...keys: string[]): string {
  const value = readField(img, ...keys)
  return value === undefined ? '' : String(value)
}

function readNumber(img: Record<string, unknown>, ...keys: string[]): number | undefined {
  const value = readField(img, ...keys)
  if (value === undefined) return undefined
  const num = Number(value)
  return Number.isFinite(num) ? num : undefined
}

function resolveMinDiskGb(img: Record<string, unknown>): number {
  const minDisk = readNumber(img, 'minDisk', 'min_disk')
  if (minDisk !== undefined && minDisk > 0) return minDisk

  const imageSize = readString(img, 'imageSize', '__image_size')
  const parsedSize = Number(imageSize)
  if (Number.isFinite(parsedSize) && parsedSize > 0) return parsedSize

  return minDisk ?? 0
}

function resolveArchitecture(img: Record<string, unknown>): string {
  const arch = readString(img, 'architecture')
  if (arch) return arch

  const osBit = readString(img, 'osBit', '__os_bit')
  if (osBit) return `${osBit}-bit`

  const supportArm = readField(img, 'supportArm', '__support_arm')
  if (supportArm === true || supportArm === 'true') return 'arm'

  const supportAmd = readField(img, '__support_amd')
  if (supportAmd === true || supportAmd === 'true') return 'x86'

  return ''
}

function mapImage(raw: unknown) {
  const img = raw as Record<string, unknown>
  const minDisk = resolveMinDiskGb(img)
  return {
    id: readString(img, 'id'),
    name: readString(img, 'name'),
    type: readString(img, 'imagetype', '__imagetype'),
    osType: readString(img, 'osType', '__os_type'),
    osVersion: readString(img, 'osVersion', '__os_version'),
    size: minDisk,
    status: readString(img, 'status'),
    createdAt: readString(img, 'createdAt', 'created_at'),
    minDisk,
    architecture: resolveArchitecture(img),
  }
}

export async function listImages(region: string): Promise<any[]> {
  const client = ImsClient.newBuilder()
    .withCredential(huaweiFactory.getCredentials())
    .withEndpoint(huaweiFactory.getEndpoint('ims', region))
    .build()
  const resp = await client.listImages(new ListImagesRequest().withImagetype('private').withLimit(500))
  return (resp.images ?? []).map(mapImage)
}
