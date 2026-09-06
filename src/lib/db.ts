import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = new PrismaClient()

if ( process.env.NODE_ENV !== 'production' ) {
  if ( globalForPrisma.prisma ) {
    globalForPrisma.prisma.$disconnect().catch( () => {} )
  }
  globalForPrisma.prisma = prisma
}

