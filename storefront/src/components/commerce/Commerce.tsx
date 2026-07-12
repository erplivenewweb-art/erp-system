"use client";

import { useState } from "react";
import { AvailabilityIndicator, Badge, Card, PriceBlock, Rating } from "@/components/display";
import { Icon } from "@/components/icons";
import { Button, IconButton } from "@/components/ui";
import styles from "./Commerce.module.css";

export function QuantitySelector({ disabled = false, initial = 1, label = "Quantity", max = 99, min = 1, onChange, step = 1 }: { disabled?: boolean; initial?: number; label?: string; max?: number; min?: number; onChange?: (value: number) => void; step?: number }) {
  const [value, setValue] = useState(Math.max(min, Math.min(max, initial)));
  function update(next: number) { const safe = Math.max(min, Math.min(max, next)); setValue(safe); onChange?.(safe); }
  return <div className={styles.quantity}><span id="quantity-label">{label}</span><div aria-labelledby="quantity-label" className={styles.quantityControls} role="group"><IconButton disabled={disabled || value <= min} label="Decrease quantity" onClick={() => update(value - step)}><Icon name="minus" /></IconButton><output aria-live="polite">{value}</output><IconButton disabled={disabled || value >= max} label="Increase quantity" onClick={() => update(value + step)}><Icon name="plus" /></IconButton></div></div>;
}

export function WishlistButton({ initial = false, label = "Save item" }: { initial?: boolean; label?: string }) {
  const [saved, setSaved] = useState(initial);
  return <IconButton label={saved ? "Remove saved item" : label} onClick={() => setSaved((value) => !value)} pressed={saved}><Icon name="heart" /></IconButton>;
}

export function ProductCardShell({ availability = "Available", name, price = "₹0.00" }: { availability?: string; name: string; price?: string }) {
  return <Card className={styles.productCard}><div aria-label="Product image placeholder" className={styles.imagePlaceholder} role="img"><span>4:5 media</span></div><div className={styles.productHeading}><div><Badge>Product shell</Badge><h3>{name}</h3></div><WishlistButton label={"Save " + name} /></div><PriceBlock amount={price} note="Synthetic showcase value" /><AvailabilityIndicator label={availability} status="success" /><Button disabled>Commerce action unavailable</Button></Card>;
}

export function ReviewCardShell({ author = "Sample customer", text = "Synthetic review content for component verification." }: { author?: string; text?: string }) {
  return <Card className={styles.review}><Rating count={1} value={5} /><blockquote>{text}</blockquote><p><strong>{author}</strong> · <span>Verified label unavailable in scaffold</span></p></Card>;
}

