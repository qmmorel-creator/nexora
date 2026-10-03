// Types minimaux du module généré photos-nexora.jsx (code de Nexora repris tel quel).
import type { ReactElement } from "react";
export interface PhotoNexora { id: string; status: string; date: string; dateSource?: string; width: number; height: number; createdAt?: string; landmarks?: Record<string, { x: number; y: number } | null>; adjust?: Record<string, unknown> }
export interface Recadrage { x: number; y: number; w: number; h: number }
export interface Alignement { ok: boolean; reason?: string; transform?: unknown }
export const BODY_PHOTO_CSS: string;
export function bodyPhotoSorted(p: PhotoNexora[]): PhotoNexora[];
export function bodyPhotoRightPhoto(p: PhotoNexora[], referenceId: string | null, rightId: string | null): PhotoNexora | null;
export function bodyPhotoAlignment(photo: PhotoNexora, reference: PhotoNexora): Alignement;
export function bodyPhotoFormatDate(iso: string): string;
export function bodyPhotoDeltaLabel(from: string, to: string): string;
export function bodyPhotoNormalizeCrop(c: unknown): Recadrage | null;
export function BodyPhotoCompare(p: { reference: PhotoNexora; photo: PhotoNexora; alignment: Alignement; split: number; onSplit: (v: number) => void; onSplitCommit: (v?: number) => void; showLandmarks: boolean; crop: Recadrage | null }): ReactElement;
export function BodyPhotoCrop(p: { reference: PhotoNexora; photo: PhotoNexora; alignment: Alignement; crop: Recadrage | null; onSave: (c: Recadrage | null) => void; onClose: () => void }): ReactElement;
export function bodyPhotoSpec(widget: { bodyPhotos?: unknown } | null): { rightId: string; split: number; showLandmarks: boolean; crops: Record<string, Recadrage> };
export function WidgetBodyPhotos(p: { widget: { bodyPhotos?: unknown }; externalToolbarSlot?: HTMLElement | null; onUpdateWidget: (patch: { bodyPhotos: Record<string, unknown> }) => void }): ReactElement;
