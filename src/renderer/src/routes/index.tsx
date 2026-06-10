import { Routes, Route, Navigate } from 'react-router-dom'
import { HuaweiECSListPage } from './huawei/ECS/ECSListPage'
import { ECSInstanceDetail } from './huawei/ECS/ECSInstanceDetail'
import { CreateECSPage } from './huawei/ECS/CreateECSPage'
import { HuaweiOBSListPage } from './huawei/OBS/OBSListPage'
import { HuaweiOBSBucketDetail } from './huawei/OBS/OBSBucketDetail'
import { HuaweiEVSPage } from './huawei/EVS/EVSPage'
import { HuaweiVPCPage } from './huawei/VPC/VPCPage'
import { HuaweiRDSPage } from './huawei/RDS/RDSPage'
import { RDSInstanceDetail } from './huawei/RDS/RDSInstanceDetail'
import { HuaweiIMSPage } from './huawei/IMS/IMSPage'
import { HuaweiEIPPage } from './huawei/EIP/HuaweiEIPPage'
import { Dashboard } from './Dashboard'
import { EC2Page } from './EC2/EC2Page'
import { EC2InstanceDetail } from './EC2/EC2InstanceDetail'
import { S3Page } from './S3/S3Page'
import { S3ObjectBrowser } from './S3/S3ObjectBrowser'
import { BucketDetail } from './S3/BucketDetail'
import { ECSPage } from './ECS/ECSPage'
import { ECSClusterDetail } from './ECS/ECSClusterDetail'
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
      <Route path="/ecs/:clusterName" element={<ECSClusterDetail />} />
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
      <Route path="/huawei/ecs" element={<HuaweiECSListPage />} />
      <Route path="/huawei/ecs/create" element={<CreateECSPage />} />
      <Route path="/huawei/ecs/:serverId" element={<ECSInstanceDetail />} />
      <Route path="/huawei/obs" element={<HuaweiOBSListPage />} />
      <Route path="/huawei/obs/:bucket/detail" element={<HuaweiOBSBucketDetail />} />
      <Route path="/huawei/evs" element={<HuaweiEVSPage />} />
      <Route path="/huawei/vpc" element={<HuaweiVPCPage />} />
      <Route path="/huawei/rds" element={<HuaweiRDSPage />} />
      <Route path="/huawei/rds/:instanceId" element={<RDSInstanceDetail />} />
      <Route path="/huawei/ims" element={<HuaweiIMSPage />} />
      <Route path="/huawei/eip" element={<HuaweiEIPPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
