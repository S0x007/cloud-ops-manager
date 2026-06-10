/** 华为云 ECS 服务器 */
export interface HuaweiServer {
  id: string
  name: string
  status: string
  flavor: string
  vcpus: number
  memoryMB: number
  imageId: string
  publicIp: string
  privateIp: string
  availabilityZone: string
  createdAt: string
  vpcId: string
  subnetId: string
  securityGroupIds: string[]
  osType: string
  keyName?: string
  diskConfig: string
  tags: Record<string, string>
}
