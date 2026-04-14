import mongoose from 'mongoose'

const SearchSessionSchema = new mongoose.Schema({
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' },
  query: String,
  status: { type: String, enum: ['pending', 'fetching', 'done', 'error'], default: 'pending' },
  errorMessage: String,
  adsFound: { type: Number, default: 0 },
}, { timestamps: true })

export default mongoose.model('SearchSession', SearchSessionSchema)
