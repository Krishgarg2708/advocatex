/** Static reference data: brands, advocates, products, customers, rewards catalogue, demo users. All names are fictional. */
import type { Brand, DemoUser, Product, RewardItem } from "@/types";

export const BRANDS: Brand[] = [
  { id: "b1", name: "Veltrix Lubricants", category: "Lubricants & Fluids", hue: 243 },
  { id: "b2", name: "TorqueGrip Tyres", category: "Tyres", hue: 199 },
  { id: "b3", name: "VoltEdge Power", category: "Batteries & Lighting", hue: 38 },
  { id: "b4", name: "StopRight Components", category: "Brakes & Filters", hue: 352 },
];

export const CITIES: { city: string; state: string }[] = [
  { city: "Pune", state: "Maharashtra" },
  { city: "Mumbai", state: "Maharashtra" },
  { city: "Nashik", state: "Maharashtra" },
  { city: "Bengaluru", state: "Karnataka" },
  { city: "Mysuru", state: "Karnataka" },
  { city: "Chennai", state: "Tamil Nadu" },
  { city: "Coimbatore", state: "Tamil Nadu" },
  { city: "Ahmedabad", state: "Gujarat" },
  { city: "Surat", state: "Gujarat" },
  { city: "Jaipur", state: "Rajasthan" },
  { city: "New Delhi", state: "Delhi" },
  { city: "Lucknow", state: "Uttar Pradesh" },
  { city: "Hyderabad", state: "Telangana" },
  { city: "Indore", state: "Madhya Pradesh" },
];
export const STATES = Array.from(new Set(CITIES.map((c) => c.state)));

type RawShop = [name: string, owner: string, city: string, category: string, status: "verified" | "pending" | "rejected", activity: number, quality: number];
export const RAW_SHOPS: RawShop[] = [
  ["Sai Motors & Spares", "Vikram Patil", "Pune", "Multi-brand spares", "verified", 1.0, 1.05],
  ["Shree Ganesh Auto Parts", "Mahesh Kulkarni", "Mumbai", "Multi-brand spares", "verified", 0.9, 0.95],
  ["Krishna Tyre House", "Ramesh Iyer", "Chennai", "Tyres & alignment", "verified", 0.85, 1.1],
  ["Balaji Battery Point", "Suresh Reddy", "Hyderabad", "Batteries & electricals", "verified", 0.8, 1.0],
  ["Patel Lubes Centre", "Hitesh Patel", "Ahmedabad", "Lubricants", "verified", 1.1, 0.9],
  ["Royal Auto Accessories", "Imran Qureshi", "Lucknow", "Accessories", "verified", 0.6, 0.85],
  ["Metro Spares Hub", "Anil Sharma", "New Delhi", "Multi-brand spares", "verified", 0.95, 1.0],
  ["Kaveri Motor Stores", "Prakash Gowda", "Bengaluru", "Multi-brand spares", "verified", 0.9, 1.15],
  ["Pink City Auto Mart", "Deepak Agarwal", "Jaipur", "Multi-brand spares", "verified", 0.7, 0.95],
  ["Narmada Tyres & Wheels", "Sanjay Joshi", "Indore", "Tyres & alignment", "verified", 0.65, 1.0],
  ["Diamond Auto Centre", "Nilesh Shah", "Surat", "Lubricants", "verified", 1.45, 0.55],
  ["Coimbatore Brake House", "Senthil Kumar", "Coimbatore", "Brakes & suspension", "verified", 0.55, 1.05],
  ["Godavari Auto Spares", "Rahul Deshmukh", "Nashik", "Multi-brand spares", "verified", 0.6, 0.9],
  ["Mysore Motor Works Store", "Kiran Rao", "Mysuru", "Batteries & electricals", "verified", 0.5, 1.0],
  ["Speedway Auto Parts", "Farhan Khan", "Mumbai", "Multi-brand spares", "pending", 0, 1],
  ["Lakshmi Auto Store", "Venkatesh Naidu", "Hyderabad", "Lubricants", "pending", 0, 1],
  ["Gomti Battery World", "Arvind Mishra", "Lucknow", "Batteries & electricals", "pending", 0, 1],
  ["Quick Fix Spares", "Rohit Bansal", "Jaipur", "Accessories", "rejected", 0, 1],
];

