import { prisma } from "../src/lib/prisma.js";

const serviceZones = [
  { name: "mirpur-1", latitude: 23.7937, longitude: 90.3654 },
  { name: "mirpur-2", latitude: 23.7998, longitude: 90.3537 },
  { name: "mirpur-10", latitude: 23.8067, longitude: 90.3686 },
  { name: "uttara-4", latitude: 23.8681, longitude: 90.3882 },
  { name: "uttara-5", latitude: 23.8729, longitude: 90.3899 },
  { name: "uttara-6", latitude: 23.8759, longitude: 90.3935 },
];

for (const zone of serviceZones) {
  await prisma.serviceZone.upsert({
    where: { name: zone.name },
    create: zone,
    update: {
      latitude: zone.latitude,
      longitude: zone.longitude,
    },
  });
}

await prisma.$disconnect();
