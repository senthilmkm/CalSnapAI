import { BarcodeProduct } from '../types/nutrition';

// Offline smart fallbacks catalog keyed or indexed by barcode hash
const FALLBACK_PRODUCTS: Omit<BarcodeProduct, 'barcode' | 'is_fallback'>[] = [
  {
    product_name: 'Chobani Plain Non-Fat Greek Yogurt',
    brand: 'Chobani',
    calories: 120,
    protein_g: 16,
    carbs_g: 6,
    fat_g: 0,
    serving_size: '170g (1 cup)',
    image_url: 'https://images.openfoodfacts.org/images/products/007/394/800/0138/front_en.3.400.jpg',
  },
  {
    product_name: 'Quest Protein Bar - Chocolate Chip Cookie Dough',
    brand: 'Quest Nutrition',
    calories: 200,
    protein_g: 21,
    carbs_g: 22,
    fat_g: 7,
    serving_size: '60g bar',
    image_url: 'https://images.openfoodfacts.org/images/products/088/884/900/0014/front_en.3.400.jpg',
  },
  {
    product_name: 'Almond Breeze Unsweetened Vanilla Almondmilk',
    brand: 'Blue Diamond',
    calories: 30,
    protein_g: 1,
    carbs_g: 1,
    fat_g: 2.5,
    serving_size: '240ml (1 cup)',
    image_url: 'https://images.openfoodfacts.org/images/products/004/157/005/3757/front_en.3.400.jpg',
  },
  {
    product_name: 'KIND Dark Chocolate Nuts & Sea Salt Bar',
    brand: 'KIND Snacks',
    calories: 200,
    protein_g: 6,
    carbs_g: 16,
    fat_g: 15,
    serving_size: '40g bar',
  },
  {
    product_name: 'Quaker Whole Grain Rolled Oats',
    brand: 'Quaker',
    calories: 150,
    protein_g: 5,
    carbs_g: 27,
    fat_g: 3,
    serving_size: '40g (1/2 cup)',
  },
];

/**
 * Deterministically generates or returns an offline fallback product for testing.
 */
export function getOfflineFallbackProduct(barcode: string): BarcodeProduct {
  // Numeric hash of the barcode string
  let numHash = 0;
  for (let i = 0; i < barcode.length; i++) {
    numHash = (numHash << 5) - numHash + barcode.charCodeAt(i);
    numHash |= 0;
  }
  const index = Math.abs(numHash) % FALLBACK_PRODUCTS.length;
  const base = FALLBACK_PRODUCTS[index];

  return {
    barcode,
    product_name: base.product_name,
    brand: base.brand,
    calories: base.calories,
    protein_g: base.protein_g,
    carbs_g: base.carbs_g,
    fat_g: base.fat_g,
    serving_size: base.serving_size,
    image_url: base.image_url,
    is_fallback: true,
  };
}

/**
 * Fetches product nutrition data from OpenFoodFacts API with 4-second timeout.
 * Automatically switches to smart offline fallback if network fails or barcode is not found.
 */
export async function fetchProductByBarcode(barcode: string): Promise<BarcodeProduct> {
  const cleanBarcode = barcode.trim();
  if (!cleanBarcode) {
    return getOfflineFallbackProduct('00000000');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);

  try {
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(cleanBarcode)}.json`,
      {
        headers: {
          'User-Agent': 'CalSnapAI - Mobile React Native App - Version 1.0',
          Accept: 'application/json',
        },
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      return getOfflineFallbackProduct(cleanBarcode);
    }

    const data = await response.json();

    if (data.status !== 1 || !data.product) {
      return getOfflineFallbackProduct(cleanBarcode);
    }

    const product = data.product;
    const nutriments = product.nutriments || {};

    const parseNum = (val: any): number | null => {
      if (val === undefined || val === null) return null;
      const n = parseFloat(String(val));
      return isNaN(n) ? null : n;
    };

    const calValue = parseNum(nutriments['energy-kcal_serving']) ??
      parseNum(nutriments['energy-kcal_100g']) ??
      parseNum(nutriments['energy-kcal']) ??
      (parseNum(nutriments['energy_100g']) ? parseNum(nutriments['energy_100g'])! / 4.184 : null);

    const proteinValue = parseNum(nutriments['proteins_serving']) ??
      parseNum(nutriments['proteins_100g']) ??
      parseNum(nutriments['proteins']);

    const carbsValue = parseNum(nutriments['carbohydrates_serving']) ??
      parseNum(nutriments['carbohydrates_100g']) ??
      parseNum(nutriments['carbohydrates']);

    const fatValue = parseNum(nutriments['fat_serving']) ??
      parseNum(nutriments['fat_100g']) ??
      parseNum(nutriments['fat']);

    const isIncomplete = calValue === null || proteinValue === null;

    const calories = Math.max(0, Math.round(calValue ?? 180));
    const protein_g = Math.max(0, Math.round(proteinValue ?? 10));
    const carbs_g = Math.max(0, Math.round(carbsValue ?? 20));
    const fat_g = Math.max(0, Math.round(fatValue ?? 5));

    const product_name =
      product.product_name ||
      product.product_name_en ||
      product.generic_name ||
      'Scanned Food Product';

    const brand = product.brands ? product.brands.split(',')[0].trim() : 'Generic Brand';
    const serving_size = product.serving_size || '100g per serving';
    const image_url =
      product.image_front_small_url || product.image_small_url || product.image_url || undefined;

    return {
      barcode: cleanBarcode,
      product_name,
      brand,
      calories,
      protein_g,
      carbs_g,
      fat_g,
      serving_size,
      image_url,
      is_fallback: false,
      is_incomplete: isIncomplete,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    return getOfflineFallbackProduct(cleanBarcode);
  }
}