type RawMechanic = [name: string, workshop: string, specialization: string, exp: number, city: string, status: "verified" | "pending" | "rejected", activity: number, quality: number];
export const RAW_MECHANICS: RawMechanic[] = [
  ["Arjun Mehta", "Mehta Auto Works", "Engine & diagnostics", 11, "Pune", "verified", 1.15, 1.18],
  ["Ravi Shankar", "RS Car Care", "Periodic servicing", 8, "Bengaluru", "verified", 1.1, 1.25],
  ["Mohammed Salim", "Salim Motor Garage", "Two-wheeler specialist", 14, "Hyderabad", "verified", 1.0, 1.05],
  ["Gurpreet Singh", "Singh Auto Clinic", "Engine & diagnostics", 17, "New Delhi", "verified", 0.95, 1.1],
  ["Rakesh Yadav", "Yadav Service Point", "Periodic servicing", 6, "Lucknow", "verified", 1.7, 0.5],
  ["Murugan P.", "Murugan Wheels", "Tyres & alignment", 12, "Chennai", "verified", 0.85, 1.15],
  ["Sunil Jadhav", "Jadhav Garage", "Brakes & suspension", 9, "Nashik", "verified", 0.75, 1.0],
  ["Karthik Natarajan", "KN Auto Electricals", "Auto electricals", 7, "Coimbatore", "verified", 0.8, 1.1],
  ["Bhavesh Desai", "Desai Motors", "Periodic servicing", 10, "Surat", "verified", 0.9, 0.95],
  ["Ajay Chauhan", "Chauhan Auto Care", "Two-wheeler specialist", 5, "Jaipur", "verified", 0.7, 1.0],
  ["Naveen Kumar", "NK Car Point", "Auto electricals", 8, "Mysuru", "verified", 0.65, 1.05],
  ["Pradeep Verma", "Verma Car Clinic", "Engine & diagnostics", 15, "Indore", "verified", 0.75, 1.0],
  ["Sachin Pawar", "Pawar Auto Garage", "Tyres & alignment", 6, "Mumbai", "verified", 1.35, 0.6],
  ["Abdul Rehman", "Rehman Motors", "Brakes & suspension", 13, "Ahmedabad", "verified", 0.7, 1.1],
  ["Dinesh Gupta", "Gupta Two Wheelers", "Two-wheeler specialist", 9, "New Delhi", "verified", 0.6, 0.95],
  ["Santosh Patil", "Patil Auto Service", "Periodic servicing", 4, "Pune", "verified", 0.5, 0.9],
  ["Vijay Raghavan", "VR Auto Hub", "Engine & diagnostics", 10, "Chennai", "verified", 0.55, 1.0],
  ["Harish Bhat", "Bhat Car Care", "Auto electricals", 7, "Bengaluru", "verified", 0.15, 1.0],
  ["Mukesh Rathore", "Rathore Motor Works", "Periodic servicing", 3, "Jaipur", "verified", 0.12, 1.0],
  ["Imtiaz Ali", "Ali Auto Garage", "Two-wheeler specialist", 8, "Lucknow", "pending", 0, 1],
  ["Ganesh Shinde", "Shinde Car Works", "Brakes & suspension", 5, "Nashik", "pending", 0, 1],
  ["Lokesh Reddy", "LR Motors", "Auto electricals", 6, "Hyderabad", "pending", 0, 1],
  ["Tushar More", "More Auto Clinic", "Engine & diagnostics", 2, "Mumbai", "pending", 0, 1],
  ["Rajeev Saxena", "Saxena Garage", "Periodic servicing", 4, "Indore", "rejected", 0, 1],
];

