import { PrismaClient } from '@prisma/client';
import { v7 as uuidv7 } from 'uuid';

const prisma = new PrismaClient();
const id = () => uuidv7();

/**
 * Minimal demo data to make the vertical slice show something:
 * one platform admin, two routes, two LIVE houseboats with a deck,
 * a cabin category and a couple of cabins each.
 */
async function main() {
  // Platform admin
  await prisma.account.upsert({
    where: { phone: '+8801700000000' },
    update: {},
    create: {
      id: id(),
      name: 'Platform Admin',
      email: 'admin@houseboat.test',
      phone: '+8801700000000',
      isPlatform: true,
      phoneVerified: true,
    },
  });

  // Routes (platform-curated)
  const tanguar = await prisma.route.create({
    data: { id: id(), name: 'Tanguar Haor', region: 'Sunamganj', active: true },
  });
  const nikli = await prisma.route.create({
    data: { id: id(), name: 'Nikli Haor', region: 'Kishoreganj', active: true },
  });

  const boats = [
    { name: 'Jol Kolol', slug: 'jol-kolol', route: tanguar.id },
    { name: 'Haor Bilash', slug: 'haor-bilash', route: nikli.id },
  ];

  for (const b of boats) {
    const boat = await prisma.houseboat.create({
      data: {
        id: id(),
        name: b.name,
        slug: b.slug,
        description: `${b.name} — a comfortable houseboat cruising the haor.`,
        safetyFeatures: 'Life jackets for all guests, trained crew, first-aid kit.',
        foodMenu: 'Local Bangladeshi cuisine, fresh fish, breakfast included.',
        status: 'live',
        profileCompletePct: 100,
        operatingDates: [],
        defaultCrew: [],
      },
    });

    await prisma.houseboatRoute.create({
      data: { id: id(), houseboatId: boat.id, routeId: b.route },
    });

    const deck = await prisma.houseboatDeck.create({
      data: { id: id(), houseboatId: boat.id, name: 'Upper Deck', position: 1 },
    });

    const category = await prisma.houseboatCabinCategory.create({
      data: {
        id: id(),
        houseboatId: boat.id,
        name: 'Luxury AC',
        isAc: true,
        baseCapacity: 2,
        extendedCapacity: 3,
        facilities: 'AC, attached bath, balcony view.',
      },
    });

    for (const name of ['101', '102']) {
      await prisma.houseboatCabin.create({
        data: {
          id: id(),
          deckId: deck.id,
          cabinCategoryId: category.id,
          name,
        },
      });
    }
  }

  console.log('Seed complete: 2 live houseboats, 2 routes, 1 admin.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
