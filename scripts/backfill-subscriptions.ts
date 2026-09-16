import "dotenv/config";
import { db } from "../src/lib/db";

async function main() {
  console.log("Starting subscription backfill...");

  const businesses = await db.business.findMany({
    select: {
      id: true,
      name: true,
      subscription: {
        select: {
          id: true,
          plan: true,
          status: true,
        },
      },
    },
  });

  console.log(
    `Found ${businesses.length} businesses.`
  );

  let created = 0;
  let skipped = 0;

  for (const business of businesses) {
    if (business.subscription) {
      skipped++;

      console.log(
        `Skipped existing subscription: ${business.name} (${business.subscription.plan})`
      );

      continue;
    }

    await db.subscription.create({
      data: {
        businessId: business.id,
        plan: "FREE",
        status: "ACTIVE",
      },
    });

    created++;

    console.log(
      `Created FREE subscription: ${business.name}`
    );
  }

  console.log("");
  console.log("Subscription backfill completed.");
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);
}

main()
  .catch((error) => {
    console.error(
      "Subscription backfill failed:",
      error
    );

    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });