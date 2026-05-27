import {
  SSMClient,
  DescribeInstanceInformationCommand,
  SendCommandCommand,
  GetCommandInvocationCommand,
  ListCommandInvocationsCommand,
} from '@aws-sdk/client-ssm'
import { clientFactory } from './client.factory'

// 检查实例是否被 SSM 管理
export async function checkSsmManaged(instanceId: string, region: string): Promise<{
  managed: boolean
  agentVersion?: string
  platformName?: string
  pingStatus?: string
  lastPingDateTime?: string
}> {
  try {
    const client = clientFactory.getClient(SSMClient, { region })
    const resp = await client.send(new DescribeInstanceInformationCommand({
      Filters: [{ Key: 'InstanceIds', Values: [instanceId] }],
    }))
    const info = resp.InstanceInformationList?.[0]
    return {
      managed: !!info,
      agentVersion: info?.AgentVersion,
      platformName: info?.PlatformName,
      pingStatus: info?.PingStatus,
      lastPingDateTime: info?.LastPingDateTime?.toISOString(),
    }
  } catch {
    return { managed: false }
  }
}

// 发送命令到实例
export async function sendCommand(
  region: string,
  instanceId: string,
  commands: string[],
  options?: {
    workingDirectory?: string
    timeoutSeconds?: number
    comment?: string
  },
): Promise<{ commandId: string; instanceId: string }> {
  const client = clientFactory.getClient(SSMClient, { region })
  const resp = await client.send(new SendCommandCommand({
    InstanceIds: [instanceId],
    DocumentName: 'AWS-RunShellScript',  // Linux
    Parameters: {
      commands,
      ...(options?.workingDirectory ? { workingDirectory: [options.workingDirectory] } : {}),
      ...(options?.timeoutSeconds ? { executionTimeout: [String(options.timeoutSeconds)] } : {}),
    },
    Comment: options?.comment,
    TimeoutSeconds: options?.timeoutSeconds ?? 60,
  }))
  return {
    commandId: resp.Command?.CommandId ?? '',
    instanceId,
  }
}

// 查询单次命令执行状态
export async function getCommandInvocation(
  region: string,
  commandId: string,
  instanceId: string,
): Promise<{
  status: string
  output: string
  error: string
  startTime?: string
  endTime?: string
}> {
  const client = clientFactory.getClient(SSMClient, { region })
  const resp = await client.send(new GetCommandInvocationCommand({
    CommandId: commandId,
    InstanceId: instanceId,
  }))
  return {
    status: resp.Status ?? 'Unknown',
    output: (resp.StandardOutputContent ?? '') + (resp.StandardErrorContent ? '\n[STDERR]\n' + resp.StandardErrorContent : ''),
    error: resp.StandardErrorContent ?? '',
    startTime: resp.ExecutionStartDateTime?.toISOString(),
    endTime: resp.ExecutionEndDateTime?.toISOString(),
  }
}

// 列出最近的命令历史
export async function listRecentCommands(
  region: string,
  instanceId: string,
  maxResults: number = 20,
): Promise<Array<{
  commandId: string
  status: string
  documentName: string
  requestedDateTime?: string
  comment?: string
}>> {
  const client = clientFactory.getClient(SSMClient, { region })
  const resp = await client.send(new ListCommandInvocationsCommand({
    InstanceId: instanceId,
    MaxResults: maxResults,
    Details: true,
  }))
  return (resp.CommandInvocations ?? []).map((c) => ({
    commandId: c.CommandId ?? '',
    status: c.Status ?? 'Unknown',
    documentName: c.DocumentName ?? 'AWS-RunShellScript',
    requestedDateTime: c.RequestedDateTime?.toISOString(),
    comment: c.Comment,
  }))
}
