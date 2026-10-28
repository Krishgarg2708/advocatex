/**
 * Domain model for AdvocateX.
 * These types mirror what a future REST/GraphQL backend would return,
 * so the mock store can be swapped for API calls without touching pages.
 */

export type Role = "admin" | "brand" | "shop" | "mechanic" | "customer";
export type AdvocateType = "shop" | "mechanic";
export type VerificationStatus = "verified" | "pending" | "rejected";
export type AdvocateTier = "Bronze" | "Silver" | "Gold" | "Platinum";
export type LoyaltyTier = "Member" | "Silver" | "Gold" | "Platinum";

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  phone: string;
  /** Linked entity: brand id, shop id, mechanic id or customer id */
  entityId?: string;
  avatarHue: number;
}

export interface Brand {
  id: string;
  name: string;
  category: string;
  hue: number;
}

export interface Shop {
  id: string;
  name: string;
  owner: string;
  city: string;
  state: string;
  category: string;
  status: VerificationStatus;
  joinedAt: string;
  referralCode: string;
  campaignIds: string[];
  phone: string;
  gstin: string;
  hue: number;
}

export interface Mechanic {
  id: string;
  name: string;
  workshop: string;
  specialization: string;
  experienceYears: number;
  city: string;
  state: string;
  status: VerificationStatus;
  joinedAt: string;
  referralCode: string;
  campaignIds: string[];
  phone: string;
  hue: number;
}

export type ProductStatus = "active" | "draft" | "discontinued";
export interface Product {
  id: string;
  name: string;
  brandId: string;
  category: ProductCategory;
  description: string;
  price: number;
  referralReward: number;
  loyaltyPoints: number;
  loyaltyOffer: string;
  status: ProductStatus;
  sku: string;
  createdAt: string;
}
export type ProductCategory = "Engine Oil" | "Tyres" | "Batteries" | "Brakes" | "Filters" | "Lighting" | "Coolants" | "Accessories";

export type CampaignStatus = "active" | "draft" | "scheduled" | "paused" | "completed";
export interface Campaign {
  id: string;
  name: string;
  brandId: string;
  description: string;
  productIds: string[];
  startDate: string;
  endDate: string;
  locations: string[];
  advocateTypes: AdvocateType[];
  rewardPerConversion: number;
  customerBonusPoints: number;
  budget: number;
  maxRewardPerAdvocate: number;
  eligibility: string;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * A referral record starts life as a click on an advocate's link/QR.
 * Only some progress to a qualified lead, a claimed purchase (pending verification),
 * and finally a verified conversion. Clicks are never counted as sales.
 */
export type ReferralStatus = "clicked" | "lead" | "pending" | "verified" | "rejected";
export interface Referral {
  id: string;
  advocateId: string;
  advocateType: AdvocateType;
  code: string;
  campaignId: string;
  productId: string;
  customerRef: string; // demo-safe masked identifier
  customerId?: string;
  createdAt: string; // click time
  leadAt?: string;
  purchaseAt?: string;
  verifiedAt?: string;
  rejectedAt?: string;
  rejectReason?: string;
  status: ReferralStatus;
  purchaseValue: number; // 0 until a purchase is claimed
  reward: number; // advocate reward for this referral (0 unless purchase)
  txnRef?: string;
  channel: "QR" | "Link" | "WhatsApp" | "In-store";
}

export type RewardTxnType = "commission" | "bonus" | "payout" | "reversal";
export type RewardTxnStatus = "pending" | "approved" | "requested" | "paid" | "reversed";
export interface RewardTxn {
  id: string;
  advocateId: string;
  advocateType: AdvocateType;
  type: RewardTxnType;
  status: RewardTxnStatus;
  amount: number;
  referralId?: string;
  campaignId?: string;
  date: string;
  note: string;
}

export interface Customer {
  id: string;
  name: string;
  city: string;
  joinedAt: string;
  email: string;
  hue: number;
}

export interface Purchase {
  id: string;
  customerId: string;
  productId: string;
  advocateId?: string;
  date: string;
  amount: number;
  points: number;
  referralId?: string;
}

export type LoyaltyTxnType = "earn" | "bonus" | "redeem" | "expire";
export interface LoyaltyTxn {
  id: string;
  customerId: string;
  date: string;
  points: number; // positive earn, negative redeem
  type: LoyaltyTxnType;
  description: string;
}

export interface RewardItem {
  id: string;
  title: string;
  description: string;
  points: number;
  category: "Service" | "Voucher" | "Accessory" | "Experience";
  stock: number;
  minTier?: LoyaltyTier;
}

export interface Redemption {
  id: string;
  customerId: string;
  rewardId: string;
  date: string;
  points: number;
  code: string;
  status: "issued" | "used";
}

export type FlagSeverity = "low" | "medium" | "high" | "critical";
export type FlagStatus = "new" | "under_review" | "resolved" | "dismissed";
export type FlagType = "duplicate_pattern" | "high_frequency" | "repeated_txn" | "conversion_spike" | "reward_abuse";
export interface FraudFlag {
  id: string;
  type: FlagType;
  severity: FlagSeverity;
  advocateId: string;
  advocateType: AdvocateType;
  reason: string;
  detectedAt: string;
  evidence: string[];
  referralIds: string[];
  status: FlagStatus;
  reviewNote?: string;
}

export type NotificationType = "campaign" | "conversion" | "reward" | "loyalty" | "approval" | "fraud" | "system";
export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  at: string;
  read: boolean;
  roles: Role[];
  link?: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  role: Role | "system";
  action: string;
  category: "auth" | "campaign" | "referral" | "reward" | "approval" | "fraud" | "product" | "settings" | "loyalty";
  target: string;
  details?: string;
}

export interface NotificationPrefs {
  email: boolean;
  push: boolean;
  conversions: boolean;
  rewards: boolean;
  campaigns: boolean;
  fraud: boolean;
  weeklyDigest: boolean;
}

export type DatePreset = "7d" | "30d" | "90d" | "custom";
export interface DateRange {
  preset: DatePreset;
  from: string; // ISO date
  to: string; // ISO date
}
