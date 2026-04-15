import mongoose from 'mongoose'

export interface ISearchSession {
  brandId?: mongoose.Types.ObjectId
  query?: string
  status: 'pending' | 'fetching' | 'done' | 'error'
  errorMessage?: string
  adsFound: number
}

const SearchSessionSchema = new mongoose.Schema<ISearchSession>({
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' },
  query: String,
  status: { type: String, enum: ['pending', 'fetching', 'done', 'error'], default: 'pending' },
  errorMessage: String,
  adsFound: { type: Number, default: 0 },
}, { timestamps: true })

SearchSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 })

export default mongoose.model<ISearchSession>('SearchSession', SearchSessionSchema)
