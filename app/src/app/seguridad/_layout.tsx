import { NativeTabs } from 'expo-router/native-tabs';
import { Platform } from 'react-native';

import { WebTabs, type WebTab } from '@/components/web-tabs';
import { brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TABS: WebTab[] = [
  { name: 'escanear', title: 'Escanear', ion: 'qr-code-outline', ionOn: 'qr-code' },
  { name: 'jugadoras', title: 'Jugadoras', ion: 'people-outline', ionOn: 'people' },
  { name: 'registro', title: 'Registro', ion: 'list-outline', ionOn: 'list' },
  { name: 'calendario', title: 'Calendario', ion: 'calendar-outline', ionOn: 'calendar' },
  { name: 'mas', title: 'Más', ion: 'ellipsis-horizontal-circle-outline', ionOn: 'ellipsis-horizontal-circle' },
];

export default function Tabs() {
  const t = useTheme();
  if (Platform.OS === 'web') return <WebTabs base="seguridad" tabs={TABS} />;
  return (
    <NativeTabs tintColor={t.tint} backgroundColor={t.surface} indicatorColor={t.tintWeak} badgeBackgroundColor={brand.gold} badgeTextColor={brand.navyDeep}>
      <NativeTabs.Trigger name="escanear">
        <NativeTabs.Trigger.Label>Escanear</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'qrcode.viewfinder', selected: 'qrcode.viewfinder' }} md="qr_code_scanner" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="jugadoras">
        <NativeTabs.Trigger.Label>Jugadoras</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="group" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="registro">
        <NativeTabs.Trigger.Label>Registro</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'list.bullet.rectangle', selected: 'list.bullet.rectangle.fill' }} md="list" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendario">
        <NativeTabs.Trigger.Label>Calendario</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="mas">
        <NativeTabs.Trigger.Label>Más</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'ellipsis.circle', selected: 'ellipsis.circle.fill' }} md="more_horiz" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
