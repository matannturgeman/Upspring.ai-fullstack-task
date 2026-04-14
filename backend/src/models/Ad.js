import mongoose from 'mongoose'

const AdSchema = new mongoose.Schema({
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
  adId: { type: String, index: true },
  platform: { type: String, default: 'Facebook/Instagram' },
  headline: String,
  primaryText: String,
  imageUrl: String,
  videoUrl: String,
  thumbnailUrl: String,
  startDate: Date,
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'UNKNOWN'], default: 'UNKNOWN' },
  performanceData: { type: mongoose.Schema.Types.Mixed, default: null },
  rawData: mongoose.Schema.Types.Mixed,
}, { timestamps: true })

export default mongoose.model('Ad', AdSchema)
