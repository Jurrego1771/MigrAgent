import { PrismaClient } from '@prisma/client';

// Singleton — una sola instancia en todo el proceso.
// Con SQLite, múltiples instancias abren conexiones separadas y pueden causar
// errores de lock en escrituras concurrentes.
const prisma = new PrismaClient();

export default prisma;
