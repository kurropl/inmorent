# Freiduría TPV — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a full-stack POS system for a fish fry restaurant that handles variable-weight products (fried fish priced per kg), routing orders to kitchen/bar displays, connecting to a weighing scale, and updating the cash register in real time via WebSockets.

**Architecture:** Modular monolith — single Express process with domain-separated folders (`orders`, `products`, `weighing`), Prisma for PostgreSQL, Socket.io for real-time device rooms. React+Vite+Tailwind frontend with a 2×2 station grid (Waiter | Kitchen / Bar+Scale | TPV).

**Tech Stack:** Node.js 20 + TypeScript 5, Express 4, PostgreSQL 16, Prisma ORM, Socket.io 4, Vitest, React 18, Vite 5, Tailwind CSS 3.

---

## Phase 0 — Project Scaffold

### Task 1: Create backend directory and install dependencies

**Files:**
- Create: `freiduría-tpv/backend/package.json`
- Create: `freiduría-tpv/backend/tsconfig.json`
- Create: `freiduría-tpv/backend/.env.example`

**Step 1: Create backend folder structure**

```bash
mkdir -p "freiduría-tpv/backend/src/domains/orders"
mkdir -p "freiduría-tpv/backend/src/domains/products"
mkdir -p "freiduría-tpv/backend/src/domains/weighing"
mkdir -p "freiduría-tpv/backend/src/infrastructure/database"
mkdir -p "freiduría-tpv/backend/src/infrastructure/websocket"
mkdir -p "freiduría-tpv/backend/src/infrastructure/http"
mkdir -p "freiduría-tpv/backend/src/shared/types"
mkdir -p "freiduría-tpv/backend/src/shared/utils"
mkdir -p "freiduría-tpv/backend/prisma"
mkdir -p "freiduría-tpv/backend/src/__tests__"
```

**Step 2: Write `package.json`**

```json
{
  "name": "freiduria-tpv-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/infrastructure/http/server.ts",
    "build": "tsc",
    "start": "node dist/infrastructure/http/server.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio"
  },
  "dependencies": {
    "@prisma/client": "^5.14.0",
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "socket.io": "^4.7.5"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.14.0",
    "prisma": "^5.14.0",
    "tsx": "^4.15.0",
    "typescript": "^5.4.5",
    "vitest": "^1.6.0",
    "vitest-mock-extended": "^1.3.1"
  }
}
```

**Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*", "prisma/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Write `.env.example`**

```
DATABASE_URL="postgresql://postgres:password@localhost:5432/freiduria_tpv"
PORT=3001
CORS_ORIGIN=http://localhost:5173
```

**Step 5: Install dependencies**

```bash
cd "freiduría-tpv/backend" && npm install
```

Expected: `node_modules/` created, no errors.

**Step 6: Commit**

```bash
git add freiduría-tpv/backend/
git commit -m "chore: scaffold backend project with dependencies"
```

---

### Task 2: Create frontend with Vite + React + Tailwind

**Files:**
- Create: `freiduría-tpv/frontend/` (via Vite scaffold)

**Step 1: Scaffold Vite React TypeScript project**

```bash
cd "freiduría-tpv" && npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install socket.io-client
npm install lucide-react
```

**Step 2: Configure Tailwind — update `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#f97316',
          dark: '#1c1917',
          surface: '#292524',
          border: '#44403c',
        }
      }
    },
  },
  plugins: [],
}
```

**Step 3: Replace `src/index.css` with Tailwind directives**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 4: Configure `vite.config.ts` with proxy**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
})
```

**Step 5: Create frontend directory structure**

```bash
mkdir -p src/stations/WaiterStation
mkdir -p src/stations/KitchenDisplay
mkdir -p src/stations/BarDisplay
mkdir -p src/stations/ScaleStation
mkdir -p src/stations/CashRegister
mkdir -p src/hooks
mkdir -p src/components
mkdir -p src/types
```

**Step 6: Commit**

```bash
git add freiduría-tpv/frontend/
git commit -m "chore: scaffold frontend with Vite, React, Tailwind"
```

---

### Task 3: Docker Compose for local PostgreSQL

**Files:**
- Create: `freiduría-tpv/docker-compose.yml`

**Step 1: Write `docker-compose.yml`**

```yaml
version: '3.9'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: freiduria_tpv
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

**Step 2: Copy `.env.example` to `.env` and start DB**

```bash
cp freiduría-tpv/backend/.env.example freiduría-tpv/backend/.env
cd freiduría-tpv && docker-compose up -d
```

Expected: `postgres` container running on port 5432.

**Step 3: Commit**

```bash
git add freiduría-tpv/docker-compose.yml
git commit -m "chore: add docker-compose for local PostgreSQL"
```

---

## Phase 1 — Database Layer

### Task 4: Prisma schema

**Files:**
- Create: `freiduría-tpv/backend/prisma/schema.prisma`

**Step 1: Write schema**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum ProductDestination {
  BAR
  KITCHEN
}

enum OrderItemStatus {
  PENDING
  WEIGHED
  SERVED
}

enum OrderStatus {
  OPEN
  CLOSED
  PAID
}

model Product {
  id          String             @id @default(cuid())
  name        String
  category    String
  destination ProductDestination
  isWeighed   Boolean            @default(false)
  // Stored in cents (integer) to avoid floating-point errors.
  // pricePerKg: 1200 = 12.00 €/kg. Only set when isWeighed=true.
  pricePerKg  Int?
  // priceFixed: 150 = 1.50 €. Only set when isWeighed=false.
  priceFixed  Int?
  imageUrl    String?
  active      Boolean            @default(true)
  orderItems  OrderItem[]
  createdAt   DateTime           @default(now())
}

model Order {
  id          String      @id @default(cuid())
  tableNumber Int
  status      OrderStatus @default(OPEN)
  items       OrderItem[]
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
}

model OrderItem {
  id      String @id @default(cuid())
  orderId String
  order   Order  @relation(fields: [orderId], references: [id])

  productId String
  product   Product @relation(fields: [productId], references: [id])

  // Price snapshot taken at order time — immune to product price changes.
  pricePerKg Int?
  priceFixed Int?

  // Weight fields: only populated for isWeighed products.
  // finalWeightGrams is null until scale provides actual weight.
  estimatedWeightGrams Int?
  finalWeightGrams     Int?

  status    OrderItemStatus @default(PENDING)
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
}
```

**Step 2: Run migration**

```bash
cd freiduría-tpv/backend && npx prisma migrate dev --name init
```

Expected: Migration `0001_init` created, tables created in DB.

**Step 3: Generate Prisma client**

```bash
npx prisma generate
```

Expected: `@prisma/client` generated, no TypeScript errors.

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat: add Prisma schema with Order, OrderItem, Product models"
```

---

### Task 5: Prisma seed — Carta completa Javi Benítez

**Files:**
- Create: `freiduría-tpv/backend/prisma/seed.ts`

**Step 1: Write seed file**

```typescript
import { PrismaClient, ProductDestination } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.product.deleteMany();

  await prisma.product.createMany({
    data: [
      // --- FREIDURAS (pescado frito, sold by weight) ---
      // pricePerKg in cents: 1200 = 12.00 €/kg
      { name: 'Chocos', category: 'Freiduras', destination: ProductDestination.KITCHEN, isWeighed: true, pricePerKg: 1400 },
      { name: 'Puntillitas', category: 'Freiduras', destination: ProductDestination.KITCHEN, isWeighed: true, pricePerKg: 1600 },
      { name: 'Gambas fritas', category: 'Freiduras', destination: ProductDestination.KITCHEN, isWeighed: true, pricePerKg: 1800 },
      { name: 'Boquerones fritos', category: 'Freiduras', destination: ProductDestination.KITCHEN, isWeighed: true, pricePerKg: 1200 },
      { name: 'Cazón adobado', category: 'Freiduras', destination: ProductDestination.KITCHEN, isWeighed: true, pricePerKg: 1500 },
      { name: 'Salmonetes', category: 'Freiduras', destination: ProductDestination.KITCHEN, isWeighed: true, pricePerKg: 1600 },
      { name: 'Acedías', category: 'Freiduras', destination: ProductDestination.KITCHEN, isWeighed: true, pricePerKg: 1300 },
      { name: 'Pescadilla', category: 'Freiduras', destination: ProductDestination.KITCHEN, isWeighed: true, pricePerKg: 1200 },

      // --- MARISCOS FRÍOS → BAR ---
      // priceFixed in cents: 350 = 3.50 €
      { name: 'Gambas cocidas', category: 'Mariscos', destination: ProductDestination.BAR, isWeighed: false, priceFixed: 850 },
      { name: 'Quisquillas', category: 'Mariscos', destination: ProductDestination.BAR, isWeighed: false, priceFixed: 750 },
      { name: 'Berberechos', category: 'Mariscos', destination: ProductDestination.BAR, isWeighed: false, priceFixed: 450 },
      { name: 'Coquinas', category: 'Mariscos', destination: ProductDestination.BAR, isWeighed: false, priceFixed: 550 },

      // --- RACIONES CALIENTES → KITCHEN ---
      { name: 'Croquetas (6 uds)', category: 'Raciones', destination: ProductDestination.KITCHEN, isWeighed: false, priceFixed: 350 },
      { name: 'Patatas bravas', category: 'Raciones', destination: ProductDestination.KITCHEN, isWeighed: false, priceFixed: 300 },
      { name: 'Ensaladilla rusa', category: 'Raciones', destination: ProductDestination.BAR, isWeighed: false, priceFixed: 350 },
      { name: 'Tortilla española', category: 'Raciones', destination: ProductDestination.KITCHEN, isWeighed: false, priceFixed: 300 },
      { name: 'Pan con tomate', category: 'Raciones', destination: ProductDestination.BAR, isWeighed: false, priceFixed: 150 },

      // --- BEBIDAS → BAR ---
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

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**Step 2: Add seed script to `package.json` (already included in Task 1, verify it exists)**

Verify `"db:seed": "tsx prisma/seed.ts"` is in scripts.

**Step 3: Run seed**

```bash
cd freiduría-tpv/backend && npm run db:seed
```

Expected: `✅ Seed completado — Carta Bar Freiduría Javi Benítez`

**Step 4: Commit**

```bash
git add prisma/seed.ts
git commit -m "feat: add product seed with full menu from Bar Javi Benitez"
```

---

### Task 6: Prisma client singleton

**Files:**
- Create: `freiduría-tpv/backend/src/infrastructure/database/prisma.client.ts`

**Step 1: Write client singleton**

```typescript
import { PrismaClient } from '@prisma/client';

