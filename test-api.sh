#!/bin/bash

# API Testing Script for Pharmacy and Accounting Modules
# This script tests the basic functionality of all endpoints

BASE_URL="http://localhost:5000"
TOKEN="" # Add your JWT token here after authentication

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "Pharmacy & Accounting API Testing Script"
echo "========================================="
echo ""

# Check if token is set
if [ -z "$TOKEN" ]; then
    echo -e "${YELLOW}WARNING: TOKEN is not set. Please authenticate first and set the TOKEN variable.${NC}"
    echo "You can get a token by logging in:"
    echo "curl -X POST $BASE_URL/api/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"your@email.com\",\"password\":\"yourpassword\"}'"
    echo ""
    exit 1
fi

# Test Health Check
echo -e "${YELLOW}Testing Health Check...${NC}"
curl -s $BASE_URL/health | jq .
echo ""

# ==================== PHARMACY TESTS ====================
echo -e "${GREEN}========== PHARMACY MODULE TESTS ==========${NC}"
echo ""

# Test 1: Create a Medicine
echo -e "${YELLOW}1. Creating a medicine...${NC}"
MEDICINE_RESPONSE=$(curl -s -X POST $BASE_URL/api/pharmacy/inventory \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Medicine Paracetamol 500mg",
    "description": "Pain reliever and fever reducer",
    "sku": "TEST-MED-001",
    "category": "painkillers",
    "manufacturer": "TestPharmaCorp",
    "batchNumber": "BATCH-TEST-001",
    "quantity": 100,
    "costPrice": 2.50,
    "sellingPrice": 5.00,
    "taxRate": 5,
    "expiryDate": "2027-12-31",
    "lowStockThreshold": 20,
    "prescriptionRequired": false
  }')

echo $MEDICINE_RESPONSE | jq .
MEDICINE_ID=$(echo $MEDICINE_RESPONSE | jq -r '.data._id')
echo -e "Medicine ID: ${GREEN}$MEDICINE_ID${NC}"
echo ""

# Test 2: Get All Medicines
echo -e "${YELLOW}2. Getting all medicines...${NC}"
curl -s -X GET $BASE_URL/api/pharmacy/inventory \
  -H "Authorization: Bearer $TOKEN" | jq '.count, .data[0].name'
echo ""

# Test 3: Create a Supplier
echo -e "${YELLOW}3. Creating a supplier...${NC}"
SUPPLIER_RESPONSE=$(curl -s -X POST $BASE_URL/api/pharmacy/suppliers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Supplier Ltd",
    "contactPerson": "John Supplier",
    "email": "supplier@test.com",
    "phone": "+1234567890",
    "address": "123 Supplier St",
    "paymentTerms": "Net 30 days"
  }')

echo $SUPPLIER_RESPONSE | jq .
SUPPLIER_ID=$(echo $SUPPLIER_RESPONSE | jq -r '.data._id')
echo -e "Supplier ID: ${GREEN}$SUPPLIER_ID${NC}"
echo ""

# Test 4: Record a Sale
echo -e "${YELLOW}4. Recording a sale...${NC}"
SALE_RESPONSE=$(curl -s -X POST $BASE_URL/api/pharmacy/sales \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"medicineId\": \"$MEDICINE_ID\",
    \"quantity\": 2,
    \"discount\": 0.50,
    \"paymentMethod\": \"cash\",
    \"customerName\": \"Test Customer\",
    \"soldBy\": \"Test Pharmacist\"
  }")

echo $SALE_RESPONSE | jq .
echo ""

# Test 5: Get Low Stock Items
echo -e "${YELLOW}5. Getting low stock items...${NC}"
curl -s -X GET $BASE_URL/api/pharmacy/stock/low \
  -H "Authorization: Bearer $TOKEN" | jq '.count'
echo ""

# Test 6: Get Inventory Value
echo -e "${YELLOW}6. Getting inventory value...${NC}"
curl -s -X GET $BASE_URL/api/pharmacy/analytics/inventory-value \
  -H "Authorization: Bearer $TOKEN" | jq '.summary'
echo ""

# ==================== ACCOUNTING TESTS ====================
echo -e "${GREEN}========== ACCOUNTING MODULE TESTS ==========${NC}"
echo ""

# Test 7: Create an Invoice
echo -e "${YELLOW}7. Creating an invoice...${NC}"
INVOICE_RESPONSE=$(curl -s -X POST $BASE_URL/api/accounting/invoices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Test Patient",
    "type": "patient",
    "items": [
      {
        "description": "Consultation Fee",
        "amount": 500,
        "quantity": 1
      },
      {
        "description": "Lab Tests",
        "amount": 1000,
        "quantity": 1
      }
    ],
    "taxAmount": 270,
    "discountAmount": 50,
    "dueDate": "2026-03-15",
    "paymentTerms": "Net 15 days"
  }')

echo $INVOICE_RESPONSE | jq .
INVOICE_ID=$(echo $INVOICE_RESPONSE | jq -r '.data._id')
echo -e "Invoice ID: ${GREEN}$INVOICE_ID${NC}"
echo ""

# Test 8: Add Payment to Invoice
echo -e "${YELLOW}8. Adding payment to invoice...${NC}"
curl -s -X POST $BASE_URL/api/accounting/invoices/$INVOICE_ID/payment \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1000,
    "paymentMethod": "card",
    "transactionId": "TEST-TXN-123",
    "receivedBy": "Test Receptionist"
  }' | jq .
echo ""

# Test 9: Create an Expense
echo -e "${YELLOW}9. Creating an expense...${NC}"
EXPENSE_RESPONSE=$(curl -s -X POST $BASE_URL/api/accounting/expenses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Office Rent - February 2026",
    "amount": 5000,
    "category": "rent",
    "paymentMethod": "bank_transfer",
    "recipient": "Landlord Inc"
  }')

echo $EXPENSE_RESPONSE | jq .
echo ""

# Test 10: Record Revenue
echo -e "${YELLOW}10. Recording revenue...${NC}"
curl -s -X POST $BASE_URL/api/accounting/revenue \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "source": "patient-consultation",
    "amount": 2500,
    "category": "consultations",
    "description": "Daily consultation revenue"
  }' | jq .
echo ""

# Test 11: Get Accounts Receivable
echo -e "${YELLOW}11. Getting accounts receivable...${NC}"
curl -s -X GET $BASE_URL/api/accounting/analytics/accounts-receivable \
  -H "Authorization: Bearer $TOKEN" | jq '.totalReceivable, .count'
echo ""

# Test 12: Get Balance Sheet
echo -e "${YELLOW}12. Getting balance sheet...${NC}"
curl -s -X GET $BASE_URL/api/accounting/reports/balance-sheet \
  -H "Authorization: Bearer $TOKEN" | jq '.balanceSheet'
echo ""

# Test 13: Calculate Tax
echo -e "${YELLOW}13. Calculating tax for current period...${NC}"
CURRENT_PERIOD=$(date +%Y-%m)
curl -s -X GET "$BASE_URL/api/accounting/tax/calculate/$CURRENT_PERIOD?taxRate=18" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}All tests completed!${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Summary:"
echo "- Medicine Created: $MEDICINE_ID"
echo "- Supplier Created: $SUPPLIER_ID"
echo "- Invoice Created: $INVOICE_ID"
echo ""
echo "Check the responses above for any errors."
