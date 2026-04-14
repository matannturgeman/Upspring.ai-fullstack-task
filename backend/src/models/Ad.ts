import mongoose from 'mongoose'

export interface IAd {
  brandId: mongoose.Types.ObjectId
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
  rawData?: unknown
}

const AdSchema = new mongoose.Schema<IAd>({
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

export default mongoose.model<IAd>('Ad', AdSchema)