// Singleton prevents multiple connections in hot-reload dev environments.
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

**Step 2: Commit**

```bash
git add src/infrastructure/database/
git commit -m "feat: add Prisma client singleton"
```

---

## Phase 2 — Shared Utilities

### Task 7: Shared types and money utilities

**Files:**
- Create: `freiduría-tpv/backend/src/shared/types/index.ts`
- Create: `freiduría-tpv/backend/src/shared/utils/money.ts`
- Create: `freiduría-tpv/backend/src/__tests__/money.test.ts`

**Step 1: Write shared types**

```typescript
// src/shared/types/index.ts

export interface OrderTotalResult {
  totalCents: number;
  totalEuros: string;
  requiresWeighingWarning: boolean;
  unweighedItems: string[];
}

export interface ParsedBarcode {
  productCode: string;
  weightGrams: number;
}
```

**Step 2: Write money utility**

```typescript
// src/shared/utils/money.ts

/**
 * Calculates the price of a weighed item in cents.
 *
 * Formula: Math.round((pricePerKg * weightGrams) / 1000)
 *
 * All values are integers (cents / grams) throughout to avoid IEEE-754
 * floating-point drift. The division by 1000 converts grams → kg.
 * Math.round() applies standard half-up rounding, consistent with
 * Spanish fiscal rounding rules.
 *
 * Example: 14.00 €/kg (1400 cents) × 260g → (1400 * 260) / 1000 = 364 cents = 3.64 €
 */
export function calcWeightPrice(pricePerKgCents: number, weightGrams: number): number {
  if (pricePerKgCents < 0 || weightGrams < 0) {
    throw new Error('Price and weight must be non-negative');
  }
  return Math.round((pricePerKgCents * weightGrams) / 1000);
}

/** Converts cents integer to formatted euro string: 364 → "3.64" */
export function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Converts euro string to cents integer: "3.64" → 364 */
export function eurosToCents(euros: string): number {
  return Math.round(parseFloat(euros) * 100);
}
```

**Step 3: Write failing tests**

```typescript
// src/__tests__/money.test.ts
import { describe, it, expect } from 'vitest';
import { calcWeightPrice, centsToEuros, eurosToCents } from '../shared/utils/money';

describe('calcWeightPrice', () => {
  it('calculates 260g at 14.00/kg correctly', () => {
    expect(calcWeightPrice(1400, 260)).toBe(364);
  });

  it('calculates 250g at 12.00/kg correctly', () => {
    expect(calcWeightPrice(1200, 250)).toBe(300);
  });

  it('rounds half-up on fractional cents', () => {
    // 1300 cents/kg * 123g = 159.9 → rounds to 160
    expect(calcWeightPrice(1300, 123)).toBe(160);
  });

  it('returns 0 for 0 grams', () => {
    expect(calcWeightPrice(1400, 0)).toBe(0);
  });

  it('throws on negative price', () => {
    expect(() => calcWeightPrice(-100, 200)).toThrow();
  });
});

describe('centsToEuros', () => {
  it('converts 364 cents to "3.64"', () => {
    expect(centsToEuros(364)).toBe('3.64');
  });

  it('pads single-cent values', () => {
    expect(centsToEuros(5)).toBe('0.05');
  });
});

describe('eurosToCents', () => {
  it('converts "3.64" to 364', () => {
    expect(eurosToCents('3.64')).toBe(364);
  });
});
```

**Step 4: Run tests to verify they fail first (TDD)**

```bash
cd freiduría-tpv/backend && npm test -- money
```

Expected: FAIL — `calcWeightPrice` not found.

**Step 5: Run tests after implementation**

```bash
npm test -- money
```

Expected: All tests PASS.

**Step 6: Commit**

```bash
git add src/shared/ src/__tests__/money.test.ts
git commit -m "feat: add money utilities and shared types with tests"
```

---

### Task 8: EAN-13 variable-weight barcode parser

**Files:**
- Create: `freiduría-tpv/backend/src/domains/weighing/barcode.parser.ts`
- Create: `freiduría-tpv/backend/src/__tests__/barcode.parser.test.ts`

**Step 1: Write failing tests first**

```typescript
// src/__tests__/barcode.parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseWeightBarcode } from '../domains/weighing/barcode.parser';

describe('parseWeightBarcode', () => {
  // EAN-13 structure: 2X PPPPP WWWWW C
  // "20" prefix + "12345" product + "00260" weight(grams) + check digit
  // Valid barcode for testing: built with known check digit
  const VALID_BARCODE = '2012345002607'; // check digit = 7 (pre-calculated)

  it('parses a valid variable-weight EAN-13', () => {
    const result = parseWeightBarcode(VALID_BARCODE);
    expect(result).not.toBeNull();
    expect(result?.productCode).toBe('12345');
    expect(result?.weightGrams).toBe(260);
  });

  it('returns null for non-13-digit strings', () => {
    expect(parseWeightBarcode('123')).toBeNull();
    expect(parseWeightBarcode('12345678901234')).toBeNull();
  });

  it('returns null for barcodes not starting with 2X prefix', () => {
    // Starts with 10 — not a variable-weight barcode
    expect(parseWeightBarcode('1012345002607')).toBeNull();
  });

  it('returns null for non-digit strings', () => {
    expect(parseWeightBarcode('201234500260A')).toBeNull();
  });

  it('returns null for invalid EAN-13 check digit', () => {
    expect(parseWeightBarcode('2012345002600')).toBeNull(); // wrong check digit
  });

  it('returns 0 grams for zero-weight barcode (tare weight scenario)', () => {
    // "20" + "12345" + "00000" = barcode with zero weight
    const zeroWeight = '2012345000004'; // pre-calculated check digit
    const result = parseWeightBarcode(zeroWeight);
    expect(result?.weightGrams).toBe(0);
  });
});
```

**Step 2: Run tests — verify they FAIL**

```bash
npm test -- barcode
```

Expected: FAIL — module not found.

**Step 3: Implement the parser**

```typescript
// src/domains/weighing/barcode.parser.ts
import type { ParsedBarcode } from '../../shared/types';

/**
 * Validates and parses a variable-weight EAN-13 barcode.
 *
 * Standard format (GS1): 2X PPPPP WWWWW C
 *   - Digits 0-1 : "2X" prefix (20-29 = variable weight indicator)
 *   - Digits 2-6 : 5-digit internal product reference
 *   - Digits 7-11: 5-digit weight in GRAMS as integer (00260 = 260g)
 *   - Digit  12  : EAN-13 check digit (modulo-10 algorithm)
 *
 * Returns null if barcode is invalid (wrong length, bad prefix, bad check digit).
 */
export function parseWeightBarcode(barcode: string): ParsedBarcode | null {
  // Must be exactly 13 decimal digits
  if (!/^\d{13}$/.test(barcode)) return null;

  // Variable-weight EAN-13 must start with 2X (20–29)
  const prefixValue = parseInt(barcode.slice(0, 2), 10);
  if (prefixValue < 20 || prefixValue > 29) return null;

  // Validate EAN-13 check digit
  if (!isValidEAN13CheckDigit(barcode)) return null;

  const productCode = barcode.slice(2, 7);
  const weightGrams = parseInt(barcode.slice(7, 12), 10);

  return { productCode, weightGrams };
}

/**
 * EAN-13 check digit validation.
 * Algorithm: alternate multiply digits by 1 and 3, sum all, mod 10.
 * Check digit makes total a multiple of 10.
 */
function isValidEAN13CheckDigit(barcode: string): boolean {
  const digits = barcode.split('').map(Number);
  const sum = digits.slice(0, 12).reduce((acc, digit, index) => {
    return acc + digit * (index % 2 === 0 ? 1 : 3);
  }, 0);
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === digits[12];
}
```

