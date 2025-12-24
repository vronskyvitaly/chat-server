// src/prisma.ts

import { PrismaClient } from '../../src/generated/prisma'

// Создаем одиночный экземпляр Prisma Client
const prisma = new PrismaClient()

// Экспортируем единственный экземпляр
export default prisma
