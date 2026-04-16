import mongoose from 'mongoose'

export interface IAd {
  brandId: mongoose.Types.ObjectId
  rawAdId: mongoose.Types.ObjectId
  extractionMethod: 'code' | 'ai'
  adId?: string
  platform: string
  headline?: string
  primaryText?: string
  imageUrl?: string
  videoUrl?: string
  thumbnailUrl?: string
  startDate?: Date
  status: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN'
  performanceData: null
}

const AdSchema = new mongoose.Schema<IAd>(
  {
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
    rawAdId: { type: mongoose.Schema.Types.ObjectId, ref: 'RawAd', required: true },
    extractionMethod: { type: String, enum: ['code', 'ai'], required: true },
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
  },
  { timestamps: true }
)

export default (mongoose.models.Ad as mongoose.Model<IAd>) ??
  mongoose.model<IAd>('Ad', AdSchema)
