import { Routes, Route } from 'react-router-dom'
import { Dashboard } from './Dashboard'
import { EC2Page } from './EC2/EC2Page'
import { EC2InstanceDetail } from './EC2/EC2InstanceDetail'
import { S3Page } from './S3/S3Page'
import { S3ObjectBrowser } from './S3/S3ObjectBrowser'
import { BucketDetail } from './S3/BucketDetail'
import { ECSPage } from './ECS/ECSPage'
import { VolumesPage } from './Volumes/VolumesPage'
import { SnapshotsPage } from './Snapshots/SnapshotsPage'
import { ElasticIPsPage } from './ElasticIPs/ElasticIPsPage'
import { KeyPairsPage } from './KeyPairs/KeyPairsPage'
import { NetworkPage } from './Network/NetworkPage'
import { AMIPage } from './AMI/AMIPage'
import { SecurityGroupsPage } from './SecurityGroups/SecurityGroupsPage'
import { SSMTerminalPage } from './Terminal/SSMTerminalPage'
import { PortForwardingPage } from './Terminal/PortForwardingPage'
import { SettingsPage } from './Settings/SettingsPage'

export function AppRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/ec2" element={<EC2Page />} />
      <Route path="/ec2/:instanceId" element={<EC2InstanceDetail />} />
      <Route path="/s3" element={<S3Page />} />
      <Route path="/s3/:bucket/detail" element={<BucketDetail />} />
      <Route path="/s3/:bucket/*" element={<S3ObjectBrowser />} />
      <Route path="/ecs" element={<ECSPage />} />
      <Route path="/volumes" element={<VolumesPage />} />
      <Route path="/snapshots" element={<SnapshotsPage />} />
      <Route path="/elastic-ips" element={<ElasticIPsPage />} />
      <Route path="/key-pairs" element={<KeyPairsPage />} />
      <Route path="/network" element={<NetworkPage />} />
      <Route path="/amis" element={<AMIPage />} />
      <Route path="/security-groups" element={<SecurityGroupsPage />} />
      <Route path="/terminal/ssm/:instanceId" element={<SSMTerminalPage />} />
      <Route path="/terminal/port-forward/:instanceId" element={<PortForwardingPage />} />
      <Route path="/terminal" element={<PortForwardingPage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}