**Step 4: Run tests — verify they PASS**

```bash
npm test -- barcode
```

Expected: All 6 tests PASS.

**Step 5: Commit**

```bash
git add src/domains/weighing/ src/__tests__/barcode.parser.test.ts
git commit -m "feat: add EAN-13 variable-weight barcode parser with tests"
```

---

## Phase 3 — Domain Services

### Task 9: Product service

**Files:**
- Create: `freiduría-tpv/backend/src/domains/products/product.service.ts`
- Create: `freiduría-tpv/backend/src/domains/products/product.types.ts`
- Create: `freiduría-tpv/backend/src/__tests__/product.service.test.ts`

**Step 1: Write product types**

```typescript
// src/domains/products/product.types.ts
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
```

**Step 2: Write failing tests**

```typescript
// src/__tests__/product.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

vi.mock('../infrastructure/database/prisma.client', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../infrastructure/database/prisma.client';
import { getActiveProducts } from '../domains/products/product.service';
import { ProductDestination } from '@prisma/client';

const mockPrisma = prisma as ReturnType<typeof mockDeep<PrismaClient>>;

describe('getActiveProducts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns only active products', async () => {
    const fakeProducts = [
      { id: '1', name: 'Chocos', category: 'Freiduras', destination: ProductDestination.KITCHEN,
        isWeighed: true, pricePerKg: 1400, priceFixed: null, imageUrl: null, active: true, createdAt: new Date(), orderItems: [] },
    ];
    mockPrisma.product.findMany.mockResolvedValue(fakeProducts as any);

    const result = await getActiveProducts();

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Chocos');
  });
});
```

**Step 3: Run tests — verify FAIL**

```bash
npm test -- product.service
```

**Step 4: Implement product service**

```typescript
// src/domains/products/product.service.ts
import { prisma } from '../../infrastructure/database/prisma.client';
import type { ProductDTO } from './product.types';

export async function getActiveProducts(): Promise<ProductDTO[]> {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  return products;
}

export async function getProductById(id: string): Promise<ProductDTO | null> {
  return prisma.product.findUnique({ where: { id } });
}
```

**Step 5: Run tests — verify PASS**

```bash
npm test -- product.service
```

**Step 6: Commit**

```bash
git add src/domains/products/ src/__tests__/product.service.test.ts
git commit -m "feat: add product service with getActiveProducts"
```

---

### Task 10: Order service — createOrder and getOrder

**Files:**
- Create: `freiduría-tpv/backend/src/domains/orders/order.types.ts`
- Create: `freiduría-tpv/backend/src/domains/orders/order.service.ts`
- Create: `freiduría-tpv/backend/src/__tests__/order.service.test.ts`

**Step 1: Write order types**

```typescript
// src/domains/orders/order.types.ts
import type { OrderStatus, OrderItemStatus, ProductDestination } from '@prisma/client';

export interface OrderItemView {
  id: string;
  productId: string;
  productName: string;
  destination: ProductDestination;
  isWeighed: boolean;
  pricePerKg: number | null;
  priceFixed: number | null;
  estimatedWeightGrams: number | null;
  finalWeightGrams: number | null;
  status: OrderItemStatus;
}

export interface OrderView {
  id: string;
  tableNumber: number;
  status: OrderStatus;
  items: OrderItemView[];
  createdAt: Date;
}

export interface CreateOrderInput {
  tableNumber: number;
}
```

**Step 2: Write failing tests**

```typescript
// src/__tests__/order.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

vi.mock('../infrastructure/database/prisma.client', () => ({
  prisma: mockDeep<PrismaClient>(),
}));

import { prisma } from '../infrastructure/database/prisma.client';
import { createOrder, getOrderById } from '../domains/orders/order.service';
import { OrderStatus } from '@prisma/client';

const mockPrisma = prisma as ReturnType<typeof mockDeep<PrismaClient>>;

const fakeOrder = {
  id: 'order-1',
  tableNumber: 5,
  status: OrderStatus.OPEN,
  items: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('createOrder', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates an order with tableNumber', async () => {
    mockPrisma.order.create.mockResolvedValue(fakeOrder as any);

    const result = await createOrder({ tableNumber: 5 });

    expect(mockPrisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { tableNumber: 5 } })
    );
    expect(result.tableNumber).toBe(5);
  });
});

describe('getOrderById', () => {
  it('returns order with items and product info', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(fakeOrder as any);

    const result = await getOrderById('order-1');

    expect(result).not.toBeNull();
    expect(result?.id).toBe('order-1');
  });

  it('returns null for non-existent order', async () => {
    mockPrisma.order.findUnique.mockResolvedValue(null);
    const result = await getOrderById('nonexistent');
    expect(result).toBeNull();
  });
});
```

**Step 3: Implement order service**

```typescript
// src/domains/orders/order.service.ts
import { prisma } from '../../infrastructure/database/prisma.client';
import type { CreateOrderInput } from './order.types';

const ORDER_WITH_ITEMS = {
  include: {
    items: {
      include: { product: true },
      orderBy: { createdAt: 'asc' as const },
    },
  },
};

export async function createOrder(input: CreateOrderInput) {
  return prisma.order.create({
    data: { tableNumber: input.tableNumber },
    ...ORDER_WITH_ITEMS,
  });
}

export async function getOrderById(id: string) {
  return prisma.order.findUnique({
    where: { id },
    ...ORDER_WITH_ITEMS,
  });
}

export async function getOpenOrders() {
  return prisma.order.findMany({
    where: { status: 'OPEN' },
    ...ORDER_WITH_ITEMS,
    orderBy: { createdAt: 'asc' },
  });
}
```

**Step 4: Run tests — verify PASS**

```bash
npm test -- order.service
```

**Step 5: Commit**

```bash
git add src/domains/orders/order.service.ts src/domains/orders/order.types.ts src/__tests__/order.service.test.ts
git commit -m "feat: add order service createOrder and getOrderById"
```

---

### Task 11: OrderItem service — createOrderItem

**Files:**
- Create: `freiduría-tpv/backend/src/domains/orders/orderItem.service.ts`
- Create: `freiduría-tpv/backend/src/__tests__/orderItem.service.test.ts`

**Step 1: Write failing tests for createOrderItem**

```typescript
// src/__tests__/orderItem.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDeep } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

vi.mock('../infrastructure/database/prisma.client', () => ({
  prisma: mockDeep<PrismaClient>(),
}));
vi.mock('../infrastructure/websocket/socket.emitter', () => ({
  emitToRoom: vi.fn(),
}));

import { prisma } from '../infrastructure/database/prisma.client';
import { createOrderItem } from '../domains/orders/orderItem.service';
import { ProductDestination, OrderItemStatus } from '@prisma/client';

const mockPrisma = prisma as ReturnType<typeof mockDeep<PrismaClient>>;

const fakeProduct = {
  id: 'prod-1', name: 'Chocos', category: 'Freiduras',
  destination: ProductDestination.KITCHEN, isWeighed: true,
  pricePerKg: 1400, priceFixed: null, imageUrl: null,
  active: true, createdAt: new Date(), orderItems: [],
};

describe('createOrderItem', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a weighed item with price snapshot and estimated weight', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(fakeProduct as any);
    mockPrisma.orderItem.create.mockResolvedValue({
      id: 'item-1', orderId: 'order-1', productId: 'prod-1',
      pricePerKg: 1400, priceFixed: null,
      estimatedWeightGrams: 250, finalWeightGrams: null,
      status: OrderItemStatus.PENDING,
      createdAt: new Date(), updatedAt: new Date(),
      product: fakeProduct,
    } as any);

    const result = await createOrderItem({
      orderId: 'order-1', productId: 'prod-1', estimatedWeightGrams: 250,
    });

    expect(mockPrisma.orderItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          pricePerKg: 1400,    // snapshot from product
          estimatedWeightGrams: 250,
        }),
      })
    );
    expect(result.pricePerKg).toBe(1400);
  });

  it('throws when weighed product has no estimatedWeightGrams', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(fakeProduct as any);

    await expect(
      createOrderItem({ orderId: 'order-1', productId: 'prod-1' })
    ).rejects.toThrow('estimatedWeightGrams required');
  });

  it('throws when product not found', async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    await expect(
      createOrderItem({ orderId: 'order-1', productId: 'nonexistent', estimatedWeightGrams: 250 })
    ).rejects.toThrow('Product not found');
  });
});
```