export const PRODUCTS_SEED: Omit<Product, "createdAt">[] = [
  { id: "p1", name: "Veltrix Synth 5W-30 Full Synthetic (3.5L)", brandId: "b1", category: "Engine Oil", price: 3450, referralReward: 180, loyaltyPoints: 170, loyaltyOffer: "Free oil-filter check on next service", status: "active", sku: "VLX-SYN-530", description: "Full-synthetic engine oil for modern petrol and diesel cars. Extended drain intervals up to 15,000 km with low-friction additives." },
  { id: "p2", name: "Veltrix Pro 20W-50 Mineral (3L)", brandId: "b1", category: "Engine Oil", price: 1280, referralReward: 70, loyaltyPoints: 60, loyaltyOffer: "Double points on second purchase", status: "active", sku: "VLX-PRO-2050", description: "Dependable mineral oil for older engines and high-mileage vehicles operating in hot conditions." },
  { id: "p3", name: "Veltrix CoolGuard Coolant (1L)", brandId: "b1", category: "Coolants", price: 420, referralReward: 30, loyaltyPoints: 20, loyaltyOffer: "Bonus 20 points with any engine oil", status: "active", sku: "VLX-CG-1L", description: "Ready-to-use long-life coolant that protects against overheating and radiator corrosion." },
  { id: "p4", name: "Veltrix Diesel Max 15W-40 (5L)", brandId: "b1", category: "Engine Oil", price: 2150, referralReward: 110, loyaltyPoints: 105, loyaltyOffer: "Free top-up pack after 3 purchases", status: "active", sku: "VLX-DM-1540", description: "Heavy-duty diesel engine oil for SUVs, pickups and light commercial vehicles." },
  { id: "p5", name: "Veltrix Ride 10W-30 4T (1L)", brandId: "b1", category: "Engine Oil", price: 480, referralReward: 35, loyaltyPoints: 25, loyaltyOffer: "Bonus points on every 3rd fill", status: "active", sku: "VLX-RD-1030", description: "Four-stroke motorcycle oil for smoother gear shifts and cleaner engines." },
  { id: "p6", name: "TorqueGrip AllTerrain 205/65 R16", brandId: "b2", category: "Tyres", price: 7850, referralReward: 380, loyaltyPoints: 390, loyaltyOffer: "Free wheel alignment with a set of 4", status: "active", sku: "TG-AT-20565", description: "All-terrain SUV tyre with reinforced sidewalls and a quiet on-road tread pattern." },
  { id: "p7", name: "TorqueGrip CityRide 185/65 R15", brandId: "b2", category: "Tyres", price: 5640, referralReward: 280, loyaltyPoints: 280, loyaltyOffer: "Free nitrogen fill for 1 year", status: "active", sku: "TG-CR-18565", description: "Comfort-focused hatchback and sedan tyre with strong wet-road braking." },
  { id: "p8", name: "TorqueGrip Moto Sport 140/70 R17", brandId: "b2", category: "Tyres", price: 3200, referralReward: 160, loyaltyPoints: 160, loyaltyOffer: "Free puncture kit", status: "active", sku: "TG-MS-14070", description: "Sport motorcycle rear tyre with dual-compound grip for city and highway riding." },
  { id: "p9", name: "TorqueGrip EcoTread 175/70 R14", brandId: "b2", category: "Tyres", price: 4450, referralReward: 220, loyaltyPoints: 220, loyaltyOffer: "Extra 100 points on a set of 4", status: "active", sku: "TG-ET-17570", description: "Low rolling-resistance tyre designed to improve fuel efficiency for compact cars." },
  { id: "p10", name: "VoltEdge Prime 65Ah Car Battery", brandId: "b3", category: "Batteries", price: 6900, referralReward: 340, loyaltyPoints: 345, loyaltyOffer: "Free battery health check every 6 months", status: "active", sku: "VE-PR-65", description: "Maintenance-free car battery with high cranking power and a 48-month warranty." },
  { id: "p11", name: "VoltEdge Ride 9Ah Bike Battery", brandId: "b3", category: "Batteries", price: 2150, referralReward: 110, loyaltyPoints: 105, loyaltyOffer: "Free terminal cleaning kit", status: "active", sku: "VE-RD-9", description: "Sealed two-wheeler battery built for reliable cold starts and long life." },
  { id: "p12", name: "VoltEdge HyperBeam H4 LED (pair)", brandId: "b3", category: "Lighting", price: 1850, referralReward: 90, loyaltyPoints: 90, loyaltyOffer: "Free fitting at partner workshops", status: "active", sku: "VE-HB-H4", description: "Road-legal LED headlamp upgrade with sharper beam cut-off and low power draw." },
  { id: "p13", name: "VoltEdge Tubular 150Ah Inverter Battery", brandId: "b3", category: "Batteries", price: 13500, referralReward: 600, loyaltyPoints: 675, loyaltyOffer: "Free installation within city limits", status: "active", sku: "VE-TB-150", description: "Tall tubular battery for home inverters with long backup and low maintenance." },
  { id: "p14", name: "StopRight Ceramic Brake Pads (front)", brandId: "b4", category: "Brakes", price: 2450, referralReward: 120, loyaltyPoints: 120, loyaltyOffer: "Free brake inspection on next visit", status: "active", sku: "SR-CP-F", description: "Low-dust ceramic brake pads with quiet, fade-resistant stopping power." },
  { id: "p15", name: "StopRight Vented Disc Rotor (pair)", brandId: "b4", category: "Brakes", price: 4800, referralReward: 230, loyaltyPoints: 240, loyaltyOffer: "Bonus 150 points with pads", status: "active", sku: "SR-DR-V2", description: "Precision-machined vented rotors for better heat dissipation under heavy braking." },
  { id: "p16", name: "StopRight Air Filter Pro", brandId: "b4", category: "Filters", price: 650, referralReward: 40, loyaltyPoints: 30, loyaltyOffer: "Double points during service month", status: "active", sku: "SR-AF-PRO", description: "High-capacity engine air filter that traps fine dust in city conditions." },
  { id: "p17", name: "StopRight Cabin Filter Carbon", brandId: "b4", category: "Filters", price: 890, referralReward: 45, loyaltyPoints: 45, loyaltyOffer: "Free AC vent sanitisation", status: "active", sku: "SR-CF-C", description: "Activated-carbon cabin filter that reduces odours and pollen inside the car." },
  { id: "p18", name: "StopRight Oil Filter", brandId: "b4", category: "Filters", price: 380, referralReward: 25, loyaltyPoints: 20, loyaltyOffer: "Bonus points with Veltrix oil", status: "active", sku: "SR-OF-STD", description: "Spin-on oil filter with anti-drain-back valve for cleaner engine starts." },
  { id: "p19", name: "Veltrix Engine Flush (300ml)", brandId: "b1", category: "Accessories", price: 390, referralReward: 25, loyaltyPoints: 20, loyaltyOffer: "Free with Synth 5W-30 during campaigns", status: "active", sku: "VLX-EF-300", description: "Pre-oil-change engine flush that loosens sludge and deposits." },
  { id: "p20", name: "TorqueGrip Digital Tyre Inflator", brandId: "b2", category: "Accessories", price: 2999, referralReward: 140, loyaltyPoints: 150, loyaltyOffer: "Launch offer: 200 bonus points", status: "draft", sku: "TG-DTI-01", description: "Portable 12V digital inflator with auto shut-off and preset pressure memory." },
  { id: "p21", name: "StopRight DOT 4 Brake Fluid (500ml)", brandId: "b4", category: "Brakes", price: 340, referralReward: 20, loyaltyPoints: 15, loyaltyOffer: "No active offer", status: "discontinued", sku: "SR-BF-D4", description: "High-boiling-point brake fluid. Replaced by the DOT 4 Plus formulation." },
];

