/**
 * DSVTT (VTT Forge) — Database Seed Script
 *
 * Creates baseline test data:
 *   - 2 users (director + player)
 *   - 1 test room owned by the director
 *   - Both users added to the room with appropriate roles
 *
 * Usage:
 *   npx prisma db seed
 *   pnpm db:seed
 */

import { PrismaClient, RoomStatus, PlayerRole, SessionStatus } from '@prisma/client';
// SessionStatus used only for cleanup of stale seed sessions
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SEED_PASSWORD = 'password123';
const BCRYPT_ROUNDS = 10;

interface SeedUser {
  email: string;
  displayName: string;
  role: PlayerRole;
}

const seedUsers: SeedUser[] = [
  { email: 'director@test.com', displayName: 'Test Director', role: PlayerRole.DIRECTOR },
  { email: 'player@test.com', displayName: 'Test Player', role: PlayerRole.PLAYER },
];

async function main(): Promise<void> {
  console.log('🌱 Seeding database...\n');

  // ── Users ───────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, BCRYPT_ROUNDS);

  const users = await Promise.all(
    seedUsers.map((u) =>
      prisma.user.upsert({
        where: { email: u.email },
        update: { displayName: u.displayName, passwordHash },
        create: {
          email: u.email,
          displayName: u.displayName,
          passwordHash,
        },
      }),
    ),
  );

  const director = users.find((u) => u.email === 'director@test.com')!;
  const player = users.find((u) => u.email === 'player@test.com')!;

  console.log(`  ✓ Users: ${users.map((u) => u.email).join(', ')}`);

  // ── Room ────────────────────────────────────────────────────────────────
  const room = await prisma.room.upsert({
    where: { id: '00000000-0000-4000-a000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-a000-000000000001',
      name: 'Test Dungeon',
      status: RoomStatus.WAITING,
      directorId: director.id,
      maxPlayers: 8,
    },
  });

  console.log(`  ✓ Room: "${room.name}" (${room.id})`);

  // ── Room Players ────────────────────────────────────────────────────────
  const roomPlayersData = [
    { roomId: room.id, userId: director.id, role: PlayerRole.DIRECTOR },
    { roomId: room.id, userId: player.id, role: PlayerRole.PLAYER },
  ];

  for (const rp of roomPlayersData) {
    await prisma.roomPlayer.upsert({
      where: {
        roomId_userId: { roomId: rp.roomId, userId: rp.userId },
      },
      update: { role: rp.role },
      create: rp,
    });
  }

  console.log(`  ✓ Room players: director + player assigned`);

  // Clean up any stale SETUP sessions left from previous seeds
  await prisma.gameSession.deleteMany({
    where: {
      id: '00000000-0000-4000-a000-000000000002',
      status: SessionStatus.SETUP,
    },
  });

  console.log(`  ✓ Cleaned up stale seed sessions`);

  console.log('\n✅ Seed complete.');
}

main()
  .catch((e: unknown) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
