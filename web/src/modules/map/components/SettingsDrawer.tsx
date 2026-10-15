"use client";

import { SettingsPanel } from "@/modules/engagement/settings/SettingsPanel";
import type { BaseStyleId } from "@/modules/map/styleManager";

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  baseStyle?: BaseStyleId;
  onBaseStyleChange?: (style: BaseStyleId) => void;
}

/**
 * Map settings drawer — thin shell over the unified SettingsPanel.
 *
 * All state lives in the engagement settings store (`gta6mapx:settings:v1`);
 * the panel is an overlay, so map state is never lost. GameMap subscribes to
 * the same store and live-applies map-affecting changes (clustering,
 * density, units) to the running MapLibre instance.
 */
export function SettingsDrawer({ open, onClose, baseStyle, onBaseStyleChange }: SettingsDrawerProps) {
  return (
    <SettingsPanel
      open={open}
      onClose={onClose}
      surface="map"
      baseStyle={baseStyle}
      onBaseStyleChange={onBaseStyleChange}
    />
  );
}
