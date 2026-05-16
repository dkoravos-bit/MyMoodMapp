/**
 * Cycle tab — redirects to home since cycle tracking is now a dashboard widget.
 * The full cycle tracker is accessible from the widget on the home dashboard.
 */
import { Redirect } from 'expo-router';

export default function CycleTab() {
  return <Redirect href="/(tabs)" />;
}
