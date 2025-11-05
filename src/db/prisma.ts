// src/prisma.ts

import { PrismaClient } from '../generated/prisma/client'

// Создаем одиночный экземпляр Prisma Client
const prisma = new PrismaClient()

// Экспортируем единственный экземпляр
export default prisma
