import "dotenv/config";
import { db } from "../src/lib/db";


async function main() {
  console.log("Starting business owner membership backfill...");

  const businesses = await db.business.findMany({
    where: {
      ownerId: {
        not: null,
      },
    },
    select: {
      id: true,
      name: true,
      ownerId: true,
    },
  });

  console.log(
    `Found ${businesses.length} businesses with owners.`
  );

  let created = 0;
  let updated = 0;

  for (const business of businesses) {
    if (!business.ownerId) {
      continue;
    }

    const existingMembership =
      await db.businessMember.findUnique({
        where: {
          businessId_userId: {
            businessId: business.id,
            userId: business.ownerId,
          },
        },
      });

    if (existingMembership) {
      if (existingMembership.role !== "OWNER") {
        await db.businessMember.update({
          where: {
            id: existingMembership.id,
          },
          data: {
            role: "OWNER",
          },
        });

        updated++;

        console.log(
          `Updated OWNER membership: ${business.name}`
        );
      }

      continue;
    }

    await db.businessMember.create({
      data: {
        businessId: business.id,
        userId: business.ownerId,
        role: "OWNER",
      },
    });

    created++;

    console.log(
      `Created OWNER membership: ${business.name}`
    );
  }

  console.log("");
  console.log("Backfill completed.");
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
}

main()
  .catch((error) => {
    console.error(
      "Business owner backfill failed:",
      error
    );

    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });