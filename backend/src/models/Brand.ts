import mongoose from 'mongoose'

export interface ICompetitor {
  name: string
  reason: string
}

export interface IBrand {
  name: string
  normalizedName: string
  lastFetched: Date
  adCount: number
  competitors: ICompetitor[]
  competitorsFetchedAt?: Date
}

const BrandSchema = new mongoose.Schema<IBrand>(
  {
    name: { type: String, required: true, index: true },
    normalizedName: { type: String, required: true, index: true, unique: true },
    lastFetched: { type: Date, default: Date.now },
    adCount: { type: Number, default: 0 },
    competitors: [{ name: String, reason: String }],
    competitorsFetchedAt: { type: Date },
  },
  { timestamps: true },
)

export default (mongoose.models.Brand as mongoose.Model<IBrand>) ??
  mongoose.model<IBrand>('Brand', BrandSchema)
