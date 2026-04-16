import { Router } from 'express'
import { analysisController } from '../container.ts'

const router = Router()

router.post('/', analysisController.streamAnalysis)

export default router