export const CUSTOMER_NAMES = [
  "Priya Sharma", "Aditya Rao", "Neha Kapoor", "Rohan Malhotra", "Sneha Iyer", "Varun Nair", "Pooja Desai", "Karan Bhatia",
  "Ananya Gupta", "Siddharth Jain", "Meera Pillai", "Nikhil Arora", "Kavya Menon", "Aman Saxena", "Ishita Banerjee", "Rahul Chawla",
  "Divya Krishnan", "Manish Tiwari", "Shreya Ghosh", "Akash Pandey", "Tanvi Joshi", "Harsh Vardhan", "Riya Sethi", "Yash Thakur",
  "Nisha Rawat", "Gaurav Sinha", "Aishwarya Hegde", "Kunal Mehra", "Simran Kaur", "Abhishek Dubey", "Lavanya Subramanian", "Mohit Agarwal",
  "Pallavi Kulkarni", "Vivek Chopra", "Swati Mishra", "Arnav Bose", "Deepika Rao", "Sameer Kohli", "Bhavna Shetty", "Tarun Goyal",
  "Asha Patil", "Naveen Bhatt", "Jyoti Yadav", "Prateek Singh", "Ritika Mathur", "Omkar Gaikwad", "Sakshi Verma", "Dev Malik",
  "Ira Chatterjee", "Kabir Anand", "Uma Rajan", "Pranav Kulkarni", "Zoya Siddiqui", "Hemant Joshi", "Tara Fernandes", "Rajat Kapoor",
];

