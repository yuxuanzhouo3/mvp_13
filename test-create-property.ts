
import { SupabaseAdapter } from './lib/db-adapter';
import { prisma } from './lib/db';

async function main() {
  const adapter = new SupabaseAdapter();
  
  // Mock property data with JSON fields (images, amenities)
  const propertyData = {
    landlordId: 'test-landlord-id', // We might need a real user ID
    title: 'Test Property for JSON Serialization',
    description: 'Testing if JSON arrays are correctly serialized',
    address: '123 Test St',
    city: 'Test City',
    state: 'TS',
    zipCode: '12345',
    country: 'US',
    price: 1000,
    deposit: 1000,
    bedrooms: 2,
    bathrooms: 1,
    propertyType: 'APARTMENT',
    status: 'AVAILABLE',
    images: ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'],
    amenities: ['Wifi', 'Parking', 'Pool'],
    petFriendly: true,
    // Add createdAt to test timestamp handling
    createdAt: new Date(),
    updatedAt: new Date()
  };

  console.log('Attempting to create property with JSON fields...');
  
  try {
    // First, we need a user to link to. Let's try to find one or create a dummy one.
    // Use raw query for safety as prisma schema might mismatch slightly
    const users = await prisma.$queryRawUnsafe(`SELECT * FROM "User" WHERE "userType" = 'LANDLORD' LIMIT 1`);
    let user = users[0];

    if (!user) {
        console.log('No landlord found, creating a dummy user...');
        // Create a dummy user using raw query to avoid other potential issues
        const userId = `user_${Date.now()}`;
        await prisma.$executeRawUnsafe(`
            INSERT INTO "User" ("id", "email", "password", "name", "userType", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        `, userId, `test${Date.now()}@example.com`, 'password', 'Test Landlord', 'LANDLORD');
        user = { id: userId };
    }
    
    if (user) {
        propertyData.landlordId = user.id;
        console.log(`Using landlord ID: ${user.id}`);

        // Try to create property using the adapter (which uses the create method we modified)
        // Note: adapter.create calls prisma.$executeRawUnsafe internally for SupabaseAdapter
        const result = await adapter.create('properties', propertyData);
        console.log('Property created successfully:', result);
    } else {
        console.error('Failed to get a landlord user.');
    }

  } catch (error: any) {
    console.error('Error creating property:', error);
    if (error.code) {
        console.error('Error Code:', error.code);
    }
    if (error.meta) {
        console.error('Error Meta:', error.meta);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
