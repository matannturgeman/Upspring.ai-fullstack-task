import mongoose = require('mongoose')

type MongoId = unknown

const SchemaTypes = mongoose.Schema as any
const ObjectIdType = SchemaTypes.Types.ObjectId

export interface ISearchSession {
  brandId?: MongoId
  query?: string
  status: 'pending' | 'fetching' | 'done' | 'error'
  errorMessage?: string
  adsFound: number
}

const SearchSessionSchema = new mongoose.Schema<ISearchSession>(
  {
    brandId: { type: ObjectIdType, ref: 'Brand' },
    query: String,
    status: { type: String, enum: ['pending', 'fetching', 'done', 'error'], default: 'pending' },
    errorMessage: String,
    adsFound: { type: Number, default: 0 },
  },
  { timestamps: true },
)

SearchSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 })

export default (mongoose.models.SearchSession as any) ??
  mongoose.model<ISearchSession>('SearchSession', SearchSessionSchema)