export const REWARD_CATALOG: RewardItem[] = [
  { id: "rw1", title: "Free Car Wash & Vacuum", description: "One complete exterior wash and interior vacuum at any participating workshop.", points: 300, category: "Service", stock: 120 },
  { id: "rw2", title: "₹250 Fuel Voucher", description: "Digital fuel voucher redeemable at partner fuel stations (simulated).", points: 600, category: "Voucher", stock: 80 },
  { id: "rw3", title: "Wheel Alignment & Balancing", description: "Four-wheel computerised alignment and balancing at partner tyre centres.", points: 900, category: "Service", stock: 60 },
  { id: "rw4", title: "Premium Microfibre Care Kit", description: "Set of microfibre cloths, dashboard polish and glass cleaner.", points: 1200, category: "Accessory", stock: 40 },
  { id: "rw5", title: "AC Service & Sanitisation", description: "Car AC performance check, gas top-up inspection and vent sanitisation.", points: 1800, category: "Service", stock: 35, minTier: "Silver" },
  { id: "rw6", title: "₹1,000 Service Credit", description: "Credit applied to your next periodic service at a partner workshop.", points: 2500, category: "Voucher", stock: 25, minTier: "Gold" },
  { id: "rw7", title: "Digital Tyre Pressure Gauge", description: "Pocket-size digital gauge with backlit display.", points: 1500, category: "Accessory", stock: 0 },
  { id: "rw8", title: "Track Day Experience Pass", description: "Half-day guided driving experience at a partner track (demo reward).", points: 6000, category: "Experience", stock: 5, minTier: "Platinum" },
];

export const DEMO_USERS: Record<string, DemoUser> = {
  admin: { id: "u-admin", name: "Neha Verma", email: "admin@advocatex.demo", role: "admin", title: "Platform Super Admin", phone: "+91 98200 10001", avatarHue: 243 },
  brand: { id: "u-brand", name: "Rohit Kapoor", email: "brand@advocatex.demo", role: "brand", title: "Brand Growth Manager, Veltrix Lubricants", phone: "+91 98200 10002", entityId: "b1", avatarHue: 221 },
  shop: { id: "u-shop", name: "Vikram Patil", email: "shop@advocatex.demo", role: "shop", title: "Owner, Sai Motors & Spares", phone: "+91 98200 10003", entityId: "s1", avatarHue: 173 },
  mechanic: { id: "u-mech", name: "Arjun Mehta", email: "mechanic@advocatex.demo", role: "mechanic", title: "Lead Technician, Mehta Auto Works", phone: "+91 98200 10004", entityId: "m1", avatarHue: 28 },
  customer: { id: "u-cust", name: "Priya Sharma", email: "customer@advocatex.demo", role: "customer", title: "Loyalty Member", phone: "+91 98200 10005", entityId: "cu1", avatarHue: 330 },
};