**Step 2: Run tests — verify FAIL**

```bash
npm test -- orderItem.service
```

**Step 3: Implement createOrderItem**

```typescript
// src/domains/orders/orderItem.service.ts
import { prisma } from '../../infrastructure/database/prisma.client';
import { emitToRoom } from '../../infrastructure/websocket/socket.emitter';

export interface CreateOrderItemInput {
  orderId: string;
  productId: string;
  estimatedWeightGrams?: number;
  quantity?: number;
}

export async function createOrderItem(input: CreateOrderItemInput) {
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) throw new Error('Product not found');

  if (product.isWeighed && !input.estimatedWeightGrams) {
    throw new Error('estimatedWeightGrams required for weighed products');
  }

  const item = await prisma.orderItem.create({
    data: {
      orderId: input.orderId,
      productId: input.productId,
      // Snapshot prices at order time — price changes don't affect open orders
      pricePerKg: product.pricePerKg,
      priceFixed: product.priceFixed,
      estimatedWeightGrams: input.estimatedWeightGrams ?? null,
      finalWeightGrams: null,
    },
    include: { product: true, order: true },
  });

  // Route new item to the correct display (kitchen or bar)
  const room = product.destination === 'KITCHEN' ? 'kitchen' : 'bar';
  emitToRoom(room, 'newOrderItem', {
    item,
    product,
    tableNumber: item.order.tableNumber,
  });

  return item;
}
```

**Step 4: Run tests — verify PASS**

```bash
npm test -- orderItem.service
```

**Step 5: Commit**

```bash
git add src/domains/orders/orderItem.service.ts src/__tests__/orderItem.service.test.ts
git commit -m "feat: add createOrderItem with routing to kitchen/bar and price snapshot"
```

---

### Task 12: OrderItem service — updateFinalWeight (critical path)

**Files:**
- Modify: `freiduría-tpv/backend/src/domains/orders/orderItem.service.ts`
- Modify: `freiduría-tpv/backend/src/__tests__/orderItem.service.test.ts`

**Step 1: Add failing tests for updateFinalWeight**

Add these test cases to `orderItem.service.test.ts`:

```typescript
import { updateFinalWeight } from '../domains/orders/orderItem.service';
import { emitToRoom } from '../infrastructure/websocket/socket.emitter';

const mockEmit = emitToRoom as ReturnType<typeof vi.fn>;

const fakeItem = {
  id: 'item-1', orderId: 'order-1', productId: 'prod-1',
  pricePerKg: 1400, priceFixed: null,
  estimatedWeightGrams: 250, finalWeightGrams: null,
  status: 'PENDING', createdAt: new Date(), updatedAt: new Date(),
  product: fakeProduct, order: { tableNumber: 3 },
};

describe('updateFinalWeight', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates finalWeightGrams, sets status WEIGHED, and returns finalPriceCents', async () => {
    mockPrisma.orderItem.findUnique.mockResolvedValue(fakeItem as any);
    mockPrisma.orderItem.update.mockResolvedValue({
      ...fakeItem, finalWeightGrams: 260, status: 'WEIGHED',
    } as any);

    const result = await updateFinalWeight('item-1', 260);

    // (1400 cents/kg * 260g) / 1000 = 364 cents
    expect(result.finalPriceCents).toBe(364);
    expect(result.finalPriceEuros).toBe('3.64');
    expect(mockPrisma.orderItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ finalWeightGrams: 260, status: 'WEIGHED' }),
      })
    );
  });

  it('emits orderItemUpdated to waiter, tpv, and kitchen rooms', async () => {
    mockPrisma.orderItem.findUnique.mockResolvedValue(fakeItem as any);
    mockPrisma.orderItem.update.mockResolvedValue({ ...fakeItem, finalWeightGrams: 260 } as any);

    await updateFinalWeight('item-1', 260);

    expect(mockEmit).toHaveBeenCalledWith('waiter', 'orderItemUpdated', expect.any(Object));
    expect(mockEmit).toHaveBeenCalledWith('tpv', 'orderItemUpdated', expect.any(Object));
    expect(mockEmit).toHaveBeenCalledWith('kitchen', 'orderItemUpdated', expect.any(Object));
  });

  it('throws when finalWeightGrams <= 0', async () => {
    await expect(updateFinalWeight('item-1', 0)).rejects.toThrow('Invalid weight');
    await expect(updateFinalWeight('item-1', -1)).rejects.toThrow('Invalid weight');
  });

  it('throws when item not found', async () => {
    mockPrisma.orderItem.findUnique.mockResolvedValue(null);
    await expect(updateFinalWeight('nonexistent', 260)).rejects.toThrow('OrderItem not found');
  });
});
```

**Step 2: Run tests — verify FAIL**

```bash
npm test -- orderItem.service
```

**Step 3: Implement updateFinalWeight (append to orderItem.service.ts)**

```typescript
export async function updateFinalWeight(itemId: string, finalWeightGrams: number) {
  if (finalWeightGrams <= 0) throw new Error('Invalid weight: must be > 0');

  const item = await prisma.orderItem.findUnique({
    where: { id: itemId },
    include: { product: true, order: true },
  });
  if (!item) throw new Error('OrderItem not found');
  if (!item.pricePerKg) throw new Error('Item has no pricePerKg — not a weighed product');

  // Core formula: (pricePerKg_cents * weightGrams) / 1000 = finalPrice_cents
  // Integer arithmetic throughout — no floating-point involved.
  const finalPriceCents = Math.round((item.pricePerKg * finalWeightGrams) / 1000);

  const updated = await prisma.orderItem.update({
    where: { id: itemId },
    data: { finalWeightGrams, status: 'WEIGHED' },
    include: { product: true, order: true },
  });

  const payload = {
    itemId,
    finalWeightGrams,
    finalPriceCents,
    finalPriceEuros: (finalPriceCents / 100).toFixed(2),
    status: 'WEIGHED',
    tableNumber: item.order.tableNumber,
    productName: item.product.name,
  };

  // Broadcast to all three device types that need to know about the price update
  emitToRoom('waiter', 'orderItemUpdated', payload);
  emitToRoom('tpv', 'orderItemUpdated', payload);
  emitToRoom('kitchen', 'orderItemUpdated', payload);

  return { ...updated, finalPriceCents, finalPriceEuros: payload.finalPriceEuros };
}
```

**Step 4: Run tests — verify PASS**

```bash
npm test -- orderItem.service
```

**Step 5: Commit**

```bash
git add src/domains/orders/orderItem.service.ts src/__tests__/orderItem.service.test.ts
git commit -m "feat: add updateFinalWeight with price recalculation and real-time emit"
```

---

### Task 13: Order service — calculateOrderTotal

**Files:**
- Modify: `freiduría-tpv/backend/src/domains/orders/order.service.ts`
- Modify: `freiduría-tpv/backend/src/__tests__/order.service.test.ts`

**Step 1: Add failing tests for calculateOrderTotal**

```typescript
import { calculateOrderTotal } from '../domains/orders/order.service';
import type { OrderView } from '../domains/orders/order.types';

const makeItem = (overrides: Partial<any>) => ({
  id: 'item-1', productId: 'p1', productName: 'Chocos',
  destination: 'KITCHEN', isWeighed: true,
  pricePerKg: 1400, priceFixed: null,
  estimatedWeightGrams: 250, finalWeightGrams: null,
  status: 'PENDING',
  ...overrides,
});

describe('calculateOrderTotal', () => {
  it('uses finalWeightGrams when available', () => {
    const items = [makeItem({ finalWeightGrams: 260 })];
    const result = calculateOrderTotal(items);
    // (1400 * 260) / 1000 = 364 cents
    expect(result.totalCents).toBe(364);
    expect(result.requiresWeighingWarning).toBe(false);
  });

  it('falls back to estimatedWeightGrams and sets warning when not yet weighed', () => {
    const items = [makeItem({ finalWeightGrams: null, estimatedWeightGrams: 250 })];
    const result = calculateOrderTotal(items);
    // (1400 * 250) / 1000 = 350 cents (estimated)
    expect(result.totalCents).toBe(350);
    expect(result.requiresWeighingWarning).toBe(true);
    expect(result.unweighedItems).toContain('Chocos');
  });

  it('adds fixed-price items directly', () => {
    const fixedItem = makeItem({
      isWeighed: false, pricePerKg: null, priceFixed: 180,
      estimatedWeightGrams: null, finalWeightGrams: null, productName: 'Cerveza',
    });
    const result = calculateOrderTotal([fixedItem]);
    expect(result.totalCents).toBe(180);
    expect(result.requiresWeighingWarning).toBe(false);
  });

  it('sums mixed items correctly', () => {
    const weighed = makeItem({ finalWeightGrams: 260 });     // 364 cents
    const fixed = makeItem({ isWeighed: false, pricePerKg: null, priceFixed: 180,
      estimatedWeightGrams: null, finalWeightGrams: null });  // 180 cents
    const result = calculateOrderTotal([weighed, fixed]);
    expect(result.totalCents).toBe(544);
  });
});
```

