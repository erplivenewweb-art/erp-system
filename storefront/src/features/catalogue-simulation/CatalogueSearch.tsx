"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import type { CatalogueProduct } from "./types";
import styles from "./Catalogue.module.css";

const recentStorageKey = "silver-sankha-development-recent-searches";

function highlighted(value: string, keyword: string) {
  const index = value
    .toLocaleLowerCase("en")
    .indexOf(keyword.toLocaleLowerCase("en"));
  if (!keyword || index < 0) return value;
  return (
    <>
      {value.slice(0, index)}
      <mark>{value.slice(index, index + keyword.length)}</mark>
      {value.slice(index + keyword.length)}
    </>
  );
}

export function CatalogueSearch({
  products,
  initialValue,
  showDevelopmentRecents,
}: {
  products: readonly CatalogueProduct[];
  initialValue?: string;
  showDevelopmentRecents: boolean;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [focused, setFocused] = useState(false);
  const [recent, setRecent] = useState<readonly string[]>([]);
  const listId = useId();
  const suggestions = useMemo(() => {
    const normalized = value.trim().toLocaleLowerCase("en");
    if (!normalized) return [];
    return products
      .filter((product) =>
        [product.title, product.category.title, product.purity]
          .join(" ")
          .toLocaleLowerCase("en")
          .includes(normalized),
      )
      .slice(0, 5);
  }, [products, value]);

  useEffect(() => {
    if (!showDevelopmentRecents) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const parsed = JSON.parse(
          localStorage.getItem(recentStorageKey) ?? "[]",
        );
        if (Array.isArray(parsed)) {
          setRecent(
            parsed
              .filter((item): item is string => typeof item === "string")
              .slice(0, 4),
          );
        }
      } catch {
        setRecent([]);
      }
    });
    return () => {
      active = false;
    };
  }, [showDevelopmentRecents]);

  function remember() {
    const normalized = value.replace(/\s+/g, " ").trim().slice(0, 80);
    if (!showDevelopmentRecents || !normalized) return;
    const next = [
      normalized,
      ...recent.filter((item) => item !== normalized),
    ].slice(0, 4);
    setRecent(next);
    localStorage.setItem(recentStorageKey, JSON.stringify(next));
  }

  const expanded = focused && Boolean(value.trim());
  return (
    <div className={styles.searchExperience}>
      <label htmlFor="catalogue-search">Search products</label>
      <div className={styles.searchControl}>
        <input
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={expanded}
          autoComplete="off"
          id="catalogue-search"
          maxLength={80}
          name="q"
          onBlur={() => window.setTimeout(() => setFocused(false), 100)}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter") remember();
          }}
          placeholder="Sankha, Pola, silver…"
          role="combobox"
          type="search"
          value={value}
        />
        {value ? (
          <button
            aria-label="Clear product search"
            className={styles.clearSearch}
            onClick={() => setValue("")}
            type="button"
          >
            Clear
          </button>
        ) : null}
      </div>
      {expanded ? (
        <div className={styles.suggestions} id={listId} role="listbox">
          {suggestions.length ? (
            suggestions.map((product) => (
              <Link
                href={`/products/${product.slug}`}
                key={product.id}
                onClick={remember}
                role="option"
              >
                <span>{highlighted(product.title, value.trim())}</span>
                <small>{product.category.title}</small>
              </Link>
            ))
          ) : (
            <p>No live suggestions. Submit to view the full empty state.</p>
          )}
        </div>
      ) : null}
      {showDevelopmentRecents && recent.length ? (
        <div className={styles.recentSearches}>
          <span>Recent development searches</span>
          {recent.map((item) => (
            <button key={item} onClick={() => setValue(item)} type="button">
              {item}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
