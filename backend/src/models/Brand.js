import mongoose from 'mongoose'

const BrandSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  normalizedName: { type: String, required: true, index: true },
  lastFetched: { type: Date, default: Date.now },
  adCount: { type: Number, default: 0 },
  competitors: [{ name: String, reason: String }],
}, { timestamps: true })

BrandSchema.index({ lastFetched: 1 }, { expireAfterSeconds: 3600 })

export default mongoose.model('Brand', BrandSchema)
