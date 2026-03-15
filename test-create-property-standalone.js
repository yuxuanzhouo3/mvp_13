const { prisma } = require('./lib/db');

async function resolveTableMeta(collection) {
    const tableNameMap = {
      users: 'User',
      properties: 'Property',
    };
    const canonicalName = tableNameMap[collection] || 'Property';
    
    // Use raw query to get actual table name case if needed, but for now assume Property
    // Actually we should query information_schema to be sure about case sensitivity if needed
    // But let's trust canonicalName matches schema for this test or use the logic from adapter
    
    const tableName = canonicalName;
    
    const columnsResult = await prisma.$queryRawUnsafe(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
        tableName
      );
      
    const columns = new Set();
    const columnTypes = new Map();
      
    if (columnsResult && Array.isArray(columnsResult)) {
        columnsResult.forEach((col) => {
          const name = String(col.column_name);
          columns.add(name);
          columnTypes.set(name, String(col.data_type).toLowerCase());
        });
    }

    if (columns.size > 0) {
        return { tableName, columns, columnTypes };
    }
    return null;
}

async function createProperty(data) {
    const collection = 'properties';
    const tableMeta = await resolveTableMeta(collection);
    
    if (!tableMeta) throw new Error("Table meta not found for Property");

    const payload = { ...data };
    if (!payload.id) payload.id = `prop_${Date.now()}`;
    if (!payload.createdAt) payload.createdAt = new Date();
    if (!payload.updatedAt) payload.updatedAt = new Date();

    const entries = Object.entries(payload).filter(([key, value]) => tableMeta.columns.has(key) && value !== undefined);
    
    const columns = entries.map(([key]) => `"${key}"`).join(', ');
    const placeholders = entries.map(([key], idx) => {
        const type = tableMeta.columnTypes.get(key);
        if (type === 'json' || type === 'jsonb') {
            return `$${idx + 1}::jsonb`;
        }
        if (type && (type.includes('timestamp') || type.includes('date'))) {
            return `$${idx + 1}::timestamp`;
        }
        return `$${idx + 1}`;
    }).join(', ');
    
    const values = entries.map(([key, value]) => {
        const type = tableMeta.columnTypes.get(key);
        if ((type === 'json' || type === 'jsonb') && typeof value === 'object') {
            return JSON.stringify(value);
        }
        return value;
    });

    const sql = `INSERT INTO "${tableMeta.tableName}" (${columns}) VALUES (${placeholders}) RETURNING *`;
    console.log("Executing SQL:", sql);
    // console.log("Values:", values);
    
    return prisma.$queryRawUnsafe(sql, ...values);
}

async function main() {
    try {
        // Find a landlord to associate with
        const users = await prisma.$queryRawUnsafe(`SELECT * FROM "User" WHERE "userType" = 'LANDLORD' LIMIT 1`);
        let landlordId = 'test_landlord_id';
        if (users && users.length > 0) {
            landlordId = users[0].id;
            console.log("Using Landlord ID:", landlordId);
        } else {
            console.log("No landlord found, using dummy ID");
        }

        const propertyData = {
            landlordId: landlordId,
            title: 'Test Property Standalone',
            description: 'Testing JSON serialization',
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
            amenities: ['Wifi', 'Parking'],
            petFriendly: true
        };

        const result = await createProperty(propertyData);
        console.log("Property created successfully:", result[0].id);
        
        // Clean up
        await prisma.$executeRawUnsafe(`DELETE FROM "Property" WHERE id = $1`, result[0].id);
        console.log("Cleaned up test property");
        
    } catch (e) {
        console.error("Error:", e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
