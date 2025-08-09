import { InventoryPoint } from '@/types/inventory-view';

export function maskInventoryPoints(items: InventoryPoint[], isLoggedIn: boolean): InventoryPoint[] {
  if (isLoggedIn) return items;
  return items.map((it) => ({
    ...it,
    asin: '***',
    productName: '***',
  }));
}


