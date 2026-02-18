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
            monthly: {
                price: "10,000",
                period: "month",
                label: "Monthly Plan"
            },
            yearly: {
                price: "100,000",
                period: "year",
                label: "Annual Plan"
            },
            outright: {
                price: "300,000",
                period: "once",
                label: "Lifetime Access"
            }
        }
    },
    {
        id: "pharmacy-pos",
        name: "Pharamacy POS",
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
            monthly: {
                price: "4,000",
                period: "month",
                label: "Monthly Plan"
            },
            yearly: {
                price: "40,000",
                period: "year",
                label: "Annual Plan"
            },
            outright: {
                price: "120,000",
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
            monthly: {
                price: "5,000",
                period: "month",
                label: "Monthly Plan"
            },
            yearly: {
                price: "50,000",
                period: "year",
                label: "Annual Plan"
            },
            outright: {
                price: "150,000",
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
            monthly: {
                price: "1,500",
                period: "month",
                label: "Monthly Plan"
            },
            yearly: {
                price: "15,000",
                period: "year",
                label: "Annual Plan"
            },
            outright: {
                price: "40,000",
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
            monthly: {
                price: "2,500",
                period: "month",
                label: "Monthly Plan"
            },
            yearly: {
                price: "25,000",
                period: "year",
                label: "Annual Plan"
            },
            outright: {
                price: "70,000",
                period: "once",
                label: "Lifetime Access"
            }
        }
    }
];

if (typeof module !== 'undefined' && module.exports) {
    module.exports = pricingData;
}
