import { NativeTabs } from 'expo-router/native-tabs';
import { Platform } from 'react-native';

import { WebTabs, type WebTab } from '@/components/web-tabs';
import { brand } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TABS: WebTab[] = [
  { name: 'inicio', title: 'Inicio', ion: 'home-outline', ionOn: 'home' },
  { name: 'permisos', title: 'Permisos', ion: 'exit-outline', ionOn: 'exit' },
  { name: 'calendario', title: 'Calendario', ion: 'calendar-outline', ionOn: 'calendar' },
  { name: 'visitas', title: 'Visitas', ion: 'people-outline', ionOn: 'people' },
  { name: 'servicios', title: 'Servicios', ion: 'construct-outline', ionOn: 'construct' },
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
      <NativeTabs.Trigger name="visitas">
        <NativeTabs.Trigger.Label>Visitas</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.2', selected: 'person.2.fill' }} md="group" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="servicios">
        <NativeTabs.Trigger.Label>Servicios</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'wrench.and.screwdriver', selected: 'wrench.and.screwdriver.fill' }} md="build" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
