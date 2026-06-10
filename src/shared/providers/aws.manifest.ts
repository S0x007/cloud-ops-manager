import type { ProviderManifest } from './types'

export const AWS_MANIFEST: ProviderManifest = {
  id: 'aws',
  name: 'AWS',
  nameZh: '亚马逊云',
  color: '#FF9900',
  defaultRegion: 'us-east-1',
  regions: [
    { id: 'us-east-1', name: 'us-east-1 (N. Virginia)', nameZh: '美东-弗吉尼亚' },
    { id: 'us-east-2', name: 'us-east-2 (Ohio)', nameZh: '美东-俄亥俄' },
    { id: 'us-west-1', name: 'us-west-1 (N. California)', nameZh: '美西-加利福尼亚' },
    { id: 'us-west-2', name: 'us-west-2 (Oregon)', nameZh: '美西-俄勒冈' },
    { id: 'ap-east-1', name: 'ap-east-1 (Hong Kong)', nameZh: '亚太-香港' },
    { id: 'ap-southeast-1', name: 'ap-southeast-1 (Singapore)', nameZh: '亚太-新加坡' },
    { id: 'ap-southeast-2', name: 'ap-southeast-2 (Sydney)', nameZh: '亚太-悉尼' },
    { id: 'ap-southeast-3', name: 'ap-southeast-3 (Jakarta)', nameZh: '亚太-雅加达' },
    { id: 'ap-northeast-1', name: 'ap-northeast-1 (Tokyo)', nameZh: '亚太-东京' },
    { id: 'ap-northeast-2', name: 'ap-northeast-2 (Seoul)', nameZh: '亚太-首尔' },
    { id: 'ap-northeast-3', name: 'ap-northeast-3 (Osaka)', nameZh: '亚太-大阪' },
    { id: 'ap-south-1', name: 'ap-south-1 (Mumbai)', nameZh: '亚太-孟买' },
    { id: 'ap-south-2', name: 'ap-south-2 (Hyderabad)', nameZh: '亚太-海得拉巴' },
    { id: 'eu-west-1', name: 'eu-west-1 (Ireland)', nameZh: '欧洲-爱尔兰' },
    { id: 'eu-west-2', name: 'eu-west-2 (London)', nameZh: '欧洲-伦敦' },
    { id: 'eu-west-3', name: 'eu-west-3 (Paris)', nameZh: '欧洲-巴黎' },
    { id: 'eu-central-1', name: 'eu-central-1 (Frankfurt)', nameZh: '欧洲-法兰克福' },
    { id: 'eu-central-2', name: 'eu-central-2 (Zurich)', nameZh: '欧洲-苏黎世' },
    { id: 'eu-north-1', name: 'eu-north-1 (Stockholm)', nameZh: '欧洲-斯德哥尔摩' },
    { id: 'eu-south-1', name: 'eu-south-1 (Milan)', nameZh: '欧洲-米兰' },
    { id: 'sa-east-1', name: 'sa-east-1 (São Paulo)', nameZh: '南美-圣保罗' },
    { id: 'me-south-1', name: 'me-south-1 (Bahrain)', nameZh: '中东-巴林' },
    { id: 'me-central-1', name: 'me-central-1 (UAE)', nameZh: '中东-阿联酋' },
    { id: 'af-south-1', name: 'af-south-1 (Cape Town)', nameZh: '非洲-开普敦' },
    { id: 'ca-central-1', name: 'ca-central-1 (Canada)', nameZh: '加拿大-中部' },
  ],
  menus: [
    { key: 'compute', labelKey: 'sidebar.compute', children: [
      { key: '/ec2', icon: 'CloudServerOutlined', labelKey: 'sidebar.ec2' },
      { key: '/ecs', icon: 'ContainerOutlined', labelKey: 'sidebar.ecs' },
    ]},
    { key: 'storage', labelKey: 'sidebar.storage', children: [
      { key: '/s3', icon: 'FolderOutlined', labelKey: 'sidebar.s3' },
      { key: '/volumes', icon: 'HddOutlined', labelKey: 'sidebar.ebs' },
      { key: '/snapshots', icon: 'CameraOutlined', labelKey: 'sidebar.snapshots' },
    ]},
    { key: 'network', labelKey: 'sidebar.network', children: [
      { key: '/security-groups', icon: 'SafetyOutlined', labelKey: 'sidebar.sg' },
      { key: '/elastic-ips', icon: 'GlobalOutlined', labelKey: 'sidebar.eip' },
      { key: '/key-pairs', icon: 'KeyOutlined', labelKey: 'sidebar.keypairs' },
      { key: '/network', icon: 'ApartmentOutlined', labelKey: 'sidebar.network2' },
    ]},
    { key: 'other', labelKey: 'sidebar.other', children: [
      { key: '/amis', icon: 'BuildOutlined', labelKey: 'sidebar.ami' },
    ]},
    { key: 'settings', labelKey: 'sidebar.settings', children: [
      { key: '/settings', icon: 'SettingOutlined', labelKey: 'sidebar.credentials' },
    ]},
  ],
}