**Step 2: Implement calculateOrderTotal (append to order.service.ts)**

```typescript
import { calcWeightPrice, centsToEuros } from '../../shared/utils/money';
import type { OrderTotalResult } from '../../shared/types';

export function calculateOrderTotal(items: any[]): OrderTotalResult {
  let totalCents = 0;
  let requiresWeighingWarning = false;
  const unweighedItems: string[] = [];

  for (const item of items) {
    if (item.isWeighed) {
      const weightToUse = item.finalWeightGrams ?? item.estimatedWeightGrams ?? 0;
      totalCents += calcWeightPrice(item.pricePerKg!, weightToUse);

      if (item.finalWeightGrams === null) {
        requiresWeighingWarning = true;
        unweighedItems.push(item.productName ?? item.product?.name ?? item.productId);
      }
    } else {
      totalCents += item.priceFixed ?? 0;
    }
  }

  return {
    totalCents,
    totalEuros: centsToEuros(totalCents),
    requiresWeighingWarning,
    unweighedItems,
  };
}
```

**Step 3: Run ALL tests**

```bash
npm test
```

Expected: All tests PASS.

**Step 4: Commit**

```bash
git add src/domains/orders/ src/__tests__/order.service.test.ts
git commit -m "feat: add calculateOrderTotal with warning flag for unweighed items"
```

---

## Phase 4 — Infrastructure

### Task 14: Socket.io server and emitter

**Files:**
- Create: `freiduría-tpv/backend/src/infrastructure/websocket/socket.server.ts`
- Create: `freiduría-tpv/backend/src/infrastructure/websocket/socket.emitter.ts`

**Step 1: Write socket server**

```typescript
// src/infrastructure/websocket/socket.server.ts
import { Server as HttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';

let io: SocketServer;

export const ROOMS = ['waiter', 'bar', 'kitchen', 'scale', 'tpv'] as const;
export type DeviceRoom = (typeof ROOMS)[number];

export function initSocketServer(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: { origin: process.env.CORS_ORIGIN ?? '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (socket) => {
    const room = socket.handshake.query.room as DeviceRoom;
    if (room && ROOMS.includes(room)) {
      socket.join(room);
      console.log(`[WS] ${socket.id} joined room: ${room}`);
    }

    socket.on('disconnect', () => {
      console.log(`[WS] ${socket.id} disconnected`);
    });
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) throw new Error('Socket.io not initialized — call initSocketServer first');
  return io;
}
```

**Step 2: Write emitter**

```typescript
// src/infrastructure/websocket/socket.emitter.ts
import { getIO } from './socket.server';
import type { DeviceRoom } from './socket.server';

export function emitToRoom(room: DeviceRoom, event: string, payload: unknown): void {
  try {
    getIO().to(room).emit(event, payload);
  } catch {
    // Server may not be initialized in test environments — fail silently
  }
}
```

**Step 3: Commit**

```bash
git add src/infrastructure/websocket/
git commit -m "feat: add Socket.io server with device rooms and emitter"
```

---

### Task 15: Express app and routes

**Files:**
- Create: `freiduría-tpv/backend/src/infrastructure/http/app.ts`
- Create: `freiduría-tpv/backend/src/infrastructure/http/server.ts`
- Create: `freiduría-tpv/backend/src/domains/products/product.routes.ts`
- Create: `freiduría-tpv/backend/src/domains/orders/order.routes.ts`
- Create: `freiduría-tpv/backend/src/domains/weighing/weighing.routes.ts`

**Step 1: Write product routes**

```typescript
// src/domains/products/product.routes.ts
import { Router } from 'express';
import { getActiveProducts } from './product.service';

export const productRouter = Router();

productRouter.get('/', async (_req, res) => {
  const products = await getActiveProducts();
  res.json(products);
});
```

**Step 2: Write order routes**

```typescript
// src/domains/orders/order.routes.ts
import { Router } from 'express';
import { createOrder, getOrderById, getOpenOrders, calculateOrderTotal } from './order.service';
import { createOrderItem } from './orderItem.service';

export const orderRouter = Router();

orderRouter.get('/', async (_req, res) => {
  const orders = await getOpenOrders();
  res.json(orders);
});

orderRouter.post('/', async (req, res) => {
  const { tableNumber } = req.body;
  if (!tableNumber) return res.status(400).json({ error: 'tableNumber required' });
  const order = await createOrder({ tableNumber });
  res.status(201).json(order);
});

orderRouter.get('/:id', async (req, res) => {
  const order = await getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(order);
});

orderRouter.get('/:id/total', async (req, res) => {
  const order = await getOrderById(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const total = calculateOrderTotal(order.items.map(i => ({
    ...i,
    isWeighed: i.product.isWeighed,
    productName: i.product.name,
  })));
  res.json(total);
});

orderRouter.post('/:id/items', async (req, res) => {
  const { productId, estimatedWeightGrams } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId required' });
  const item = await createOrderItem({
    orderId: req.params.id, productId, estimatedWeightGrams,
  });
  res.status(201).json(item);
});
```

**Step 3: Write weighing routes**

```typescript
// src/domains/weighing/weighing.routes.ts
import { Router } from 'express';
import { updateFinalWeight } from '../orders/orderItem.service';
import { parseWeightBarcode } from './barcode.parser';

export const weighingRouter = Router();

// Called by scale station with manual or barcode-parsed weight
weighingRouter.patch('/items/:itemId/weight', async (req, res) => {
  const { finalWeightGrams } = req.body;
  if (!finalWeightGrams || finalWeightGrams <= 0) {
    return res.status(400).json({ error: 'finalWeightGrams must be > 0' });
  }
  const result = await updateFinalWeight(req.params.itemId, finalWeightGrams);
  res.json(result);
});

// EAN-13 barcode from scanner — parse weight and product code
weighingRouter.post('/barcode', (req, res) => {
  const { barcode } = req.body;
  if (!barcode) return res.status(400).json({ error: 'barcode required' });
  const parsed = parseWeightBarcode(barcode);
  if (!parsed) return res.status(422).json({ error: 'Invalid variable-weight EAN-13 barcode' });
  res.json(parsed);
});
```

**Step 4: Write Express app factory**

```typescript
// src/infrastructure/http/app.ts
import express from 'express';
import cors from 'cors';
import { productRouter } from '../../domains/products/product.routes';
import { orderRouter } from '../../domains/orders/order.routes';
import { weighingRouter } from '../../domains/weighing/weighing.routes';

export function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/products', productRouter);
  app.use('/api/orders', orderRouter);
  app.use('/api/weighing', weighingRouter);

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: err.message });
  });

  return app;
}
```

**Step 5: Write server entry point**

```typescript
// src/infrastructure/http/server.ts
import { createServer } from 'http';
import { createApp } from './app';
import { initSocketServer } from '../websocket/socket.server';

const PORT = process.env.PORT ?? 3001;
const app = createApp();
const httpServer = createServer(app);

initSocketServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`🍤 Freiduría TPV server running on http://localhost:${PORT}`);
});
```

**Step 6: Start server and verify health endpoint**

```bash
cd freiduría-tpv/backend && npm run dev
```

In another terminal:
```bash
curl http://localhost:3001/api/health
```

Expected: `{"status":"ok"}`

**Step 7: Commit**

```bash
git add src/infrastructure/http/ src/domains/products/product.routes.ts src/domains/orders/order.routes.ts src/domains/weighing/weighing.routes.ts
git commit -m "feat: add Express app with product, order, and weighing routes"
```

---

## Phase 5 — Frontend

### Task 16: Shared types, hooks, and API client

**Files:**
- Create: `freiduría-tpv/frontend/src/types/index.ts`
- Create: `freiduría-tpv/frontend/src/lib/api.ts`
- Create: `freiduría-tpv/frontend/src/hooks/useSocket.ts`
- Create: `freiduría-tpv/frontend/src/hooks/useOrders.ts`

**Step 1: Write frontend types**

```typescript
// src/types/index.ts
export type ProductDestination = 'BAR' | 'KITCHEN';
export type OrderItemStatus = 'PENDING' | 'WEIGHED' | 'SERVED';
export type OrderStatus = 'OPEN' | 'CLOSED' | 'PAID';

