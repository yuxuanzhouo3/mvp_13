CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "phone" TEXT UNIQUE,
  "password" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "avatar" TEXT,
  "userType" TEXT NOT NULL DEFAULT 'TENANT',
  "isPremium" BOOLEAN NOT NULL DEFAULT FALSE,
  "premiumExpiry" TIMESTAMPTZ,
  "vipLevel" TEXT,
  "subscriptionEndTime" TIMESTAMPTZ,
  "lastUsageDate" TIMESTAMPTZ,
  "dailyQuota" INTEGER,
  "monthlyQuota" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX "User_email_idx" ON "User" ("email");
CREATE INDEX "User_userType_idx" ON "User" ("userType");

CREATE TABLE "AgentProfile" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "companyName" TEXT,
  "licenseNumber" TEXT,
  "verified" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "AgentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE TABLE "TenantProfile" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "monthlyIncome" DOUBLE PRECISION,
  "creditScore" INTEGER,
  "employmentStatus" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SEARCHING',
  "references" JSONB,
  "preferences" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "representedById" TEXT,
  CONSTRAINT "TenantProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
  CONSTRAINT "TenantProfile_representedById_fkey" FOREIGN KEY ("representedById") REFERENCES "User" ("id")
);

CREATE TABLE "LandlordProfile" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "representedById" TEXT,
  "companyName" TEXT,
  "licenseNumber" TEXT,
  "verified" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "LandlordProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
  CONSTRAINT "LandlordProfile_representedById_fkey" FOREIGN KEY ("representedById") REFERENCES "User" ("id")
);

CREATE TABLE "Property" (
  "id" TEXT PRIMARY KEY,
  "landlordId" TEXT NOT NULL,
  "agentId" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "address" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "zipCode" TEXT NOT NULL,
  "country" TEXT NOT NULL DEFAULT 'US',
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "price" DOUBLE PRECISION NOT NULL,
  "deposit" DOUBLE PRECISION NOT NULL,
  "bedrooms" INTEGER NOT NULL,
  "bathrooms" DOUBLE PRECISION NOT NULL,
  "sqft" INTEGER,
  "propertyType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "images" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "amenities" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "petFriendly" BOOLEAN NOT NULL DEFAULT FALSE,
  "availableFrom" TIMESTAMPTZ,
  "leaseDuration" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Property_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "User" ("id"),
  CONSTRAINT "Property_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User" ("id")
);

CREATE INDEX "Property_landlordId_idx" ON "Property" ("landlordId");
CREATE INDEX "Property_city_state_idx" ON "Property" ("city", "state");
CREATE INDEX "Property_status_idx" ON "Property" ("status");
CREATE INDEX "Property_lat_lng_idx" ON "Property" ("latitude", "longitude");

CREATE TABLE "TenantRequest" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "query" TEXT NOT NULL,
  "parsedCriteria" JSONB NOT NULL,
  "maxPrice" DOUBLE PRECISION,
  "minPrice" DOUBLE PRECISION,
  "maxDistance" DOUBLE PRECISION,
  "minBedrooms" INTEGER,
  "minBathrooms" DOUBLE PRECISION,
  "city" TEXT,
  "state" TEXT,
  "minLeaseDuration" INTEGER,
  "petFriendly" BOOLEAN,
  "amenities" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "searchResults" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "TenantRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User" ("id")
);

CREATE INDEX "TenantRequest_tenantId_idx" ON "TenantRequest" ("tenantId");
CREATE INDEX "TenantRequest_status_idx" ON "TenantRequest" ("status");

CREATE TABLE "LandlordRequest" (
  "id" TEXT PRIMARY KEY,
  "landlordId" TEXT NOT NULL,
  "propertyId" TEXT,
  "query" TEXT NOT NULL,
  "parsedCriteria" JSONB NOT NULL,
  "minRent" DOUBLE PRECISION,
  "maxRent" DOUBLE PRECISION,
  "minLeaseDuration" INTEGER,
  "requiredIncome" DOUBLE PRECISION,
  "minCreditScore" INTEGER,
  "city" TEXT,
  "state" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "searchResults" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "LandlordRequest_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "User" ("id"),
  CONSTRAINT "LandlordRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id")
);

CREATE INDEX "LandlordRequest_landlordId_idx" ON "LandlordRequest" ("landlordId");
CREATE INDEX "LandlordRequest_status_idx" ON "LandlordRequest" ("status");

CREATE TABLE "Application" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "monthlyIncome" DOUBLE PRECISION,
  "creditScore" INTEGER,
  "depositAmount" DOUBLE PRECISION NOT NULL,
  "message" TEXT,
  "appliedDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "reviewedDate" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Application_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User" ("id"),
  CONSTRAINT "Application_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id")
);

