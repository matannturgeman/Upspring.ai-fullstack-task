import mongoose = require('mongoose')

type MongoId = unknown

const SchemaTypes = mongoose.Schema as any
const ObjectIdType = SchemaTypes.Types.ObjectId
const MixedType = SchemaTypes.Types.Mixed

export interface IAd {
  brandId: MongoId
  rawAdId: MongoId
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
    brandId: { type: ObjectIdType, ref: 'Brand', required: true, index: true },
    rawAdId: { type: ObjectIdType, ref: 'RawAd', required: true },
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
    performanceData: { type: MixedType, default: null },
  },
  { timestamps: true },
)

export default (mongoose.models.Ad as any) ?? mongoose.model<IAd>('Ad', AdSchema)
