import type { ProductDestination } from '@prisma/client';

export interface ProductDTO {
  id: string;
  name: string;
  category: string;
  destination: ProductDestination;
  isWeighed: boolean;
  pricePerKg: number | null;
  priceFixed: number | null;
  imageUrl: string | null;
}
