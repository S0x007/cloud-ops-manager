import { CloudWatchClient, GetMetricDataCommand } from '@aws-sdk/client-cloudwatch'
import { clientFactory } from './client.factory'

export interface MetricData {
  label: string; timestamps: string[]; values: number[]
}

export async function getInstanceMetrics(region: string, instanceId: string): Promise<MetricData[]> {
  const client = clientFactory.getClient(CloudWatchClient, { region })
  const now = new Date()
  const start = new Date(now.getTime() - 3 * 60 * 60 * 1000) // 过去 3 小时

  const queries = [
    { id: 'cpu', label: 'CPU 使用率 (%)', metric: 'CPUUtilization', stat: 'Average' },
    { id: 'netIn', label: '网络入站 (MB/s)', metric: 'NetworkIn', stat: 'Average' },
    { id: 'netOut', label: '网络出站 (MB/s)', metric: 'NetworkOut', stat: 'Average' },
    { id: 'diskRead', label: '磁盘读取 (MB/s)', metric: 'DiskReadBytes', stat: 'Average' },
    { id: 'diskWrite', label: '磁盘写入 (MB/s)', metric: 'DiskWriteBytes', stat: 'Average' },
  ]

  const resp = await client.send(new GetMetricDataCommand({
    StartTime: start, EndTime: now,
    MetricDataQueries: queries.map((q) => ({
      Id: q.id, Label: q.label, ReturnData: true,
      MetricStat: {
        Metric: { Namespace: 'AWS/EC2', MetricName: q.metric, Dimensions: [{ Name: 'InstanceId', Value: instanceId }] },
        Period: 300, Stat: q.stat,
      },
    })),
  }))

  return (resp.MetricDataResults ?? []).map((r) => ({
    label: r.Label ?? '',
    timestamps: (r.Timestamps ?? []).map((t) => t.toISOString()),
    values: (r.Values ?? []).map((v) => {
      // 转换单位：Bytes → MB
      if (r.Label?.includes('MB/s')) return v / (1024 * 1024)
      return v
    }),
  }))
}
