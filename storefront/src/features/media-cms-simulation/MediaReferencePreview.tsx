"use client";

import { findMedia, projectHomeMedia } from "./projection";
import { useMediaCMS } from "./MediaCMSProvider";
import type { HomeMedia } from "@/features/home/types";
import styles from "./MediaLibrary.module.css";

export function MediaReferencePreview({
  id,
  label,
}: {
  id: string | null;
  label: string;
}) {
  const media = useMediaCMS();
  const item = findMedia(media.content, id);
  if (!item) return null;
  return (
    <div
      aria-label={item.alt}
      className={styles.placeholder}
      data-media-reference={item.id}
      role="img"
    >
      <strong>{label}</strong>
      <span>{item.caption || item.displayName}</span>
    </div>
  );
}

export function useProjectedHomeMedia(fallback: HomeMedia, id: string | null) {
  const media = useMediaCMS();
  return projectHomeMedia(fallback, media.content, id);
}
