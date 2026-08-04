"use client";

import { useState } from "react";
import { useMediaCMS } from "@/features/media-cms-simulation/MediaCMSProvider";
import { projectProductMedia } from "@/features/media-cms-simulation/projection";
import { CatalogueProductMedia } from "./CatalogueMedia";
import type { ProductMedia } from "./types";
import styles from "./Catalogue.module.css";

export function SimulationProductGallery({
  media,
  productId = "",
  productTitle,
}: {
  media: readonly ProductMedia[];
  productId?: string;
  productTitle: string;
}) {
  const mediaCMS = useMediaCMS();
  const projected = projectProductMedia(
    { id: productId, media },
    mediaCMS.content,
  ).media;
  const [selected, setSelected] = useState(projected[0]?.id ?? "");
  const active = projected.find((item) => item.id === selected) ?? projected[0];
  if (!active) return null;
  return (
    <div
      aria-label={`${productTitle} gallery`}
      className={styles.galleryExperience}
      data-zoom-ready="true"
    >
      <div className={styles.galleryStage}>
        <CatalogueProductMedia media={active} />
        <button
          aria-label="Zoom preview is unavailable in development"
          className={styles.zoomPlaceholder}
          disabled
          type="button"
        >
          Zoom-ready preview
        </button>
      </div>
      <div
        aria-label={`${productTitle} thumbnails`}
        className={styles.thumbnails}
      >
        {projected.map((item, index) => (
          <button
            aria-label={`Show ${item.label.toLocaleLowerCase("en")}`}
            aria-pressed={item.id === active.id}
            key={item.id}
            onClick={() => setSelected(item.id)}
            type="button"
          >
            <CatalogueProductMedia media={item} />
            <span>{index + 1}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