CREATE INDEX "Application_tenantId_idx" ON "Application" ("tenantId");
CREATE INDEX "Application_propertyId_idx" ON "Application" ("propertyId");
CREATE INDEX "Application_status_idx" ON "Application" ("status");

CREATE TABLE "Lease" (
  "id" TEXT PRIMARY KEY,
  "propertyId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "landlordId" TEXT NOT NULL,
  "startDate" TIMESTAMPTZ NOT NULL,
  "endDate" TIMESTAMPTZ NOT NULL,
  "monthlyRent" DOUBLE PRECISION NOT NULL,
  "depositAmount" DOUBLE PRECISION NOT NULL,
  "listingAgentId" TEXT,
  "tenantAgentId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "documentUrl" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Lease_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id"),
  CONSTRAINT "Lease_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User" ("id"),
  CONSTRAINT "Lease_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "User" ("id"),
  CONSTRAINT "Lease_listingAgentId_fkey" FOREIGN KEY ("listingAgentId") REFERENCES "User" ("id"),
  CONSTRAINT "Lease_tenantAgentId_fkey" FOREIGN KEY ("tenantAgentId") REFERENCES "User" ("id")
);

CREATE INDEX "Lease_tenantId_idx" ON "Lease" ("tenantId");
CREATE INDEX "Lease_landlordId_idx" ON "Lease" ("landlordId");
CREATE INDEX "Lease_propertyId_idx" ON "Lease" ("propertyId");

CREATE TABLE "Deposit" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'HELD_IN_ESCROW',
  "depositDate" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "expectedReturn" TIMESTAMPTZ,
  "actualReturn" TIMESTAMPTZ,
  "returnAmount" DOUBLE PRECISION,
  "deductions" JSONB,
  "disputeId" TEXT UNIQUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Deposit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id"),
  CONSTRAINT "Deposit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id")
);

CREATE INDEX "Deposit_userId_idx" ON "Deposit" ("userId");
CREATE INDEX "Deposit_propertyId_idx" ON "Deposit" ("propertyId");
CREATE INDEX "Deposit_status_idx" ON "Deposit" ("status");

CREATE TABLE "Dispute" (
  "id" TEXT PRIMARY KEY,
  "depositId" TEXT NOT NULL UNIQUE,
  "tenantId" TEXT NOT NULL,
  "landlordId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "tenantClaim" TEXT,
  "landlordClaim" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "resolution" TEXT,
  "resolvedBy" TEXT,
  "resolvedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Dispute_depositId_fkey" FOREIGN KEY ("depositId") REFERENCES "Deposit" ("id")
);

CREATE INDEX "Dispute_status_idx" ON "Dispute" ("status");

CREATE TABLE "Payment" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "description" TEXT,
  "propertyId" TEXT,
  "transactionId" TEXT UNIQUE,
  "paymentMethod" TEXT,
  "escrowStatus" TEXT DEFAULT 'HELD_IN_ESCROW',
  "distribution" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id")
);

CREATE INDEX "Payment_userId_idx" ON "Payment" ("userId");
CREATE INDEX "Payment_status_idx" ON "Payment" ("status");
CREATE INDEX "Payment_type_idx" ON "Payment" ("type");

CREATE TABLE "Message" (
  "id" TEXT PRIMARY KEY,
  "senderId" TEXT NOT NULL,
  "receiverId" TEXT NOT NULL,
  "propertyId" TEXT,
  "content" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id"),
  CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User" ("id"),
  CONSTRAINT "Message_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id")
);

CREATE INDEX "Message_sender_receiver_idx" ON "Message" ("senderId", "receiverId");
CREATE INDEX "Message_receiver_isRead_idx" ON "Message" ("receiverId", "isRead");

CREATE TABLE "SavedProperty" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "SavedProperty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id"),
  CONSTRAINT "SavedProperty_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id"),
  CONSTRAINT "SavedProperty_userId_propertyId_key" UNIQUE ("userId", "propertyId")
);

CREATE INDEX "SavedProperty_userId_idx" ON "SavedProperty" ("userId");

CREATE TABLE "Notification" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT FALSE,
  "link" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id")
);

CREATE INDEX "Notification_userId_isRead_idx" ON "Notification" ("userId", "isRead");

CREATE TABLE "Testimonial" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "rating" INTEGER NOT NULL DEFAULT 5,
  "avatar" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE "Event" (
  "id" TEXT PRIMARY KEY,
  "type" TEXT NOT NULL,
  "userId" TEXT,
  "region" TEXT NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "metadata" JSONB
);

CREATE INDEX "Event_type_idx" ON "Event" ("type");
CREATE INDEX "Event_userId_idx" ON "Event" ("userId");
CREATE INDEX "Event_timestamp_idx" ON "Event" ("timestamp");
CREATE INDEX "Event_region_idx" ON "Event" ("region");
