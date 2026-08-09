"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type {
  CatalogueCategory,
  CatalogueProduct,
  CatalogueQuery,
} from "@/features/catalogue-simulation/types";
import { SimulationProductCard } from "@/features/catalogue-simulation/ProductCard";
import { useProductCMS } from "@/features/product-cms-simulation";
import {
  cmsDiscoveryProducts,
  filterAndSortDiscoveryProducts,
  fixtureDiscoveryProducts,
} from "./domain";
import { DiscoveryScope, useDiscovery } from "./DiscoveryProvider";
import type { DiscoveryProduct, DiscoverySort } from "./types";
import styles from "./Discovery.module.css";

const sortOptions: readonly [DiscoverySort, string][] = [
  ["NEWEST", "Newest"],
  ["OLDEST", "Oldest"],
  ["FEATURED", "Featured"],
  ["TRENDING", "Trending"],
  ["NAME_ASC", "Alphabetical A-Z"],
  ["NAME_DESC", "Alphabetical Z-A"],
  ["PRICE_ASC", "Price low to high"],
  ["PRICE_DESC", "Price high to low"],
  ["MOST_VIEWED", "Most viewed (simulated)"],
  ["MOST_POPULAR", "Most popular (simulated)"],
];

export function DiscoveryListing({
  products,
  categories,
  query,
  enabled,
}: {
  products: readonly CatalogueProduct[];
  categories: readonly CatalogueCategory[];
  query: CatalogueQuery;
  enabled: boolean;
}) {
  return (
    <DiscoveryScope enabled={enabled}>
      <DiscoveryListingContent
        categories={categories}
        products={products}
        query={query}
      />
    </DiscoveryScope>
  );
}

