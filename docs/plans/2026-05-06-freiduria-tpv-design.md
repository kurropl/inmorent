# Diseño: Freiduría TPV — Sistema POS de Peso Variable

**Fecha:** 2026-05-06  
**Autor:** Arquitecto de Software Senior  
**Estado:** Aprobado

---

## 1. Contexto y Problema

Sistema POS (TPV) para **Bar Freiduría Javi Benítez**. El problema central es el **peso variable**: el camarero toma la comanda con un peso estimado ("250g de chocos"), pero el precio real solo puede calcularse después de que cocina pese el producto frito en la balanza ("260g reales"). El precio de la línea debe actualizarse en tiempo real en el TPV y en las PDAs de camareros antes del cobro.

### Reglas de Negocio Clave

1. **Solo el pescado frito se pesa** (`isWeighed = true`). El resto tiene precio fijo por ración/unidad.
2. **Enrutamiento de productos:**
   - `destination: BAR` → comida fría + bebidas → pantalla de Barra
   - `destination: KITCHEN` → comida caliente → pantalla de Cocina
   - Pescado frito siempre `destination: KITCHEN` + `isWeighed: true`
3. **Moneda en enteros (céntimos)** para evitar errores de punto flotante.
4. **Snapshot de precio** en `OrderItem.pricePerKg` al momento de la comanda — inmune a cambios de tarifa posteriores.
5. `calculateOrderTotal` usa `finalWeightGrams` si existe; si no, usa `estimatedWeightGrams` + flag `requiresWeighingWarning: true`.

---

## 2. Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js 20 LTS + TypeScript 5 |
| API | Express 4 |
| Base de datos | PostgreSQL 16 via Prisma ORM |
| Tiempo real | Socket.io 4 |
| Frontend | React 18 + Vite 5 + Tailwind CSS 3 |
| Containerización | Docker + docker-compose (dev) |

---

## 3. Arquitectura: Monolito Modular

Un único proceso Express con **fronteras de dominio explícitas** que permiten extracción futura a microservicios sin reescritura.

### Estructura de Directorios

```
freiduría-tpv/
├── backend/
│   ├── src/
│   │   ├── domains/
│   │   │   ├── orders/
│   │   │   │   ├── order.service.ts      # createOrder, getOrder, calculateTotal
│   │   │   │   ├── orderItem.service.ts  # createOrderItem, updateFinalWeight
│   │   │   │   ├── order.routes.ts
│   │   │   │   └── order.types.ts
│   │   │   ├── products/
│   │   │   │   ├── product.service.ts
│   │   │   │   ├── product.routes.ts
│   │   │   │   └── product.types.ts
│   │   │   └── weighing/
│   │   │       ├── barcode.parser.ts     # parseWeightBarcode EAN-13
│   │   │       └── weighing.routes.ts
│   │   ├── infrastructure/
│   │   │   ├── database/
│   │   │   │   └── prisma.client.ts
│   │   │   ├── websocket/
│   │   │   │   ├── socket.server.ts      # inicialización Socket.io
│   │   │   │   └── socket.emitter.ts     # funciones emit por room
│   │   │   └── http/
│   │   │       ├── app.ts                # Express app factory
│   │   │       └── server.ts             # entry point
│   │   └── shared/
│   │       ├── types/
│   │       │   └── index.ts
│   │       └── utils/
│   │           └── money.ts              # helpers céntimos → euros
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts                       # Carta completa Bar Javi Benítez
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── stations/
    │   │   ├── WaiterStation/            # Toma de comanda
    │   │   ├── KitchenDisplay/           # KDS Cocina
    │   │   ├── BarDisplay/               # KDS Barra
    │   │   ├── ScaleStation/             # Balanza + EAN-13
    │   │   └── CashRegister/             # TPV / cobro
    │   ├── hooks/
    │   │   ├── useSocket.ts
    │   │   └── useOrder.ts
    │   ├── components/                   # UI compartida
    │   └── App.tsx                       # Layout 2+2
    ├── package.json
    └── vite.config.ts
```

---

## 4. Modelo de Datos (Prisma)

```prisma
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
  pricePerKg  Int?               // céntimos, solo si isWeighed=true
  priceFixed  Int?               // céntimos, si isWeighed=false
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
  id                   String          @id @default(cuid())
  orderId              String
  order                Order           @relation(fields: [orderId], references: [id])
  productId            String
  product              Product         @relation(fields: [productId], references: [id])
  // Snapshot del precio en el momento de la comanda
  pricePerKg           Int?            // céntimos
  priceFixed           Int?            // céntimos
  estimatedWeightGrams Int?            // solo si isWeighed=true
  finalWeightGrams     Int?            // null hasta que se pese
  status               OrderItemStatus @default(PENDING)
  createdAt            DateTime        @default(now())
  updatedAt            DateTime        @updatedAt
}
```

---

## 5. Lógica de Negocio

### 5.1 Cálculo de Precio (fórmula crítica)

