import { Router } from 'express'
import { competitorsController } from '../container.ts'

const router = Router()

router.post('/find', competitorsController.findCompetitors)

export default router
