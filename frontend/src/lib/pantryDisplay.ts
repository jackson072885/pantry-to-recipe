type PantryDisplayLike = {
  ingredient?: string;
  name?: string;
  title?: string;
  code?: string;
};

export function getPantryDisplayName(item: PantryDisplayLike): string {
  const displayName = item.ingredient ?? item.name ?? item.title ?? "";
  return String(displayName).trim();
}
