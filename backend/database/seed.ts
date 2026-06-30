require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
import pool from '../config/database';
import bcrypt from 'bcryptjs';

const vets = [
  {
    name: "Central Veterinary Hospital Dhaka",
    location_name: "Mirpur",
    latitude: 23.8103,
    longitude: 90.3654,
    address: "Road 12, Mirpur DOHS, Mirpur, Dhaka 1216",
    contact: "+880 1711-234567",
    email: "central.vet@gmail.com",
    description:
      "One of the leading veterinary hospitals in Dhaka offering comprehensive care for all pets including dogs, cats, birds, and exotic animals. Our team of experienced veterinarians provides 24/7 emergency services.",
    services: [
      "General Checkup",
      "Surgery",
      "Vaccination",
      "Dental Care",
      "Emergency Care",
      "X-Ray",
      "Lab Tests",
    ],
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600",
  },
  {
    name: "Gulshan Pet Care Center",
    location_name: "Gulshan",
    latitude: 23.7806,
    longitude: 90.4193,
    address: "House 45, Road 7, Gulshan-1, Dhaka 1212",
    contact: "+880 1812-345678",
    email: "gulshan.petcare@gmail.com",
    description:
      "Premium pet care facility in the heart of Gulshan offering state-of-the-art medical equipment and experienced veterinary staff. Specializing in small animal care and exotic pets.",
    services: [
      "Consultation",
      "Grooming",
      "Boarding",
      "Vaccination",
      "Surgery",
      "Microchipping",
      "Nutrition Counseling",
    ],
    image: "https://images.unsplash.com/photo-1576201836106-db1758fd1c97?w=600",
  },
  {
    name: "Dhanmondi Animal Clinic",
    location_name: "Dhanmondi",
    latitude: 23.7461,
    longitude: 90.3742,
    address: "House 32, Road 8A, Dhanmondi R/A, Dhaka 1209",
    contact: "+880 1911-456789",
    email: "dhanmondi.animal@gmail.com",
    description:
      "Trusted veterinary clinic serving Dhanmondi for over 15 years. We offer compassionate care for your beloved pets with modern diagnostic facilities.",
    services: [
      "General Medicine",
      "Surgery",
      "Vaccination",
      "Parasite Control",
      "Spay/Neuter",
      "Blood Tests",
    ],
    image: "https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?w=600",
  },
  {
    name: "Uttara Veterinary & Pet Shop",
    location_name: "Uttara",
    latitude: 23.8759,
    longitude: 90.3795,
    address: "Sector 7, Road 14, Uttara, Dhaka 1230",
    contact: "+880 1611-567890",
    email: "uttara.vet@gmail.com",
    description:
      "Complete pet solution center offering veterinary services along with a well-stocked pet shop. From food and accessories to medical care — all under one roof.",
    services: [
      "Veterinary Care",
      "Pet Shop",
      "Grooming",
      "Vaccination",
      "Dental Cleaning",
      "Flea Treatment",
    ],
    image: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600",
  },
  {
    name: "Bashundhara Pet Hospital",
    location_name: "Bashundhara",
    latitude: 23.8137,
    longitude: 90.4253,
    address: "Block C, Road 10, Bashundhara R/A, Dhaka 1229",
    contact: "+880 1511-678901",
    email: "bashundhara.pet@gmail.com",
    description:
      "Modern pet hospital equipped with the latest veterinary technology. Our team includes specialists in orthopedics, ophthalmology, and dermatology for comprehensive pet healthcare.",
    services: [
      "Orthopedic Surgery",
      "Eye Care",
      "Skin Treatment",
      "Emergency",
      "Ultrasound",
      "ECG",
      "Physiotherapy",
    ],
    image: "https://images.unsplash.com/photo-1601758174114-e711c0cbaa69?w=600",
  },
  {
    name: "Chittagong Central Animal Hospital",
    location_name: "Chittagong",
    latitude: 22.3569,
    longitude: 91.7832,
    address: "GEC Circle, Chittagong 4000",
    contact: "+880 1711-789012",
    email: "ctg.animal@gmail.com",
    description:
      "The premier veterinary hospital in Chittagong providing high-quality care for all types of animals. Serving the port city with dedication and expertise since 2005.",
    services: [
      "General Care",
      "Surgery",
      "Vaccination",
      "Marine Animal Care",
      "Emergency",
      "Lab Diagnostics",
    ],
    image: "https://images.unsplash.com/photo-1612531386530-97286d97c2d2?w=600",
  },
  {
    name: "Sylhet Pet Wellness Center",
    location_name: "Sylhet",
    latitude: 24.8949,
    longitude: 91.8687,
    address: "Zindabazar, Sylhet 3100",
    contact: "+880 1811-890123",
    email: "sylhet.wellness@gmail.com",
    description:
      "Providing holistic veterinary care in the beautiful tea garden city of Sylhet. We specialize in preventive care and wellness programs for pets.",
    services: [
      "Wellness Checkup",
      "Vaccination",
      "Deworming",
      "Nutritional Advice",
      "Puppy/Kitten Care",
    ],
    image: "https://images.unsplash.com/photo-1548681528-6a5c45b66b42?w=600",
  },
  {
    name: "Rajshahi Animal Care",
    location_name: "Rajshahi",
    latitude: 24.3636,
    longitude: 88.6241,
    address: "Shaheb Bazar, Rajshahi 6000",
    contact: "+880 1911-901234",
    email: "rajshahi.animal@gmail.com",
    description:
      "Dedicated veterinary practice in the silk city of Rajshahi. We provide affordable and quality veterinary services to pet owners across the northern region.",
    services: [
      "Consultation",
      "Surgery",
      "Vaccination",
      "Livestock Care",
      "Poultry Medicine",
      "Lab Tests",
    ],
    image: "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=600",
  },
  {
    name: "Banani Paws & Claws Clinic",
    location_name: "Banani",
    latitude: 23.7937,
    longitude: 90.4066,
    address: "House 12, Road 11, Banani, Dhaka 1213",
    contact: "+880 1611-012345",
    email: "banani.paws@gmail.com",
    description:
      "Boutique veterinary clinic in upscale Banani offering personalized care for your furry family members. We treat every pet as our own.",
    services: [
      "Preventive Care",
      "Dental Health",
      "Senior Pet Care",
      "Behavioral Counseling",
      "Vaccination",
      "Grooming",
    ],
    image: "https://images.unsplash.com/photo-1628009368231-7bb7cfcb0def?w=600",
  },
  {
    name: "Mohammadpur Vet Clinic",
    location_name: "Mohammadpur",
    latitude: 23.7617,
    longitude: 90.357,
    address: "Asad Gate, Mohammadpur, Dhaka 1207",
    contact: "+880 1511-123456",
    email: "mohammadpur.vet@gmail.com",
    description:
      "Affordable and reliable veterinary services for the community of Mohammadpur. Our experienced doctors provide compassionate care with transparent pricing.",
    services: [
      "Basic Care",
      "Vaccination",
      "Deworming",
      "Wound Care",
      "Minor Surgery",
      "Medicine Dispensary",
    ],
    image: "https://images.unsplash.com/photo-1601758174114-e711c0cbaa69?w=600",
  },
  {
    name: "Wari Animal Hospital",
    location_name: "Wari",
    latitude: 23.7238,
    longitude: 90.4143,
    address: "Wari, Old Dhaka 1203",
    contact: "+880 1711-234568",
    email: "wari.animal@gmail.com",
    description:
      "Serving the historic neighborhood of Old Dhaka with quality veterinary care. We are committed to maintaining the health and happiness of pets in our community.",
    services: [
      "General Medicine",
      "Vaccination",
      "Surgery",
      "X-Ray",
      "Blood Work",
      "Flea & Tick Treatment",
    ],
    image: "https://images.unsplash.com/photo-1576201836106-db1758fd1c97?w=600",
  },
  {
    name: "Khulna Pet Medical Center",
    location_name: "Khulna",
    latitude: 22.8456,
    longitude: 89.5403,
    address: "KDA Avenue, Khulna 9000",
    contact: "+880 1811-345679",
    email: "khulna.pet@gmail.com",
    description:
      "The leading veterinary center in the southern gateway city of Khulna. We provide comprehensive care for pets and also support wildlife conservation in the Sundarbans area.",
    services: [
      "General Care",
      "Wildlife Consultation",
      "Surgery",
      "Vaccination",
      "Aquatic Animal Care",
      "Emergency",
    ],
    image: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600",
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    console.log("🌱 Starting database seed...");

    // Insert vets
    for (const vet of vets) {
      await client.query(
        `INSERT INTO vets (name, location_name, latitude, longitude, address, contact, email, description, services, image)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT DO NOTHING`,
        [
          vet.name,
          vet.location_name,
          vet.latitude,
          vet.longitude,
          vet.address,
          vet.contact,
          vet.email,
          vet.description,
          vet.services,
          vet.image,
        ],
      );
    }
    console.log(`✅ Inserted ${vets.length} vets`);

    // Reset vets id sequence to avoid duplicate key errors
    await client.query(
      `SELECT setval('vets_id_seq', (SELECT COALESCE(MAX(id), 0) FROM vets))`,
    );

    // Create sample users. Passwords come from env so they can be rotated on any
    // shared DB without editing code; the literals are LOCAL dev defaults only.
    const seedUserPassword = process.env.SEED_USER_PASSWORD || "User@123";
    const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@123";
    const hashedPassword = await bcrypt.hash(seedUserPassword, 12);
    const adminHash = await bcrypt.hash(seedAdminPassword, 12);

    // Update admin password properly
    await client.query(
      `UPDATE users SET password = $1 WHERE phone = '01700000000'`,
      [adminHash],
    );

    const sampleUsers = [
      {
        name: "Rahim Ahmed",
        phone: "01712345678",
        email: "rahim@gmail.com",
        dob: "1990-05-15",
        address: "Mirpur-10, Dhaka",
      },
      {
        name: "Sultana Begum",
        phone: "01812345678",
        email: "sultana@gmail.com",
        dob: "1988-09-22",
        address: "Gulshan-2, Dhaka",
      },
      {
        name: "Karim Hassan",
        phone: "01912345678",
        email: "karim@gmail.com",
        dob: "1995-12-03",
        address: "Dhanmondi, Dhaka",
      },
    ];

    for (const user of sampleUsers) {
      await client.query(
        `INSERT INTO users (name, phone, email, password, dob, address)
         VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (phone) DO NOTHING`,
        [
          user.name,
          user.phone,
          user.email,
          hashedPassword,
          user.dob,
          user.address,
        ],
      );
    }
    console.log("✅ Inserted sample users");

    // Add sample reviews
    const vetResult = await client.query("SELECT id FROM vets LIMIT 6");
    const userResult = await client.query(
      "SELECT id FROM users WHERE role = 'user' LIMIT 3",
    );

    const reviews = [
      {
        rating: 5,
        comment:
          "Excellent service! The doctors are very professional and caring. My dog recovered quickly after treatment.",
      },
      {
        rating: 4,
        comment:
          "Good clinic with modern equipment. A bit crowded during weekends but the service is worth it.",
      },
      {
        rating: 5,
        comment:
          "Best vet in the area! They treated my cat with so much care. Highly recommended.",
      },
      {
        rating: 3,
        comment:
          "Decent service but waiting time is too long. The staff is friendly though.",
      },
      {
        rating: 4,
        comment:
          "Very knowledgeable doctors. They explained everything clearly about my pet's condition.",
      },
    ];

    if (vetResult.rows.length > 0 && userResult.rows.length > 0) {
      let reviewIdx = 0;
      for (let v = 0; v < Math.min(3, vetResult.rows.length); v++) {
        for (let u = 0; u < Math.min(2, userResult.rows.length); u++) {
          const review = reviews[reviewIdx % reviews.length];
          await client.query(
            `INSERT INTO reviews (user_id, vet_id, rating, comment)
             VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, vet_id) DO NOTHING`,
            [
              userResult.rows[u].id,
              vetResult.rows[v].id,
              review.rating,
              review.comment,
            ],
          );
          reviewIdx++;
        }
      }
    }
    console.log("✅ Inserted sample reviews");

    console.log("\n🎉 Seed completed successfully!");
    console.log("📋 Seeded accounts (passwords from SEED_ADMIN_PASSWORD / SEED_USER_PASSWORD, default dev values):");
    console.log("   Admin  → Phone: 01700000000");
    console.log("   User   → Phone: 01712345678");
  } catch (err) {
    console.error("❌ Seed error:", err);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