function DiscoveryListingContent({
  products,
  categories,
  query,
}: {
  products: readonly CatalogueProduct[];
  categories: readonly CatalogueCategory[];
  query: CatalogueQuery;
}) {
  const discovery = useDiscovery();
  const cms = useProductCMS();
  const router = useRouter();
  const initialized = useRef(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const suggestionRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const activeSuggestionRef = useRef(-1);
  const suggestionListId = useId();
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const items = useMemo(
    () =>
      cms.enabled
        ? cmsDiscoveryProducts(
            cms.content.products,
            cms.content.categories,
            cms.content.collections,
          )
        : fixtureDiscoveryProducts(products),
    [cms.content, cms.enabled, products],
  );

  useEffect(() => {
    if (!discovery.hydrated || initialized.current) return;
    initialized.current = true;
    const initial = {
      ...(query.keyword ? { search: query.keyword } : {}),
      ...(query.category ? { category: query.category } : {}),
    };
    if (Object.keys(initial).length) discovery.setFilters(initial);
  }, [discovery, query.category, query.keyword]);

  useEffect(() => {
    if (!discovery.hydrated || discovery.state.scrollPosition <= 0) return;
    if (navigator.userAgent.toLocaleLowerCase("en").includes("jsdom")) return;
    const frame = window.requestAnimationFrame(() =>
      window.scrollTo({ top: discovery.state.scrollPosition }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [discovery.hydrated, discovery.state.scrollPosition]);

  useEffect(() => {
    if (!suggestionsOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !searchBoxRef.current?.contains(event.target)
      ) {
        setSuggestionsOpen(false);
        activeSuggestionRef.current = -1;
        setActiveSuggestion(-1);
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [suggestionsOpen]);

  useEffect(() => {
    if (activeSuggestion < 0) return;
    const option = suggestionRefs.current[activeSuggestion];
    if (typeof option?.scrollIntoView === "function") {
      option.scrollIntoView({ block: "nearest" });
    }
  }, [activeSuggestion]);

  const filtered = useMemo(
    () => filterAndSortDiscoveryProducts(items, discovery.state.filters),
    [discovery.state.filters, items],
  );
  const visible = filtered.slice(0, discovery.state.visibleCount);
  const keyword = discovery.state.filters.search.trim();
  const suggestions = keyword
    ? items
        .filter((item) =>
          item.searchTerms
            .join(" ")
            .toLocaleLowerCase("en")
            .includes(keyword.toLocaleLowerCase("en")),
        )
        .slice(0, 24)
    : [];
  const collectionOptions = [
    ...new Map(
      items.map((item) => [item.collectionId, item.collectionName]),
    ).entries(),
  ];
  const activeFilters = activeFilterLabels(discovery.state.filters);

  function updateActiveSuggestion(index: number) {
    activeSuggestionRef.current = index;
    setActiveSuggestion(index);
  }

  function selectSuggestion(item: DiscoveryProduct) {
    discovery.setFilters({ search: item.product.title });
    discovery.rememberSearch(item.product.title);
    setSuggestionsOpen(false);
    updateActiveSuggestion(-1);
    router.push(`/products/${item.product.slug}`);
  }

  return (
    <div className={styles.listingLayout}>
      <aside className={styles.filters} aria-label="Advanced product filters">
        <h2>Discover products</h2>
        <div className={styles.searchBox} ref={searchBoxRef}>
          <label htmlFor="discovery-search">Search products</label>
          <input
            aria-activedescendant={
              activeSuggestion >= 0
                ? `${suggestionListId}-option-${activeSuggestion}`
                : undefined
            }
            aria-autocomplete="list"
            aria-controls={suggestionListId}
            aria-expanded={suggestionsOpen && Boolean(keyword)}
            aria-haspopup="listbox"
            autoComplete="off"
            id="discovery-search"
            maxLength={80}
            onChange={(event) => {
              discovery.setFilters({ search: event.target.value });
              setSuggestionsOpen(true);
              updateActiveSuggestion(-1);
            }}
            onFocus={() => setSuggestionsOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                setSuggestionsOpen(false);
                updateActiveSuggestion(-1);
              } else if (event.key === "ArrowDown" && suggestions.length) {
                event.preventDefault();
                setSuggestionsOpen(true);
                updateActiveSuggestion(
                  (activeSuggestionRef.current + 1) % suggestions.length,
                );
              } else if (event.key === "ArrowUp" && suggestions.length) {
                event.preventDefault();
                setSuggestionsOpen(true);
                updateActiveSuggestion(
                  activeSuggestionRef.current <= 0
                    ? suggestions.length - 1
                    : activeSuggestionRef.current - 1,
                );
              } else if (event.key === "Enter") {
                const selected = suggestions[activeSuggestionRef.current];
                if (selected) {
                  event.preventDefault();
                  selectSuggestion(selected);
                } else {
                  discovery.rememberSearch(keyword);
                }
              }
            }}
            placeholder="Search simulated jewellery"
            role="combobox"
            type="search"
            value={discovery.state.filters.search}
          />
          {keyword ? (
            <button
              onClick={() => {
                discovery.setFilters({ search: "" });
                setSuggestionsOpen(false);
                updateActiveSuggestion(-1);
              }}
              type="button"
            >
              Clear search
            </button>
          ) : null}
          {suggestionsOpen && keyword ? (
            <div
              className={styles.suggestions}
              id={suggestionListId}
              role="listbox"
            >
              {suggestions.length ? (
                suggestions.map((item, index) => (
                  <Link
                    aria-selected={activeSuggestion === index}
                    className={styles.suggestionRow}
                    href={`/products/${item.product.slug}`}
                    id={`${suggestionListId}-option-${index}`}
                    key={item.product.id}
                    onClick={(event) => {
                      event.preventDefault();
                      selectSuggestion(item);
                    }}
                    onMouseEnter={() => updateActiveSuggestion(index)}
                    onMouseDown={(event) => event.preventDefault()}
                    ref={(node) => {
                      suggestionRefs.current[index] = node;
                    }}
                    role="option"
                    tabIndex={-1}
                  >
                    <span className={styles.suggestionSearchIcon} aria-hidden>
                      <svg viewBox="0 0 24 24">
                        <path d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
                      </svg>
                    </span>
                    <span
                      aria-hidden
                      className={styles.suggestionThumbnail}
                      data-suggestion-thumbnail
                    >
                      SS
                    </span>
                    <span className={styles.suggestionContent}>
                      <span className={styles.suggestionHeading}>
                        <strong title={item.product.title}>
                          <HighlightedText
                            text={item.product.title}
                            query={keyword}
                          />
                        </strong>
                        {item.product.badges[0] ? (
                          <span className={styles.suggestionBadge}>
                            {badgeLabel(item.product.badges[0])}
                          </span>
                        ) : null}
                      </span>
                      <span className={styles.suggestionMeta}>
                        <span>{item.product.category.title}</span>
                        <span aria-hidden>•</span>
                        <span>{item.collectionName}</span>
                        <span aria-hidden>•</span>
                        <span>{purityLabel(item.product.purity)}</span>
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <div className={styles.noSuggestions} role="status">
                  <strong>No matching suggestions</strong>
                  <span>Try Silver, Sankha, Pola, featured, or wholesale.</span>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {discovery.state.recentSearches.length ? (
          <div className={styles.history}>
            <div>
              <strong>Recent searches</strong>
              <button onClick={discovery.clearSearchHistory} type="button">
                Clear history
              </button>
            </div>
            <div className={styles.chips}>
              {discovery.state.recentSearches.map((search) => (
                <button
                  key={search}
                  onClick={() => discovery.setFilters({ search })}
                  type="button"
                >
                  {search}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <label>
          Category
          <select
            onChange={(event) =>
              discovery.setFilters({ category: event.target.value })
            }
            value={discovery.state.filters.category}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          Collection
          <select
            onChange={(event) =>
              discovery.setFilters({ collection: event.target.value })
            }
            value={discovery.state.filters.collection}
          >
            <option value="">All collections</option>
            {collectionOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <div className={styles.priceFields}>
          <label>
            Minimum simulated price
            <input
              min="0"
              onChange={(event) =>
                discovery.setFilters({
                  minPrice: numericValue(event.target.value),
                })
              }
              type="number"
              value={discovery.state.filters.minPrice ?? ""}
            />
          </label>
          <label>
            Maximum simulated price
            <input
              min="0"
              onChange={(event) =>
                discovery.setFilters({
                  maxPrice: numericValue(event.target.value),
                })
              }
              type="number"
              value={discovery.state.filters.maxPrice ?? ""}
            />
          </label>
        </div>
        <fieldset>
          <legend>Merchandising</legend>
          {(
            [
              ["featured", "Featured"],
              ["trending", "Trending"],
              ["newArrival", "New arrival"],
              ["wholesale", "Wholesale available"],
            ] as const
          ).map(([key, label]) => (
            <label className={styles.check} key={key}>
              <input
                checked={discovery.state.filters[key]}
                onChange={(event) =>
                  discovery.setFilters({ [key]: event.target.checked })
                }
                type="checkbox"
              />
              {label}
            </label>
          ))}
        </fieldset>
        <p className={styles.note}>
          Public discovery contains published products only. Draft and archived
          filters remain inside Product CMS.
        </p>
        <button onClick={discovery.resetFilters} type="button">
          Reset filters
        </button>
      </aside>

      <section
        className={styles.results}
        aria-labelledby="discovery-results-title"
      >
        <div className={styles.resultHeader}>
          <div>
            <h2 id="discovery-results-title">Catalogue results</h2>
            <p aria-live="polite">
              {filtered.length} simulated{" "}
              {filtered.length === 1 ? "product" : "products"}
            </p>
          </div>
          <label>
            Sort products
            <select
              onChange={(event) =>
                discovery.setFilters({
                  sort: event.target.value as DiscoverySort,
                })
              }
              value={discovery.state.filters.sort}
            >
              {sortOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {activeFilters.length ? (
          <div aria-label="Active filters" className={styles.activeFilters}>
            {activeFilters.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>
        ) : null}
        {discovery.state.comparison.length ? (
          <div className={styles.compareBar} role="status">
            <span>
              {discovery.state.comparison.length} of 4 products selected
            </span>
            <Link href="/compare">Open comparison</Link>
          </div>
        ) : null}
        {visible.length ? (
          <div
            className={styles.productGrid}
            aria-label="Simulated product catalogue"
          >
            {visible.map((item) => (
              <SimulationProductCard
                highlight={keyword}
                key={item.product.id}
                onNavigate={() => discovery.rememberScroll(window.scrollY)}
                product={item.product}
              />
            ))}
          </div>
        ) : (
          <div className={styles.empty} role="status">
            <h3>No simulated products match</h3>
            <p>
              Try a broader price range, remove a merchandising filter, or
              search for Sankha or Pola.
            </p>
            <button onClick={discovery.resetFilters} type="button">
              Clear all discovery filters
            </button>
          </div>
        )}
        {visible.length < filtered.length ? (
          <button
            className={styles.loadMore}
            onClick={discovery.showMore}
            type="button"
          >
            Load more products
          </button>
        ) : null}
      </section>
    </div>
  );
}

function numericValue(value: string) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}

function badgeLabel(value: CatalogueProduct["badges"][number]) {
  return value === "MADE_TO_ORDER" ? "Made to order" : value.toLowerCase();
}

function purityLabel(value: CatalogueProduct["purity"]) {
  if (value === "925_SILVER") return "925 silver";
  if (value === "999_SILVER") return "999 silver";
  return "Gold plated";
}

function activeFilterLabels(
  filters: ReturnType<typeof useDiscovery>["state"]["filters"],
) {
  return [
    filters.search ? `Search: ${filters.search}` : "",
    filters.category ? `Category: ${filters.category}` : "",
    filters.collection ? "Collection selected" : "",
    filters.minPrice !== null
      ? `Min: ₹${filters.minPrice.toLocaleString("en-IN")}`
      : "",
    filters.maxPrice !== null
      ? `Max: ₹${filters.maxPrice.toLocaleString("en-IN")}`
      : "",
    filters.featured ? "Featured" : "",
    filters.trending ? "Trending" : "",
    filters.newArrival ? "New arrival" : "",
    filters.wholesale ? "Wholesale" : "",
  ].filter(Boolean);
}

export function HighlightedText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const normalized = query.trim();
  const index = text
    .toLocaleLowerCase("en")
    .indexOf(normalized.toLocaleLowerCase("en"));
  if (!normalized || index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + normalized.length)}</mark>
      {text.slice(index + normalized.length)}
    </>
  );
}
