import { Router } from 'express'
import { adsController } from '../container'

const router = Router()

router.get('/', adsController.getAds)
router.get('/:brandId', adsController.getAdsByBrand)

export default router
