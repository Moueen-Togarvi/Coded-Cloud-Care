const pricingData = [
    {
        id: "hospital-pms",
        name: "Hospital PMS",
        description: "Complete Patient Management System for modern hospitals.",
        highlight: true,
        image: "../images/d2.png",
        features: [
            "Electronic Health Records (EHR)",
            "Appointment Scheduling",
            "Billing & Insurance",
            "Inpatient Management",
            "Staff Scheduling",
            "Advanced Analytics"
        ],
        pricing: {
            free: {
                price: "0",
                period: "3-day trial",
                label: "Free Trial"
            },
            monthly: {
                price: "20,000",
                period: "month",
                label: "Monthly Plan"
            },
            yearly: {
                price: "210,000",
                period: "year",
                label: "Annual Plan"
            },
            outright: {
                price: "Contact Us",
                period: "once",
                label: "Lifetime Access"
            }
        }
    },
    {
        id: "pharmacy-pos",
        name: "Pharmacy POS",
        description: "Efficient Point of Sale for pharmacies.",
        highlight: false,
        image: "../images/d1.png",
        features: [
            "Quick Checkout",
            "Inventory Tracking",
            "Supplier Management",
            "Expiry Alerts",
            "Sales Reporting",
            "Barcode Scanning"
        ],
        pricing: {
            free: {
                price: "0",
                period: "3-day trial",
                label: "Free Trial"
            },
            monthly: {
                price: "20,000",
                period: "month",
                label: "Monthly Plan"
            },
            yearly: {
                price: "210,000",
                period: "year",
                label: "Annual Plan"
            },
            outright: {
                price: "Contact Us",
                period: "once",
                label: "Lifetime Access"
            }
        }
    },
    {
        id: "lab-reporting",
        name: "Lab Reporting",
        description: "Streamlined pathology and diagnostic reporting.",
        highlight: false,
        image: "../images/dash.png",
        features: [
            "Test Management",
            "Sample Tracking",
            "Automated Report Generation",
            "Patient Portal Access",
            "Doctor Referrals",
            "Result SMS/Email"
        ],
        pricing: {
            free: {
                price: "0",
                period: "3-day trial",
                label: "Free Trial"
            },
            monthly: {
                price: "20,000",
                period: "month",
                label: "Monthly Plan"
            },
            yearly: {
                price: "210,000",
                period: "year",
                label: "Annual Plan"
            },
            outright: {
                price: "Contact Us",
                period: "once",
                label: "Lifetime Access"
            }
        }
    },
    {
        id: "quick-invoice",
        name: "Quick Invoice",
        description: "Fast and professional invoicing for freelancers and small businesses.",
        highlight: false,
        image: "../images/ai_v9_corporate.png",
        features: [
            "Custom Invoice Templates",
            "Client Database",
            "Payment Reminders",
            "Expense Tracking",
            "Tax Calculations",
            "Multi-Currency Support"
        ],
        pricing: {
            free: {
                price: "0",
                period: "3-day trial",
                label: "Free Trial"
            },
            monthly: {
                price: "20,000",
                period: "month",
                label: "Monthly Plan"
            },
            yearly: {
                price: "210,000",
                period: "year",
                label: "Annual Plan"
            },
            outright: {
                price: "Contact Us",
                period: "once",
                label: "Lifetime Access"
            }
        }
    },
    {
        id: "private-clinic-lite",
        name: "Private Clinic Lite",
        description: "Essential tools for private practitioners.",
        highlight: false,
        image: "../images/ai_v7_pastel.png",
        features: [
            "Basic Patient Records",
            "Appointment Calendar",
            "Prescription Writer",
            "Billing Summary",
            "Secure Cloud Storage",
            "Mobile Access"
        ],
        pricing: {
            free: {
                price: "0",
                period: "3-day trial",
                label: "Free Trial"
            },
            monthly: {
                price: "20,000",
                period: "month",
                label: "Monthly Plan"
            },
            yearly: {
                price: "210,000",
                period: "year",
                label: "Annual Plan"
            },
            outright: {
                price: "Contact Us",
                period: "once",
                label: "Lifetime Access"
            }
        }
    }
];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = pricingData;
}
