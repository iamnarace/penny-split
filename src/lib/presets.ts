import type { Adjustment } from "./bill";

/** The "+ Tip", "+ Tax"… buttons and the extra each one adds. */
export interface Preset {
  label: string;
  kind: Adjustment["kind"];
  value: number;
  split: Adjustment["split"];
  compound: boolean;
}

export const PRESETS: Preset[] = [
  { label: "Tip", kind: "percent", value: 10, split: "proportional", compound: true },
  { label: "Tax", kind: "percent", value: 10, split: "proportional", compound: false },
  { label: "Service charge", kind: "percent", value: 10, split: "proportional", compound: false },
  { label: "Card surcharge", kind: "percent", value: 1.5, split: "proportional", compound: true },
  { label: "Delivery fee", kind: "amount", value: 0, split: "even", compound: false },
  { label: "Discount", kind: "amount", value: 0, split: "proportional", compound: false },
];
