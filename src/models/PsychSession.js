const mongoose = require('mongoose');

const psychSessionSchema = new mongoose.Schema(
    {
        tenantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        psychologist_id: { type: String, required: true },
        date: { type: Date, required: true },
        time_slot: { type: String, default: '' },
        patient_ids: [{ type: String }],
        title: { type: String, default: '' },
        note: { type: String, default: null },
        note_detail: {
            issue: String,
            intervention: String,
            response: String,
        },
        note_author: { type: String, default: '' },
        note_at: { type: Date, default: null },
        created_by: { type: String },
    },
    { timestamps: true }
);

module.exports = mongoose.model('PsychSession', psychSessionSchema);
