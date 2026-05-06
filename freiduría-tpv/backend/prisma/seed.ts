import { PrismaClient, ProductDestination } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.product.deleteMany();

  await prisma.product.createMany({
    data: [
      { name: 'Chocos', category: 'Freiduras', destination: ProductDestination.KITCHEN, isWeighed: true, pricePerKg: 1400 },
      { name: 'Puntillitas', category: 'Freiduras', destination: ProductDestination.KITCHEN, isWeighed: true, pricePerKg: 1600 },
      { name: 'Gambas fritas', category: 'Freiduras', destination: ProductDestination.KITCHEN, isWeighed: true, pricePerKg: 1800 },
      { name: 'Boquerones fritos', category: 'Freiduras', destination: ProductDestination.KITCHEN, isWeighed: true, pricePerKg: 1200 },
      { name: 'Cazón adobado', category: 'Freiduras', destination: ProductDestination.KITCHEN, isWeighed: true, pricePerKg: 1500 },
      { name: 'Salmonetes', category: 'Freiduras', destination: ProductDestination.KITCHEN, isWeighed: true, pricePerKg: 1600 },
      { name: 'Acedías', category: 'Freiduras', destination: ProductDestination.KITCHEN, isWeighed: true, pricePerKg: 1300 },
      { name: 'Pescadilla', category: 'Freiduras', destination: ProductDestination.KITCHEN, isWeighed: true, pricePerKg: 1200 },
      { name: 'Gambas cocidas', category: 'Mariscos', destination: ProductDestination.BAR, isWeighed: false, priceFixed: 850 },
      { name: 'Quisquillas', category: 'Mariscos', destination: ProductDestination.BAR, isWeighed: false, priceFixed: 750 },
      { name: 'Berberechos', category: 'Mariscos', destination: ProductDestination.BAR, isWeighed: false, priceFixed: 450 },
      { name: 'Coquinas', category: 'Mariscos', destination: ProductDestination.BAR, isWeighed: false, priceFixed: 550 },
      { name: 'Croquetas (6 uds)', category: 'Raciones', destination: ProductDestination.KITCHEN, isWeighed: false, priceFixed: 350 },
      { name: 'Patatas bravas', category: 'Raciones', destination: ProductDestination.KITCHEN, isWeighed: false, priceFixed: 300 },
      { name: 'Ensaladilla rusa', category: 'Raciones', destination: ProductDestination.BAR, isWeighed: false, priceFixed: 350 },
      { name: 'Tortilla española', category: 'Raciones', destination: ProductDestination.KITCHEN, isWeighed: false, priceFixed: 300 },
      { name: 'Pan con tomate', category: 'Raciones', destination: ProductDestination.BAR, isWeighed: false, priceFixed: 150 },
      { name: 'Cerveza (caña)', category: 'Bebidas', destination: ProductDestination.BAR, isWeighed: false, priceFixed: 180 },
      { name: 'Cerveza (botellín)', category: 'Bebidas', destination: ProductDestination.BAR, isWeighed: false, priceFixed: 220 },
      { name: 'Refresco', category: 'Bebidas', destination: ProductDestination.BAR, isWeighed: false, priceFixed: 200 },
      { name: 'Agua (50cl)', category: 'Bebidas', destination: ProductDestination.BAR, isWeighed: false, priceFixed: 120 },
      { name: 'Vino (copa)', category: 'Bebidas', destination: ProductDestination.BAR, isWeighed: false, priceFixed: 180 },
      { name: 'Rebujito', category: 'Bebidas', destination: ProductDestination.BAR, isWeighed: false, priceFixed: 300 },
    ],
  });

  console.log('✅ Seed completado — Carta Bar Freiduría Javi Benítez');
}

main().catch(console.error).finally(() => prisma.$disconnect());
