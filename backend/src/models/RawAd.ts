import mongoose from 'mongoose'

export interface IRawAd {
  brandId: mongoose.Types.ObjectId
  scraper: string
  scrapedAt: Date
  rawData: unknown
}

const RawAdSchema = new mongoose.Schema<IRawAd>(
  {
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
    scraper: { type: String, required: true },
    scrapedAt: { type: Date, default: Date.now },
    rawData: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { timestamps: false }
)

export default (mongoose.models.RawAd as mongoose.Model<IRawAd>) ??
  mongoose.model<IRawAd>('RawAd', RawAdSchema)
