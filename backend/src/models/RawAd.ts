import mongoose = require('mongoose')

type MongoId = unknown

const SchemaTypes = mongoose.Schema as any
const ObjectIdType = SchemaTypes.Types.ObjectId
const MixedType = SchemaTypes.Types.Mixed

export interface IRawAd {
  brandId: MongoId
  scraper: string
  scrapedAt: Date
  rawData: unknown
}

const RawAdSchema = new mongoose.Schema<IRawAd>(
  {
    brandId: { type: ObjectIdType, ref: 'Brand', required: true, index: true },
    scraper: { type: String, required: true },
    scrapedAt: { type: Date, default: Date.now },
    rawData: { type: MixedType, required: true },
  },
  { timestamps: false },
)

export default (mongoose.models.RawAd as any) ?? mongoose.model<IRawAd>('RawAd', RawAdSchema)
