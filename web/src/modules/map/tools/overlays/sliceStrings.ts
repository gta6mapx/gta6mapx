// ─── modules/map/tools/overlays/sliceStrings.ts ───────────────────────
// Overlays slice UI strings. Same rule as tools/strings.ts: ONE language
// (English). Overlays components import copy from here, never hardcode
// inline. (tools/strings.ts is owned by the coordinator — it merges these.)

export const overlayStrings = {
  panelTitle: "Overlays",
  panelHint: "Image and tile overlays — sit above the base map",
  empty: "No overlays yet — import an image to compare against anything.",
  emptyBuiltInNote:
    "No built-in map art here — comparisons are your own imports only.",
  importImage: "Import image overlay",
  overlayOpacity: "Opacity",
  overlayVisible: "Visible",
  overlayHidden: "Hidden",
  overlayMoveUp: "Move up",
  overlayMoveDown: "Move down",
  overlayRename: "Rename",
  overlayRemove: "Remove",
  overlayRemoveConfirm: (name: string) => `Remove overlay "${name}"?`,
  overlayRemoveYes: "Remove overlay",
  overlayRenameSave: "Save name",
  overlayRenameCancel: "Cancel rename",
  overlayRenameLabel: (name: string) => `Rename overlay "${name}"`,
  overlayNeedsFile: "Needs file — re-select the image to restore placement",
  overlayReselect: "Re-select file",
  overlayYourImage: "Your image — stored only on this device",
  overlayPlaceTitle: "Place image on map",
  overlayPlaceStep: (n: number) =>
    n <= 3 ? `Click map point ${n} of 3` : `Click image corner ${n - 3} of 3`,
  overlayPlaceStepLabel: (done: number) =>
    `${done} of 3 points placed — click the map to continue`,
  overlayPlaceHint:
    "Click 3 points on the map, then the matching 3 corners on your image.",
  overlayPlaceCancel: "Cancel placement",
  overlayPlaceImageTitle: "Click the 3 matching corners on your image",
  overlayTooBig: "Image is larger than 10 MB — pick a smaller file.",
  overlayBadType: "That file isn't an image — pick a PNG or JPEG.",
  overlayDownscaled: "Image downscaled to fit the 2048 px limit.",
  overlayLocalOnly:
    "Image files aren't stored — keep your file; re-select it next visit and your placement is restored.",
  overlayHashMismatch:
    "This file doesn't match the saved one — place the 3 points again.",
  overlayRestored: "Placement restored — image re-georeferenced.",
  overlayAdded: (name: string) => `Overlay "${name}" added.`,
  overlayRemoved: (name: string) => `Overlay "${name}" removed.`,
  overlayPlacementCancelled: "Placement cancelled.",
  overlayDegenerate:
    "Those 3 points are on a line — pick 3 points that form a triangle.",
  overlayDecodeFailed: "Couldn't read that image — try another file.",
  overlayLimit: (n: number) =>
    `Overlay limit reached (${n}) — remove one to import another.`,
  overlayCompareNote:
    "Overlays persist across base-layer switches and keep their order.",
  overlaysCorrupt: "Saved overlays couldn't be read — starting fresh.",
} as const;

export type OverlayStrings = typeof overlayStrings;

/** Same audit approach as tools/strings.ts: English-only, no empty strings. */
const NON_ENGLISH_TOKENS = [
  "koordinaten",
  "zur position",
  "anwenden",
  "suchen",
  "schließen",
  "werkzeug",
];

export function auditOverlayStrings(strings: OverlayStrings): string[] {
  const violations: string[] = [];
  const check = (value: string, key: string) => {
    if (typeof value !== "string" || value.trim().length === 0) {
      violations.push(`${key}: empty or not a string`);
      return;
    }
    const lower = value.toLowerCase();
    for (const token of NON_ENGLISH_TOKENS) {
      if (lower.includes(token)) violations.push(`${key}: contains "${token}"`);
    }
  };
  for (const [key, value] of Object.entries(strings)) {
    if (typeof value === "function") {
      try {
        const probed = (value as (...a: never[]) => string)(
          ...(["Test", 3].slice(0, value.length) as never[])
        );
        check(probed, key);
      } catch {
        violations.push(`${key}: template function threw on probe args`);
      }
    } else {
      check(value, key);
    }
  }
  return violations;
}
