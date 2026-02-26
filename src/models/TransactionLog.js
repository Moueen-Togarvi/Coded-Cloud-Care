const mongoose = require('mongoose');

const transactionLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true
    },
    type: {
        type: String,
        enum: ['PAYFAST_INITIATE', 'PAYFAST_IPN', 'PAYFAST_TOKEN_REQUEST'],
        required: true,
        index: true
    },
    internalOrderId: {
        type: String,
        index: true
    },
    basketId: {
        type: String,
        index: true
    },
    payload: {
        type: mongoose.Schema.Types.Mixed
    },
    response: {
        type: mongoose.Schema.Types.Mixed
    },
    status: {
        type: String,
        index: true
    },
    message: String,
    ipAddress: String,
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    }
}, { timestamps: true });

const TransactionLog = mongoose.model('TransactionLog', transactionLogSchema);

module.exports = TransactionLog;
