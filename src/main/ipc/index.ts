import { registerProfilesIpc } from './profiles.ipc'
import { registerEc2Ipc } from './ec2.ipc'
import { registerEc2SecurityGroupsIpc } from './ec2-security-groups.ipc'
import { registerEc2VolumesIpc } from './ec2-volumes.ipc'
import { registerEc2AddressesIpc } from './ec2-addresses.ipc'
import { registerEc2KeyPairsIpc } from './ec2-keypairs.ipc'
import { registerEc2NetworkIpc } from './ec2-network.ipc'
import { registerEc2AmisIpc } from './ec2-amis.ipc'
import { registerS3Ipc } from './s3.ipc'
import { registerS3BucketIpc } from './s3-bucket.ipc'
import { registerEcsIpc } from './ecs.ipc'
import { registerSsmIpc } from './ssm.ipc'
import { registerSsmCommandIpc } from './ssm-command.ipc'
import { registerCloudWatchIpc } from './cloudwatch.ipc'
import { registerAppIpc } from './app.ipc'
import { registerUpdaterIpc } from './updater.ipc'
import { registerCloudRouter } from './cloud-router'
import { initAutoUpdater } from '../updater'

export function registerAllIpcHandlers(): void {
  registerAppIpc()
  registerUpdaterIpc()
  registerProfilesIpc()
  registerEc2Ipc()
  registerEc2SecurityGroupsIpc()
  registerEc2VolumesIpc()
  registerEc2AddressesIpc()
  registerEc2KeyPairsIpc()
  registerEc2NetworkIpc()
  registerEc2AmisIpc()
  registerS3Ipc()
  registerS3BucketIpc()
  registerEcsIpc()
  registerSsmIpc()
  registerSsmCommandIpc()
  registerCloudWatchIpc()
  registerCloudRouter()
}
