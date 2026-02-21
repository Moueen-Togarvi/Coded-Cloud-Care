// Debug script for pharmacy bulk checkout transaction
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const schemas = require('./src/models/tenantSchemas');

async function testTransaction() {
    await mongoose.connect(process.env.MONGO_URI);
    const user = await User.findOne({ isActive: true });
    if (!user) {
        console.log("No active user found!");
        process.exit(1);
    }

    // Get tenant db connected
    const tenantConnection = mongoose.connection;
    const Inventory = tenantConnection.models.Inventory || tenantConnection.model('Inventory', schemas.inventorySchema);
    const Sale = tenantConnection.models.Sale || tenantConnection.model('Sale', schemas.saleSchema);
    const StockMovement = tenantConnection.models.StockMovement || tenantConnection.model('StockMovement', schemas.stockMovementSchema);
    const Revenue = tenantConnection.models.Revenue || tenantConnection.model('Revenue', schemas.revenueSchema);

    // Get any inventory item
    let med = await Inventory.findOne({ isActive: true, quantity: { $gt: 0 } });
    if (!med) {
        // create a dummy inventory item
        med = new Inventory({
            tenantId: user._id,
            name: "Test Med",
            costPrice: 50,
            sellingPrice: 100,
            quantity: 10,
            status: 'active'
        });
        await med.save();
    }

    // Ensure we have a valid reference ObjectId
    const saleId = new mongoose.Types.ObjectId();

    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const newSale = new Sale({
                _id: saleId,
                tenantId: user._id,
                medicineId: med._id,
                medicineName: med.name,
                quantity: 1,
                unitPrice: med.sellingPrice,
                costPrice: med.costPrice,
                totalAmount: med.sellingPrice,
                profit: med.sellingPrice - med.costPrice,
                paymentMethod: 'cash',
                invoiceNumber: 'TEST-123'
            });
            await newSale.save({ session });

            const stockMovement = new StockMovement({
                tenantId: user._id,
                medicineId: med._id,
                medicineName: med.name,
                type: 'sale',
                quantity: -1,
                previousStock: 10,
                newStock: 9,
                referenceId: newSale._id,
                referenceType: 'Sale'
            });
            await stockMovement.save({ session });

            if (Revenue) {
                const rev = new Revenue({
                    tenantId: user._id,
                    source: 'pharmacy-sales',
                    amount: med.sellingPrice,
                    category: 'Sales',
                    description: 'Test Sale',
                    referenceType: 'Sale',
                    referenceId: newSale._id,
                    paymentMethod: 'cash'
                });
                await rev.save({ session });
            }
        });
        console.log("Transaction SUCCESS");
    } catch (e) {
        console.error("TRANS ERROR", e, e.stack);
    }

    session.endSession();
    mongoose.connection.close();
}

testTransaction();
