"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FINIO_CATEGORY_SET = exports.FINIO_CATEGORIES = void 0;
exports.isFinioCategory = isFinioCategory;
exports.normalizeToFinioCategory = normalizeToFinioCategory;
exports.effectiveCategory = effectiveCategory;
/** Canonical Finio spending categories */
exports.FINIO_CATEGORIES = [
    "Food & Drink",
    "Groceries",
    "Transportation",
    "Entertainment",
    "Shopping",
    "Bills & Utilities",
    "Healthcare",
    "Travel",
    "Rent & Housing",
    "Income",
    "Transfers",
    "Education",
    "Personal Care",
    "Fees & Charges",
    "Other",
];
exports.FINIO_CATEGORY_SET = new Set(exports.FINIO_CATEGORIES);
function isFinioCategory(value) {
    return exports.FINIO_CATEGORY_SET.has(value);
}
/** Map Plaid primary/detailed categories and common variants to Finio categories */
const PLAID_CATEGORY_MAP = {
    "food and drink": "Food & Drink",
    restaurants: "Food & Drink",
    "coffee shop": "Food & Drink",
    "fast food": "Food & Drink",
    bar: "Food & Drink",
    groceries: "Groceries",
    "supermarkets and groceries": "Groceries",
    transportation: "Transportation",
    travel: "Travel",
    taxi: "Transportation",
    rideshare: "Transportation",
    gas: "Transportation",
    "gas stations": "Transportation",
    parking: "Transportation",
    transportation: "Transportation",
    entertainment: "Entertainment",
    recreation: "Entertainment",
    "music and audio": "Entertainment",
    "sporting goods": "Entertainment",
    shops: "Shopping",
    shopping: "Shopping",
    "general merchandise": "Shopping",
    "department stores": "Shopping",
    "clothing and accessories": "Shopping",
    "bills and utilities": "Bills & Utilities",
    utilities: "Bills & Utilities",
    telephone: "Bills & Utilities",
    internet: "Bills & Utilities",
    subscription: "Bills & Utilities",
    healthcare: "Healthcare",
    pharmacy: "Healthcare",
    medical: "Healthcare",
    "personal care": "Personal Care",
    rent: "Rent & Housing",
    "rent and utilities": "Rent & Housing",
    mortgage: "Rent & Housing",
    housing: "Rent & Housing",
    payment: "Transfers",
    transfer: "Transfers",
    "bank fees": "Fees & Charges",
    "service charge": "Fees & Charges",
    interest: "Fees & Charges",
    "interest income": "Income",
    payroll: "Income",
    deposit: "Income",
    income: "Income",
    education: "Education",
    "student loan": "Education",
};
const KEYWORD_RULES = [
    { keywords: ["starbucks", "mcdonald", "restaurant", "cafe", "doordash", "uber eats", "grubhub", "chipotle", "pizza"], category: "Food & Drink" },
    { keywords: ["whole foods", "trader joe", "kroger", "safeway", "grocery", "market basket"], category: "Groceries" },
    { keywords: ["shell", "chevron", "exxon", "bp gas", "metro", "transit", "parking", "uber", "lyft"], category: "Transportation" },
    { keywords: ["netflix", "spotify", "hulu", "disney+", "steam", "cinema", "theater", "concert"], category: "Entertainment" },
    { keywords: ["amazon", "walmart", "target", "costco", "best buy", "apple store"], category: "Shopping" },
    { keywords: ["electric", "water bill", "comcast", "verizon", "at&t", "internet"], category: "Bills & Utilities" },
    { keywords: ["cvs", "walgreens", "pharmacy", "doctor", "hospital", "dental", "clinic"], category: "Healthcare" },
    { keywords: ["airline", "hotel", "airbnb", "expedia", "delta", "united", "marriott"], category: "Travel" },
    { keywords: ["rent", "mortgage", "landlord", "zillow"], category: "Rent & Housing" },
    { keywords: ["salary", "payroll", "direct dep", "paycheck"], category: "Income" },
    { keywords: ["transfer", "venmo", "zelle", "paypal transfer"], category: "Transfers" },
    { keywords: ["tuition", "coursera", "udemy", "college"], category: "Education" },
    { keywords: ["gym", "salon", "barber", "spa"], category: "Personal Care" },
    { keywords: ["atm fee", "overdraft", "service fee", "late fee"], category: "Fees & Charges" },
];
function normalizeKey(value) {
    return value.trim().toLowerCase();
}
function mapPlaidCategory(raw) {
    if (!raw)
        return undefined;
    const key = normalizeKey(raw);
    if (PLAID_CATEGORY_MAP[key])
        return PLAID_CATEGORY_MAP[key];
    for (const [pattern, category] of Object.entries(PLAID_CATEGORY_MAP)) {
        if (key.includes(pattern))
            return category;
    }
    return undefined;
}
function normalizeToFinioCategory(merchantName, name, plaidCategories) {
    for (const raw of plaidCategories ?? []) {
        const mapped = mapPlaidCategory(raw);
        if (mapped)
            return mapped;
    }
    const haystack = `${merchantName || ""} ${name || ""}`.toLowerCase();
    for (const rule of KEYWORD_RULES) {
        if (rule.keywords.some((keyword) => haystack.includes(keyword))) {
            return rule.category;
        }
    }
    if (plaidCategories?.length) {
        const first = plaidCategories[0];
        if (isFinioCategory(first))
            return first;
    }
    return "Other";
}
function effectiveCategory(txn) {
    if (txn.userCategory && isFinioCategory(txn.userCategory))
        return txn.userCategory;
    if (txn.suggestedCategory && isFinioCategory(txn.suggestedCategory))
        return txn.suggestedCategory;
    return normalizeToFinioCategory(null, null, txn.category);
}
