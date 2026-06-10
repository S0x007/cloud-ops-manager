import type { ProviderManifest } from './types'

export const HUAWEI_MANIFEST: ProviderManifest = {
  id: 'huawei',
  name: 'Huawei Cloud',
  nameZh: '华为云',
  color: '#CF0A2C',
  defaultRegion: 'cn-north-4',
  regions: [
    { id: 'cn-north-1', name: 'CN North-Beijing 1', nameZh: '华北-北京一' },
    { id: 'cn-north-2', name: 'CN North-Beijing 2', nameZh: '华北-北京二' },
    { id: 'cn-north-4', name: 'CN North-Beijing 4', nameZh: '华北-北京四' },
    { id: 'cn-east-2', name: 'CN East-Shanghai 2', nameZh: '华东-上海二' },
    { id: 'cn-east-3', name: 'CN East-Shanghai 3', nameZh: '华东-上海三' },
    { id: 'cn-south-1', name: 'CN South-Guangzhou', nameZh: '华南-广州' },
    { id: 'cn-south-2', name: 'CN South-Shenzhen', nameZh: '华南-深圳' },
    { id: 'cn-southwest-2', name: 'CN Southwest-Guiyang 1', nameZh: '西南-贵阳一' },
    { id: 'ap-southeast-1', name: 'AP-Hong Kong', nameZh: '亚太-香港' },
    { id: 'ap-southeast-2', name: 'AP-Bangkok', nameZh: '亚太-曼谷' },
    { id: 'ap-southeast-3', name: 'AP-Singapore', nameZh: '亚太-新加坡' },
    { id: 'ap-southeast-4', name: 'AP-Jakarta', nameZh: '亚太-雅加达' },
    { id: 'af-south-1', name: 'AF-Johannesburg', nameZh: '非洲-约翰内斯堡' },
    { id: 'sa-brazil-1', name: 'LA-São Paulo', nameZh: '拉美-圣保罗' },
    { id: 'la-north-2', name: 'LA-Mexico City 2', nameZh: '拉美-墨西哥城二' },
    { id: 'la-south-2', name: 'LA-Santiago', nameZh: '拉美-圣地亚哥' },
  ],
  menus: [
    { key: 'compute', labelKey: 'sidebar.compute', children: [
      { key: '/huawei/ecs', icon: 'CloudServerOutlined', labelKey: 'huawei.ecs' },
    ]},
    { key: 'storage', labelKey: 'sidebar.storage', children: [
      { key: '/huawei/obs', icon: 'FolderOutlined', labelKey: 'huawei.obs' },
      { key: '/huawei/evs', icon: 'HddOutlined', labelKey: 'huawei.evs' },
    ]},
    { key: 'network', labelKey: 'sidebar.network', children: [
      { key: '/huawei/vpc', icon: 'ApartmentOutlined', labelKey: 'huawei.vpc' },
      { key: '/huawei/eip', icon: 'GlobalOutlined', labelKey: 'huawei.eip' },
    ]},
    { key: 'database', labelKey: 'sidebar.database', children: [
      { key: '/huawei/rds', icon: 'DatabaseOutlined', labelKey: 'huawei.rds' },
    ]},
    { key: 'other', labelKey: 'sidebar.other', children: [
      { key: '/huawei/ims', icon: 'BuildOutlined', labelKey: 'huawei.ims' },
    ]},
    { key: 'settings', labelKey: 'sidebar.settings', children: [
      { key: '/settings', icon: 'SettingOutlined', labelKey: 'sidebar.credentials' },
    ]},
  ],
}
