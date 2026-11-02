import { NativeTabs } from 'expo-router/native-tabs';
import { Platform } from 'react-native';

import { WebTabs, type WebTab } from '@/components/web-tabs';
import { brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TABS: WebTab[] = [
  { name: 'inicio', title: 'Inicio', ion: 'home-outline', ionOn: 'home' },
  { name: 'permisos', title: 'Permisos', ion: 'exit-outline', ionOn: 'exit' },
  { name: 'calendario', title: 'Calendario', ion: 'calendar-outline', ionOn: 'calendar' },
  { name: 'comidas', title: 'Comidas', ion: 'restaurant-outline', ionOn: 'restaurant' },
  { name: 'mas', title: 'Más', ion: 'ellipsis-horizontal-circle-outline', ionOn: 'ellipsis-horizontal-circle' },
];

export default function Tabs() {
  const t = useTheme();
  if (Platform.OS === 'web') return <WebTabs base="jugadora" tabs={TABS} />;
  return (
    <NativeTabs tintColor={t.tint} backgroundColor={t.surface} indicatorColor={t.tintWeak} badgeBackgroundColor={brand.gold} badgeTextColor={brand.navyDeep}>
      <NativeTabs.Trigger name="inicio">
        <NativeTabs.Trigger.Label>Inicio</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="permisos">
        <NativeTabs.Trigger.Label>Permisos</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'rectangle.portrait.and.arrow.right', selected: 'rectangle.portrait.and.arrow.right.fill' }} md="exit_to_app" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendario">
        <NativeTabs.Trigger.Label>Calendario</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'calendar', selected: 'calendar' }} md="calendar_month" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="comidas">
        <NativeTabs.Trigger.Label>Comidas</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'fork.knife', selected: 'fork.knife' }} md="restaurant" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="mas">
        <NativeTabs.Trigger.Label>Más</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'ellipsis.circle', selected: 'ellipsis.circle.fill' }} md="more_horiz" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
