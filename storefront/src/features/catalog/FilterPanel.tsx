import styles from "./Catalog.module.css";

const fields = [
  ["category", "Category", ["All categories", "Sankha Forms", "Pola Forms", "Ceremonial Pairs"]],
  ["purity", "Purity", ["All approved values", "Pending CMS approval"]],
  ["weight", "Weight", ["All weights", "Light", "Medium", "Statement"]],
  ["size", "Size", ["All sizes", "Size guide pending"]],
  ["price", "Price range", ["All published prices", "Price pending"]],
  ["availability", "Availability", ["All availability", "Publication pending"]],
] as const;

export function FilterPanel() {
  return <aside className={styles.filterPanel} aria-label="Catalogue filters"><fieldset><legend>Refine catalogue</legend>{fields.map(([id, label, options]) => <label key={id} htmlFor={`filter-${id}`}>{label}<select defaultValue={options[0]} id={`filter-${id}`} name={id}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>)}<label htmlFor="filter-sort">Sort by<select defaultValue="Featured" id="filter-sort" name="sort"><option>Featured</option><option>Newest</option><option>Name</option><option>Weight</option><option>Price (when published)</option></select></label></fieldset></aside>;
}
