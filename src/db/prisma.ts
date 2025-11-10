// src/prisma.ts

import { PrismaClient } from '../../src/generated/prisma'

// Создаем одиночный экземпляр Prisma Client
const prisma = new PrismaClient()

// Экспортируем единственный экземплярck
export default prisma