export interface Product {
  id: string;
  name: string;
  category: string;
  destination: ProductDestination;
  isWeighed: boolean;
  pricePerKg: number | null;
  priceFixed: number | null;
  imageUrl: string | null;
}

export interface OrderItem {
  id: string;
  productId: string;
  product: Product;
  pricePerKg: number | null;
  priceFixed: number | null;
  estimatedWeightGrams: number | null;
  finalWeightGrams: number | null;
  status: OrderItemStatus;
  createdAt: string;
}

export interface Order {
  id: string;
  tableNumber: number;
  status: OrderStatus;
  items: OrderItem[];
  createdAt: string;
}

export interface OrderTotal {
  totalCents: number;
  totalEuros: string;
  requiresWeighingWarning: boolean;
  unweighedItems: string[];
}
```

**Step 2: Write API client**

```typescript
// src/lib/api.ts
const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export const api = {
  getProducts: () => request<import('../types').Product[]>('/products'),
  getOrders: () => request<import('../types').Order[]>('/orders'),
  createOrder: (tableNumber: number) =>
    request<import('../types').Order>('/orders', {
      method: 'POST',
      body: JSON.stringify({ tableNumber }),
    }),
  addItem: (orderId: string, productId: string, estimatedWeightGrams?: number) =>
    request<import('../types').OrderItem>(`/orders/${orderId}/items`, {
      method: 'POST',
      body: JSON.stringify({ productId, estimatedWeightGrams }),
    }),
  getOrderTotal: (orderId: string) =>
    request<import('../types').OrderTotal>(`/orders/${orderId}/total`),
  updateWeight: (itemId: string, finalWeightGrams: number) =>
    request(`/weighing/items/${itemId}/weight`, {
      method: 'PATCH',
      body: JSON.stringify({ finalWeightGrams }),
    }),
};
```

**Step 3: Write useSocket hook**

```typescript
// src/hooks/useSocket.ts
import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { DeviceRoom } from './types';

export type DeviceRoom = 'waiter' | 'kitchen' | 'bar' | 'scale' | 'tpv';

export function useSocket(room: DeviceRoom, handlers: Record<string, (data: any) => void>) {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io({ query: { room } });
    socketRef.current = socket;

    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      socket.disconnect();
    };
  }, [room]);

  return socketRef;
}
```

**Step 4: Write useOrders hook**

```typescript
// src/hooks/useOrders.ts
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';
import type { Order, Product } from '../types';

export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [o, p] = await Promise.all([api.getOrders(), api.getProducts()]);
    setOrders(o);
    setProducts(p);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const updateItemWeight = useCallback((itemId: string, finalWeightGrams: number) => {
    setOrders(prev =>
      prev.map(order => ({
        ...order,
        items: order.items.map(item =>
          item.id === itemId ? { ...item, finalWeightGrams, status: 'WEIGHED' as const } : item
        ),
      }))
    );
  }, []);

  return { orders, products, loading, refresh, updateItemWeight };
}
```

**Step 5: Commit**

```bash
git add src/types/ src/lib/ src/hooks/
git commit -m "feat: add frontend types, API client, and socket/orders hooks"
```

---

### Task 17: App.tsx — 2×2 grid layout and station wiring

**Files:**
- Modify: `freiduría-tpv/frontend/src/App.tsx`

**Step 1: Write App.tsx skeleton**

```tsx
// src/App.tsx
import { useState } from 'react';
import { WaiterStation } from './stations/WaiterStation/WaiterStation';
import { KitchenDisplay } from './stations/KitchenDisplay/KitchenDisplay';
import { BarScaleStation } from './stations/ScaleStation/BarScaleStation';
import { CashRegister } from './stations/CashRegister/CashRegister';
import { useOrders } from './hooks/useOrders';

