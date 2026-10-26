import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { getState } from '../store.js';

export const isNative = () => Capacitor.isNativePlatform();

const on = () => isNative() && getState().settings.haptics;

export function tap() {
  if (on()) Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
}

export function thud() {
  if (on()) Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
}

export function success() {
  if (on()) Haptics.notification({ type: NotificationType.Success }).catch(() => {});
}
