import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts'
import { clientFactory } from './client.factory'

interface CallerIdentity {
  accountId: string
  arn: string
  userId: string
}

export async function getCallerIdentity(): Promise<CallerIdentity> {
  const client = clientFactory.getClient(STSClient)
  const response = await client.send(new GetCallerIdentityCommand({}))
  return {
    accountId: response.Account ?? 'unknown',
    arn: response.Arn ?? 'unknown',
    userId: response.UserId ?? 'unknown',
  }
}