export default function App() {
  const { orders, products, refresh, updateItemWeight } = useOrders();
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  const activeOrder = orders.find(o => o.id === activeOrderId) ?? null;

  return (
    <div className="min-h-screen bg-brand-dark text-white font-sans">
      {/* Header */}
      <header className="bg-brand-surface border-b border-brand-border px-6 py-3 flex items-center gap-4">
        <span className="text-2xl">🍤</span>
        <h1 className="text-xl font-bold tracking-tight text-brand-orange">
          Bar Freiduría Javi Benítez
        </h1>
        <span className="ml-auto text-xs text-zinc-400 font-mono">TPV v1.0 · Simulador</span>
      </header>

      {/* 2×2 grid */}
      <div className="grid grid-cols-2 grid-rows-2 h-[calc(100vh-56px)]">
        {/* TOP-LEFT: Camarero */}
        <div className="border-r border-b border-brand-border overflow-auto">
          <WaiterStation
            orders={orders}
            products={products}
            activeOrderId={activeOrderId}
            onSelectOrder={setActiveOrderId}
            onRefresh={refresh}
          />
        </div>

        {/* TOP-RIGHT: Cocina KDS */}
        <div className="border-b border-brand-border overflow-auto">
          <KitchenDisplay orders={orders} onRefresh={refresh} />
        </div>

        {/* BOTTOM-LEFT: Barra + Balanza */}
        <div className="border-r border-brand-border overflow-auto">
          <BarScaleStation orders={orders} onWeightUpdate={updateItemWeight} onRefresh={refresh} />
        </div>

        {/* BOTTOM-RIGHT: TPV / Caja */}
        <div className="overflow-auto">
          <CashRegister order={activeOrder} onRefresh={refresh} />
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Update `src/main.tsx` to render App**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Step 3: Commit skeleton**

```bash
git add src/App.tsx src/main.tsx
git commit -m "feat: add 2x2 station grid layout"
```

---

### Task 18: WaiterStation — order taking and menu

**Files:**
- Create: `freiduría-tpv/frontend/src/stations/WaiterStation/WaiterStation.tsx`
- Create: `freiduría-tpv/frontend/src/components/StationHeader.tsx`
- Create: `freiduría-tpv/frontend/src/components/PriceTag.tsx`

**Step 1: Write StationHeader**

```tsx
// src/components/StationHeader.tsx
interface Props { title: string; subtitle?: string; color?: string; }

export function StationHeader({ title, subtitle, color = 'text-brand-orange' }: Props) {
  return (
    <div className="px-4 py-3 border-b border-brand-border bg-brand-surface sticky top-0 z-10">
      <h2 className={`font-bold text-sm uppercase tracking-widest ${color}`}>{title}</h2>
      {subtitle && <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}
```

**Step 2: Write PriceTag**

```tsx
// src/components/PriceTag.tsx
interface Props { cents: number; suffix?: string; className?: string; }

export function PriceTag({ cents, suffix = '', className = '' }: Props) {
  return (
    <span className={`font-mono tabular-nums ${className}`}>
      {(cents / 100).toFixed(2)} €{suffix}
    </span>
  );
}
```

**Step 3: Write WaiterStation**

```tsx
// src/stations/WaiterStation/WaiterStation.tsx
import { useState } from 'react';
import { StationHeader } from '../../components/StationHeader';
import { PriceTag } from '../../components/PriceTag';
import { api } from '../../lib/api';
import type { Order, Product } from '../../types';

interface Props {
  orders: Order[];
  products: Product[];
  activeOrderId: string | null;
  onSelectOrder: (id: string) => void;
  onRefresh: () => void;
}

const TABLES = Array.from({ length: 10 }, (_, i) => i + 1);

export function WaiterStation({ orders, products, activeOrderId, onSelectOrder, onRefresh }: Props) {
  const [weightInput, setWeightInput] = useState<Record<string, string>>({});

  const categories = [...new Set(products.map(p => p.category))];
  const activeOrder = orders.find(o => o.id === activeOrderId);

  async function openTable(tableNumber: number) {
    const existing = orders.find(o => o.tableNumber === tableNumber && o.status === 'OPEN');
    if (existing) { onSelectOrder(existing.id); return; }
    const order = await api.createOrder(tableNumber);
    onRefresh();
    onSelectOrder(order.id);
  }

  async function addItem(product: Product) {
    if (!activeOrderId) return;
    const grams = product.isWeighed
      ? parseInt(weightInput[product.id] ?? '250', 10)
      : undefined;
    await api.addItem(activeOrderId, product.id, grams);
    onRefresh();
  }

  return (
    <div className="flex flex-col h-full">
      <StationHeader title="Camarero" subtitle="Selecciona mesa y añade productos" />

      {/* Table selector */}
      <div className="p-3 border-b border-brand-border">
        <p className="text-xs text-zinc-400 mb-2">Mesas</p>
        <div className="grid grid-cols-5 gap-1.5">
          {TABLES.map(n => {
            const isOpen = orders.some(o => o.tableNumber === n && o.status === 'OPEN');
            const isActive = activeOrder?.tableNumber === n;
            return (
              <button
                key={n}
                onClick={() => openTable(n)}
                className={`rounded-lg py-2 text-sm font-bold transition-colors
                  ${isActive ? 'bg-brand-orange text-white' :
                    isOpen ? 'bg-yellow-600/30 text-yellow-300 border border-yellow-600' :
                    'bg-brand-surface text-zinc-300 hover:bg-zinc-700'}`}
              >
                {n}
              </button>
            );
          })}
        </div>
      </div>

      {/* Product catalog */}
      {activeOrderId ? (
        <div className="flex-1 overflow-auto p-3 space-y-4">
          {categories.map(cat => (
            <div key={cat}>
              <p className="text-xs text-zinc-400 uppercase tracking-widest mb-2">{cat}</p>
              <div className="space-y-1">
                {products.filter(p => p.category === cat).map(product => (
                  <div key={product.id}
                    className="flex items-center gap-2 bg-brand-surface rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">{product.name}</span>
                      <span className="text-xs text-zinc-400">
                        {product.isWeighed
                          ? <PriceTag cents={product.pricePerKg!} suffix="/kg" className="text-green-400" />
                          : <PriceTag cents={product.priceFixed!} className="text-zinc-300" />}
                      </span>
                    </div>
                    {product.isWeighed && (
                      <input
                        type="number"
                        placeholder="g"
                        value={weightInput[product.id] ?? ''}
                        onChange={e => setWeightInput(w => ({ ...w, [product.id]: e.target.value }))}
                        className="w-16 bg-zinc-700 rounded px-2 py-1 text-sm text-center"
                      />
                    )}
                    <button
                      onClick={() => addItem(product)}
                      className="bg-brand-orange hover:bg-orange-500 text-white rounded px-3 py-1 text-sm font-bold"
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
          Selecciona una mesa para comenzar
        </div>
      )}

      {/* Active order summary */}
      {activeOrder && (
        <div className="border-t border-brand-border p-3 bg-brand-surface">
          <p className="text-xs text-zinc-400 mb-1">
            Mesa {activeOrder.tableNumber} · {activeOrder.items.length} líneas
          </p>
          <div className="space-y-1 max-h-28 overflow-auto">
            {activeOrder.items.map(item => (
              <div key={item.id} className="flex justify-between text-xs">
                <span className="text-zinc-300">{item.product.name}</span>
                <span className={`font-mono ${item.status === 'WEIGHED' ? 'text-green-400' : 'text-yellow-400'}`}>
                  {item.status === 'WEIGHED' && item.finalWeightGrams
                    ? `${item.finalWeightGrams}g`
                    : item.estimatedWeightGrams
                    ? `~${item.estimatedWeightGrams}g`
                    : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Step 4: Commit**

```bash
git add src/stations/WaiterStation/ src/components/
git commit -m "feat: add WaiterStation with table selector and product catalog"
```

---

### Task 19: KitchenDisplay — KDS for KITCHEN items

**Files:**
- Create: `freiduría-tpv/frontend/src/stations/KitchenDisplay/KitchenDisplay.tsx`

**Step 1: Write KitchenDisplay**

```tsx
// src/stations/KitchenDisplay/KitchenDisplay.tsx
import { useEffect, useState } from 'react';
import { StationHeader } from '../../components/StationHeader';
import { useSocket } from '../../hooks/useSocket';
import type { Order, OrderItem } from '../../types';

interface Props { orders: Order[]; onRefresh: () => void; }

interface TicketItem extends OrderItem { tableNumber: number; orderId: string; }

function ElapsedTimer({ since }: { since: string }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(since).getTime();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [since]);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const color = elapsed > 300 ? 'text-red-400' : elapsed > 120 ? 'text-yellow-400' : 'text-green-400';
  return <span className={`font-mono text-xs ${color}`}>{mins}:{secs.toString().padStart(2, '0')}</span>;
}

export function KitchenDisplay({ orders, onRefresh }: Props) {
  useSocket('kitchen', {
    newOrderItem: () => onRefresh(),
    orderItemUpdated: () => onRefresh(),
  });

  const tickets: TicketItem[] = orders.flatMap(order =>
    order.items
      .filter(item => item.product.destination === 'KITCHEN' && item.status !== 'SERVED')
      .map(item => ({ ...item, tableNumber: order.tableNumber, orderId: order.id }))
  );

  return (
    <div className="flex flex-col h-full">
      <StationHeader
        title="Cocina"
        subtitle={`${tickets.length} líneas pendientes`}
        color="text-red-400"
      />

      <div className="flex-1 overflow-auto p-3 space-y-2">
        {tickets.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-zinc-500 text-sm">
            Sin comandas pendientes 🎉
          </div>
        ) : (
          tickets.map(item => (
            <div
              key={item.id}
              className={`rounded-xl border p-3 transition-all
                ${item.status === 'WEIGHED' ? 'border-green-600 bg-green-900/20' :
                  'border-brand-border bg-brand-surface'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-brand-orange bg-orange-900/40 rounded px-1.5 py-0.5">
                      Mesa {item.tableNumber}
                    </span>
                    <ElapsedTimer since={item.createdAt} />
                  </div>
                  <p className="mt-1 font-semibold">{item.product.name}</p>
                  {item.product.isWeighed && (
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Pedido: ~{item.estimatedWeightGrams}g
                      {item.finalWeightGrams && (
                        <span className="text-green-400 ml-2">✓ Pesado: {item.finalWeightGrams}g</span>
                      )}
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium
                  ${item.status === 'WEIGHED' ? 'bg-green-900 text-green-300' :
                    'bg-zinc-700 text-zinc-300'}`}>
                  {item.status}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/stations/KitchenDisplay/
git commit -m "feat: add KitchenDisplay KDS with elapsed timers and real-time socket"
```

---

### Task 20: BarScaleStation — bar display + weighing interface

**Files:**
- Create: `freiduría-tpv/frontend/src/stations/ScaleStation/BarScaleStation.tsx`

**Step 1: Write BarScaleStation**

```tsx
// src/stations/ScaleStation/BarScaleStation.tsx
import { useState } from 'react';
import { StationHeader } from '../../components/StationHeader';
import { useSocket } from '../../hooks/useSocket';
import { api } from '../../lib/api';
import { parseWeightBarcode } from '../../lib/barcodeParser';
import type { Order, OrderItem } from '../../types';

interface Props {
  orders: Order[];
  onWeightUpdate: (itemId: string, grams: number) => void;
  onRefresh: () => void;
}

export function BarScaleStation({ orders, onWeightUpdate, onRefresh }: Props) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [manualGrams, setManualGrams] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  useSocket('bar', {
    newOrderItem: () => onRefresh(),
  });
  useSocket('scale', {
    newOrderItem: () => onRefresh(),
  });

  // Items that need weighing (kitchen fish items not yet weighed)
  const pendingWeigh: Array<OrderItem & { tableNumber: number }> = orders.flatMap(order =>
    order.items
      .filter(i => i.product.isWeighed && i.status === 'PENDING')
      .map(i => ({ ...i, tableNumber: order.tableNumber }))
  );

  // Bar items (cold food + drinks)
  const barTickets: Array<OrderItem & { tableNumber: number }> = orders.flatMap(order =>
    order.items
      .filter(i => i.product.destination === 'BAR' && i.status !== 'SERVED')
      .map(i => ({ ...i, tableNumber: order.tableNumber }))
  );

  async function submitWeight(itemId: string) {
    const grams = parseInt(manualGrams[itemId] ?? '0', 10);
    if (!grams || grams <= 0) return;
    setSubmitting(itemId);
    await api.updateWeight(itemId, grams);
    onWeightUpdate(itemId, grams);
    onRefresh();
    setSubmitting(null);
  }

  function handleBarcode(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseWeightBarcode(barcodeInput);
    if (parsed) {
      const match = pendingWeigh.find(i => i.productId.endsWith(parsed.productCode));
      if (match) setManualGrams(m => ({ ...m, [match.id]: String(parsed.weightGrams) }));
    }
    setBarcodeInput('');
  }

  return (
    <div className="flex flex-col h-full">
      <StationHeader title="Barra + Balanza" subtitle="Pase y pesaje" color="text-blue-400" />

      {/* EAN-13 barcode simulator */}
      <div className="p-3 border-b border-brand-border bg-brand-surface">
        <p className="text-xs text-zinc-400 mb-2">Lector código de barras EAN-13</p>
        <form onSubmit={handleBarcode} className="flex gap-2">
          <input
            value={barcodeInput}
            onChange={e => setBarcodeInput(e.target.value)}
            placeholder="Escanear o escribir EAN-13..."
            className="flex-1 bg-zinc-700 rounded px-3 py-1.5 text-sm font-mono"
          />
          <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded text-sm">
            Leer
          </button>
        </form>
      </div>

      {/* Pending weighing */}
      <div className="flex-1 overflow-auto">
        {pendingWeigh.length > 0 && (
          <div className="p-3 border-b border-brand-border">
            <p className="text-xs text-zinc-400 uppercase tracking-widest mb-2">
              Pendiente de pesar ({pendingWeigh.length})
            </p>
            <div className="space-y-2">
              {pendingWeigh.map(item => (
                <div key={item.id} className="bg-brand-surface rounded-xl border border-yellow-600/50 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold text-brand-orange">Mesa {item.tableNumber}</span>
                    <span className="font-semibold text-sm">{item.product.name}</span>
                    <span className="text-xs text-zinc-400 ml-auto">~{item.estimatedWeightGrams}g est.</span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Peso real (g)"
                      value={manualGrams[item.id] ?? ''}
                      onChange={e => setManualGrams(m => ({ ...m, [item.id]: e.target.value }))}
                      className="flex-1 bg-zinc-700 rounded px-3 py-1.5 text-sm text-center font-mono"
                    />
                    <button
                      onClick={() => submitWeight(item.id)}
                      disabled={submitting === item.id}
                      className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-1.5 rounded text-sm font-bold"
                    >
                      {submitting === item.id ? '...' : '✓ Pesar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bar items */}
        <div className="p-3">
          <p className="text-xs text-zinc-400 uppercase tracking-widest mb-2">
            Barra ({barTickets.length})
          </p>
          {barTickets.length === 0 ? (
            <p className="text-zinc-500 text-sm">Sin pedidos en barra</p>
          ) : (
            <div className="space-y-1">
              {barTickets.map(item => (
                <div key={item.id}
                  className="flex items-center justify-between bg-brand-surface rounded-lg px-3 py-2 text-sm">
                  <div>
                    <span className="text-xs text-brand-orange mr-2">Mesa {item.tableNumber}</span>
                    <span>{item.product.name}</span>
                  </div>
                  <span className="font-mono text-zinc-300">
                    {((item.priceFixed ?? 0) / 100).toFixed(2)} €
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create frontend barcode parser utility**

```typescript
// src/lib/barcodeParser.ts
interface ParsedBarcode { productCode: string; weightGrams: number; }

function isValidEAN13CheckDigit(barcode: string): boolean {
  const digits = barcode.split('').map(Number);
  const sum = digits.slice(0, 12).reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}

export function parseWeightBarcode(barcode: string): ParsedBarcode | null {
  if (!/^\d{13}$/.test(barcode)) return null;
  const prefix = parseInt(barcode.slice(0, 2), 10);
  if (prefix < 20 || prefix > 29) return null;
  if (!isValidEAN13CheckDigit(barcode)) return null;
  return { productCode: barcode.slice(2, 7), weightGrams: parseInt(barcode.slice(7, 12), 10) };
}
```

**Step 3: Commit**

```bash
git add src/stations/ScaleStation/ src/lib/barcodeParser.ts
git commit -m "feat: add BarScaleStation with manual weight entry and EAN-13 barcode simulator"
```

---

### Task 21: CashRegister — TPV with real-time total

**Files:**
- Create: `freiduría-tpv/frontend/src/stations/CashRegister/CashRegister.tsx`

**Step 1: Write CashRegister**

```tsx
// src/stations/CashRegister/CashRegister.tsx
import { useState, useEffect } from 'react';
import { StationHeader } from '../../components/StationHeader';
import { PriceTag } from '../../components/PriceTag';
import { useSocket } from '../../hooks/useSocket';
import { api } from '../../lib/api';
import type { Order, OrderTotal } from '../../types';

interface Props { order: Order | null; onRefresh: () => void; }

export function CashRegister({ order, onRefresh }: Props) {
  const [total, setTotal] = useState<OrderTotal | null>(null);

  useSocket('tpv', {
    orderItemUpdated: () => {
      onRefresh();
      if (order) fetchTotal(order.id);
    },
  });

  async function fetchTotal(orderId: string) {
    const t = await api.getOrderTotal(orderId);
    setTotal(t);
  }

  useEffect(() => {
    if (order) fetchTotal(order.id);
    else setTotal(null);
  }, [order?.id, order?.items.length]);

  if (!order) {
    return (
      <div className="flex flex-col h-full">
        <StationHeader title="TPV / Caja" color="text-purple-400" />
        <div className="flex-1 flex items-center justify-center text-zinc-500 text-sm">
          Selecciona una mesa en el Camarero
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <StationHeader
        title="TPV / Caja"
        subtitle={`Mesa ${order.tableNumber}`}
        color="text-purple-400"
      />

      {/* Line items */}
      <div className="flex-1 overflow-auto p-3 space-y-1">
        {order.items.map(item => {
          const priceEuros = item.product.isWeighed
            ? item.finalWeightGrams
              ? ((item.pricePerKg! * item.finalWeightGrams) / 1000 / 100).toFixed(2)
              : item.estimatedWeightGrams
              ? ((item.pricePerKg! * item.estimatedWeightGrams) / 1000 / 100).toFixed(2)
              : '—'
            : ((item.priceFixed ?? 0) / 100).toFixed(2);

          return (
            <div key={item.id}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm
                ${item.product.isWeighed && !item.finalWeightGrams
                  ? 'bg-yellow-900/20 border border-yellow-600/40'
                  : 'bg-brand-surface'}`}>
              <div className="flex-1 min-w-0">
                <span className="truncate block">{item.product.name}</span>
                {item.product.isWeighed && (
                  <span className="text-xs text-zinc-400">
                    {item.finalWeightGrams
                      ? <span className="text-green-400">{item.finalWeightGrams}g (real)</span>
                      : <span className="text-yellow-400">~{item.estimatedWeightGrams}g (est.) ⚠️</span>}
                  </span>
                )}
              </div>
              <span className="font-mono tabular-nums ml-2 text-right">{priceEuros} €</span>
            </div>
          );
        })}
      </div>

      {/* Warning */}
      {total?.requiresWeighingWarning && (
        <div className="mx-3 mb-2 bg-yellow-900/30 border border-yellow-600 rounded-lg p-2 text-xs text-yellow-300">
          ⚠️ Precio estimado — falta pesar: {total.unweighedItems.join(', ')}
        </div>
      )}

      {/* Total and pay button */}
      <div className="border-t border-brand-border p-4 bg-brand-surface">
        <div className="flex justify-between items-center mb-3">
          <span className="text-zinc-400">TOTAL</span>
          <span className="text-2xl font-bold font-mono text-white">
            {total ? `${total.totalEuros} €` : '—'}
          </span>
        </div>
        <button
          disabled={!!total?.requiresWeighingWarning}
          className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed
            text-white font-bold py-3 rounded-xl text-lg transition-colors"
        >
          {total?.requiresWeighingWarning ? '⚠️ Esperando pesaje...' : '💳 COBRAR'}
        </button>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/stations/CashRegister/
git commit -m "feat: add CashRegister TPV with real-time total and weighing warning"
```

---

## Phase 6 — Integration & Verification

### Task 22: Run full integration test

**Step 1: Start backend and seed data**

```bash
cd freiduría-tpv/backend && npm run dev &
sleep 3 && npm run db:seed
```

**Step 2: Start frontend**

```bash
cd freiduría-tpv/frontend && npm run dev
```

**Step 3: Simulate complete flow in browser at `http://localhost:5173`**

Scenario to verify:
1. Select table 3 in WaiterStation
2. Add "Chocos" with estimated 250g — verify appears in KitchenDisplay with timer
3. Add "Cerveza" — verify appears in BarScaleStation bar section
4. In BarScaleStation, enter 260g for the Chocos line, click "✓ Pesar"
5. Verify CashRegister updates total from ~3.50€ to 3.64€ (1400 cents × 260g / 1000)
6. Verify ⚠️ warning disappears
7. Verify COBRAR button activates

**Step 4: Run all backend tests**

```bash
cd freiduría-tpv/backend && npm test
```

Expected: All tests PASS.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete freiduría TPV MVP — variable-weight POS system"
```

---

## Appendix: Key Math Reference

| Scenario | Formula | Example |
|----------|---------|---------|
| Weight price | `Math.round((pricePerKgCents * grams) / 1000)` | `(1400 × 260) / 1000 = 364¢ = 3.64€` |
| Display price | `(cents / 100).toFixed(2)` | `364 / 100 = "3.64"` |
| EAN-13 grams | `parseInt(barcode.slice(7, 12), 10)` | `"00260" → 260g` |

## Appendix: Socket Events Reference

| Event | Emitted by | Consumed by |
|-------|-----------|------------|
| `newOrderItem` | `createOrderItem` | `kitchen` or `bar` room |
| `orderItemUpdated` | `updateFinalWeight` | `waiter`, `tpv`, `kitchen` rooms |