```
// Precio en céntimos para evitar float
// pricePerKg: 1200 = 12,00 €/kg
// weightGrams: 260
//
// Formula: (pricePerKg * weightGrams) / 1000
// Ejemplo: (1200 * 260) / 1000 = 312 céntimos = 3,12 €
//
// División entera con Math.round() para redondeo bancario estándar
// NUNCA usar multiplicación/división de floats en moneda
finalPrice = Math.round((pricePerKg * weightGrams) / 1000)
```

### 5.2 updateFinalWeight

1. Validar que `finalWeightGrams > 0`
2. Actualizar `OrderItem.finalWeightGrams` + `status = WEIGHED`
3. Calcular `finalPrice` con la fórmula anterior
4. Emitir evento `orderItemUpdated` a rooms: `waiter`, `tpv`, `kitchen`

### 5.3 calculateOrderTotal

- Si `item.finalWeightGrams != null` → usar `finalWeightGrams` para calcular
- Si `item.finalWeightGrams == null` && `item.isWeighed` → usar `estimatedWeightGrams` + activar `requiresWeighingWarning: true`
- Sumar todos los `priceFixed` de items no pesables directamente

### 5.4 parseWeightBarcode (EAN-13 Peso Variable)

Formato estándar: `2X PPPPP WWWWW C`
- `2X` → prefijo peso variable (20-29)
- `PPPPP` → 5 dígitos ID producto
- `WWWWW` → 5 dígitos peso (gramos, últimos 3 son decimales → dividir /1000*1000 = gramos enteros)
- `C` → dígito de control

---

## 6. WebSocket Rooms y Eventos

| Room | Suscriptores físicos futuros |
|------|------------------------------|
| `waiter` | PDAs camareros |
| `kitchen` | Pantalla KDS cocina |
| `bar` | Pantalla KDS barra |
| `scale` | Balanza + lector EAN-13 |
| `tpv` | Terminal de cobro |

### Eventos emitidos

| Evento | Room destino | Payload |
|--------|-------------|---------|
| `newOrderItem` | `kitchen` o `bar` | `{ item, product, tableNumber }` |
| `orderItemUpdated` | `waiter`, `tpv`, `kitchen` | `{ itemId, finalWeightGrams, finalPrice, status }` |
| `orderItemServed` | `waiter` | `{ itemId }` |
| `orderClosed` | `tpv` | `{ orderId, total, requiresWeighingWarning }` |

---

## 7. Layout Frontend 2+2

```
┌──────────────────────────┬──────────────────────────┐
│   CAMARERO / MESA        │   COCINA (KDS)            │
│  • Selector mesa 1-10    │  • Tickets pendientes     │
│  • Carta categorizada    │  • Timer por ticket       │
│  • Peso estimado (g)     │  • Botón "Listo pesar"    │
│  • Estado comanda        │  • Destino: solo KITCHEN  │
├──────────────────────────┼──────────────────────────┤
│   BARRA                  │   TPV / CAJA              │
│  • Tickets BAR           │  • Líneas con precio      │
│  • Bebidas + frío        │  • ⚠️ flags sin pesar      │
│  • Balanza / EAN-13 sim  │  • Total actualizado      │
│  • Input peso real (g)   │  • Botón COBRAR           │
└──────────────────────────┴──────────────────────────┘
```

> Nota: La balanza se coloca en el panel inferior izquierdo (Barra/Pase) ya que el pase físico suele estar entre cocina y la barra. Los tickets de cocina que requieren pesaje llegan aquí.

---

## 8. Seed de Productos (Carta Javi Benítez)

Categorías a sembrar:
- **Freiduras** (isWeighed: true, destination: KITCHEN): Chocos, Puntillitas, Gambas, Boquerones fritos, Cazón, Salmonetes, Acedías
- **Mariscos fríos** (isWeighed: false, destination: BAR): Gambas cocidas, Quisquillas, Berberechos
- **Raciones calientes** (isWeighed: false, destination: KITCHEN): Croquetas, Patatas bravas, Ensaladilla
- **Bebidas** (isWeighed: false, destination: BAR): Cerveza, Refresco, Agua, Vino

---

## 9. Decisiones de Diseño y Rationale

| Decisión | Alternativa rechazada | Motivo |
|----------|-----------------------|--------|
| Enteros para moneda | `float` / `Decimal` | IEEE 754 introduce errores en sumas repetidas |
| Snapshot precio en OrderItem | Leer precio de Product siempre | Cambio de tarifa no debe afectar comandas abiertas |
| Monolito modular | Microservicios | Un restaurante, un proceso, complejidad mínima |
| Rooms por tipo de dispositivo | Broadcast global | Cada dispositivo solo recibe sus eventos relevantes |
| `destination` en Product | Lógica de enrutamiento en frontend | La regla de negocio vive en el backend |

---

## 10. Fuera de Alcance (V1)

- Autenticación y roles de usuario
- Gestión de inventario / stock
- Informes y estadísticas
- Integración con TPV físico (Verifone, etc.)
- Conexión serial/USB con balanza física (se usa EAN-13 como Plan B)
- Multi-restaurante / multi-sede
