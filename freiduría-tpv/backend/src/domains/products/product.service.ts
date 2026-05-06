import { prisma } from '../../infrastructure/database/prisma.client';
import type { ProductDTO } from './product.types';

export async function getActiveProducts(): Promise<ProductDTO[]> {
  return prisma.product.findMany({
    where: { active: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
}

export async function getProductById(id: string): Promise<ProductDTO | null> {
  return prisma.product.findUnique({ where: { id } });
}
