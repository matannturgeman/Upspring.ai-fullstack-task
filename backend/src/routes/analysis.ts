import { Router } from 'express'
import { analysisController } from '../container'

const router = Router()

router.post('/', analysisController.streamAnalysis)
router.post('/chat', analysisController.streamChat)

export default router
