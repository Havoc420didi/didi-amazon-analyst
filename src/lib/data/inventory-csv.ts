import fs from 'node:fs/promises';
import path from 'node:path';
import { InventoryPoint } from '@/types/inventory-view';

const CSV_FILE = path.join(process.cwd(), 'src', '库存点数据Sampley.csv');

function parseNumber(value: string | undefined): number {
  const v = (value ?? '').trim();
  if (!v) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function getInventoryPointsFromCSV(): Promise<InventoryPoint[]> {
  const raw = await fs.readFile(CSV_FILE, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length <= 1) return [];

  const headers = lines[0].split(',');
  const hIndex = (name: string) => headers.indexOf(name);

  const idx = {
    asin: hIndex('ASIN'),
    productName: hIndex('品名'),
    salesPerson: hIndex('业务员'),
    marketplace: hIndex('库存点'),
    fbaAvailable: hIndex('FBA可用'),
    fbaInbound: hIndex('FBA在途'),
    localAvailable: hIndex('本地仓'),
    averageSales: hIndex('平均销量'),
    dailySalesAmount: hIndex('日均销售额'),
    totalInventory: hIndex('总库存'),
    adImpressions: hIndex('广告曝光量'),
    adClicks: hIndex('广告点击量'),
    adSpend: hIndex('广告花费'),
    adOrderCount: hIndex('广告订单量'),
    turnoverDays: hIndex('库存周转天数'),
    inventoryStatus: hIndex('库存状态'),
  };

  const points: InventoryPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    if (!cells.length) continue;

    const status = (cells[idx.inventoryStatus] ?? '').trim();

    const point: InventoryPoint = {
      asin: (cells[idx.asin] ?? '').trim(),
      productName: (cells[idx.productName] ?? '').trim(),
      salesPerson: (cells[idx.salesPerson] ?? '').trim(),
      marketplace: (cells[idx.marketplace] ?? '').trim(),

      fbaAvailable: parseNumber(cells[idx.fbaAvailable]),
      fbaInbound: parseNumber(cells[idx.fbaInbound]),
      localAvailable: parseNumber(cells[idx.localAvailable]),
      averageSales: parseNumber(cells[idx.averageSales]),
      dailySalesAmount: parseNumber(cells[idx.dailySalesAmount]),
      totalInventory: parseNumber(cells[idx.totalInventory]),

      adImpressions: parseNumber(cells[idx.adImpressions]),
      adClicks: parseNumber(cells[idx.adClicks]),
      adSpend: parseNumber(cells[idx.adSpend]),
      adOrderCount: parseNumber(cells[idx.adOrderCount]),

      turnoverDays: parseNumber(cells[idx.turnoverDays]),
      isLowInventory: status === '库存不足',
      isTurnoverExceeded: status === '周转超标',
      isOutOfStock: parseNumber(cells[idx.totalInventory]) <= 0,
      isZeroSales: parseNumber(cells[idx.averageSales]) <= 0,
    };

    points.push(point);
  }

  return points;
}


