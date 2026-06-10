/** AWS / 华为云实例规格的人类可读展示 */

export interface AwsTypeInfo {
  vcpu: number
  memoryGiB: number
}

function awsFamilyKey(instanceType: string): string {
  return instanceType.split('.')[0]?.replace(/\d/g, '') ?? ''
}

function awsFamilyFallback(instanceType: string, t: (key: string) => string): string {
  const base = awsFamilyKey(instanceType)
  const translated = t(`ec2.family.${base}`)
  return translated !== `ec2.family.${base}` ? translated : base.toUpperCase()
}

function awsHeuristicSpec(instanceType: string): { vcpu: number; mem: number } {
  const base = awsFamilyKey(instanceType)
  const sizePart = instanceType.split('.')[1] || ''
  const mult = sizePart.includes('xlarge') ? parseInt(sizePart, 10) || 1 : 0
  const vcpu = mult > 0 ? mult * 4 : sizePart.includes('large') ? 2 : sizePart.includes('medium') ? 2 : 1
  const mem = mult > 0 && base === 'r' ? mult * 32
    : mult > 0 && base === 'x' ? mult * 64
    : mult > 0 && base === 't' ? mult * 4
    : mult > 0 ? mult * 16
    : sizePart.includes('large') ? 8
    : sizePart.includes('medium') ? 4
    : sizePart.includes('small') ? 2
    : 1
  return { vcpu, mem }
}

/** 例：1vCPU / 2GB 突增型 */
export function formatAwsInstanceSpec(
  instanceType: string,
  t: (key: string) => string,
  info?: AwsTypeInfo,
): string {
  if (!instanceType) return '-'
  const family = awsFamilyFallback(instanceType, t)
  const vcpu = info && info.vcpu > 0 ? info.vcpu : awsHeuristicSpec(instanceType).vcpu
  const mem = info && info.memoryGiB > 0 ? Math.round(info.memoryGiB) : awsHeuristicSpec(instanceType).mem
  return t('ec2.specFormat').replace('{vcpu}', String(vcpu)).replace('{mem}', String(mem)).replace('{family}', family)
}

/** 例：4 vCPU / 32 GB */
export function formatHuaweiFlavorSpec(vcpus?: number | string, memoryMB?: number | string): string {
  const cpu = Number(vcpus)
  const memMb = Number(memoryMB)
  if (!Number.isFinite(cpu) || cpu <= 0) return '-'
  if (!Number.isFinite(memMb) || memMb <= 0) return `${cpu} vCPU`
  const memGb = memMb >= 1024 ? Math.round(memMb / 1024) : memMb
  return `${cpu} vCPU / ${memGb} GB`
}
